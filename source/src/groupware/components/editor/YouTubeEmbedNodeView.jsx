import { NodeViewWrapper } from '@tiptap/react';

import { parseYouTubeId, youTubeEmbedUrl } from './YouTubeEmbed.js';

// 편집 중에도 영상을 그대로 띄운다. 글을 쓰면서 어느 영상인지 확인할 수 있어야
// 잘못 붙인 것을 바로 알아챈다.
export default function YouTubeEmbedNodeView({ node, selected, updateAttributes, deleteNode }) {
  const { videoId, caption = '' } = node.attrs;

  const changeVideo = () => {
    const input = window.prompt('유튜브 주소나 영상 번호를 입력하세요.', videoId);
    if (input === null) return;
    const next = parseYouTubeId(input);
    if (!next) { window.alert('유튜브 주소를 알아보지 못했습니다. 주소창의 주소를 그대로 붙여넣어 주세요.'); return; }
    updateAttributes({ videoId: next });
  };

  return (
    <NodeViewWrapper as="figure" className={`gw-youtube${selected ? ' is-selected' : ''}`} data-youtube-id={videoId}>
      <div className="gw-youtube-frame">
        {videoId
          ? <iframe
              src={youTubeEmbedUrl(videoId)}
              title={caption || '유튜브 영상'}
              loading="lazy"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          : <p className="gw-youtube-empty">영상을 불러올 수 없습니다.</p>}
      </div>
      <figcaption>
        <input
          value={caption}
          onChange={(event) => updateAttributes({ caption: event.target.value })}
          placeholder="영상 설명 (선택)"
          maxLength={1000}
          aria-label="영상 설명"
        />
      </figcaption>
      <div className="gw-youtube-tools" contentEditable={false}>
        <button type="button" onClick={changeVideo}>영상 바꾸기</button>
        <button type="button" onClick={deleteNode}>삭제</button>
      </div>
    </NodeViewWrapper>
  );
}
