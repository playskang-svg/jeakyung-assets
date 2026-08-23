import { useState } from 'react';
import { NodeViewWrapper } from '@tiptap/react';

const SIZE_OPTIONS = [
  ['original', '원본'],
  ['small', '작게'],
  ['medium', '중간'],
  ['large', '크게'],
  ['custom', '직접 조절'],
];

export default function InlineImageNodeView({ node, selected, updateAttributes, deleteNode, extension }) {
  const { attachmentId, alt = '', caption = '', alignment = 'center', size = 'medium', width = null } = node.attrs;
  const [replaceState, setReplaceState] = useState({ loading: false, error: '' });
  const source = extension.options.resolveUrl(attachmentId);

  const replaceImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || replaceState.loading) return;
    setReplaceState({ loading: true, error: '' });
    try {
      const attachment = await extension.options.replaceImage(file, attachmentId);
      updateAttributes({ attachmentId: attachment.id });
      setReplaceState({ loading: false, error: '' });
    } catch (error) {
      setReplaceState({ loading: false, error: error instanceof Error ? error.message : '이미지를 교체하지 못했습니다.' });
    }
  };

  return (
    <NodeViewWrapper
      as="figure"
      className={`gw-inline-image gw-inline-image--${alignment} gw-inline-image--${size}${selected ? ' is-selected' : ''}`}
      data-attachment-id={attachmentId}
      style={size === 'custom' && width ? { '--gw-image-width': `${width}px` } : undefined}
    >
      {source ? <img src={source} alt={alt} draggable="false" /> : <div className="gw-inline-image-placeholder" role="status">이미지를 불러오는 중입니다.</div>}
      {caption && !selected && <figcaption>{caption}</figcaption>}
      {selected && <div className="gw-inline-image-controls" contentEditable={false}>
        <label><span>대체 텍스트</span><input value={alt} maxLength="500" onChange={(event) => updateAttributes({ alt: event.target.value })} placeholder="이미지를 설명해 주세요" /></label>
        <label><span>캡션</span><input value={caption} maxLength="1000" onChange={(event) => updateAttributes({ caption: event.target.value })} placeholder="이미지 설명(선택)" /></label>
        <div className="gw-inline-image-control-row">
          <fieldset><legend>정렬</legend>{[['left','왼쪽'],['center','가운데'],['right','오른쪽']].map(([value, label]) => <button key={value} type="button" aria-pressed={alignment === value} onClick={() => updateAttributes({ alignment: value })}>{label}</button>)}</fieldset>
          <label><span>표시 크기</span><select value={size} onChange={(event) => updateAttributes({ size: event.target.value, width: event.target.value === 'custom' ? (width || 640) : null })}>{SIZE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        {size === 'custom' && <label><span>직접 조절: {width || 640}px</span><input type="range" min="80" max="2560" step="10" value={width || 640} onChange={(event) => updateAttributes({ width: Number(event.target.value) })} /></label>}
        <div className="gw-inline-image-actions">
          <label className="gw-secondary-button">{replaceState.loading ? '교체 중…' : '이미지 교체'}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={replaceImage} disabled={replaceState.loading} /></label>
          <button className="gw-secondary-button gw-secondary-button--danger" type="button" onClick={deleteNode}>본문에서 삭제</button>
        </div>
        {replaceState.error && <p className="gw-inline-image-error" role="alert">{replaceState.error}</p>}
      </div>}
    </NodeViewWrapper>
  );
}
