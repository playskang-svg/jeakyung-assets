import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import BoardPostEditor from '../../components/editor/BoardPostEditor.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  createBoardPostDraft,
  deleteBoardAttachment,
  getBoardOverview,
  getBoardPost,
  getInlineAttachmentUrls,
  saveBoardPost,
  uploadBoardAttachment,
} from '../../services/boardService.js';
import {
  boardDocumentHasContent,
  EMPTY_BOARD_DOCUMENT,
  legacyTextToDocument,
} from '../../utils/boardDocument.js';

export default function PostWritePage() {
  const { boardSlug, postId } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const draftRequest = useRef(false);
  const [overview, setOverview] = useState(null);
  const [post, setPost] = useState(null);
  const [activePostId, setActivePostId] = useState(postId ?? null);
  const [documentValue, setDocumentValue] = useState(EMPTY_BOARD_DOCUMENT);
  const [initialUrls, setInitialUrls] = useState({});
  const [initialAttachments, setInitialAttachments] = useState([]);
  const [inlineImageIds, setInlineImageIds] = useState([]);
  const [generalAttachments, setGeneralAttachments] = useState([]);
  const [coverAttachmentId, setCoverAttachmentId] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const boardOverview = await getBoardOverview(boardSlug);
        if (!active) return;
        setOverview(boardOverview);

        if (postId) {
          const postData = await getBoardPost(postId);
          const contentDocument = postData.post.content_document?.type === 'doc'
            ? postData.post.content_document
            : legacyTextToDocument(postData.post.content);
          const urls = await getInlineAttachmentUrls(postData.attachments);
          if (!active) return;
          setPost(postData.post);
          setActivePostId(postData.post.id);
          setDocumentValue(contentDocument);
          setInitialUrls(urls);
          setInitialAttachments(postData.attachments);
          setInlineImageIds(postData.attachments.filter((item) => item.purpose === 'inline_image').map((item) => item.id));
          setGeneralAttachments(postData.attachments.filter((item) => item.purpose !== 'inline_image'));
          setCoverAttachmentId(postData.post.cover_attachment_id ?? '');
          return;
        }

        if (draftRequest.current) return;
        draftRequest.current = true;
        const draftId = await createBoardPostDraft(boardOverview.board.id);
        if (!active) return;
        setActivePostId(draftId);
        setPost({ id: draftId, title: '', content_document: EMPTY_BOARD_DOCUMENT, status: 'draft' });
        setDocumentValue(EMPTY_BOARD_DOCUMENT);
      } catch {
        if (active) setError('글쓰기 권한을 확인하지 못했거나 편집용 임시 글을 만들지 못했습니다.');
      }
    };
    load();
    return () => { active = false; };
  }, [boardSlug, postId]);

  const submit = async (formElement, status) => {
    if (saving || uploadingAttachments || !overview || !activePostId) return;
    const form = new FormData(formElement);
    if (status === 'published' && !boardDocumentHasContent(documentValue)) {
      setError('게시할 본문 내용이나 이미지를 입력해 주세요.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const id = await saveBoardPost({
        id: activePostId,
        boardId: overview.board.id,
        title: form.get('title'),
        contentDocument: documentValue,
        categoryId: form.get('categoryId'),
        postPrefix: form.get('postPrefix'),
        isAnonymous: form.get('anonymous') === 'on',
        isNotice: form.get('notice') === 'on',
        isImportant: form.get('important') === 'on',
        isPinned: form.get('pinned') === 'on',
        coverAttachmentId: coverAttachmentId || null,
        status,
      });
      navigate(`/boards/${boardSlug}/posts/${id}`);
    } catch {
      setError('게시글을 저장하지 못했습니다. 신규 이미지는 자동 정리 후보로 유지됩니다. 권한과 입력값을 확인해 주세요.');
      setSaving(false);
    }
  };

  const uploadAttachments = async (event) => {
    const files = [...(event.target.files ?? [])];
    event.target.value = '';
    if (!files.length || !overview || !activePostId || !auth.user) return;
    setUploadingAttachments(true);
    setError('');
    try {
      const uploaded = [];
      for (const file of files) {
        uploaded.push(await uploadBoardAttachment({
          boardId: overview.board.id,
          postId: activePostId,
          file,
          userId: auth.user.id,
          maxSizeMb: overview.board.settings.max_file_size_mb,
        }));
      }
      setGeneralAttachments((current) => [...current, ...uploaded]);
    } catch (uploadError) {
      setError(uploadError?.message ?? '첨부파일을 업로드하지 못했습니다.');
    } finally {
      setUploadingAttachments(false);
    }
  };

  const removeAttachment = async (attachmentId) => {
    try {
      await deleteBoardAttachment(attachmentId);
      setGeneralAttachments((current) => current.filter((item) => item.id !== attachmentId));
    } catch {
      setError('첨부파일을 삭제하지 못했습니다.');
    }
  };

  if (!overview || !activePostId || !post) {
    return <div className="gw-route-state">{error ? <div className="gw-notice gw-notice--warning" role="alert">{error}</div> : <p className="gw-empty-state" role="status">게시글 편집기를 준비하고 있습니다.</p>}</div>;
  }

  return <article className="gw-page" aria-labelledby="write-title">
    <header className="gw-page-header"><div><span className="gw-eyebrow">WRITE</span><h1 id="write-title">{overview.board.name} {postId ? '글 수정' : '글쓰기'}</h1><p>본문 이미지는 비공개 저장소에 업로드되며 게시판 권한을 서버에서 다시 검증합니다.</p></div><div className="gw-admin-actions"><button type="button" className="gw-secondary-button" onClick={() => navigate(`/boards/${boardSlug}`)}>목록 보기</button></div></header>
    {error && <div className="gw-notice gw-notice--warning" role="alert">{error}</div>}
    <form className="gw-editor-form" onSubmit={(event) => { event.preventDefault(); submit(event.currentTarget, 'published'); }}>
      <label className="gw-field"><span>제목</span><input name="title" required maxLength="240" defaultValue={post?.title === '(제목 없음)' ? '' : post?.title ?? ''} /></label>
      {overview.board.settings.use_prefix && <label className="gw-field"><span>말머리</span><input name="postPrefix" maxLength="40" defaultValue={post?.prefix ?? ''} /></label>}
      {overview.categories.length > 0 && <label className="gw-field"><span>카테고리</span><select name="categoryId" defaultValue={post?.category_id ?? ''}><option value="">선택 안 함</option>{overview.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      <div className="gw-field"><span>본문</span><BoardPostEditor board={overview.board} postId={activePostId} initialDocument={documentValue} initialUrls={initialUrls} initialAttachments={initialAttachments} onChange={setDocumentValue} onImageIdsChange={(ids) => { setInlineImageIds(ids); if (coverAttachmentId && !ids.includes(coverAttachmentId)) setCoverAttachmentId(''); }} /></div>
      {overview.board.settings.allow_attachments && <section className="gw-compose-attachments" aria-labelledby="compose-attachments-title"><div><h2 id="compose-attachments-title">첨부파일</h2><p>글을 게시하기 전에도 파일을 추가하거나 삭제할 수 있습니다.</p></div>{generalAttachments.length > 0 && <ul>{generalAttachments.map((item) => <li key={item.id}><span><strong>{item.original_name}</strong><small>{Math.ceil(item.file_size / 1024)}KB</small></span><button type="button" onClick={() => removeAttachment(item.id)} aria-label={`${item.original_name} 삭제`}>삭제</button></li>)}</ul>}{overview.permissions.upload && <label className="gw-file-button">{uploadingAttachments ? '업로드 중…' : '파일 선택'}<input type="file" multiple disabled={uploadingAttachments} onChange={uploadAttachments} /></label>}</section>}
      {overview.board.board_type === 'gallery' && inlineImageIds.length > 0 && <label className="gw-field"><span>갤러리 대표 이미지</span><select value={coverAttachmentId} onChange={(event) => setCoverAttachmentId(event.target.value)}><option value="">본문 첫 이미지 자동 사용</option>{inlineImageIds.map((id, index) => <option key={id} value={id}>본문 이미지 {index + 1}</option>)}</select></label>}
      <div className="gw-check-grid">
        {overview.board.settings.allow_anonymous && <label><input name="anonymous" type="checkbox" defaultChecked={post?.is_anonymous ?? false} /> 익명으로 작성</label>}
        {overview.permissions.notice && overview.board.settings.allow_notices !== false && <label><input name="notice" type="checkbox" defaultChecked={post?.is_notice ?? false} /> 공지글</label>}
        {overview.permissions.notice && overview.board.settings.allow_important !== false && <label><input name="important" type="checkbox" defaultChecked={post?.is_important ?? false} /> 중요글</label>}
        {overview.permissions.pin && overview.board.settings.use_pinned !== false && <label><input name="pinned" type="checkbox" defaultChecked={post?.is_pinned ?? false} /> 상단 고정</label>}
      </div>
      <div className="gw-admin-actions"><button type="button" className="gw-secondary-button" onClick={() => navigate(`/boards/${boardSlug}`)}>목록 보기</button><button className="gw-primary-button" type="submit" disabled={saving || uploadingAttachments}>게시</button><button className="gw-secondary-button" type="button" disabled={saving || uploadingAttachments} onClick={(event) => submit(event.currentTarget.form, 'draft')}>임시 저장</button></div>
    </form>
  </article>;
}
