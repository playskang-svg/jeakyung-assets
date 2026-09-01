import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

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


// .env 없이 돌리면 Supabase 주소가 빈 값으로 들어가서, 그룹웨어가 로그인 화면에서
// "Supabase 연결 설정이 필요합니다" 만 띄우고 멈춘다. 화면은 멀쩡히 그려지기 때문에
// 무엇이 빠졌는지 알아채기 어렵다.
//   build : 그대로 배포되면 실제 사이트가 죽으므로 멈춘다.
//   dev   : 공개 사이트만 손볼 때는 키 없이도 쓸 수 있어야 하니, 멈추는 대신
//           터미널에 눈에 띄게 알린다.
function checkSupabaseEnv(mode, command) {
  const env = loadEnv(mode, projectRoot, 'VITE_');
  const missing = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY']
    .filter((key) => !env[key]?.trim());
  if (missing.length === 0) return;

  if (command === 'build') {
    throw new Error(
      `${missing.join(', ')} 이(가) 없어 빌드를 멈춥니다. source/.env 를 만든 뒤 다시 빌드해 주세요.\n`
      + '이 값 없이 만든 번들은 그룹웨어 로그인이 동작하지 않습니다.',
    );
  }

  console.warn(
    `\n\u001b[33m┌─ source/.env 가 없습니다 ─────────────────────────────\u001b[0m\n`
    + `\u001b[33m│\u001b[0m 빠진 값: ${missing.join(', ')}\n`
    + `\u001b[33m│\u001b[0m 공개 사이트는 그대로 보이지만 \u001b[1m/groupware/ 로그인은 동작하지 않습니다.\u001b[0m\n`
    + `\u001b[33m│\u001b[0m 고치려면: cp .env.example .env 로 만든 뒤 Supabase 대시보드의\n`
    + `\u001b[33m│\u001b[0m Settings → API 에서 Project URL 과 publishable key 를 채우고,\n`
    + `\u001b[33m│\u001b[0m 개발 서버를 다시 시작하세요.\n`
    + `\u001b[33m└──────────────────────────────────────────────────────\u001b[0m\n`,
  );
}

export default defineConfig(({ command, mode }) => {
  checkSupabaseEnv(mode, command);
  return {
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
  };
});
