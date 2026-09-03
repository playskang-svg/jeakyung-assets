// 서비스 카드와 그 서비스의 글 목록이 함께 쓰는 표.
//
// 열쇠말(3pl, fresh …)은 site_articles.service_key 에 그대로 들어간다. 글을
// 새로 쓸 때 이 값을 붙이면 그 서비스의 목록에 나타난다. 이름을 여기 한 곳에
// 두는 까닭은, 카드 제목과 목록 페이지 제목이 갈라지지 않게 하기 위해서다.
export const SERVICE_NAMES = {
  '3pl': '3PL 물류대행',
  fresh: '신선식품 풀필먼트',
  transport: '기업운송',
  storage: '보관물류',
  consulting: '물류컨설팅',
};

export const serviceName = (key) => SERVICE_NAMES[key] ?? '';

// 카드의 "자세히 보기"와 띠의 그림이 함께 여는 자리.
export const serviceListHref = (key) => `news/?service=${encodeURIComponent(key)}`;

// "3PL 물류대행을", "신선식품 풀필먼트를" — 받침에 따라 조사를 고른다.
// 을(를) 처럼 두 벌을 함께 적으면 읽기가 걸린다.
export function withObjectParticle(name) {
  const last = (name ?? '').trim().slice(-1);
  const code = last.charCodeAt(0);
  const hangul = code >= 0xac00 && code <= 0xd7a3;
  const hasFinal = hangul && (code - 0xac00) % 28 !== 0;
  return `${name}${hasFinal ? '을' : '를'}`;
}
