import { CONSULTATION_URL } from '../../data/navigation.js';
import useHeroVideoState from '../../hooks/useHeroVideoState.js';
import heroVideoUrl from '../../../../public/videos/main_top.mp4';

export default function HeroSection() {
  const {
    handleVideoError,
    isPaused,
    isUnavailable,
    videoRef,
  } = useHeroVideoState();
  const className = [
    'hero',
    isUnavailable ? 'video-unavailable' : '',
    isPaused ? 'video-paused' : '',
  ].filter(Boolean).join(' ');

  return (
    <section className={className} id="top" aria-labelledby="hero-title">
      <div className="hero-media" aria-hidden="true">
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          onError={handleVideoError}
        >
          <source src={heroVideoUrl} type="video/mp4" />
        </video>
        <div className="hero-overlay" />
        <div className="hero-grid" />
      </div>

      <div className="hero-inner content-width">
        <div className="hero-copy reveal">
          <span className="eyebrow eyebrow-light"><i /> 3PL &amp; Fresh Fulfillment Partner</span>
          <h1 id="hero-title">Logistics Simplified.<br /><span>Success Delivered.</span></h1>
          <p>3PL 물류대행과 신선식품 풀필먼트부터 기업운송, 보관물류, 물류컨설팅까지.<br className="desktop-only" /> 비즈니스 운영에 필요한 물류 서비스를 한곳에서 살펴보세요.</p>
          <div className="hero-actions">
            <a className="button button-primary" href="#services">
              <span className="hero-action-label">서비스 살펴보기</span>
              <span className="hero-action-symbol" aria-hidden="true">↘</span>
            </a>
            <a
              className="button button-ghost kakao-cta kakao-cta-hero"
              href={CONSULTATION_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="빠른 상담하기, 카카오톡 채널 새 창"
            >
              <span className="kakao-cta-label hero-action-label">빠른 상담하기</span>
              <span className="kakao-cta-arrow" aria-hidden="true">↗</span>
            </a>
          </div>
        </div>

        <div className="hero-index reveal" aria-label="주요 서비스">
          <p>Service spectrum</p>
          <ol>
            <li><span>01</span> 3PL 물류대행</li>
            <li><span>02</span> 신선식품 풀필먼트</li>
            <li><span>03</span> 기업운송</li>
            <li><span>04</span> 보관물류</li>
            <li><span>05</span> 물류컨설팅</li>
          </ol>
        </div>
      </div>

      <a className="scroll-cue" href="#about">
        <span>Scroll to explore</span>
        <i aria-hidden="true" />
      </a>
    </section>
  );
}
