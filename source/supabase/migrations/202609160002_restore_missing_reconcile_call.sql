begin;

-- 버그(진짜 원인): 원격 DB에 배포되어 있던 save_board_post 함수 본문에서
-- reconcile_board_inline_images(...) 호출이 통째로 빠져 있었다(이 저장소의
-- 202607310003_board_inline_images.sql 에는 있는데, 실제 원격 함수 정의에는
-- 없었다 - 마이그레이션 파일 밖에서 손으로 적용된 적이 있었던 것으로 보인다).
--
-- 그 결과, "게시" 눌러 글을 발행해도 본문에 올린 이미지(inlineImage)는
-- register_inline_board_image 가 만들어 둔 lifecycle_status='pending' 그대로
-- 남아 절대 'active' 로 바뀌지 않았다. get_board_post/get_board_posts 등은
-- 전부 lifecycle_status='active' 인 첨부만 보여 주므로, 글은 발행되어도 본문
-- 이미지는 "이미지를 표시할 수 없습니다"로 영원히 깨져 보였다(202609160001 에서
-- 고친 attachment_view 권한 문제와는 별개의, 더 근본적인 원인).
--
-- 고쳐서: save_board_post 끝에 reconcile_board_inline_images 호출을 되살린다
-- (이 저장소 마이그레이션이 원래 정의한 그대로). 이미 이 버그로 발행 시점에
-- 반영되지 못한 기존 글은 새로 글을 고쳐 저장하기 전까지는 여전히 깨진 채로
-- 남으므로, 아래에서 한 번만 일괄 보정한다.

create or replace function public.save_board_post(
  p_post_id uuid,p_board_id uuid,p_title text,p_content_document jsonb,p_category_id uuid,p_post_prefix text,
  p_is_anonymous boolean,p_is_notice boolean,p_is_important boolean,p_is_pinned boolean,p_status text default 'published',p_cover_attachment_id uuid default null
)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare result_id uuid; existing public.board_posts; settings jsonb; before_data jsonb; after_data jsonb; clean_title text; plain_content text;
begin
  if p_status not in ('draft','published') then raise exception 'invalid_post_status' using errcode='22023'; end if;
  clean_title:=btrim(coalesce(p_title,''));
  if clean_title='' and p_status='published' then raise exception 'post_title_required' using errcode='22023'; end if;
  if clean_title='' then clean_title:='(제목 없음)'; end if;
  if char_length(clean_title)>240 then raise exception 'post_title_too_long' using errcode='22023'; end if;
  perform public.validate_board_document(p_content_document);
  plain_content:=public.extract_board_document_text(p_content_document);
  if p_status='published' and btrim(plain_content)='' and not exists(
    with recursive nodes(node) as (
      select p_content_document
      union all
      select child.value from nodes parent cross join lateral jsonb_array_elements(case when jsonb_typeof(parent.node->'content')='array' then parent.node->'content' else '[]'::jsonb end) child
    ) select 1 from nodes where node->>'type' in ('inlineImage', 'externalImage', 'youtubeEmbed')
  ) then raise exception 'post_content_required' using errcode='22023'; end if;
  if p_post_id is null then
    if not public.can_access_board(p_board_id,'post_create') then raise exception 'post_create_denied' using errcode='42501'; end if;
    if p_category_id is not null and not exists(select 1 from public.board_categories c where c.id=p_category_id and c.board_id=p_board_id and c.is_active) then raise exception 'invalid_category' using errcode='22023'; end if;
    select b.settings into settings from public.boards b where id=p_board_id;
    if p_is_anonymous and not coalesce((settings->>'allow_anonymous')::boolean,false) then raise exception 'anonymous_not_allowed' using errcode='42501'; end if;
    if (p_is_notice or p_is_important) and not public.can_access_board(p_board_id,'notice_manage') then raise exception 'notice_manage_denied' using errcode='42501'; end if;
    if p_is_pinned and not public.can_access_board(p_board_id,'pin_manage') then raise exception 'pin_manage_denied' using errcode='42501'; end if;
    insert into public.board_posts(board_id,category_id,author_user_id,title,content,content_document,post_prefix,is_anonymous,is_notice,is_important,is_pinned,status,published_at)
    values(p_board_id,p_category_id,auth.uid(),clean_title,plain_content,p_content_document,nullif(btrim(p_post_prefix),''),coalesce(p_is_anonymous,false),coalesce(p_is_notice,false),coalesce(p_is_important,false),coalesce(p_is_pinned,false),p_status,case when p_status='published' then now() end) returning id into result_id;
  else
    select * into existing from public.board_posts where id=p_post_id for update;
    if existing.id is null or existing.board_id<>p_board_id or not public.can_edit_board_post_for_attachment(existing.id) then raise exception 'post_update_denied' using errcode='42501'; end if;
    if p_category_id is not null and not exists(select 1 from public.board_categories c where c.id=p_category_id and c.board_id=existing.board_id and c.is_active) then raise exception 'invalid_category' using errcode='22023'; end if;
    select b.settings into settings from public.boards b where id=existing.board_id;
    if p_is_anonymous and not coalesce((settings->>'allow_anonymous')::boolean,false) then raise exception 'anonymous_not_allowed' using errcode='42501'; end if;
    select to_jsonb(existing) into before_data;
    update public.board_posts set category_id=p_category_id,title=clean_title,content=plain_content,content_document=p_content_document,
      post_prefix=nullif(btrim(p_post_prefix),''),is_anonymous=coalesce(p_is_anonymous,false),
      is_notice=case when public.can_access_board(existing.board_id,'notice_manage') then coalesce(p_is_notice,false) else existing.is_notice end,
      is_important=case when public.can_access_board(existing.board_id,'notice_manage') then coalesce(p_is_important,false) else existing.is_important end,
      is_pinned=case when public.can_access_board(existing.board_id,'pin_manage') then coalesce(p_is_pinned,false) else existing.is_pinned end,
      status=p_status,published_at=case when p_status='published' then coalesce(existing.published_at,now()) else existing.published_at end,edited_at=now()
    where id=p_post_id returning id into result_id;
    if existing.author_user_id<>auth.uid() then
      select to_jsonb(p) into after_data from public.board_posts p where p.id=result_id;
      insert into public.audit_logs(actor_user_id,action,target_type,target_id,before_data,after_data) values(auth.uid(),'board.post.admin_updated','board_post',result_id::text,before_data,after_data);
    end if;
  end if;
  perform public.reconcile_board_inline_images(result_id,p_content_document,p_cover_attachment_id);
  return result_id;
end;
$$;

-- 이미 발행됐지만 위 버그 때문에 pending/cleanup_candidate 로 남은 본문 이미지를
-- 지금 본문이 실제로 가리키는 것만 골라 한 번에 활성화한다. reconcile_board_inline_images
-- 와 똑같은 로직이되, auth.uid() 기반 글쓰기 권한 검사는 이 보정 목적에 맞지 않아
-- 뺐다(이미 발행된 글의 본문이 실제로 가리키는 첨부만 건드리므로 권한과 무관하게 안전하다).
do $$
declare
  post_row record;
  image_row record;
  image_ids uuid[];
  resolved_cover uuid;
begin
  for post_row in
    select p.id, p.board_id, p.content_document, p.cover_attachment_id
    from public.board_posts p
    where p.deleted_at is null and p.status='published'
      and exists(
        select 1 from public.board_attachments a
        where a.post_id=p.id and a.purpose='inline_image' and a.deleted_at is null and a.lifecycle_status<>'active'
          and a.id::text in (
            select (n->'attrs'->>'attachmentId')
            from jsonb_path_query(coalesce(p.content_document,'{}'::jsonb), '$.**?(@.type=="inlineImage")') n
          )
      )
  loop
    image_ids := '{}'::uuid[];

    for image_row in
      with recursive nodes(node, sequence) as (
        select post_row.content_document, ''::text
        union all
        select child.value, nodes.sequence || lpad(child.ordinality::text,6,'0')
        from nodes
        cross join lateral jsonb_array_elements(case when jsonb_typeof(nodes.node->'content')='array' then nodes.node->'content' else '[]'::jsonb end) with ordinality child(value, ordinality)
      )
      select (node->'attrs'->>'attachmentId')::uuid attachment_id,
        coalesce(node->'attrs'->>'alt','') alt_text,
        nullif(btrim(coalesce(node->'attrs'->>'caption','')),'') caption,
        coalesce(node->'attrs'->>'alignment','center') alignment,
        coalesce(node->'attrs'->>'size','medium') display_size,
        nullif(node->'attrs'->>'width','')::integer display_width,
        row_number() over (order by sequence)::integer sort_order
      from nodes where node->>'type'='inlineImage'
      order by sequence
    loop
      if exists(
        select 1 from public.board_attachments a
        where a.id=image_row.attachment_id and a.post_id=post_row.id and a.board_id=post_row.board_id
          and a.purpose='inline_image' and a.deleted_at is null and a.lifecycle_status in ('pending','active','cleanup_candidate')
      ) then
        image_ids := array_append(image_ids, image_row.attachment_id);
        update public.board_attachments set
          lifecycle_status='active', cleanup_after=null, removed_at=null,
          alt_text=image_row.alt_text, caption=image_row.caption, alignment=image_row.alignment,
          display_size=image_row.display_size, display_width=image_row.display_width, sort_order=image_row.sort_order
        where id=image_row.attachment_id;
      end if;
    end loop;

    if post_row.cover_attachment_id is not null and post_row.cover_attachment_id=any(image_ids) then
      resolved_cover := post_row.cover_attachment_id;
    elsif exists(select 1 from public.boards b where b.id=post_row.board_id and b.board_type='gallery') and array_length(image_ids,1)>0 then
      resolved_cover := image_ids[1];
    else
      resolved_cover := post_row.cover_attachment_id;
    end if;

    update public.board_posts set cover_attachment_id=resolved_cover,
      attachment_count=(select count(*) from public.board_attachments a where a.post_id=post_row.id and a.deleted_at is null and a.lifecycle_status='active')
    where id=post_row.id;
  end loop;
end $$;

commit;
