import { useState } from 'react';
import { NodeViewWrapper } from '@tiptap/react';

import { WrapLeftIcon, WrapNoneIcon, WrapRightIcon } from './EditorIcons.jsx';
import useImageResize from './useImageResize.js';

const SIZE_OPTIONS = [
  ['original', '원본'],
  ['small', '작게'],
  ['medium', '중간'],
  ['large', '크게'],
  ['full', '꽉 채우기'],
  ['custom', '직접 조절'],
];

// 첨부 이미지와 같은 클래스(gw-inline-image)를 쓴다. 정렬·크기·반응형 규칙을
// 한 곳에서 관리하기 위해서다. 다른 점은 파일이 우리 것이 아니라는 것뿐이라,
// "이미지 교체" 대신 "주소 바꾸기"를 둔다.
export default function ExternalImageNodeView({ node, selected, updateAttributes, deleteNode }) {
  const { src, alt = '', caption = '', alignment = 'center', size = 'medium', width = null, flow = 'block' } = node.attrs;
  // 끌어서 크기 조절. 손을 뗄 때 size 를 custom 으로 바꾸며 한 번만 기록한다.
  const { figureRef, dragWidth, startResize, nudge, isResizing } = useImageResize({
    width,
    alignment,
    onCommit: (next) => updateAttributes({ size: 'custom', width: next }),
  });
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
      className={`gw-inline-image gw-inline-image--${alignment} gw-inline-image--${size} gw-inline-image--flow-${flow}${selected ? ' is-selected' : ''}${isResizing ? ' is-resizing' : ''}`}
      data-external-image-src={src}
      ref={figureRef}
      style={dragWidth != null
        ? { '--gw-image-width': `${dragWidth}px`, width: `min(100%, ${dragWidth}px)` }
        : (size === 'custom' && width ? { '--gw-image-width': `${width}px` } : undefined)}
    >
      {broken
        ? <div className="gw-inline-image-placeholder" role="status">이미지를 불러오지 못했습니다. 주소를 확인해 주세요.</div>
        : <img src={src} alt={alt} draggable="false" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} onLoad={() => setBroken(false)} />}
      {selected && <>
        <span
          className="gw-image-handle gw-image-handle--left"
          role="slider"
          tabIndex={0}
          aria-label="이미지 너비 조절 (좌우 화살표로도 조절할 수 있습니다)"
          aria-valuenow={Math.round(dragWidth ?? width ?? 640)}
          aria-valuemin={80}
          aria-valuemax={2560}
          onPointerDown={(event) => startResize(event, 'left')}
          onKeyDown={nudge}
        />
        <span
          className="gw-image-handle gw-image-handle--right"
          role="slider"
          tabIndex={0}
          aria-label="이미지 너비 조절 (좌우 화살표로도 조절할 수 있습니다)"
          aria-valuenow={Math.round(dragWidth ?? width ?? 640)}
          aria-valuemin={80}
          aria-valuemax={2560}
          onPointerDown={(event) => startResize(event, 'right')}
          onKeyDown={nudge}
        />
        {isResizing && <span className="gw-image-size-badge" aria-hidden="true">{Math.round(dragWidth)}px</span>}
      </>}
      {caption && !selected && <figcaption>{caption}</figcaption>}
      {selected && <div className="gw-inline-image-controls" contentEditable={false}>
        <label><span>대체 텍스트</span><input value={alt} maxLength="500" onChange={(event) => updateAttributes({ alt: event.target.value })} placeholder="이미지를 설명해 주세요" /></label>
        <label><span>캡션</span><input value={caption} maxLength="1000" onChange={(event) => updateAttributes({ caption: event.target.value })} placeholder="이미지 설명(선택)" /></label>
        <div className="gw-inline-image-control-row">
          <fieldset><legend>정렬</legend>{[['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']].map(([value, label]) => <button key={value} type="button" aria-pressed={alignment === value} onClick={() => updateAttributes({ alignment: value })}>{label}</button>)}</fieldset>
          <label><span>표시 크기</span><select value={size} onChange={(event) => updateAttributes({ size: event.target.value, width: event.target.value === 'custom' ? (width || 640) : null })}>{SIZE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        <div className="gw-inline-image-control-row gw-inline-image-flow-row">
          <fieldset><legend>글 배치</legend>
            {[['block', '글과 분리', WrapNoneIcon], ['wrap-left', '왼쪽에 붙이고 글 흐르기', WrapLeftIcon], ['wrap-right', '오른쪽에 붙이고 글 흐르기', WrapRightIcon]].map(([value, title, IconComponent]) => {
              const current = flow === 'wrap' ? `wrap-${alignment === 'right' ? 'right' : 'left'}` : 'block';
              return (
                <button
                  key={value}
                  type="button"
                  title={title}
                  aria-label={title}
                  aria-pressed={current === value}
                  onClick={() => (value === 'block'
                    ? updateAttributes({ flow: 'block' })
                    : updateAttributes({ flow: 'wrap', alignment: value === 'wrap-right' ? 'right' : 'left' }))}
                ><IconComponent /></button>
              );
            })}
          </fieldset>
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
