import { useEffect, useState } from 'react';

// Robust phone detection: a device counts as mobile if the viewport is narrow
// OR it's a touch-primary device on a smallish screen. Uses matchMedia (fires
// reliably on orientation change / real devices) plus a coarse-pointer check,
// rather than a bare window.innerWidth read.
function detect(breakpoint: number): boolean {
  if (typeof window === 'undefined') return false;
  const narrow = window.matchMedia(`(max-width: ${breakpoint - 1}px)`).matches;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const smallish = window.innerWidth < 1024;
  // Fallback to a UA sniff for the rare browser that misreports the above.
  const uaMobile = /Android|iPhone|iPod|iPad|Mobile|Windows Phone|BlackBerry/i.test(
    (navigator && (navigator.userAgent || (navigator as any).vendor)) || ''
  );
  return narrow || (coarse && smallish) || (uaMobile && smallish);
}

export function useIsMobile(breakpoint = 820) {
  const [isMobile, setIsMobile] = useState(() => detect(breakpoint));
  useEffect(() => {
    const update = () => setIsMobile(detect(breakpoint));
    update();
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    // addEventListener('change') is the modern API; addListener is the fallback.
    mq.addEventListener ? mq.addEventListener('change', update) : mq.addListener(update);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      mq.removeEventListener ? mq.removeEventListener('change', update) : mq.removeListener(update);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, [breakpoint]);
  return isMobile;
}
