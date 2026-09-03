import { useEffect, useMemo, useState } from 'react';

import { getAttachmentViewUrl, getInlineAttachmentUrls } from '../../services/boardService.js';
import { EMPTY_BOARD_DOCUMENT } from '../../utils/boardDocument.js';
import { YOUTUBE_ID, youTubeEmbedUrl } from './YouTubeEmbed.js';

const HEX_COLOR = /^#[0-9a-f]{3,8}$/i;
const SAFE_HREF = /^https?:\/\//i;
// 이미지는 https 만 받는다. http 는 브라우저가 혼합 콘텐츠로 막아 어차피 안 보인다.
const SAFE_IMAGE_SRC = /^https:\/\//i;

function MarkedText({ node }) {
  let content = node.text ?? '';
  for (const mark of node.marks ?? []) {
    if (mark.type === 'bold') content = <strong>{content}</strong>;
    else if (mark.type === 'italic') content = <em>{content}</em>;
    else if (mark.type === 'strike') content = <s>{content}</s>;
    else if (mark.type === 'code') content = <code>{content}</code>;
    else if (mark.type === 'underline') content = <u>{content}</u>;
    else if (mark.type === 'highlight') {
      const color = mark.attrs?.color;
      content = <mark style={HEX_COLOR.test(color ?? '') ? { background: color } : undefined}>{content}</mark>;
    } else if (mark.type === 'textStyle') {
      const color = mark.attrs?.color;
      if (HEX_COLOR.test(color ?? '')) content = <span style={{ color }}>{content}</span>;
    } else if (mark.type === 'link') {
      // 저장 시 DB에서도 검사하지만, 예전 문서를 대비해 여기서도 스킴을 확인한다.
      const href = mark.attrs?.href ?? '';
      if (SAFE_HREF.test(href)) content = <a href={href} target="_blank" rel="noopener noreferrer">{content}</a>;
    }
  }
  return content;
}

const ALIGNMENTS = new Set(['left', 'center', 'right', 'justify']);
const alignStyle = (node) => (ALIGNMENTS.has(node.attrs?.textAlign) ? { textAlign: node.attrs.textAlign } : undefined);

function RenderNodes({ nodes = [], urls, openImage }) {
  return nodes.map((node, index) => {
    const key = `${node.type}-${index}`;
    const children = <RenderNodes nodes={node.content} urls={urls} openImage={openImage} />;
    if (node.type === 'text') return <MarkedText key={key} node={node} />;
    if (node.type === 'paragraph') return <p key={key} style={alignStyle(node)}>{children}</p>;
    if (node.type === 'heading') {
      const level = Math.min(Math.max(Number(node.attrs?.level) || 2, 1), 3);
      const Heading = `h${level}`;
      return <Heading key={key} style={alignStyle(node)}>{children}</Heading>;
    }
    if (node.type === 'bulletList') return <ul key={key}>{children}</ul>;
    if (node.type === 'orderedList') {
      const listType = ['1', 'a', 'A', 'i', 'I'].includes(node.attrs?.type) ? node.attrs.type : undefined;
      return <ol key={key} start={Number(node.attrs?.start) || 1} type={listType}>{children}</ol>;
    }
    if (node.type === 'listItem') return <li key={key}>{children}</li>;
    if (node.type === 'blockquote') return <blockquote key={key}>{children}</blockquote>;
    if (node.type === 'codeBlock') return <pre key={key}><code>{node.content?.map((item) => item.text ?? '').join('')}</code></pre>;
    if (node.type === 'horizontalRule') return <hr key={key} />;
    if (node.type === 'hardBreak') return <br key={key} />;
    if (node.type === 'externalImage') {
      // 주소로 연결한 이미지. 저장 시 DB 에서도 https 만 통과시키지만, 예전 문서를
      // 대비해 여기서도 스킴을 확인한다. 클릭 확대는 없다 - 원본이 곧 그 주소다.
      const { src = '', alt = '', caption = '', alignment = 'center', size = 'medium', width = null, flow = 'block' } = node.attrs ?? {};
      if (!SAFE_IMAGE_SRC.test(src)) return null;
      return <figure key={key} className={`gw-inline-image gw-inline-image--${alignment} gw-inline-image--${size} gw-inline-image--flow-${flow}`} style={size === 'custom' && width ? { '--gw-image-width': `${width}px` } : undefined}>
        <a href={src} target="_blank" rel="noopener noreferrer" aria-label={`${alt || '본문 이미지'} 원본 열기, 새 창`}>
          <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" />
        </a>
        {caption && <figcaption>{caption}</figcaption>}
      </figure>;
    }
    if (node.type === 'youtubeEmbed') {
      // 문서에는 영상 번호만 있다. 재생 주소는 여기서 만들어 붙이므로,
      // 남의 주소가 이 자리에 실릴 길이 없다. 형태가 어긋나면 그냥 지운다.
      const { videoId = '', caption = '' } = node.attrs ?? {};
      if (!YOUTUBE_ID.test(videoId)) return null;
      return <figure key={key} className="gw-youtube">
        <div className="gw-youtube-frame">
          <iframe
            src={youTubeEmbedUrl(videoId)}
            title={caption || '유튜브 영상'}
            loading="lazy"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
        {caption && <figcaption>{caption}</figcaption>}
      </figure>;
    }
    if (node.type === 'inlineImage') {
      const { attachmentId, alt = '', caption = '', alignment = 'center', size = 'medium', width = null, flow = 'block' } = node.attrs ?? {};
      const source = urls[attachmentId];
      return <figure key={key} className={`gw-inline-image gw-inline-image--${alignment} gw-inline-image--${size} gw-inline-image--flow-${flow}`} style={size === 'custom' && width ? { '--gw-image-width': `${width}px` } : undefined}>
        {source
          ? <button type="button" className="gw-inline-image-open" onClick={() => openImage(attachmentId)} aria-label={`${alt || '본문 이미지'} 원본 확대 보기`}><img src={source} alt={alt} /></button>
          : <div className="gw-inline-image-placeholder" role="status">이미지를 표시할 수 없습니다.</div>}
        {caption && <figcaption>{caption}</figcaption>}
      </figure>;
    }
    return null;
  });
}

export default function BoardDocumentRenderer({
  documentValue = EMPTY_BOARD_DOCUMENT,
  attachments = [],
  loadInlineUrls = getInlineAttachmentUrls,
  loadAttachmentUrl = getAttachmentViewUrl,
}) {
  const inlineAttachments = useMemo(() => attachments.filter((item) => item.purpose === 'inline_image'), [attachments]);
  const [urls, setUrls] = useState({});

  useEffect(() => {
    let active = true;
    loadInlineUrls(inlineAttachments).then((result) => { if (active) setUrls(result); }).catch(() => { if (active) setUrls({}); });
    return () => { active = false; };
  }, [inlineAttachments, loadInlineUrls]);

  const openImage = async (attachmentId) => {
    const popup = window.open('about:blank', '_blank');
    if (popup) popup.opener = null;
    try {
      const signedUrl = await loadAttachmentUrl(attachmentId);
      if (popup) popup.location.replace(signedUrl);
      else window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch {
      if (popup) popup.close();
    }
  };

  return <div className="gw-board-document"><RenderNodes nodes={documentValue.content} urls={urls} openImage={openImage} /></div>;
}
