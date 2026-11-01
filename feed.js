// jeakyung.com 네이버/구글 서치콘솔 호환 사이트맵 및 RSS 2.0 피드 생성 모듈

const BASE_URL = 'https://jeakyung.com';
const SUPABASE_URL = 'https://vzswlvumcdxnryrfwkkl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Jl43SzCeIQ90W-yYKgCQNA_2bS1K7Sd';

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function fetchArticles() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_site_articles`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_limit: 50 }),
    });
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  } catch (err) {
    console.error('Error fetching articles for sitemap/rss:', err);
  }
  return [];
}

const STATIC_PAGES = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/services/', priority: '0.9', changefreq: 'weekly' },
  { path: '/news/', priority: '0.9', changefreq: 'daily' },
  { path: '/company-profile/', priority: '0.8', changefreq: 'monthly' },
  { path: '/privacy/', priority: '0.3', changefreq: 'yearly' },
];

export async function generateSitemap() {
  const articles = await fetchArticles();
  const today = new Date().toISOString().split('T')[0];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  for (const page of STATIC_PAGES) {
    xml += `  <url>\n`;
    xml += `    <loc>${BASE_URL}${page.path}</loc>\n`;
    xml += `    <lastmod>${today}</lastmod>\n`;
    xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
    xml += `    <priority>${page.priority}</priority>\n`;
    xml += `  </url>\n`;
  }

  for (const art of articles) {
    if (!art.id) continue;
    const lastmod = art.published_at ? art.published_at.split('T')[0] : today;
    const loc = `${BASE_URL}/news/?article=${encodeURIComponent(art.id)}`;
    xml += `  <url>\n`;
    xml += `    <loc>${escapeXml(loc)}</loc>\n`;
    xml += `    <lastmod>${lastmod}</lastmod>\n`;
    xml += `    <changefreq>monthly</changefreq>\n`;
    xml += `    <priority>0.7</priority>\n`;
    xml += `  </url>\n`;
  }

  xml += `</urlset>\n`;
  return xml;
}

export async function generateRss() {
  const articles = await fetchArticles();
  const now = new Date().toUTCString();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n`;
  xml += `  <channel>\n`;
  xml += `    <title>재경로지스｜물류</title>\n`;
  xml += `    <link>${BASE_URL}/</link>\n`;
  xml += `    <description>3PL 물류대행과 신선식품 풀필먼트를 중심으로 기업운송, 보관물류, 물류컨설팅을 제공하는 재경로지스｜물류의 소식 및 기사 피드입니다.</description>\n`;
  xml += `    <language>ko</language>\n`;
  xml += `    <lastBuildDate>${now}</lastBuildDate>\n`;
  xml += `    <atom:link href="${BASE_URL}/rss.xml" rel="self" type="application/rss+xml" />\n`;

  // 기본 홈 항목
  xml += `    <item>\n`;
  xml += `      <title>재경로지스｜물류 - 3PL 물류 및 신선식품 풀필먼트 전문</title>\n`;
  xml += `      <link>${BASE_URL}/</link>\n`;
  xml += `      <description>${escapeXml('3PL 물류대행과 신선식품 풀필먼트를 중심으로 기업운송, 보관물류, 물류컨설팅을 제공합니다.')}</description>\n`;
  xml += `      <pubDate>${now}</pubDate>\n`;
  xml += `      <guid isPermaLink="true">${BASE_URL}/</guid>\n`;
  xml += `    </item>\n`;

  for (const art of articles) {
    if (!art.id) continue;
    const link = `${BASE_URL}/news/?article=${encodeURIComponent(art.id)}`;
    const pubDate = art.published_at ? new Date(art.published_at).toUTCString() : now;
    xml += `    <item>\n`;
    xml += `      <title>${escapeXml(art.title)}</title>\n`;
    xml += `      <link>${escapeXml(link)}</link>\n`;
    xml += `      <description>${escapeXml(art.summary || art.title)}</description>\n`;
    xml += `      <pubDate>${pubDate}</pubDate>\n`;
    xml += `      <guid isPermaLink="true">${escapeXml(link)}</guid>\n`;
    if (art.category) {
      xml += `      <category>${escapeXml(art.category)}</category>\n`;
    }
    if (art.author) {
      xml += `      <author>${escapeXml(art.author)}</author>\n`;
    }
    xml += `    </item>\n`;
  }

  xml += `  </channel>\n`;
  xml += `</rss>\n`;
  return xml;
}
