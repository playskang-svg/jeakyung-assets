// quick: 대시보드 게시판 판 위에 한 줄로 세우는 버튼. 숫자는 그 줄의 순서다.
// 예전에는 대표님·결제 링크 발송·적격수급평가가 여기 적혀만 있고 화면 어디에도
// 나오지 않아 주소를 아는 사람만 쓸 수 있었다.
// 화면 제목과 경로 줄이 쓰는 목록. 대시보드는 게시판을 서버에서 받아 그리므로
// 여기에는 게시판별 항목을 두지 않는다.
export const GROUPWARE_NAVIGATION = [
  { key: 'dashboard', label: '대시보드', path: '/dashboard' },
  // 웹메일은 다른 화면 안에 실리는 것을 막아 둔다(X-Frame-Options). 액자에
  // 넣으면 빈 화면만 남으므로 이것만 새 탭으로 연다.
  { key: 'mail', label: '사내메일', href: 'https://mail.jeakyung.com/', newTab: true, quick: 10 },
  { key: 'approval', label: '전자결재', path: '/approval', quick: 20 },
  { key: 'organization', label: '조직도', path: '/organization', quick: 30 },
  { key: 'calendar', label: '일정', path: '/calendar' },
  { key: 'files', label: '파일', path: '/files', quick: 40 },
  { key: 'boards', label: '게시판', path: '/boards' },
  { key: 'consignment', label: '지입업무', href: 'https://jeakyung.quv.kr/41', quick: 45 },
  { key: 'safety-eval', label: '적격수급평가', href: 'https://jeakyung.com/hl-safety-eval/', quick: 50 },
  { key: 'ceo', label: '대표님', href: 'https://jeakyung.quv.kr/17', quick: 60 },
  { key: 'payment-link', label: '결제 링크 발송', href: 'https://seller.payapp.kr/r/using_reg?payreqtype=krw', quick: 70 },
  { key: 'admin', label: '관리자', path: '/admin', requiredPermission: 'admin.access' },
];


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
  [/^\/view\/[^/]+$/, ['바로가기', null]],
  [/^\/profile$/, ['내 프로필', null]],
];

export function getRouteTrail(pathname) {
  const home = { label: '홈', path: '/dashboard' };
  const rule = TRAIL_RULES.find(([pattern]) => pattern.test(pathname));
  if (!rule) return [home];
  const steps = rule.slice(1).map(([label, path]) => ({ label, path: path ?? pathname }));
  return [home, ...steps];
}

// 빠른 실행 줄. quick 숫자 순으로 세운다. 바깥 주소를 가리키는 항목도 새 탭이
// 아니라 /view/<key> 로 보내 그룹웨어 화면 안에서 열리게 한다.
export const quickLinks = () => GROUPWARE_NAVIGATION
  .filter((item) => typeof item.quick === 'number')
  .sort((a, b) => a.quick - b.quick)
  .map((item) => (item.newTab
    ? { ...item, to: null }
    : { ...item, to: item.path ?? `/view/${item.key}` }));
