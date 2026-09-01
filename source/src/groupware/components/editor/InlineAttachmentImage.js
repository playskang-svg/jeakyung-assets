import { mergeAttributes, Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';

import InlineImageNodeView from './InlineImageNodeView.jsx';

export const InlineAttachmentImage = Node.create({
  name: 'inlineImage',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addOptions() {
    return {
      resolveUrl: () => '',
      replaceImage: async () => { throw new Error('이미지 교체 기능을 사용할 수 없습니다.'); },
    };
  },

  addAttributes() {
    return {
      attachmentId: { default: null },
      alt: { default: '' },
      caption: { default: '' },
      alignment: { default: 'center' },
      size: { default: 'medium' },
      width: { default: null },
      flow: { default: 'block' },  // 'wrap' 이면 글이 이미지 옆으로 흐른다
    };
  },

  parseHTML() {
    return [{
      tag: 'figure[data-inline-attachment-id]',
      getAttrs: (element) => ({ attachmentId: element.getAttribute('data-inline-attachment-id') }),
    }];
  },

  renderHTML({ HTMLAttributes }) {
    const { attachmentId, alt, caption, alignment, size, width, flow } = HTMLAttributes;
    return ['figure', mergeAttributes({
      'data-inline-attachment-id': attachmentId,
      'data-alt': alt || '',
      'data-caption': caption || '',
      'data-alignment': alignment || 'center',
      'data-size': size || 'medium',
      'data-width': width || '',
      'data-flow': flow || 'block',
    })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(InlineImageNodeView);
  },
});
