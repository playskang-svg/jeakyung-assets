export const GROUPWARE_NAVIGATION = [
  { key: 'dashboard', label: '대시보드', path: '/dashboard' },
  { key: 'mail', label: '이메일', href: 'https://mail.jeakyung.com', external: true },
  { key: 'organization', label: '조직도', path: '/organization' },
  { key: 'boards', label: '게시판', path: '/boards' },
  { key: 'approval', label: '전자결재', path: '/approval' },
  { key: 'calendar', label: '일정', path: '/calendar' },
  { key: 'files', label: '파일', path: '/files' },
  { key: 'admin', label: '관리자', path: '/admin', requiredPermission: 'admin.access' },
];

export function getRouteTitle(pathname) {
  if (pathname.startsWith('/boards/')) return '게시판';
  if (pathname.startsWith('/approval/')) return '전자결재';
  if (pathname.startsWith('/admin/')) return '관리자';
  if (pathname === '/profile' || pathname === '/mypage') return '내 프로필';
  return GROUPWARE_NAVIGATION.find((item) => pathname === item.path)?.label ?? '그룹웨어';
}
