// Paths that must never be indexed by search engines (internal/private or noindex-marked areas).
// Mirrors the noindex rules the old vercel.json headers config applied.
const NOINDEX_PREFIXES = ['/groupware', '/hl-safety-eval', '/legacy', '/notice'];

function applyCommonHeaders(response, pathname) {
  const withHeaders = new Response(response.body, response);
  const headers = withHeaders.headers;

  // Security headers (previously set by vercel.json's global "/(.*)" rule)
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  if (NOINDEX_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    headers.set('X-Robots-Tag', 'noindex, nofollow');
  }

  if (pathname.startsWith('/assets/')) {
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (pathname === '/favicon.ico' || pathname === '/favicon.svg') {
    headers.set('Cache-Control', 'public, max-age=86400');
  }

  return withHeaders;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const lastSegment = url.pathname.split('/').pop() || '';
    const isFile = lastSegment.includes('.');

    let response = await env.ASSETS.fetch(request);

    // Fallback to /groupware/ for client-side SPA routes (not missing files)
    if (response.status === 404 && !isFile && url.pathname.startsWith('/groupware')) {
      const fallbackUrl = new URL('/groupware/', request.url);
      response = await env.ASSETS.fetch(new Request(fallbackUrl, request));
    }

    // Only process successful HTML responses further; still apply common headers to everything else.
    if (response.status !== 200) {
      return applyCommonHeaders(response, url.pathname);
    }

    // Dynamic OpenGraph metadata injection for shared articles
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      const articleId = url.searchParams.get('article');
      if (articleId && (url.pathname.startsWith('/news') || url.pathname.startsWith('/services'))) {
        try {
          const rpcRes = await fetch('https://vzswlvumcdxnryrfwkkl.supabase.co/rest/v1/rpc/get_public_site_article', {
            method: 'POST',
            headers: {
              'apikey': 'sb_publishable_Jl43SzCeIQ90W-yYKgCQNA_2bS1K7Sd',
              'Authorization': 'Bearer sb_publishable_Jl43SzCeIQ90W-yYKgCQNA_2bS1K7Sd',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ p_id: articleId }),
          });
          if (rpcRes.ok) {
            const data = await rpcRes.json();
            const article = Array.isArray(data) ? data[0] : data;
            if (article && article.title) {
              const pageTitle = `${article.title} | 재경로지스｜물류`;
              const summary = (article.summary || article.title || '').replace(/\s+/g, ' ').trim();
              const thumb = article.thumbnail_url || 'https://jeakyung.com/og-image.png';

              const rewriter = new HTMLRewriter()
                .on('title', { element(e) { e.setInnerContent(pageTitle); } })
                .on('meta[property="og:title"]', { element(e) { e.setAttribute('content', pageTitle); } })
                .on('meta[property="og:description"]', { element(e) { e.setAttribute('content', summary); } })
                .on('meta[property="og:image"]', { element(e) { e.setAttribute('content', thumb); } })
                .on('meta[property="og:image:alt"]', { element(e) { e.setAttribute('content', article.title); } })
                .on('meta[property="og:image:width"]', { element(e) { e.remove(); } })
                .on('meta[property="og:image:height"]', { element(e) { e.remove(); } })
                .on('meta[property="og:url"]', { element(e) { e.setAttribute('content', request.url); } })
                .on('link[rel="canonical"]', { element(e) { e.setAttribute('href', request.url); } })
                .on('meta[name="description"]', { element(e) { e.setAttribute('content', summary); } });

              response = rewriter.transform(response);
            }
          }
        } catch {
          // fallback silently
        }
      }

      // Ensure HTML is never stale-cached by edge or browser
      const newResponse = applyCommonHeaders(response, url.pathname);
      newResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      newResponse.headers.set('Pragma', 'no-cache');
      newResponse.headers.set('Expires', '0');
      return newResponse;
    }

    return applyCommonHeaders(response, url.pathname);
  },
};
