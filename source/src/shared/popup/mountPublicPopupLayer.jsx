// 공개 사이트는 마케팅 페이지라 첫 화면 속도가 중요하다. 팝업 레이어는
// supabase-js를 함께 끌고 오므로 초기 번들에 넣지 않고, 페이지가 한가해진 뒤에
// 따로 내려받아 붙인다. 팝업이 없으면 아무것도 렌더링하지 않는다.
const whenIdle = (run) => {
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 3000 });
  else window.setTimeout(run, 1200);
};

export function mountPublicPopupLayer(target) {
  whenIdle(async () => {
    try {
      const [{ createRoot }, { default: PopupLayer }, { publicSupabase }] = await Promise.all([
        import('react-dom/client'),
        import('./PopupLayer.jsx'),
        import('../supabaseAnon.js'),
      ]);
      if (!publicSupabase) return;
      const host = document.createElement('div');
      document.body.appendChild(host);
      createRoot(host).render(<PopupLayer client={publicSupabase} target={target} />);
    } catch {
      /* 팝업은 부가 기능이라 실패해도 페이지는 그대로 둔다. */
    }
  });
}
