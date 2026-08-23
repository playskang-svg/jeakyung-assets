import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export default function useHeaderNavigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const mobileNavigationRef = useRef(null);
  const menuOpenRef = useRef(false);
  const returnFocusRef = useRef(false);

  const closeMenu = useCallback((returnFocus = false) => {
    if (!menuOpenRef.current) return;

    menuOpenRef.current = false;
    returnFocusRef.current = returnFocus;
    setIsMenuOpen(false);
  }, []);

  const openMenu = useCallback(() => {
    if (menuOpenRef.current) return;

    menuOpenRef.current = true;
    returnFocusRef.current = false;
    setIsMenuOpen(true);
  }, []);

  const toggleMenu = useCallback(() => {
    if (menuOpenRef.current) closeMenu();
    else openMenu();
  }, [closeMenu, openMenu]);

  useEffect(() => {
    const updateHeader = () => setIsScrolled(window.scrollY > 20);

    updateHeader();
    window.addEventListener('scroll', updateHeader, { passive: true });

    return () => window.removeEventListener('scroll', updateHeader);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeMenu(true);
    };
    const handleResize = () => {
      if (window.innerWidth > 900) closeMenu();
    };

    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [closeMenu]);

  useLayoutEffect(() => {
    const header = menuButtonRef.current?.closest('.site-header');
    header?.classList.toggle('scrolled', isScrolled);
  }, [isScrolled]);

  useLayoutEffect(() => {
    const header = menuButtonRef.current?.closest('.site-header');

    header?.classList.toggle('menu-active', isMenuOpen);
    document.body.classList.toggle('menu-open', isMenuOpen);

    if (isMenuOpen) {
      mobileNavigationRef.current?.querySelector('a')?.focus();
    } else if (returnFocusRef.current) {
      returnFocusRef.current = false;
      menuButtonRef.current?.focus();
    }
  }, [isMenuOpen]);

  useEffect(() => () => {
    const header = menuButtonRef.current?.closest('.site-header');
    header?.classList.remove('scrolled', 'menu-active');
    document.body.classList.remove('menu-open');
  }, []);

  return {
    closeMenu,
    isMenuOpen,
    menuButtonRef,
    mobileNavigationRef,
    toggleMenu,
  };
}
