// 외부 주소를 그룹웨어 화면 안에 그대로 띄운다.
// 상대편 사이트가 X-Frame-Options / CSP frame-ancestors 로 막아 두면 iframe 이
// 조용히 빈 화면으로 남는다. 그 경우를 사용자가 알 수 있도록 잠시 기다렸다가
// 새 탭으로 여는 길을 같이 안내한다.
import { useEffect, useRef, useState } from 'react';

const BLOCKED_AFTER_MS = 4000;

export default function EmbeddedSite({ url, title }) {
  const [loaded, setLoaded] = useState(false);
  const [maybeBlocked, setMaybeBlocked] = useState(false);
  const frameRef = useRef(null);

  useEffect(() => {
    setLoaded(false);
    setMaybeBlocked(false);
    const timer = setTimeout(() => setMaybeBlocked(true), BLOCKED_AFTER_MS);
    return () => clearTimeout(timer);
  }, [url]);

  return (
    <div className="gw-embed-frame">
      {!loaded && !maybeBlocked && <p className="gw-empty-state" role="status">화면을 불러오고 있습니다.</p>}
      {!loaded && maybeBlocked && (
        <div className="gw-notice gw-notice--warning" role="status">
          <strong>이 사이트는 화면 안에 담기지 않을 수 있습니다.</strong>
          <span> 상대 사이트가 다른 화면에 실리는 것을 막아 둔 경우입니다. </span>
          <a href={url} target="_blank" rel="noopener noreferrer">새 탭에서 열기 ↗</a>
        </div>
      )}
      <iframe
        ref={frameRef}
        src={url}
        title={title}
        onLoad={() => setLoaded(true)}
        loading="lazy"
        referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin"
      />
    </div>
  );
}
