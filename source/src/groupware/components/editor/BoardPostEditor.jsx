import { useCallback, useMemo, useRef, useState } from 'react';
import { Extension } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import ExternalImage from './ExternalImage.js';
import { BackgroundColor, Color, TextStyle } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import { Plugin } from '@tiptap/pm/state';

import { getAttachmentViewUrl, uploadInlineBoardImage } from '../../services/boardService.js';
import { countInlineImages, prepareInlineImage, sanitizePastedHtml } from '../../utils/boardDocument.js';
import { InlineAttachmentImage } from './InlineAttachmentImage.js';

const MAX_PARALLEL_SELECTION = 20;

function imageFiles(fileList) {
  return [...(fileList ?? [])].filter((file) => file.type.startsWith('image/'));
}

const ImageTransfer = Extension.create({
  name: 'imageTransfer',
  priority: 1000,
  addOptions() { return { receiveFiles: () => {} }; },
  addProseMirrorPlugins() {
    return [new Plugin({
      props: {
        handlePaste: (view, event) => {
          const files = imageFiles(event.clipboardData?.files);
          if (!files.length) return false;
          event.preventDefault();
          this.options.receiveFiles(files, view.state.selection.from);
          return true;
        },
        handleDrop: (view, event, _slice, moved) => {
          if (moved) return false;
          const files = imageFiles(event.dataTransfer?.files);
          if (!files.length) return false;
          event.preventDefault();
          const position = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? view.state.selection.from;
          this.options.receiveFiles(files, position);
          return true;
        },
      },
    })];
  },
});

function ToolbarButton({ active = false, children, onClick, label }) {
  return <button type="button" aria-label={label} title={label} aria-pressed={active} onClick={onClick}>{children}</button>;
}

const TEXT_COLORS = [
  ['#11172b', '검정'], ['#b3261e', '빨강'], ['#c2610a', '주황'],
  ['#16734a', '초록'], ['#2450f5', '파랑'], ['#6b21a8', '보라'], ['#687087', '회색'],
];
const HIGHLIGHT_COLORS = [
  ['#fff3a3', '노랑'], ['#c8f2d4', '초록'], ['#cfe0ff', '파랑'],
  ['#ffd6d6', '분홍'], ['#e7e9ee', '회색'],
];

/* 색상 선택은 버튼을 계속 늘리는 대신 하나의 드롭다운으로 묶는다. */
function ColorMenu({ label, icon, colors, onPick, onClear }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="gw-editor-color-menu">
      <button type="button" aria-label={label} title={label} aria-expanded={open} onClick={() => setOpen((v) => !v)}>{icon}</button>
      {open && (
        <span className="gw-editor-color-pop" role="menu">
          {colors.map(([value, name]) => (
            <button
              key={value}
              type="button"
              role="menuitem"
              aria-label={name}
              title={name}
              style={{ background: value }}
              onClick={() => { onPick(value); setOpen(false); }}
            />
          ))}
          <button type="button" role="menuitem" className="gw-editor-color-clear" onClick={() => { onClear(); setOpen(false); }}>지우기</button>
        </span>
      )}
    </span>
  );
}

export default function BoardPostEditor({ board, postId, initialDocument, initialUrls = {}, initialAttachments = [], onChange, onImageIdsChange, uploadImage = uploadInlineBoardImage, getImageUrl = getAttachmentViewUrl }) {
  const urlsRef = useRef(initialUrls);
  const attachmentSizesRef = useRef(Object.fromEntries(initialAttachments.map((item) => [item.id, Number(item.file_size) || 0])));
  const generalBytesRef = useRef(initialAttachments.filter((item) => item.purpose !== 'inline_image').reduce((sum, item) => sum + (Number(item.file_size) || 0), 0));
  const totalBytesRef = useRef(initialAttachments.reduce((sum, item) => sum + (Number(item.file_size) || 0), 0));
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const [uploads, setUploads] = useState([]);
  const [htmlMode, setHtmlMode] = useState(false);
  const [htmlDraft, setHtmlDraft] = useState('');
  const limits = useMemo(() => ({
    maxBytes: Math.min(Math.max(Number(board.settings.max_inline_image_size_mb) || 10, 1), 10) * 1024 * 1024,
    maxImages: Math.min(Math.max(Number(board.settings.max_inline_images) || 20, 1), 20),
    maxTotalBytes: Math.min(Math.max(Number(board.settings.max_total_attachment_mb) || 50, 1), 50) * 1024 * 1024,
    preserveOriginal: Boolean(board.settings.preserve_image_originals),
  }), [board.settings]);

  const uploadOne = useCallback(async (file, replacesAttachmentId = null) => {
    const prepared = await prepareInlineImage(file, { maxBytes: limits.maxBytes, preserveOriginal: limits.preserveOriginal });
    const replacedBytes = replacesAttachmentId ? (attachmentSizesRef.current[replacesAttachmentId] ?? 0) : 0;
    if (totalBytesRef.current - replacedBytes + prepared.file.size > limits.maxTotalBytes) {
      throw new Error(`본문 이미지와 첨부파일의 합계는 ${limits.maxTotalBytes / 1024 / 1024}MB 이하여야 합니다.`);
    }
    const attachment = await uploadImage({ boardId: board.id, postId, file: prepared.file, originalName: prepared.originalName, replacesAttachmentId });
    const url = await getImageUrl(attachment.id);
    urlsRef.current = { ...urlsRef.current, [attachment.id]: url };
    totalBytesRef.current = totalBytesRef.current - replacedBytes + Number(attachment.file_size || prepared.file.size);
    attachmentSizesRef.current = { ...attachmentSizesRef.current, [attachment.id]: Number(attachment.file_size || prepared.file.size) };
    return attachment;
  }, [board.id, getImageUrl, limits, postId, uploadImage]);

  const receiveFiles = useCallback(async (incomingFiles, requestedPosition) => {
    const editor = editorRef.current;
    const files = imageFiles(incomingFiles).slice(0, MAX_PARALLEL_SELECTION);
    if (!editor || !files.length) return;
    const existingCount = countInlineImages(editor.getJSON());
    if (existingCount + files.length > limits.maxImages) {
      setUploads([{ id: crypto.randomUUID(), name: '선택한 이미지', state: 'error', message: `게시글당 이미지는 최대 ${limits.maxImages}장입니다.` }]);
      return;
    }
    if (totalBytesRef.current + files.reduce((sum, file) => sum + file.size, 0) > limits.maxTotalBytes) {
      setUploads([{ id: crypto.randomUUID(), name: '선택한 이미지', state: 'error', message: `본문 이미지와 첨부파일의 합계는 ${limits.maxTotalBytes / 1024 / 1024}MB 이하여야 합니다.` }]);
      return;
    }

    const jobs = files.map((file) => ({ id: crypto.randomUUID(), file, name: file.name, state: 'queued', message: '업로드 대기' }));
    setUploads((current) => [...current.filter((item) => item.state === 'uploading'), ...jobs]);
    let insertionPosition = Math.min(requestedPosition ?? editor.state.selection.from, editor.state.doc.content.size);
    for (const job of jobs) {
      setUploads((current) => current.map((item) => item.id === job.id ? { ...item, state: 'uploading', message: '검사·최적화 후 업로드 중' } : item));
      try {
        const attachment = await uploadOne(job.file);
        editor.chain().focus().insertContentAt(insertionPosition, {
          type: 'inlineImage',
          attrs: { attachmentId: attachment.id, alt: '', caption: '', alignment: 'center', size: 'medium', width: null },
        }).run();
        insertionPosition = Math.min(insertionPosition + 1, editor.state.doc.content.size);
        setUploads((current) => current.map((item) => item.id === job.id ? { ...item, state: 'success', message: '본문에 삽입됨' } : item));
      } catch (error) {
        setUploads((current) => current.map((item) => item.id === job.id ? { ...item, state: 'error', message: error instanceof Error ? error.message : '업로드 실패' } : item));
      }
    }
  }, [limits, uploadOne]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } },
      }),
      TextStyle,
      Color,
      BackgroundColor,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      InlineAttachmentImage.configure({
        resolveUrl: (attachmentId) => urlsRef.current[attachmentId] ?? '',
        replaceImage: async (file, attachmentId) => uploadOne(file, attachmentId),
      }),
      ExternalImage,
      ImageTransfer.configure({ receiveFiles }),
    ],
    content: initialDocument,
    editorProps: {
      attributes: { class: 'gw-rich-editor-content', 'aria-label': '게시글 본문 편집기' },
      transformPastedHTML: sanitizePastedHtml,
    },
    onCreate: ({ editor: createdEditor }) => { editorRef.current = createdEditor; },
    onUpdate: ({ editor: updatedEditor }) => {
      const documentValue = updatedEditor.getJSON();
      onChange(documentValue);
      const ids = [];
      updatedEditor.state.doc.descendants((node) => { if (node.type.name === 'inlineImage') ids.push(node.attrs.attachmentId); });
      totalBytesRef.current = generalBytesRef.current + [...new Set(ids)].reduce((sum, id) => sum + (attachmentSizesRef.current[id] ?? 0), 0);
      onImageIdsChange(ids);
    },
  }, [postId]);
  editorRef.current = editor;

  if (!editor) return <p className="gw-empty-state" role="status">본문 편집기를 준비하고 있습니다.</p>;
  const retry = (job) => receiveFiles([job.file], editor.state.selection.from);

  const toggleLink = () => {
    const previous = editor.getAttributes('link').href ?? '';
    const input = window.prompt('연결할 주소를 입력하세요. 비워 두면 링크가 해제됩니다.', previous);
    if (input === null) return;
    const href = input.trim();
    if (!href) { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
    if (!/^https?:\/\//i.test(href)) { window.alert('http:// 또는 https:// 로 시작하는 주소만 넣을 수 있습니다.'); return; }
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  };

  // 주소로 이미지 넣기. 파일을 올리지 않으므로 용량·장수 제한과는 무관하고,
  // 대신 원본이 사라지면 깨진다는 점을 노드뷰에서 안내한다.
  const insertImageUrl = () => {
    const input = window.prompt('본문에 넣을 이미지 주소를 입력하세요.', 'https://');
    if (input === null) return;
    const src = input.trim();
    if (!/^https:\/\//i.test(src)) { window.alert('https:// 로 시작하는 주소만 넣을 수 있습니다.'); return; }
    if (src.length > 2000) { window.alert('주소가 너무 깁니다.'); return; }
    editor.chain().focus().insertContent({ type: 'externalImage', attrs: { src } }).run();
  };

  const applyHtml = () => {
    editor.commands.setContent(htmlDraft, { emitUpdate: true });
    setHtmlMode(false);
  };

  return <div className="gw-rich-editor">
    <div className="gw-editor-toolbar" role="toolbar" aria-label="본문 서식">
      <ToolbarButton label="굵게" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>𝐁</ToolbarButton>
      <ToolbarButton label="기울임" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>𝐼</ToolbarButton>
      <ToolbarButton label="밑줄" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>U̲</ToolbarButton>
      <ToolbarButton label="취소선" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>S̶</ToolbarButton>
      <span className="gw-editor-divider" aria-hidden="true" />
      <ToolbarButton label="제목" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>🅗</ToolbarButton>
      <ToolbarButton label="인용" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>❝</ToolbarButton>
      <ToolbarButton label="글머리표 목록" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>•☰</ToolbarButton>
      <ToolbarButton label="번호 목록" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1☰</ToolbarButton>
      <span className="gw-editor-divider" aria-hidden="true" />
      <ToolbarButton label="왼쪽 정렬" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}>⬅</ToolbarButton>
      <ToolbarButton label="가운데 정렬" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}>↔</ToolbarButton>
      <ToolbarButton label="오른쪽 정렬" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}>➡</ToolbarButton>
      <span className="gw-editor-divider" aria-hidden="true" />
      <ColorMenu label="글자색" icon="🎨" colors={TEXT_COLORS} onPick={(c) => editor.chain().focus().setColor(c).run()} onClear={() => editor.chain().focus().unsetColor().run()} />
      <ColorMenu label="글자 배경색" icon="🖍" colors={HIGHLIGHT_COLORS} onPick={(c) => editor.chain().focus().setHighlight({ color: c }).run()} onClear={() => editor.chain().focus().unsetHighlight().run()} />
      <span className="gw-editor-divider" aria-hidden="true" />
      <ToolbarButton label="링크 추가·해제" active={editor.isActive('link')} onClick={toggleLink}>🔗</ToolbarButton>
      <ToolbarButton label="주소로 이미지 넣기" onClick={insertImageUrl}>🌐</ToolbarButton>
      {board.settings.allow_images && <ToolbarButton label="사진 추가" onClick={() => fileInputRef.current?.click()}>🖼</ToolbarButton>}
      <ToolbarButton label="구분선" onClick={() => editor.chain().focus().setHorizontalRule().run()}>―</ToolbarButton>
      <span className="gw-editor-divider" aria-hidden="true" />
      <ToolbarButton
        label={htmlMode ? 'HTML 모드 끄기' : 'HTML 모드'}
        active={htmlMode}
        onClick={() => { if (htmlMode) { applyHtml(); } else { setHtmlDraft(editor.getHTML()); setHtmlMode(true); } }}
      >{'</>'}</ToolbarButton>
      <ToolbarButton label="서식 지우기" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>🧹</ToolbarButton>
      <input ref={fileInputRef} className="gw-visually-hidden" type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { receiveFiles(event.target.files, editor.state.selection.from); event.target.value = ''; }} />
    </div>
    {htmlMode ? (
      <div className="gw-editor-html">
        <textarea value={htmlDraft} onChange={(event) => setHtmlDraft(event.target.value)} spellCheck="false" aria-label="HTML 원본" />
        <div className="gw-editor-html-actions">
          <button type="button" className="gw-primary-button" onClick={applyHtml}>HTML 적용</button>
          <button type="button" className="gw-secondary-button" onClick={() => setHtmlMode(false)}>취소</button>
        </div>
      </div>
    ) : <EditorContent editor={editor} />}
    <p className="gw-editor-hint">이미지를 끌어 놓거나 클립보드에서 붙여넣을 수 있습니다. JPEG·PNG·WebP·GIF, 장당 최대 {limits.maxBytes / 1024 / 1024}MB, 최대 {limits.maxImages}장.</p>
    {uploads.length > 0 && <ul className="gw-upload-status" aria-label="이미지 업로드 상태" aria-live="polite">{uploads.map((item) => <li key={item.id} className={`is-${item.state}`}><span>{item.name}</span><strong>{item.message}</strong>{item.state === 'error' && item.file && <button type="button" onClick={() => retry(item)}>재시도</button>}</li>)}</ul>}
  </div>;
}
