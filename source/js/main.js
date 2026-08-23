document.addEventListener('DOMContentLoaded', () => {
    const header = document.getElementById('header');
    const menuButton = document.querySelector('.menu-button');
    const mobileNavigation = document.getElementById('mobile-navigation');
    const mobileLinks = mobileNavigation ? mobileNavigation.querySelectorAll('a') : [];
    const navigationLinks = document.querySelectorAll('.desktop-nav a');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const updateHeader = () => {
        if (!header) return;
        header.classList.toggle('scrolled', window.scrollY > 20);
    };

    const closeMenu = (returnFocus = false) => {
        if (!menuButton || !mobileNavigation || menuButton.getAttribute('aria-expanded') !== 'true') return;

        menuButton.setAttribute('aria-expanded', 'false');
        menuButton.setAttribute('aria-label', '메뉴 열기');
        mobileNavigation.hidden = true;
        header?.classList.remove('menu-active');
        document.body.classList.remove('menu-open');

        if (returnFocus) menuButton.focus();
    };

    const openMenu = () => {
        if (!menuButton || !mobileNavigation) return;

        menuButton.setAttribute('aria-expanded', 'true');
        menuButton.setAttribute('aria-label', '메뉴 닫기');
        mobileNavigation.hidden = false;
        header?.classList.add('menu-active');
        document.body.classList.add('menu-open');
        mobileNavigation.querySelector('a')?.focus();
    };

    updateHeader();
    window.addEventListener('scroll', updateHeader, { passive: true });

    menuButton?.addEventListener('click', () => {
        const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
        if (isOpen) closeMenu();
        else openMenu();
    });

    mobileLinks.forEach((link) => {
        link.addEventListener('click', () => closeMenu());
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeMenu(true);
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 900) closeMenu();
    });

    const sections = [...navigationLinks]
        .map((link) => link.getAttribute('href'))
        .filter((href) => href?.startsWith('#'))
        .map((href) => document.querySelector(href))
        .filter(Boolean);

    if ('IntersectionObserver' in window && sections.length) {
        const sectionObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                navigationLinks.forEach((link) => {
                    const isCurrent = link.getAttribute('href') === `#${entry.target.id}`;
                    link.classList.toggle('active', isCurrent);
                    if (isCurrent) link.setAttribute('aria-current', 'location');
                    else link.removeAttribute('aria-current');
                });
            });
        }, {
            rootMargin: '-30% 0px -60% 0px',
            threshold: 0
        });

        sections.forEach((section) => sectionObserver.observe(section));
    }

    const revealElements = document.querySelectorAll('.reveal');
    if (reduceMotion || !('IntersectionObserver' in window)) {
        revealElements.forEach((element) => element.classList.add('is-visible'));
    } else {
        const revealObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            });
        }, {
            rootMargin: '0px 0px -8% 0px',
            threshold: 0.12
        });

        revealElements.forEach((element) => revealObserver.observe(element));
    }

    const hero = document.querySelector('.hero');
    const heroVideo = document.querySelector('.hero-media video');
    if (heroVideo && hero) {
        heroVideo.addEventListener('error', () => hero.classList.add('video-unavailable'));

        const playPromise = heroVideo.play();
        if (playPromise !== undefined) {
            playPromise.catch(() => hero.classList.add('video-paused'));
        }
    }

    const selectedService = document.querySelector('.selected-service');
    document.querySelectorAll('[data-service]').forEach((link) => {
        link.addEventListener('click', () => {
            if (!selectedService) return;
            selectedService.textContent = `선택한 관심 서비스: ${link.dataset.service}`;
        });
    });

    const currentYear = document.getElementById('current-year');
    if (currentYear) currentYear.textContent = new Date().getFullYear();
});
