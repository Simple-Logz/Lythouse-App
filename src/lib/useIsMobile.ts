import { useEffect, useState } from 'react';

function detect(breakpoint: number): boolean {
  if (typeof window === 'undefined') return false;
  const narrow = window.matchMedia(`(max-width: ${breakpoint - 1}px)`).matches;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const smallish = window.innerWidth < 1024;
  const nav = navigator as Navigator & { vendor?: string };
  const uaMobile = /Android|iPhone|iPod|iPad|Mobile|Windows Phone|BlackBerry/i.test(
    nav.userAgent || nav.vendor || ''
  );
  return narrow || (coarse && smallish) || (uaMobile && smallish);
}

export function useIsMobile(breakpoint = 820) {
  const [isMobile, setIsMobile] = useState(() => detect(breakpoint));
  useEffect(() => {
    const update = () => setIsMobile(detect(breakpoint));
    update();
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const legacyMq = mq as MediaQueryList & {
      addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
      removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
    };
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', update);
    else legacyMq.addListener?.(update);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      if (typeof mq.removeEventListener === 'function') mq.removeEventListener('change', update);
      else legacyMq.removeListener?.(update);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, [breakpoint]);
  return isMobile;
}
