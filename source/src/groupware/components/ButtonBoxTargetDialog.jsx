import { useEffect, useRef, useState } from 'react';

import BoardPage from '../pages/internal/BoardPage.jsx';
import EmbeddedSite from './EmbeddedSite.jsx';
import PostDetailPage from '../pages/internal/PostDetailPage.jsx';

// 버튼 박스에서 버튼을 눌렀을 때 뜨는 팝업.
// 게시판 대상이면 목록을 띄우고, 글을 누르면 새 창으로 나가지 않고 이 팝업 안에서
// 본문으로 바뀐다. 목록 보기 / 뒤로가기 / 닫기 / Esc 로 되돌아온다.
export default function ButtonBoxTargetDialog({ item, onClose }) {
  const [postId, setPostId] = useState(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      // 본문을 보고 있으면 먼저 목록으로, 목록이면 팝업을 닫는다.
      if (postId) setPostId(null);
      else onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [postId, onClose]);

  const showingPost = Boolean(postId);

  return (
    <div
      className="gw-target-dialog-layer"
      role="presentation"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section className="gw-target-dialog" role="dialog" aria-modal="true" aria-label={item.label}>
        <header className="gw-target-dialog-bar">
          <div className="gw-target-dialog-title">
            {showingPost && (
              <button type="button" className="gw-secondary-button" onClick={() => setPostId(null)}>
                <span aria-hidden="true">←</span> 뒤로가기
              </button>
            )}
            <strong>{item.label}</strong>
          </div>
          <div className="gw-target-dialog-actions">
            {showingPost && (
              <button type="button" className="gw-secondary-button" onClick={() => setPostId(null)}>목록 보기</button>
            )}
            <a
              className="gw-secondary-button"
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              title="새 탭에서 전체 화면으로 열기"
            >
              새 탭 <span aria-hidden="true">↗</span>
            </a>
            <button ref={closeButtonRef} type="button" className="gw-target-dialog-close" onClick={onClose} aria-label="닫기">×</button>
          </div>
        </header>

        <div className="gw-target-dialog-body">
          {item.link_type === 'board' && item.board_slug && (showingPost ? (
            <PostDetailPage
              boardSlug={item.board_slug}
              postId={postId}
              embedded
              onBack={() => setPostId(null)}
            />
          ) : (
            <BoardPage boardSlug={item.board_slug} embedded onOpenPost={setPostId} />
          ))}

          {item.link_type === 'board' && !item.board_slug && (
            <p className="gw-empty-state">연결된 게시판을 찾을 수 없습니다. 관리자 화면에서 다시 지정해 주세요.</p>
          )}

          {item.link_type === 'embed' && item.url && (
            <EmbeddedSite url={item.url} title={item.label} />
          )}

          {item.link_type !== 'board' && item.link_type !== 'embed' && (
            <p className="gw-empty-state">
              이 대상은 팝업 안에서 열 수 없습니다. 위의 “새 탭”으로 열어 주세요.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
