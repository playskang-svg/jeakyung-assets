import { mergeAttributes, Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';

import YouTubeEmbedNodeView from './YouTubeEmbedNodeView.jsx';

// 유튜브 주소에서 영상 번호 열한 글자만 뽑는다. 아는 형태만 받아들이고
// 나머지는 버린다. 주소를 통째로 문서에 남기지 않는 이유가 이것이다 —
// 번호만 남기면 재생 주소는 우리가 만들어 붙이므로, 남의 주소가 우리
// 화면 안에서 열릴 길이 애초에 없다.
export function parseYouTubeId(input) {
  const text = String(input ?? '').trim();
  if (!text) return '';
  // 번호를 그대로 붙여넣은 경우
  if (/^[A-Za-z0-9_-]{11}$/.test(text)) return text;
  let url;
  try { url = new URL(text); } catch { return ''; }
  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  let candidate = '';
  if (host === 'youtu.be') candidate = url.pathname.slice(1);
  else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    if (url.pathname === '/watch') candidate = url.searchParams.get('v') ?? '';
    else if (url.pathname.startsWith('/embed/')) candidate = url.pathname.slice(7);
    else if (url.pathname.startsWith('/shorts/')) candidate = url.pathname.slice(8);
    else if (url.pathname.startsWith('/live/')) candidate = url.pathname.slice(6);
  }
  candidate = candidate.split('/')[0];
  return /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : '';
}

export const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export const youTubeThumbnail = (videoId) =>
  YOUTUBE_ID.test(videoId) ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '';

// 재생 주소. nocookie 쪽을 쓴다 — 누르기 전까지 유튜브가 우리 직원을
// 추적하지 않는다.
export const youTubeEmbedUrl = (videoId) =>
  YOUTUBE_ID.test(videoId) ? `https://www.youtube-nocookie.com/embed/${videoId}` : '';

export const YouTubeEmbed = Node.create({
  name: 'youtubeEmbed',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      videoId: { default: '' },
      caption: { default: '' },
    };
  },

  parseHTML() {
    return [{
      tag: 'figure[data-youtube-id]',
      getAttrs: (element) => ({ videoId: element.getAttribute('data-youtube-id') }),
    }];
  },

  renderHTML({ HTMLAttributes }) {
    const { videoId, caption } = HTMLAttributes;
    return ['figure', mergeAttributes({
      'data-youtube-id': videoId,
      'data-caption': caption || '',
    })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(YouTubeEmbedNodeView);
  },
});

export default YouTubeEmbed;
