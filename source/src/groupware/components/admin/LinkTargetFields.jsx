// 버튼이 열 곳을 고르는 공통 입력. 링크 페이지 항목과 버튼 박스 항목이 같이 쓴다.
//   board    : 게시판을 목록에서 고른다
//   page     : 다른 링크 페이지를 목록에서 고른다
//   external : 주소를 직접 적는다
// 실제로 열 주소(url)는 저장할 때 서버가 만들어 준다.
export const LINK_TYPES = [
  ['board', '게시판'],
  ['page', '페이지'],
  ['external', '외부 주소'],
];

export const emptyLinkTarget = (type = 'board') => ({ link_type: type, board_id: '', target_page_id: '', url: '' });

// 저장 직전 서버가 기대하는 모양으로 정리한다. 고르지 않은 칸은 비워 보낸다.
export function linkTargetPayload(item) {
  const type = item.link_type || 'board';
  return {
    link_type: type,
    board_id: type === 'board' ? item.board_id : '',
    target_page_id: type === 'page' ? item.target_page_id : '',
    url: type === 'external' ? (item.url ?? '').trim() : '',
  };
}

export function isLinkTargetComplete(item) {
  const type = item.link_type || 'board';
  if (type === 'board') return Boolean(item.board_id);
  if (type === 'page') return Boolean(item.target_page_id);
  return /^(https?:\/\/|\/)/i.test((item.url ?? '').trim());
}

export default function LinkTargetFields({ item, boards, pages, excludePageId, onChange, index }) {
  const type = item.link_type || 'board';
  const selectablePages = (pages ?? []).filter((page) => page.id !== excludePageId);

  return (
    <>
      <select
        value={type}
        aria-label={`${index + 1}번 버튼이 열 대상 종류`}
        onChange={(event) => onChange({ ...emptyLinkTarget(event.target.value) })}
      >
        {LINK_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>

      {type === 'board' && (
        <select
          value={item.board_id ?? ''}
          aria-label={`${index + 1}번 버튼에 연결할 게시판`}
          onChange={(event) => onChange({ board_id: event.target.value })}
        >
          <option value="">게시판 선택</option>
          {(boards ?? []).map((board) => <option key={board.id} value={board.id}>{board.name}</option>)}
        </select>
      )}

      {type === 'page' && (
        <select
          value={item.target_page_id ?? ''}
          aria-label={`${index + 1}번 버튼에 연결할 페이지`}
          onChange={(event) => onChange({ target_page_id: event.target.value })}
        >
          <option value="">페이지 선택</option>
          {selectablePages.map((page) => <option key={page.id} value={page.id}>{page.title}</option>)}
        </select>
      )}

      {type === 'external' && (
        <input
          value={item.url ?? ''}
          maxLength={300}
          placeholder="https://... 또는 /경로"
          aria-label={`${index + 1}번 버튼이 열 주소`}
          onChange={(event) => onChange({ url: event.target.value })}
        />
      )}
    </>
  );
}
