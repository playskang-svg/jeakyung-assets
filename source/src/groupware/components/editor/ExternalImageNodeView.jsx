import { useState } from 'react';
import { NodeViewWrapper } from '@tiptap/react';

const SIZE_OPTIONS = [
  ['original', '원본'],
  ['small', '작게'],
  ['medium', '중간'],
  ['large', '크게'],
  ['custom', '직접 조절'],
];

// 첨부 이미지와 같은 클래스(gw-inline-image)를 쓴다. 정렬·크기·반응형 규칙을
// 한 곳에서 관리하기 위해서다. 다른 점은 파일이 우리 것이 아니라는 것뿐이라,
// "이미지 교체" 대신 "주소 바꾸기"를 둔다.
export default function ExternalImageNodeView({ node, selected, updateAttributes, deleteNode }) {
  const { src, alt = '', caption = '', alignment = 'center', size = 'medium', width = null } = node.attrs;
  const [broken, setBroken] = useState(false);

  const changeSource = () => {
    const input = window.prompt('이미지 주소를 입력하세요.', src);
    if (input === null) return;
    const next = input.trim();
    if (!/^https:\/\//i.test(next)) {
      window.alert('https:// 로 시작하는 주소만 넣을 수 있습니다.');
      return;
    }
    setBroken(false);
    updateAttributes({ src: next });
  };

  return (
    <NodeViewWrapper
      as="figure"
      className={`gw-inline-image gw-inline-image--${alignment} gw-inline-image--${size}${selected ? ' is-selected' : ''}`}
      data-external-image-src={src}
      style={size === 'custom' && width ? { '--gw-image-width': `${width}px` } : undefined}
    >
      {broken
        ? <div className="gw-inline-image-placeholder" role="status">이미지를 불러오지 못했습니다. 주소를 확인해 주세요.</div>
        : <img src={src} alt={alt} draggable="false" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} onLoad={() => setBroken(false)} />}
      {caption && !selected && <figcaption>{caption}</figcaption>}
      {selected && <div className="gw-inline-image-controls" contentEditable={false}>
        <label><span>대체 텍스트</span><input value={alt} maxLength="500" onChange={(event) => updateAttributes({ alt: event.target.value })} placeholder="이미지를 설명해 주세요" /></label>
        <label><span>캡션</span><input value={caption} maxLength="1000" onChange={(event) => updateAttributes({ caption: event.target.value })} placeholder="이미지 설명(선택)" /></label>
        <div className="gw-inline-image-control-row">
          <fieldset><legend>정렬</legend>{[['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']].map(([value, label]) => <button key={value} type="button" aria-pressed={alignment === value} onClick={() => updateAttributes({ alignment: value })}>{label}</button>)}</fieldset>
          <label><span>표시 크기</span><select value={size} onChange={(event) => updateAttributes({ size: event.target.value, width: event.target.value === 'custom' ? (width || 640) : null })}>{SIZE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        {size === 'custom' && <label><span>직접 조절: {width || 640}px</span><input type="range" min="80" max="2560" step="10" value={width || 640} onChange={(event) => updateAttributes({ width: Number(event.target.value) })} /></label>}
        <p className="gw-inline-image-note">이 이미지는 외부 주소에 연결되어 있습니다. 원본이 사라지면 표시되지 않습니다.</p>
        <div className="gw-inline-image-actions">
          <button className="gw-secondary-button" type="button" onClick={changeSource}>주소 바꾸기</button>
          <button className="gw-secondary-button gw-secondary-button--danger" type="button" onClick={deleteNode}>본문에서 삭제</button>
        </div>
      </div>}
    </NodeViewWrapper>
  );
}
