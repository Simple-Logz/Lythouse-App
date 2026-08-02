import{StrictMode}from'react';
import{createRoot}from'react-dom/client';
import'./index.css';
import{App}from'./App';
import{AuthProvider}from'./lib/auth';
import{ErrorBoundary}from'./lib/ErrorBoundary';

// Block pinch/rotate gestures on touch devices (iOS Safari fires its own
// non-standard gesture* events for a real two-finger pinch, so this only
// ever fires for that — it never touches ordinary scrolling or tapping).
// Double-tap-to-zoom is handled by CSS `touch-action:manipulation` in
// index.css instead of JS: an earlier version of this file also globally
// preventDefault()'d any touchend within 300ms of the previous one to fake
// double-tap-zoom blocking, but that fired on ordinary fast taps and flick
// scrolls too (not just real double-taps on the same spot), which is what
// was making scrolling and tapping feel broken/unresponsive on phones.
if(typeof window!=='undefined'){
  ['gesturestart','gesturechange','gestureend'].forEach(ev=>document.addEventListener(ev,e=>e.preventDefault(),{passive:false}));
  document.addEventListener('touchmove',e=>{if(e.touches&&e.touches.length>1)e.preventDefault();},{passive:false});
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App/>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>
);
