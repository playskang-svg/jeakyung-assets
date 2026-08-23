export const BOARD_TYPES = {
  free: {
    label: '통합게시판',
    shortLabel: '통합',
    description: '공지와 자유 글, 자료 공유를 한곳에서 운영하는 기본 게시판',
    icon: 'dashboard',
    settings: {
      allow_comments: true,
      allow_replies: true,
      allow_attachments: true,
      allow_images: true,
      allow_anonymous: false,
      allow_reactions: true,
      default_sort: 'latest',
    },
  },
  gallery: {
    label: '갤러리',
    shortLabel: '갤러리',
    description: '본문 이미지를 대표 이미지로 보여주는 카드형 게시판',
    icon: 'gallery_thumbnail',
    settings: {
      allow_comments: true,
      allow_replies: true,
      allow_attachments: true,
      allow_images: true,
      allow_anonymous: false,
      allow_reactions: true,
      default_sort: 'latest',
    },
  },
  discussion: {
    label: '댓글형 게시판',
    shortLabel: '댓글형',
    description: '최근 의견이 오간 글을 먼저 보여주는 토론·문의용 게시판',
    icon: 'forum',
    settings: {
      allow_comments: true,
      allow_replies: true,
      allow_attachments: false,
      allow_images: false,
      allow_anonymous: false,
      allow_reactions: true,
      default_sort: 'activity',
    },
  },
};

const LEGACY_LABELS = {
  general: '일반 게시판',
  notice: '공지 게시판',
  files: '자료 게시판',
  anonymous: '익명 게시판',
  qna: 'Q&A 게시판',
  project: '프로젝트 게시판',
  department: '부서 게시판',
  custom: '사용자 정의',
};

export function getBoardType(type) {
  return BOARD_TYPES[type] ?? {
    label: LEGACY_LABELS[type] ?? type ?? '게시판',
    shortLabel: LEGACY_LABELS[type] ?? type ?? '게시판',
    description: '기존 게시판 유형',
    icon: 'article',
    settings: {},
  };
}
