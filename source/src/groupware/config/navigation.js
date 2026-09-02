// 화면 제목과 경로 줄이 쓰는 목록. 대시보드는 게시판을 서버에서 받아 그리므로
// 여기에는 게시판별 항목을 두지 않는다.
export const GROUPWARE_NAVIGATION = [
  { key: 'dashboard', label: '대시보드', path: '/dashboard' },
  { key: 'mail', label: '사내메일', href: 'https://mail.jeakyung.com', external: true },
  { key: 'approval', label: '전자결재', path: '/approval' },
  { key: 'organization', label: '조직도', path: '/organization' },
  { key: 'calendar', label: '일정', path: '/calendar' },
  { key: 'files', label: '파일', path: '/files' },
  { key: 'boards', label: '게시판', path: '/boards' },
  { key: 'safety-eval', label: '적격수급평가', href: 'https://jeakyung.com/hl-safety-eval/', external: true },
  { key: 'ceo', label: '대표님', href: 'https://jeakyung.quv.kr/17', external: true },
  { key: 'payment-link', label: '결제 링크 발송', href: 'https://seller.payapp.kr/r/using_reg?payreqtype=krw', external: true },
  { key: 'admin', label: '관리자', path: '/admin', requiredPermission: 'admin.access' },
];


export function getRouteTitle(pathname) {
  if (pathname.startsWith('/boards/')) return '게시판';
  if (pathname.startsWith('/approval/')) return '전자결재';
  if (pathname.startsWith('/admin/')) return '관리자';
  if (pathname === '/profile' || pathname === '/mypage') return '내 프로필';
  return GROUPWARE_NAVIGATION.find((item) => pathname === item.path)?.label ?? '그룹웨어';
}

// 주소를 "홈 > 게시판 > 글쓰기" 같은 단계로 바꾼다. 경로 줄과 뒤로가기가
// 이 결과를 쓴다. 게시판 이름처럼 서버에서 와야 아는 값은 넣지 않는다.
// 화면마다 다시 불러오는 비용보다, 한 단계 덜 자세한 편이 낫다.
const TRAIL_RULES = [
  [/^\/boards\/[^/]+\/posts\/[^/]+\/edit$/, ['게시판', '/boards'], ['글 수정', null]],
  [/^\/boards\/[^/]+\/posts\/[^/]+$/, ['게시판', '/boards'], ['게시글', null]],
  [/^\/boards\/[^/]+\/write$/, ['게시판', '/boards'], ['글쓰기', null]],
  [/^\/boards\/[^/]+$/, ['게시판', '/boards'], ['게시판 보기', null]],
  [/^\/boards$/, ['게시판', null]],
  [/^\/approval\/.+/, ['전자결재', '/approval'], ['문서', null]],
  [/^\/approval$/, ['전자결재', null]],
  [/^\/admin\/.+/, ['관리자', '/admin'], ['설정', null]],
  [/^\/admin$/, ['관리자', null]],
  [/^\/pages\/[^/]+$/, ['업무 페이지', null]],
  [/^\/organization$/, ['조직도', null]],
  [/^\/calendar$/, ['일정', null]],
  [/^\/files$/, ['파일', null]],
  [/^\/profile$/, ['내 프로필', null]],
];

export function getRouteTrail(pathname) {
  const home = { label: '홈', path: '/dashboard' };
  const rule = TRAIL_RULES.find(([pattern]) => pattern.test(pathname));
  if (!rule) return [home];
  const steps = rule.slice(1).map(([label, path]) => ({ label, path: path ?? pathname }));
  return [home, ...steps];
}
