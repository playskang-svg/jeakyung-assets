// shortcut: 대시보드에 바로가기 줄로 내보낼 항목. 사이드바를 없앤 뒤로 이
// 목록이 게시판 말고 다른 곳으로 갈 수 있는 유일한 길이라, 여기 없으면 주소를
// 직접 치는 수밖에 없다.
//   'module' — 그룹웨어 안의 기능. 게시판 박스 위에 놓는다.
//   'tool'   — 바깥 서비스. 성격이 달라 맨 아래로 내린다.
// 대시보드(자기 자신)와 관리자(상단 오른쪽 버튼)는 shortcut 을 주지 않는다.
export const GROUPWARE_NAVIGATION = [
  { key: 'dashboard', label: '대시보드', path: '/dashboard' },
  { key: 'mail', label: '사내메일', href: 'https://mail.jeakyung.com', external: true, shortcut: 'module' },
  { key: 'approval', label: '전자결재', path: '/approval', shortcut: 'module' },
  { key: 'organization', label: '조직도', path: '/organization', shortcut: 'module' },
  { key: 'calendar', label: '일정', path: '/calendar', shortcut: 'module' },
  { key: 'files', label: '파일', path: '/files', shortcut: 'module' },
  { key: 'boards', label: '게시판', path: '/boards' },
  { key: 'safety-eval', label: '적격수급평가', href: 'https://jeakyung.com/hl-safety-eval/', external: true, shortcut: 'tool' },
  { key: 'ceo', label: '대표님', href: 'https://jeakyung.quv.kr/17', external: true, shortcut: 'tool' },
  { key: 'payment-link', label: '결제 링크 발송', href: 'https://seller.payapp.kr/r/using_reg?payreqtype=krw', external: true, shortcut: 'tool' },
  { key: 'admin', label: '관리자', path: '/admin', requiredPermission: 'admin.access' },
];

export const shortcutsOf = (kind) => GROUPWARE_NAVIGATION.filter((item) => item.shortcut === kind);

export function getRouteTitle(pathname) {
  if (pathname.startsWith('/boards/')) return '게시판';
  if (pathname.startsWith('/approval/')) return '전자결재';
  if (pathname.startsWith('/admin/')) return '관리자';
  if (pathname === '/profile' || pathname === '/mypage') return '내 프로필';
  return GROUPWARE_NAVIGATION.find((item) => pathname === item.path)?.label ?? '그룹웨어';
}
