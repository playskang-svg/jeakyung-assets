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

    // Ensure HTML is never stale-cached by edge or browser
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
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
