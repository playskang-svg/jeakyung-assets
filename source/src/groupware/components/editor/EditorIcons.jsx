// 도구모음 아이콘.
//
// 예전에는 이모지(𝐁, 🔗, 🖼)를 그대로 썼는데, 이모지는 기기마다 생김새가 달라
// 어떤 화면에서는 컬러 그림으로, 어떤 화면에서는 흑백 글리프로 나온다. 크기와
// 굵기도 제각각이라 한 줄에 늘어놓으면 들쭉날쭉해 보인다. 선 두께가 같은
// SVG 로 그려 어디서나 같은 모양이 되게 한다.
//
// 24×24 격자에 stroke 1.8 로 통일한다. 색은 currentColor 를 따르므로
// 버튼이 눌린 상태(파란색)일 때 아이콘도 같이 파래진다.

function Icon({ children, filled = false }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export const BoldIcon = () => <Icon><path d="M7 5h6.5a3.5 3.5 0 0 1 0 7H7zM7 12h7.5a3.5 3.5 0 0 1 0 7H7z" /></Icon>;
export const ItalicIcon = () => <Icon><path d="M15 5h-5M14 19H9M14 5l-4 14" /></Icon>;
export const UnderlineIcon = () => <Icon><path d="M7 4v6a5 5 0 0 0 10 0V4M6 20h12" /></Icon>;
export const StrikeIcon = () => <Icon><path d="M5 12h14M8 8a3.2 3.2 0 0 1 3.4-3h1.6a3.2 3.2 0 0 1 3.2 2.6M16 15.4A3.2 3.2 0 0 1 12.8 19h-1.6A3.2 3.2 0 0 1 8 16.6" /></Icon>;

export const HeadingIcon = () => <Icon><path d="M6 5v14M14 5v14M6 12h8M17.5 10.5l2-1.2V19" /></Icon>;
export const QuoteIcon = () => <Icon><path d="M9.5 7c-2.5 0-4 1.8-4 4.2 0 1.9 1.3 3.3 3 3.3 1.5 0 2.6-1 2.6-2.4 0-1.3-.9-2.3-2.2-2.3-.3 0-.6 0-.8.1.2-.9 1-1.6 2-1.8zM18.5 7c-2.5 0-4 1.8-4 4.2 0 1.9 1.3 3.3 3 3.3 1.5 0 2.6-1 2.6-2.4 0-1.3-.9-2.3-2.2-2.3-.3 0-.6 0-.8.1.2-.9 1-1.6 2-1.8z" /></Icon>;
export const BulletListIcon = () => <Icon><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1.3" fill="currentColor" stroke="none" /><circle cx="4.5" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="4.5" cy="18" r="1.3" fill="currentColor" stroke="none" /></Icon>;
export const OrderedListIcon = () => <Icon><path d="M10 6h10M10 12h10M10 18h10M4 5.2l1.4-.7V9M3.6 15c0-.7.6-1.2 1.4-1.2s1.4.5 1.4 1.1c0 1.3-2.8 1.6-2.8 3.4h2.9" /></Icon>;

export const AlignLeftIcon = () => <Icon><path d="M4 6h16M4 12h10M4 18h13" /></Icon>;
export const AlignCenterIcon = () => <Icon><path d="M4 6h16M7 12h10M6 18h12" /></Icon>;
export const AlignRightIcon = () => <Icon><path d="M4 6h16M10 12h10M7 18h13" /></Icon>;

export const TextColorIcon = () => <Icon><path d="M6 16 11 5h2l5 11M8.2 12.5h7.6" /><path d="M4 20h16" strokeWidth="3" /></Icon>;
export const HighlightIcon = () => <Icon><path d="m14 5 5 5-7.5 7.5H7l-1-3z" /><path d="M4 20h16" strokeWidth="3" /></Icon>;

export const LinkIcon = () => <Icon><path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.54 3.54 0 0 0-5-5l-1.4 1.4" /><path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.54 3.54 0 0 0 5 5l1.4-1.4" /></Icon>;
export const ImageUrlIcon = () => <Icon><circle cx="12" cy="12" r="8.2" /><path d="M3.8 12h16.4M12 3.8c2.1 2.3 3.2 5.2 3.2 8.2s-1.1 5.9-3.2 8.2c-2.1-2.3-3.2-5.2-3.2-8.2s1.1-5.9 3.2-8.2z" /></Icon>;
export const ImageIcon = () => <Icon><rect x="3.2" y="5" width="17.6" height="14" rx="2.2" /><circle cx="8.6" cy="10" r="1.6" /><path d="m4 17 4.6-4.3a1.8 1.8 0 0 1 2.4 0L16 17M14.5 14.4l1.6-1.4a1.8 1.8 0 0 1 2.4 0l2 1.8" /></Icon>;
export const RuleIcon = () => <Icon><path d="M4 12h16" /><path d="M6 7h12M6 17h12" opacity=".38" /></Icon>;

export const CodeIcon = () => <Icon><path d="m8.5 8-4.5 4 4.5 4M15.5 8l4.5 4-4.5 4" /></Icon>;
export const ClearFormatIcon = () => <Icon><path d="M9 5h11M14 5 9.5 19M5 12h7" /><path d="m16 15 5 5M21 15l-5 5" /></Icon>;

// 이미지 배치. 글이 옆으로 흐르는지 아닌지를 그림으로 구분한다.
export const WrapLeftIcon = () => <Icon><rect x="3.2" y="6" width="8" height="8" rx="1.4" fill="currentColor" stroke="none" opacity=".85" /><path d="M13.4 7h7.4M13.4 10.4h7.4M13.4 13.8h7.4M3.2 17.2h17.6M3.2 20.2h12" /></Icon>;
export const WrapRightIcon = () => <Icon><rect x="12.8" y="6" width="8" height="8" rx="1.4" fill="currentColor" stroke="none" opacity=".85" /><path d="M3.2 7h7.4M3.2 10.4h7.4M3.2 13.8h7.4M3.2 17.2h17.6M8.2 20.2h12.6" /></Icon>;
export const WrapNoneIcon = () => <Icon><path d="M3.2 5h17.6" /><rect x="5.6" y="8.4" width="12.8" height="7.2" rx="1.4" fill="currentColor" stroke="none" opacity=".85" /><path d="M3.2 19h17.6" /></Icon>;
