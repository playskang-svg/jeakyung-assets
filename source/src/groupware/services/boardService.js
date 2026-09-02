import { requireSupabase } from '../lib/supabase.js';

const BUCKET = 'groupware-board-attachments';
const SAFE_FILE = /[^a-zA-Z0-9._-]+/g;
const BLOCKED_EXTENSIONS = /\.(exe|dll|bat|cmd|com|scr|msi|js|jar|sh|ps1)$/i;

export const BOARD_CATALOG_CHANGED_EVENT = 'groupware:boards-changed';
export const notifyBoardCatalogChanged = () => window.dispatchEvent(new CustomEvent(BOARD_CATALOG_CHANGED_EVENT));

async function rpc(name, params = {}) {
  const { data, error } = await requireSupabase().rpc(name, params);
  if (error) throw error;
  return data;
}

export const getVisibleBoards = () => rpc('get_my_visible_boards').then((data) => data ?? []);
export const getBoardOverview = (slug) => rpc('get_board_overview', { p_slug: slug });
export const getBoardPosts = (slug, { search = '', category = null, page = 1, scope = 'all' } = {}) => rpc('get_board_posts', { p_slug: slug, p_search: search || null, p_category: category, p_page: page, p_scope: scope });
export const getBoardPost = (postId) => rpc('get_board_post', { p_post_id: postId });
export const createBoardPostDraft = (boardId) => rpc('create_board_post_draft', { p_board_id: boardId });
export const saveBoardPost = (post) => rpc('save_board_post', {
  p_post_id: post.id ?? null,
  p_board_id: post.boardId,
  p_title: post.title,
  p_content_document: post.contentDocument,
  p_category_id: post.categoryId || null,
  p_post_prefix: post.postPrefix || null,
  p_is_anonymous: Boolean(post.isAnonymous),
  p_is_notice: Boolean(post.isNotice),
  p_is_important: Boolean(post.isImportant),
  p_is_pinned: Boolean(post.isPinned),
  p_status: post.status ?? 'published',
  p_cover_attachment_id: post.coverAttachmentId ?? null,
});
export const deleteBoardPost = (postId) => rpc('delete_board_post', { p_post_id: postId });
export const saveBoardComment = (comment) => rpc('save_board_comment', {
  p_comment_id: comment.id ?? null,
  p_post_id: comment.postId,
  p_parent_comment_id: comment.parentCommentId ?? null,
  p_content: comment.content,
  p_is_anonymous: Boolean(comment.isAnonymous),
});
export const deleteBoardComment = (commentId) => rpc('delete_board_comment', { p_comment_id: commentId });
export const getBoardAdminCatalog = () => rpc('get_board_admin_catalog').then((data) => data ?? { groups: [], boards: [] });
export const saveBoardDefinition = (board, rules, categories, managers = []) => rpc('manage_board', { p_board: board, p_rules: rules, p_categories: categories, p_managers: managers });
export const saveBoardGroup = (group) => rpc('manage_board_group', { p_group: group });
export const previewBoardPermissions = (boardId, userId) => rpc('preview_board_permissions', { p_board_id: boardId, p_user_id: userId });
export const deleteOrArchiveBoard = (boardId) => rpc('delete_or_archive_board', { p_board_id: boardId });
export const getBoardReactions = (postId) => rpc('get_board_reactions', { p_post_id: postId });
export const toggleBoardReaction = (postId, reactionType = 'like') => rpc('toggle_board_reaction', { p_post_id: postId, p_reaction_type: reactionType });
export const deleteBoardAttachment = (attachmentId) => rpc('delete_board_attachment', { p_attachment_id: attachmentId });

// DB·저장소가 돌려주는 코드는 그대로 보여 주면 무슨 뜻인지 알 수 없다.
// ("new row violates row-level security policy" 같은 것) 사람이 읽고 다음에
// 무엇을 해야 할지 알 수 있는 말로 바꾼다.
const UPLOAD_ERROR_MESSAGES = {
  attachment_upload_denied: '이 글에 파일을 올릴 권한이 없습니다.',
  attachments_disabled: '이 게시판은 첨부파일을 받지 않습니다.',
  attachment_size_exceeded: '파일 하나의 크기 제한을 넘었습니다.',
  attachment_total_size_exceeded: '이 글의 첨부파일 용량 합계 제한을 넘었습니다. 다른 첨부를 지운 뒤 다시 올려 주세요.',
  attachment_type_blocked: '보안상 허용되지 않는 파일 형식입니다.',
  storage_object_not_owned: '업로드가 끝나기 전에 등록을 시도했습니다. 잠시 뒤 다시 시도해 주세요.',
  storage_metadata_mismatch: '업로드된 파일 정보가 맞지 않습니다. 다시 올려 주세요.',
  invalid_storage_path: '파일 경로가 올바르지 않습니다. 새로고침 후 다시 시도해 주세요.',
  attachment_delete_denied: '이 첨부파일을 삭제할 권한이 없습니다.',
};

function describeUploadError(error) {
  const raw = error?.message ?? '';
  for (const [code, message] of Object.entries(UPLOAD_ERROR_MESSAGES)) {
    if (raw.includes(code)) return new Error(message);
  }
  // 저장소 정책에 막히면 위 코드가 아니라 RLS 문구가 온다. 이 경우 대부분
  // 용량 합계나 게시판 설정에 걸린 것이므로 그쪽을 짚어 준다.
  if (/row-level security|violates|403/i.test(raw)) {
    return new Error('파일을 올릴 수 없습니다. 첨부 용량 합계 제한에 걸렸거나 게시판 설정이 막고 있습니다.');
  }
  return error;
}

export async function uploadBoardAttachment({ boardId, postId, file, userId, maxSizeMb = 20 }) {
  const safeLimitMb = Math.min(Math.max(Number(maxSizeMb) || 20, 1), 20);
  if (file.size > safeLimitMb * 1024 * 1024) throw new Error(`첨부파일은 ${safeLimitMb}MB 이하여야 합니다.`);
  if (BLOCKED_EXTENSIONS.test(file.name)) throw new Error('보안상 허용되지 않는 파일 형식입니다.');
  const safeName = file.name.normalize('NFKC').replace(SAFE_FILE, '-').replace(/^-+|-+$/g, '') || 'attachment';
  const storagePath = `${boardId}/${userId}/general/${postId}/${crypto.randomUUID()}-${safeName}`;
  const client = requireSupabase();
  const { error: uploadError } = await client.storage.from(BUCKET).upload(storagePath, file, { contentType: file.type || 'application/octet-stream', upsert: false });
  if (uploadError) throw describeUploadError(uploadError);
  try {
    const attachmentId = await rpc('register_board_attachment', {
      p_board_id: boardId,
      p_post_id: postId,
      p_storage_path: storagePath,
      p_original_name: file.name,
      p_mime_type: file.type || 'application/octet-stream',
      p_file_size: file.size,
    });
    return {
      id: attachmentId,
      original_name: file.name,
      mime_type: file.type || 'application/octet-stream',
      file_size: file.size,
      purpose: 'general_attachment',
    };
  } catch (error) {
    await client.storage.from(BUCKET).remove([storagePath]);
    throw describeUploadError(error);
  }
}

export async function uploadInlineBoardImage({ boardId, postId, file, originalName = file.name, replacesAttachmentId = null }) {
  const form = new FormData();
  form.set('board_id', boardId);
  form.set('post_id', postId);
  form.set('original_name', originalName);
  if (replacesAttachmentId) form.set('replaces_attachment_id', replacesAttachmentId);
  form.set('file', file, file.name);
  const { data, error } = await requireSupabase().functions.invoke('board-image-upload', { body: form });
  if (error) {
    // supabase-js's FunctionsHttpError carries only a generic message
    // ("Edge Function returned a non-2xx status code") - the actual
    // { error: "reason" } body we return is on error.context (the raw
    // Response). Without reading it, every failure looks identical
    // regardless of cause.
    const detail = await error.context?.json?.().catch(() => null);
    throw new Error(detail?.error || error.message);
  }
  if (data?.error) throw new Error(data.error);
  if (!data?.attachment?.id) throw new Error('업로드 결과에서 첨부 ID를 확인하지 못했습니다.');
  return data.attachment;
}

async function createAttachmentSignedUrl(attachmentId, download) {
  const metadata = await rpc('get_board_attachment_path', { p_attachment_id: attachmentId });
  const options = download ? { download: metadata.original_name } : undefined;
  const { data, error } = await requireSupabase().storage.from(BUCKET).createSignedUrl(metadata.storage_path, 60, options);
  if (error) throw error;
  return data.signedUrl;
}

export const getAttachmentDownloadUrl = (attachmentId) => createAttachmentSignedUrl(attachmentId, true);
export const getAttachmentViewUrl = (attachmentId) => createAttachmentSignedUrl(attachmentId, false);

export async function getInlineAttachmentUrls(attachments = []) {
  const inlineAttachments = attachments.filter((item) => item.purpose === 'inline_image');
  const results = await Promise.allSettled(inlineAttachments.map(async (item) => [item.id, await getAttachmentViewUrl(item.id)]));
  return Object.fromEntries(results.filter((result) => result.status === 'fulfilled').map((result) => result.value));
}
