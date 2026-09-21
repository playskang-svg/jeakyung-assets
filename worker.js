export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const lastSegment = url.pathname.split('/').pop() || '';
    const isFile = lastSegment.includes('.');

    let response;
    // Direct SPA serving for all /groupware routes without file extension
    if (!isFile && (url.pathname === '/groupware' || url.pathname.startsWith('/groupware/'))) {
      const fallbackUrl = new URL('/groupware/index.html', request.url);
      response = await env.ASSETS.fetch(new Request(fallbackUrl, request));
    } else {
      response = await env.ASSETS.fetch(request);
      if (response.status === 404 && url.pathname.startsWith('/groupware')) {
        const fallbackUrl = new URL('/groupware/index.html', request.url);
        response = await env.ASSETS.fetch(new Request(fallbackUrl, request));
      }
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
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ p_id: articleId }),
          });
          if (rpcRes.ok) {
            const data = await rpcRes.json();
            const article = Array.isArray(data) ? data[0] : data;
            if (article && article.title) {
              const pageTitle = `${article.title} | 재경로지스｜물류`;
              const summary = (article.summary || article.title).replace(/\s+/g, ' ').trim();
              const thumb = article.thumbnail_url || 'https://jeakyung.com/og-image.png';

              response = new HTMLRewriter()
                .on('title', { element(e) { e.setInnerContent(pageTitle); } })
                .on('meta[property="og:title"]', { element(e) { e.setAttribute('content', pageTitle); } })
                .on('meta[property="og:description"]', { element(e) { e.setAttribute('content', summary); } })
                .on('meta[property="og:image"]', { element(e) { e.setAttribute('content', thumb); } })
                .on('meta[property="og:url"]', { element(e) { e.setAttribute('content', request.url); } })
                .on('meta[name="description"]', { element(e) { e.setAttribute('content', summary); } })
                .on('meta[name="twitter:title"]', { element(e) { e.setAttribute('content', pageTitle); } })
                .on('meta[name="twitter:description"]', { element(e) { e.setAttribute('content', summary); } })
                .on('meta[name="twitter:image"]', { element(e) { e.setAttribute('content', thumb); } })
                .transform(response);
            }
          }
        } catch {
          // fallback silently
        }
      }

      // Ensure HTML is never stale-cached by edge or browser
      const newHeaders = new Headers(response.headers);
      newHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      newHeaders.set('Pragma', 'no-cache');
      newHeaders.set('Expires', '0');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    }

    return response;
  },
};
