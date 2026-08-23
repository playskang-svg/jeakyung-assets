import { useLayoutEffect } from 'react';

export default function useRevealOnScroll() {
  useLayoutEffect(() => {
    const documentElement = document.documentElement;
    const main = document.getElementById('main-content');
    const revealElements = main?.querySelectorAll('.reveal') ?? [];
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    documentElement.classList.add('reveal-ready');

    if (reduceMotion || !('IntersectionObserver' in window)) {
      revealElements.forEach((element) => element.classList.add('is-visible'));
      return () => documentElement.classList.remove('reveal-ready');
    }

    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, {
      rootMargin: '0px 0px -8% 0px',
      threshold: 0.12,
    });

    revealElements.forEach((element) => revealObserver.observe(element));

    return () => {
      revealObserver.disconnect();
      documentElement.classList.remove('reveal-ready');
    };
  }, []);
}
