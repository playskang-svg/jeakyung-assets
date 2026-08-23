import { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

function EditorButton({ active = false, children, onClick }) {
  return <button type="button" aria-pressed={active} onClick={onClick}>{children}</button>;
}

export default function PopupRichEditor({ value, onChange }) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3, 4] } })],
    content: value || '<p></p>',
    editorProps: { attributes: { class: 'gw-popup-editor-content', 'aria-label': '팝업 문서 일반 편집기' } },
    onUpdate: ({ editor: current }) => onChange(current.getHTML()),
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) editor.commands.setContent(value || '<p></p>', { emitUpdate: false });
  }, [editor, value]);

  if (!editor) return <p className="gw-empty-state">편집기를 준비하고 있습니다.</p>;

  return <div className="gw-popup-rich-editor">
    <div className="gw-popup-editor-toolbar" role="toolbar" aria-label="팝업 문서 서식">
      <EditorButton active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>굵게</EditorButton>
      <EditorButton active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>기울임</EditorButton>
      <EditorButton active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>큰 제목</EditorButton>
      <EditorButton active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>작은 제목</EditorButton>
      <EditorButton active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>목록</EditorButton>
      <EditorButton active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>번호</EditorButton>
      <EditorButton active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>인용</EditorButton>
    </div>
    <EditorContent editor={editor} />
  </div>;
}

