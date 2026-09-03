// 게시판에서 쓰는 날짜 표기. 2026.9.3 13:19 처럼 분까지 적는다.
//
// 날짜만 적으면 같은 날 올라온 글의 앞뒤를 알 수 없다. 게시판은 하루에 여러
// 건이 오가는 자리라 시각이 있어야 한다.
//
// 월·일은 앞의 0 을 붙이지 않고, 시·분은 붙인다. 09:05 를 9:5 로 적으면
// 시각으로 읽히지 않는다.
export function formatBoardDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()} ${time}`;
}

export default formatBoardDateTime;
