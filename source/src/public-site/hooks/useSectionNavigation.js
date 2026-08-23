import { useEffect, useState } from 'react';

export default function useSectionNavigation(page, navigation) {
  const [activeHref, setActiveHref] = useState(null);

  useEffect(() => {
    setActiveHref(null);
    if (page !== 'home' || !('IntersectionObserver' in window)) return undefined;

    let cancelled = false;
    let sectionObserver;

    queueMicrotask(() => {
      if (cancelled) return;

      const sections = navigation
        .map((item) => item.href)
        .filter((href) => href.startsWith('#'))
        .map((href) => document.querySelector(href))
        .filter(Boolean);

      if (!sections.length) return;

      sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveHref(`#${entry.target.id}`);
        });
      }, {
        rootMargin: '-30% 0px -60% 0px',
        threshold: 0,
      });

      sections.forEach((section) => sectionObserver.observe(section));
    });

    return () => {
      cancelled = true;
      sectionObserver?.disconnect();
    };
  }, [navigation, page]);

  return activeHref;
}
