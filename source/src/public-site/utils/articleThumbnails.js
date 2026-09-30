export const ARTICLE_THUMBNAIL_MAP = {
  '676dacaa-86ac-4737-93ab-8a0388c542c3': '/assets/articles/logistics-workforce-photo.webp',
  '7d946bbb-e6d1-4172-bf2e-bf86b8cffb9c': '/assets/articles/esg-logistics-photo.webp',
  'a99c27d3-6109-4e83-9598-7a8706b116db': '/assets/articles/3pl-selection-criteria-photo.webp',
  'a6ed4a2a-8e88-49a6-935e-7f516141e58f': '/assets/articles/digital-logistics-wms-tms-photo.webp',
  '53098f28-f4e7-49d3-9fc9-f866c2ba5a61': '/assets/articles/warehouse-safety-management-photo.webp',
  'd206417e-2592-4035-b33b-1662bf3d933b': '/assets/articles/cost-reduction-guide-photo.webp',
  'f25b65a9-89f1-4630-b94f-81d8108f394d': '/assets/articles/regional-logistics-hub-photo.webp',
  '179cd6a3-78dc-49ae-8bff-5a27fc16d443': '/assets/articles/logistics-market-outlook-2026-photo.webp',
  'eda292ca-c47b-4a72-a6de-6662077875c1': '/assets/articles/fulfillment-automation-robot-photo.webp',
};

export function resolveArticleThumbnail(article) {
  if (!article) return null;
  return article.thumbnail_url || ARTICLE_THUMBNAIL_MAP[article.id] || null;
}

/**
 * 본문 상세 보기에서 상단 대표 썸네일을 띄울지 결정한다.
 * 본문(content_html) 서두에 이미 같은 이미지나 대표 이미지가 포함되어 있는 경우
 * 중복 출력을 방지하여 화면에 단 1번만 나오도록 한다.
 */
export function shouldShowArticleDetailThumb(thumbUrl, contentHtml) {
  if (!thumbUrl) return false;
  if (!contentHtml) return true;

  // 본문 내 이미지 태그 추출
  const imgMatches = [...contentHtml.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)];
  if (imgMatches.length === 0) return true;

  // 쿼리스트링 및 HTML 엔티티 정규화
  const cleanThumb = thumbUrl.replace(/&amp;/g, '&').split('?')[0].split('#')[0];
  const thumbBaseName = cleanThumb.split('/').filter(Boolean).pop();

  for (const match of imgMatches) {
    const src = match[1].replace(/&amp;/g, '&').split('?')[0].split('#')[0];
    const srcBaseName = src.split('/').filter(Boolean).pop();
    if (cleanThumb === src || (thumbBaseName && srcBaseName && thumbBaseName === srcBaseName)) {
      return false; // 본문에 완전히 동일한 이미지가 이미 있으므로 상단 썸네일 숨김
    }
  }

  // 본문 앞부분(600자 이내)에 이미 이미지가 있으면 상단 중복 방지
  const firstImgIndex = contentHtml.search(/<img\s/i);
  if (firstImgIndex !== -1 && firstImgIndex < 600) {
    return false;
  }

  return true;
}
