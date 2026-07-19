import { useEffect, useState } from 'react';

// True on phone-sized viewports. Used to switch into the dedicated mobile app
// tree instead of shrinking the desktop layout.
export function useIsMobile(breakpoint = 768) {
  const get = () => (typeof window !== 'undefined' ? window.innerWidth < breakpoint : false);
  const [isMobile, setIsMobile] = useState(get);
  useEffect(() => {
    const onResize = () => setIsMobile(get());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isMobile;
}
