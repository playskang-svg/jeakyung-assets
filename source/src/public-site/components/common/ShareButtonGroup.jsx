import { useState } from 'react';

export default function ShareButtonGroup({ title, summary }) {
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => {
      setToast('');
    }, 2500);
  };

  const getShareUrl = () => {
    return window.location.href;
  };

  const handleKakaoShare = async () => {
    const url = getShareUrl();
    const shareData = {
      title: title || document.title,
      text: summary || '',
      url: url,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') {
          return;
        }
      }
    }

    // Fallback: copy link and alert user to paste in KakaoTalk
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      showToast('카카오톡에 공유할 링크가 복사되었습니다!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast('링크 복사 완료: ' + url);
    }
  };

  const handleCopyLink = async () => {
    const url = getShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      showToast('링크가 복사되었습니다.');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast('링크 복사에 실패했습니다.');
    }
  };

  return (
    <div className="news-share-group">
      <button
        type="button"
        className="news-share-btn news-share-btn--kakao"
        onClick={handleKakaoShare}
        title="카카오톡으로 공유하기"
        aria-label="카카오톡으로 공유하기"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
          <path d="M12 3C6.477 3 2 6.477 2 10.767c0 2.766 1.874 5.19 4.686 6.551l-1.189 4.364c-.104.383.332.695.66.477l5.228-3.486c.203.02.408.031.615.031 5.523 0 10-3.477 10-7.767S17.523 3 12 3z" />
        </svg>
      </button>
      <button
        type="button"
        className="news-share-btn news-share-btn--link"
        onClick={handleCopyLink}
        title="URL 링크 복사"
        aria-label="URL 링크 복사"
      >
        {copied ? (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        )}
      </button>
      {toast && (
        <div className="news-share-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

