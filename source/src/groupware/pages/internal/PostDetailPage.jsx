import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import BoardDocumentRenderer from '../../components/editor/BoardDocumentRenderer.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { deleteBoardAttachment, deleteBoardComment, deleteBoardPost, getAttachmentDownloadUrl, getBoardOverview, getBoardPost, getBoardReactions, saveBoardComment, toggleBoardReaction, uploadBoardAttachment } from '../../services/boardService.js';
import { legacyTextToDocument } from '../../utils/boardDocument.js';

// 팝업 안에서도 쓰기 위해 라우트 파라미터 대신 props 로도 받을 수 있게 한다.
// onBack 이 있으면 목록으로 돌아가는 동작을 그 함수에 맡긴다(팝업 안 전환).
export default function PostDetailPage({ boardSlug: boardSlugProp, postId: postIdProp, embedded = false, onBack = null }) {
  const routeParams = useParams();
  const boardSlug = boardSlugProp ?? routeParams.boardSlug;
  const postId = postIdProp ?? routeParams.postId;
  const navigate = useNavigate(); const auth = useAuth();
  const goToList = () => (onBack ? onBack() : navigate(`/boards/${boardSlug}`));
  const [data, setData] = useState(null); const [overview, setOverview] = useState(null); const [reactions, setReactions] = useState({ counts: {}, mine: [] }); const [error, setError] = useState(''); const [actionError, setActionError] = useState(''); const [replyTo, setReplyTo] = useState(null); const [editingComment, setEditingComment] = useState(null); const [commentStatus, setCommentStatus] = useState(''); const [commentSaving, setCommentSaving] = useState(false);
  const load = () => Promise.all([getBoardPost(postId), getBoardOverview(boardSlug), getBoardReactions(postId).catch(() => ({ counts: {}, mine: [] }))]).then(([postData, boardData, reactionData]) => { setData(postData); setOverview(boardData); setReactions(reactionData); setError(''); }).catch(() => setError('게시글을 볼 권한이 없거나 글을 찾을 수 없습니다.'));
  useEffect(() => { load(); }, [boardSlug, postId]);
  if (error) return <div className="gw-route-state"><div className="gw-notice gw-notice--warning" role="alert">{error}<br />{onBack
    ? <button type="button" className="gw-secondary-button" onClick={goToList}>목록 보기</button>
    : <Link to="/boards">게시판으로</Link>}</div></div>;
  if (!data || !overview) return <p className="gw-empty-state">게시글을 불러오고 있습니다.</p>;
  // 댓글·첨부파일 같은 부분 작업이 실패해도 글 전체를 에러 화면으로 덮지 않고,
  // 화면 상단에 알림만 띄운다.
  const submitComment = async (event) => {
    event.preventDefault();
    // form 요소를 await 전에 잡아 둔다. React 는 핸들러가 끝나면 currentTarget 을
    // 비우므로, await 뒤에 event.currentTarget 을 쓰면 null 이라 예외가 난다.
    // 그러면 댓글은 이미 저장됐는데 화면에는 실패로 뜨고, 사용자가 다시 눌러
    // 같은 댓글이 여러 번 등록된다(실제로 그렇게 8개가 쌓였다).
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setCommentSaving(true); setCommentStatus('');
    try {
      setActionError('');
      const wasEditing = Boolean(editingComment);
      await saveBoardComment({ id: editingComment?.id, postId, parentCommentId: editingComment ? editingComment.parent_comment_id : replyTo, content: form.get('content'), isAnonymous: editingComment ? false : form.get('anonymous') === 'on' });
      formElement.reset(); setReplyTo(null); setEditingComment(null);
      await load();
      setCommentStatus(wasEditing ? '댓글을 수정했습니다.' : '댓글을 등록했습니다.');
    } catch (cause) { setActionError(cause.message || '댓글을 저장하지 못했습니다.'); }
    finally { setCommentSaving(false); }
  };
  const upload = async (event) => { const file = event.target.files?.[0]; if (!file) return; try { setActionError(''); await uploadBoardAttachment({ boardId: data.post.board_id, postId, file, userId: auth.user.id, maxSizeMb: overview.board.settings.max_file_size_mb }); load(); } catch (uploadError) { setActionError(uploadError.message); } event.target.value = ''; };
  const generalAttachments = data.attachments.filter((item) => item.purpose !== 'inline_image');
  const documentValue = data.post.content_document?.type === 'doc' ? data.post.content_document : legacyTextToDocument(data.post.content);
  const authorMeta = [data.post.author_name, overview.board.settings.show_author_department && data.post.author_department, overview.board.settings.show_author_position && data.post.author_position, overview.board.settings.show_author_job_title && data.post.author_job_title].filter(Boolean).join(' · ');
  return <article className={embedded ? 'gw-page gw-page--embedded' : 'gw-page'} aria-labelledby="post-title"><header className="gw-post-header"><div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}><button type="button" className="gw-back-icon-button" onClick={goToList} aria-label="게시판으로"><svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg></button><div><span>{data.post.is_notice ? '공지' : overview.board.board_type === 'discussion' ? '대화' : '게시글'}</span><h1 id="post-title">{data.post.title}</h1><p>{authorMeta} · {new Date(data.post.created_at).toLocaleString('ko-KR')}{overview.board.settings.show_views !== false ? ` · 조회 ${data.post.view_count}` : ''}</p></div></div>{/* 상단 "목록 보기"는 좌측 뒤로가기 화살표, 하단 목록 버튼과 기능이 겹쳐
    제거했다. 헤더는 이 글에 대한 동작(수정·삭제)만 남긴다. */}
<div className="gw-admin-actions">{data.post.can_edit && <Link className="gw-secondary-button" to={`/boards/${boardSlug}/posts/${postId}/edit`}>수정</Link>}{data.post.can_delete && <button className="gw-secondary-button gw-secondary-button--danger" type="button" onClick={async () => { if (window.confirm('이 게시글을 삭제하시겠습니까?')) { await deleteBoardPost(postId); goToList(); } }}>삭제</button>}</div></header><section className="gw-post-content"><BoardDocumentRenderer documentValue={documentValue} attachments={data.attachments} /></section>
    {actionError && <div className="gw-notice gw-notice--warning" role="alert">{actionError}</div>}
    {overview.board.settings.allow_reactions && <section className="gw-reactions" aria-label="게시글 반응">{[['like','좋아요'],['helpful','도움돼요'],['support','응원해요']].map(([type, label]) => <button key={type} type="button" aria-pressed={reactions.mine.includes(type)} onClick={async () => setReactions(await toggleBoardReaction(postId, type))}>{label} {reactions.counts[type] ?? 0}</button>)}</section>}
    {overview.board.settings.allow_attachments && <section className="gw-attachment-section"><h2>첨부파일</h2><div className="gw-attachment-list">{generalAttachments.map((item) => <div key={item.id}><button type="button" onClick={async () => { try { setActionError(''); window.open(await getAttachmentDownloadUrl(item.id), '_blank', 'noopener'); } catch (downloadError) { setActionError(downloadError.message); } }}>{item.original_name} <span>{Math.ceil(item.file_size / 1024)}KB</span></button>{data.post.can_edit && <button type="button" onClick={async () => { try { setActionError(''); await deleteBoardAttachment(item.id); load(); } catch (deleteError) { setActionError(deleteError.message); } }} aria-label={`${item.original_name} 삭제`}>삭제</button>}</div>)}</div>{generalAttachments.length === 0 && <p className="gw-empty-state">첨부파일이 없습니다.</p>}{overview.permissions.upload && <label className="gw-file-button">파일 첨부<input type="file" onChange={upload} /></label>}</section>}
    {overview.board.settings.allow_comments && <section className="gw-comments"><h2>댓글</h2>{data.comments.map((comment) => <article key={comment.id} className={comment.parent_comment_id ? 'is-reply' : ''}><header><strong>{comment.author_name}</strong><time>{new Date(comment.created_at).toLocaleString('ko-KR')}</time></header><p>{comment.content}</p><div>{overview.permissions.comment && overview.board.settings.allow_replies && <button type="button" onClick={() => { setEditingComment(null); setReplyTo(comment.id); }}>답글</button>}{comment.can_edit && <button type="button" onClick={() => { setReplyTo(null); setEditingComment(comment); }}>수정</button>}{comment.can_delete && <button type="button" onClick={async () => { if (window.confirm('댓글을 삭제하시겠습니까?')) { await deleteBoardComment(comment.id); load(); } }}>삭제</button>}</div></article>)}{overview.permissions.comment && <form className="gw-comment-form" key={editingComment?.id ?? replyTo ?? 'new'} onSubmit={submitComment}><label className="gw-field"><span>{editingComment ? '댓글 수정' : replyTo ? '답글' : '댓글'}</span><textarea name="content" required defaultValue={editingComment?.content ?? ''} onChange={() => setCommentStatus('')} /></label>{!editingComment && overview.board.settings.allow_anonymous && <label><input type="checkbox" name="anonymous" /> 익명</label>}<div className="gw-admin-actions"><button className="gw-primary-button" type="submit" disabled={commentSaving}>{commentSaving ? '저장 중…' : editingComment ? '수정 저장' : '등록'}</button>{(editingComment || replyTo) && <button className="gw-secondary-button" type="button" onClick={() => { setEditingComment(null); setReplyTo(null); setCommentStatus(''); }} disabled={commentSaving}>취소</button>}</div>{commentStatus && <p className="gw-form-status" role="status">{commentStatus}</p>}</form>}</section>}
    <div className="gw-admin-actions" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>{onBack
      ? <button type="button" className="gw-secondary-button" onClick={goToList}>목록 보기</button>
      : <Link className="gw-secondary-button" to={`/boards/${boardSlug}`}>목록 보기</Link>}</div>
  </article>;
}
