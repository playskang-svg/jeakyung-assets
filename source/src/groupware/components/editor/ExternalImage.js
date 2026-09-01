import { mergeAttributes, Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';

import ExternalImageNodeView from './ExternalImageNodeView.jsx';

// 주소로 연결한 본문 이미지.
//
// inlineImage 와 달리 파일이 우리 저장소에 없다. 문서에 남는 것은 src 하나뿐이고,
// 그림은 매번 그 주소에서 불러온다. 그래서 원본이 사라지면 이미지도 사라진다.
// 정렬·크기 속성은 inlineImage 와 똑같이 두었다. 화면에서 같은 CSS 를 쓰므로
// 좁은 화면에서 줄어드는 동작까지 그대로 따라간다.
export const ExternalImage = Node.create({
  name: 'externalImage',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: '' },
      alt: { default: '' },
      caption: { default: '' },
      alignment: { default: 'center' },
      size: { default: 'medium' },
      width: { default: null },
    };
  },

  parseHTML() {
    return [{
      tag: 'figure[data-external-image-src]',
      getAttrs: (element) => ({ src: element.getAttribute('data-external-image-src') }),
    }];
  },

  renderHTML({ HTMLAttributes }) {
    const { src, alt, caption, alignment, size, width } = HTMLAttributes;
    return ['figure', mergeAttributes({
      'data-external-image-src': src,
      'data-alt': alt || '',
      'data-caption': caption || '',
      'data-alignment': alignment || 'center',
      'data-size': size || 'medium',
      'data-width': width || '',
    })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ExternalImageNodeView);
  },
});

export default ExternalImage;
