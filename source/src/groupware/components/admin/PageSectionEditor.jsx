// 페이지 항목이 내용을 직접 담는 종류(html·richtext·buttons)일 때 쓰는 편집기.
// 대상을 가리키는 종류는 여기까지 오지 않는다.
import { useState } from 'react';

import BoardPostEditor from '../editor/BoardPostEditor.jsx';
import PageSection from '../PageSection.jsx';
import { uploadSiteArticleThumbnail } from '../../services/siteArticleService.js';

// 글 편집기는 원래 게시판에 매여 있고 첨부를 게시판 저장소에 올린다. 페이지 항목은
// 게시글이 아니므로, 주입할 수 있게 열려 있는 두 갈래(uploadImage·getImageUrl)만
// 공개 버킷 쪽으로 바꿔 끼운다. 공개 버킷은 주소 자체가 곧 식별자다.
const PAGE_EDITOR_BOARD = {
  id: null,
  settings: { max_inline_image_size_mb: 5, max_inline_images: 20 },
};
const uploadPageImage = async ({ file }) => ({ id: await uploadSiteArticleThumbnail(file) });
const pageImageUrl = async (id) => id;

const NEW_BUTTON = () => ({ key: crypto.randomUUID(), label: '', description: '', url: '' });

function HtmlEditor({ content, onChange }) {
  const [preview, setPreview] = useState(false);
  const html = content?.html ?? '';

  return (
    <div className="gw-section-editor">
      <div className="gw-section-editor-bar">
        <span className="gw-field-hint">
          HTML 을 직접 씁니다. 저장하면 안전 검사를 거쳐 표시되므로 스크립트나
          외부 삽입 태그는 걸러집니다. 표·제목·목록·이미지·링크는 그대로 남습니다.
        </span>
        <button type="button" className="gw-secondary-button" onClick={() => setPreview((current) => !current)}>
          {preview ? '편집' : '미리보기'}
        </button>
      </div>
      {preview
        ? <div className="gw-section-editor-preview"><PageSection item={{ item_type: 'html', content: { html } }} /></div>
        : (
          <textarea
            className="gw-html-editor"
            value={html}
            spellCheck={false}
            rows={16}
            placeholder={'<h2>제목</h2>\n<p>내용을 적습니다.</p>'}
            onChange={(event) => onChange({ html: event.target.value })}
          />
        )}
    </div>
  );
}

function RichTextEditor({ content, onChange }) {
  return (
    <div className="gw-section-editor">
      <span className="gw-field-hint">게시글과 같은 편집기입니다. 서식과 목록을 그대로 쓸 수 있습니다.</span>
      <BoardPostEditor
        board={PAGE_EDITOR_BOARD}
        initialDocument={content?.document ?? null}
        uploadImage={uploadPageImage}
        getImageUrl={pageImageUrl}
        onChange={(document) => onChange({ document })}
      />
    </div>
  );
}

function ButtonsEditor({ content, onChange }) {
  const buttons = content?.buttons ?? [];
  const patch = (index, next) => onChange({
    buttons: buttons.map((button, position) => (position === index ? { ...button, ...next } : button)),
  });

  return (
    <div className="gw-section-editor">
      <span className="gw-field-hint">누르면 새 탭으로 열리는 바로가기 목록입니다. 주소는 https:// 로 시작하거나 / 로 시작하는 내부 경로여야 합니다.</span>
      {buttons.map((button, index) => (
        <div className="gw-linkpage-item-row" key={button.key ?? index}>
          <input
            value={button.label ?? ''}
            maxLength={40}
            placeholder="제목"
            aria-label={`${index + 1}번 바로가기 제목`}
            onChange={(event) => patch(index, { label: event.target.value })}
          />
          <input
            value={button.description ?? ''}
            maxLength={80}
            placeholder="설명 (선택)"
            aria-label={`${index + 1}번 바로가기 설명`}
            onChange={(event) => patch(index, { description: event.target.value })}
          />
          <input
            value={button.url ?? ''}
            maxLength={300}
            placeholder="https://... 또는 /경로"
            aria-label={`${index + 1}번 바로가기 주소`}
            onChange={(event) => patch(index, { url: event.target.value })}
          />
          <button
            type="button"
            className="gw-secondary-button gw-icon-danger-button"
            aria-label={`${index + 1}번 바로가기 삭제`}
            onClick={() => onChange({ buttons: buttons.filter((_, position) => position !== index) })}
          >
            삭제
          </button>
        </div>
      ))}
      <button type="button" className="gw-secondary-button" onClick={() => onChange({ buttons: [...buttons, NEW_BUTTON()] })}>
        바로가기 추가
      </button>
    </div>
  );
}

export default function PageSectionEditor({ type, content, onChange }) {
  const merge = (next) => onChange({ ...(content ?? {}), ...next });
  if (type === 'html') return <HtmlEditor content={content} onChange={merge} />;
  if (type === 'richtext') return <RichTextEditor content={content} onChange={merge} />;
  if (type === 'buttons') return <ButtonsEditor content={content} onChange={merge} />;
  return null;
}
