import { useEffect, useRef, useState } from 'react';
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
  const [data, setData] = useState(null); const [overview, setOverview] = useState(null); const [reactions, setReactions] = useState({ counts: {}, mine: [] }); const [error, setError] = useState(''); const [actionError, setActionError] = useState(''); const [replyTo, setReplyTo] = useState(null); const [editingComment, setEditingComment] = useState(null); const [commentStatus, setCommentStatus] = useState(''); const [commentSaving, setCommentSaving] = useState(false); const [uploading, setUploading] = useState(false); const commentBoxRef = useRef(null);
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
  // 파일 입력은 값이 그대로면 같은 파일을 다시 골라도 change 가 일어나지 않는다.
  // 방금 지운 첨부를 그대로 다시 올리는 것이 정확히 그 경우라, 파일 선택창에서
  // 같은 파일을 골라도 아무 일이 없고 버튼이 죽은 것처럼 보였다. 그래서 값을
  // await 전에 먼저 비운다(글쓰기 화면은 원래 이렇게 하고 있었다).
  const upload = async (event) => {
    const input = event.target;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setUploading(true);
    try {
      setActionError('');
      await uploadBoardAttachment({ boardId: data.post.board_id, postId, file, userId: auth.user.id, maxSizeMb: overview.board.settings.max_file_size_mb });
      await load();
    } catch (uploadError) {
      setActionError(uploadError?.message || '첨부파일을 올리지 못했습니다.');
    } finally {
      setUploading(false);
    }
  };
  const removeAttachment = async (attachment) => {
    try {
      setActionError('');
      await deleteBoardAttachment(attachment.id);
      await load();
    } catch (deleteError) {
      setActionError(deleteError?.message || '첨부파일을 삭제하지 못했습니다.');
    }
  };
  const generalAttachments = data.attachments.filter((item) => item.purpose !== 'inline_image');
  const documentValue = data.post.content_document?.type === 'doc' ? data.post.content_document : legacyTextToDocument(data.post.content);
  const authorMeta = [data.post.author_name, overview.board.settings.show_author_department && data.post.author_department, overview.board.settings.show_author_position && data.post.author_position, overview.board.settings.show_author_job_title && data.post.author_job_title].filter(Boolean).join(' · ');
  // 위·아래 같은 동작 줄을 둔다. 긴 글을 다 읽고 나서 위로 올라가지 않아도
  // 목록으로 돌아가거나 수정할 수 있다.
  const actionRow = (
    <div className="gw-post-actions">
      <div>
        {onBack
          ? <button type="button" className="gw-flat-button" onClick={goToList}>목록</button>
          : <Link className="gw-flat-button" to={`/boards/${boardSlug}`}>목록</Link>}
        {overview.permissions.comment && overview.board.settings.allow_replies
          && <button type="button" className="gw-flat-button" onClick={() => { setEditingComment(null); setReplyTo(null); commentBoxRef.current?.focus(); }}>답글</button>}
      </div>
      <div>
        {data.post.can_edit && <Link className="gw-flat-button gw-flat-button--strong" to={`/boards/${boardSlug}/posts/${postId}/edit`}>수정</Link>}
        {data.post.can_delete && <button className="gw-flat-button" type="button" onClick={async () => { if (window.confirm('이 게시글을 삭제하시겠습니까?')) { await deleteBoardPost(postId); goToList(); } }}>삭제</button>}
      </div>
    </div>
  );

  return <article className={embedded ? 'gw-page gw-page--embedded gw-post-view' : 'gw-page gw-post-view'} aria-labelledby="post-title">
    {actionRow}

    <header className="gw-post-head">
      <p className="gw-post-head-category">{data.post.category ?? data.post.prefix ?? (data.post.is_notice ? '공지' : overview.board.name)}</p>
      <h1 id="post-title">{data.post.title}</h1>
      <div className="gw-post-head-meta">
        <span><small>작성자</small> <strong>{authorMeta}</strong></span>
        <span>
          {new Date(data.post.created_at).toLocaleDateString('ko-KR')}
          {overview.board.settings.show_views !== false && <em>조회 {data.post.view_count}</em>}
        </span>
      </div>
    </header>

    <section className="gw-post-content"><BoardDocumentRenderer documentValue={documentValue} attachments={data.attachments} /></section>
    {actionError && <div className="gw-notice gw-notice--warning" role="alert">{actionError}</div>}

    {overview.board.settings.allow_reactions && <section className="gw-reactions" aria-label="게시글 반응">{[['like','좋아요'],['helpful','도움돼요'],['support','응원해요']].map(([type, label]) => <button key={type} type="button" aria-pressed={reactions.mine.includes(type)} onClick={async () => setReactions(await toggleBoardReaction(postId, type))}>{label} {reactions.counts[type] ?? 0}</button>)}</section>}

    {overview.board.settings.allow_attachments && <section className="gw-attachment-section"><h2>첨부파일</h2><div className="gw-attachment-list">{generalAttachments.map((item) => <div key={item.id}><button type="button" onClick={async () => { try { setActionError(''); window.open(await getAttachmentDownloadUrl(item.id), '_blank', 'noopener'); } catch (downloadError) { setActionError(downloadError.message); } }}>{item.original_name} <span>{Math.ceil(item.file_size / 1024)}KB</span></button>{data.post.can_edit && <button type="button" onClick={() => removeAttachment(item)} aria-label={`${item.original_name} 삭제`}>삭제</button>}</div>)}</div>{generalAttachments.length === 0 && <p className="gw-empty-state">첨부파일이 없습니다.</p>}{overview.permissions.upload && <label className="gw-file-button">{uploading ? '올리는 중…' : '파일 첨부'}<input type="file" disabled={uploading} onChange={upload} /></label>}</section>}

    {overview.board.settings.allow_comments && <section className="gw-comments">
      <h2>댓글 {data.comments.length > 0 && <span className="gw-comment-count">{data.comments.length}</span>}</h2>
      {data.comments.map((comment) => <article key={comment.id} className={comment.parent_comment_id ? 'is-reply' : ''}>
        <header><strong>{comment.author_name}</strong><time>{new Date(comment.created_at).toLocaleString('ko-KR')}</time></header>
        <p>{comment.content}</p>
        <div>
          {overview.permissions.comment && overview.board.settings.allow_replies && <button type="button" onClick={() => { setEditingComment(null); setReplyTo(comment.id); }}>답글</button>}
          {comment.can_edit && <button type="button" onClick={() => { setReplyTo(null); setEditingComment(comment); }}>수정</button>}
          {comment.can_delete && <button type="button" onClick={async () => { if (window.confirm('댓글을 삭제하시겠습니까?')) { await deleteBoardComment(comment.id); load(); } }}>삭제</button>}
        </div>
      </article>)}
      {overview.permissions.comment && <form className="gw-comment-box" key={editingComment?.id ?? replyTo ?? 'new'} onSubmit={submitComment}>
        <textarea
          ref={commentBoxRef}
          name="content"
          required
          rows={2}
          placeholder={editingComment ? '댓글을 수정합니다' : replyTo ? '답글을 입력하세요' : '댓글'}
          defaultValue={editingComment?.content ?? ''}
          onChange={() => setCommentStatus('')}
          aria-label={editingComment ? '댓글 수정' : replyTo ? '답글' : '댓글'}
        />
        <button className="gw-comment-submit" type="submit" disabled={commentSaving}>{commentSaving ? '저장 중…' : editingComment ? '수정' : '댓글쓰기'}</button>
        <div className="gw-comment-box-foot">
          {!editingComment && overview.board.settings.allow_anonymous && <label><input type="checkbox" name="anonymous" /> 익명</label>}
          {(editingComment || replyTo) && <button type="button" className="gw-flat-button" onClick={() => { setEditingComment(null); setReplyTo(null); setCommentStatus(''); }} disabled={commentSaving}>취소</button>}
          {commentStatus && <p className="gw-form-status" role="status">{commentStatus}</p>}
        </div>
      </form>}
    </section>}

    {actionRow}
  </article>;
}
