export const ARTICLE_THUMBNAIL_MAP = {
  '676dacaa-86ac-4737-93ab-8a0388c542c3': '/assets/articles/logistics-workforce.webp',
  '7d946bbb-e6d1-4172-bf2e-bf86b8cffb9c': '/assets/articles/esg-logistics.webp',
  'a99c27d3-6109-4e83-9598-7a8706b116db': '/assets/articles/3pl-selection-criteria.webp',
  'a6ed4a2a-8e88-49a6-935e-7f516141e58f': '/assets/articles/digital-logistics-wms-tms.webp',
  '53098f28-f4e7-49d3-9fc9-f866c2ba5a61': '/assets/articles/warehouse-safety-management.webp',
  'd206417e-2592-4035-b33b-1662bf3d933b': '/assets/articles/cost-reduction-guide.webp',
  'f25b65a9-89f1-4630-b94f-81d8108f394d': '/assets/articles/regional-logistics-hub.webp',
  '179cd6a3-78dc-49ae-8bff-5a27fc16d443': '/assets/articles/logistics-market-outlook-2026.webp',
  'eda292ca-c47b-4a72-a6de-6662077875c1': '/assets/articles/fulfillment-automation-robot.webp',
};

export function resolveArticleThumbnail(article) {
  if (!article) return null;
  return article.thumbnail_url || ARTICLE_THUMBNAIL_MAP[article.id] || null;
}
