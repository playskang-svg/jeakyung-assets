import { useCallback, useEffect, useRef, useState } from 'react';

export default function useHeroVideoState() {
  const videoRef = useRef(null);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const handleVideoError = useCallback(() => {
    setIsUnavailable(true);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const playPromise = videoRef.current?.play();

    if (playPromise !== undefined) {
      playPromise.catch(() => {
        if (isMounted) setIsPaused(true);
      });
    }

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    handleVideoError,
    isPaused,
    isUnavailable,
    videoRef,
  };
}
