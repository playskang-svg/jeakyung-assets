import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

const preserveLegacyScript = {
  name: 'preserve-legacy-script',
  transformIndexHtml: {
    order: 'pre',
    handler(html) {
      return html.replace(
        /<script src="((?:\.\.\/)?js\/main\.js)"><\/script>/g,
        '<script type="module" src="$1"></script>',
      );
    },
  },
};

function useGroupwareFallback(middlewares) {
  middlewares.use((request, _response, next) => {
    const [pathname, query = ''] = (request.url || '').split('?');
    const isGroupwareRoute = pathname === '/groupware'
      || pathname === '/groupware/'
      || (pathname.startsWith('/groupware/') && !pathname.split('/').at(-1).includes('.'));

    if (isGroupwareRoute) {
      request.url = `/groupware/index.html${query ? `?${query}` : ''}`;
    }

    next();
  });
}

const groupwareSpaFallback = {
  name: 'groupware-spa-fallback',
  configureServer(server) {
    useGroupwareFallback(server.middlewares);
  },
  configurePreviewServer(server) {
    useGroupwareFallback(server.middlewares);
  },
};

export default defineConfig({
  plugins: [groupwareSpaFallback, preserveLegacyScript, react()],
  publicDir: 'static',
  build: {
    // esbuild의 CSS 최적화는 타깃이 최신이면 미디어쿼리를 Level 4 range 문법으로
    // 축약한다(@media (max-width: 1023px) → @media (width<=1023px)).
    // 이 문법은 Safari 16.4+ 에서만 인식되므로 그 이전 iOS 기기에서는 반응형
    // 스타일이 통째로 무시되어 모바일에서도 데스크톱 레이아웃이 그대로 나온다.
    // 타깃을 낮춰 range 문법 자체가 생성되지 않게 한다.
    cssTarget: ['chrome87', 'edge88', 'firefox78', 'safari14'],
    rollupOptions: {
      input: {
        home: fileURLToPath(new URL('index.html', import.meta.url)),
        privacy: fileURLToPath(new URL('privacy/index.html', import.meta.url)),
        news: fileURLToPath(new URL('news/index.html', import.meta.url)),
        groupware: fileURLToPath(new URL('groupware/index.html', import.meta.url)),
      },
    },
  },
  server: {
    fs: {
      strict: true,
      allow: [projectRoot],
    },
  },
});
