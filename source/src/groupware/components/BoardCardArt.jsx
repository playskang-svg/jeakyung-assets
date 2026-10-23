const paths = {
  notice: <><path d="M7 5h10v14H7z" /><path d="M10 9h4M10 12h4M10 15h3" /></>,
  work: <><rect x="4" y="7" width="16" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M4 12h16M10 12v2h4v-2" /></>,
  vehicle: <><path d="M3 15V9l3-4h9l3 4h3v6" /><path d="M3 15h18M6 9h12M7 18h.01M18 18h.01" /><circle cx="7" cy="17" r="2" /><circle cx="18" cy="17" r="2" /></>,
  album: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8" cy="9" r="1.5" /><path d="m4 17 5-5 3 3 3-4 5 6" /></>,
  chat: <><path d="M4 5h16v12H9l-5 3V5Z" /><path d="M8 9h8M8 12h6" /></>,
  page: <><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v5h4M10 12h5M10 16h5" /></>,
};

export function boardCardKind(board) {
  const slug = board.slug ?? '';
  if (/notice|공지/.test(slug + board.name)) return 'notice';
  if (/album|photo|앨범/.test(slug + board.name)) return 'album';
  if (/free|자유/.test(slug + board.name)) return 'chat';
  if (/consign|vehicle|fleet|지입|차량/.test(slug + board.name)) return 'vehicle';
  return 'work';
}

export default function BoardCardArt({ kind = 'work' }) {
  return <svg className="gw-board-card-art" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind] ?? paths.work}</svg>;
}
