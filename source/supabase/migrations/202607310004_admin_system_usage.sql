begin;

create or replace function public.get_admin_system_usage()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  result jsonb;
begin
  if not public.is_membership_admin() then
    raise exception 'membership_admin_required' using errcode = '42501';
  end if;

  with
  member_usage as (
    select
      count(*) as total,
      count(*) filter (where membership_status = 'pending') as pending,
      count(*) filter (where membership_status = 'approved') as approved,
      count(*) filter (where membership_status = 'rejected') as rejected,
      count(*) filter (where membership_status = 'locked') as locked,
      count(*) filter (where membership_status = 'resigned') as resigned
    from public.profiles
  ),
  dashboard_usage as (
    select
      count(*) as widgets_total,
      count(*) filter (where is_active and archived_at is null) as active,
      count(*) filter (where archived_at is not null) as archived
    from public.dashboard_widgets
  ),
  content_usage as (
    select
      (select count(*) from public.boards) as boards_total,
      (select count(*) from public.boards where is_active and archived_at is null) as boards_active,
      (select count(*) from public.boards where archived_at is not null) as boards_archived,
      (select count(*) from public.board_posts) as posts_total,
      (select count(*) from public.board_posts where status = 'published' and deleted_at is null) as posts_published,
      (select count(*) from public.board_posts where status = 'draft' and deleted_at is null) as posts_draft,
      (select count(*) from public.board_posts where status = 'hidden' and deleted_at is null) as posts_hidden,
      (select count(*) from public.board_posts where status = 'deleted' or deleted_at is not null) as posts_deleted,
      (select count(*) from public.board_comments) as comments_total,
      (select count(*) from public.board_comments where deleted_at is not null) as comments_deleted,
      (select count(*) from public.board_reactions) as reactions_total,
      (select count(*) from public.board_post_views where viewed_on >= current_date - 29) as post_views_30d
  ),
  attachment_usage as (
    select
      count(*) as records_total,
      count(*) filter (where deleted_at is not null) as deleted_metadata,
      count(*) filter (where deleted_at is null and lifecycle_status = 'active') as active,
      count(*) filter (where deleted_at is null and lifecycle_status = 'pending') as pending,
      count(*) filter (where deleted_at is null and lifecycle_status = 'cleanup_candidate') as cleanup_candidates,
      count(*) filter (where deleted_at is null and purpose = 'inline_image' and lifecycle_status <> 'cleanup_candidate') as inline_images,
      count(*) filter (where deleted_at is null and purpose = 'general_attachment' and lifecycle_status <> 'cleanup_candidate') as general_files,
      coalesce(sum(file_size) filter (where deleted_at is null), 0) as tracked_bytes,
      coalesce(sum(file_size) filter (where deleted_at is null and lifecycle_status = 'active'), 0) as active_bytes,
      coalesce(sum(file_size) filter (where deleted_at is null and lifecycle_status = 'pending'), 0) as pending_bytes,
      coalesce(sum(file_size) filter (where deleted_at is null and lifecycle_status = 'cleanup_candidate'), 0) as cleanup_bytes,
      count(*) filter (where deleted_at is null and lifecycle_status = 'cleanup_candidate' and cleanup_after <= now()) as due_cleanup_count,
      coalesce(sum(file_size) filter (where deleted_at is null and lifecycle_status = 'cleanup_candidate' and cleanup_after <= now()), 0) as due_cleanup_bytes
    from public.board_attachments
  ),
  storage_usage as (
    select
      count(*) as object_count,
      coalesce(sum(case when (o.metadata ->> 'size') ~ '^[0-9]+$' then (o.metadata ->> 'size')::bigint else 0 end), 0) as object_bytes,
      count(*) filter (where a.id is null) as orphan_object_count,
      coalesce(sum(case when a.id is null and (o.metadata ->> 'size') ~ '^[0-9]+$' then (o.metadata ->> 'size')::bigint else 0 end), 0) as orphan_object_bytes
    from storage.objects o
    left join public.board_attachments a
      on a.storage_path = o.name
     and a.deleted_at is null
    where o.bucket_id = 'groupware-board-attachments'
  ),
  bucket_usage as (
    select public as is_public, file_size_limit, allowed_mime_types
    from storage.buckets
    where id = 'groupware-board-attachments'
  ),
  board_rows as (
    select jsonb_build_object(
      'id', b.id,
      'name', b.name,
      'slug', b.slug,
      'board_type', b.board_type,
      'is_active', b.is_active,
      'archived_at', b.archived_at,
      'posts', count(distinct p.id) filter (where p.status <> 'deleted' and p.deleted_at is null),
      'comments', count(distinct c.id) filter (where c.deleted_at is null),
      'attachments', count(distinct a.id) filter (where a.deleted_at is null and a.lifecycle_status <> 'cleanup_candidate'),
      'attachment_bytes', coalesce((
        select sum(ba.file_size)
        from public.board_attachments ba
        where ba.board_id = b.id
          and ba.deleted_at is null
          and ba.lifecycle_status <> 'cleanup_candidate'
      ), 0),
      'inline_images', count(distinct a.id) filter (where a.deleted_at is null and a.purpose = 'inline_image' and a.lifecycle_status <> 'cleanup_candidate'),
      'general_files', count(distinct a.id) filter (where a.deleted_at is null and a.purpose = 'general_attachment' and a.lifecycle_status <> 'cleanup_candidate'),
      'cleanup_candidates', count(distinct a.id) filter (where a.deleted_at is null and a.lifecycle_status = 'cleanup_candidate'),
      'max_file_size_mb', coalesce(nullif(b.settings ->> 'max_file_size_mb', '')::integer, 20),
      'max_inline_image_size_mb', coalesce(nullif(b.settings ->> 'max_inline_image_size_mb', '')::integer, 10),
      'max_inline_images', coalesce(nullif(b.settings ->> 'max_inline_images', '')::integer, 20),
      'max_total_attachment_mb', coalesce(nullif(b.settings ->> 'max_total_attachment_mb', '')::integer, 50),
      'preserve_image_originals', coalesce((b.settings ->> 'preserve_image_originals')::boolean, false)
    ) as item
    from public.boards b
    left join public.board_posts p on p.board_id = b.id
    left join public.board_comments c on c.board_id = b.id
    left join public.board_attachments a on a.board_id = b.id
    group by b.id
  )
  select jsonb_build_object(
    'generated_at', now(),
    'members', to_jsonb(member_usage),
    'dashboards', to_jsonb(dashboard_usage) || jsonb_build_object(
      'assignments', (select count(*) from public.dashboard_widget_assignments),
      'preferences', (select count(*) from public.user_dashboard_preferences)
    ),
    'content', to_jsonb(content_usage),
    'attachments', to_jsonb(attachment_usage) || to_jsonb(storage_usage) || jsonb_build_object(
      'bucket_public', coalesce(bucket_usage.is_public, false),
      'bucket_file_size_limit', bucket_usage.file_size_limit,
      'allowed_mime_types', coalesce(to_jsonb(bucket_usage.allowed_mime_types), '[]'::jsonb)
    ),
    'boards', coalesce((select jsonb_agg(item order by item ->> 'name') from board_rows), '[]'::jsonb),
    'activity', jsonb_build_object(
      'audit_events_30d', (select count(*) from public.audit_logs where created_at >= now() - interval '30 days'),
      'post_views_30d', content_usage.post_views_30d
    )
  )
  into result
  from member_usage, dashboard_usage, content_usage, attachment_usage, storage_usage
  left join bucket_usage on true;

  return result;
end;
$$;

revoke all on function public.get_admin_system_usage() from public, anon, authenticated;
grant execute on function public.get_admin_system_usage() to authenticated;

commit;
