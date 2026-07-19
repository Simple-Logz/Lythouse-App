import{StrictMode}from'react';
import{createRoot}from'react-dom/client';
import'./index.css';
import{App}from'./App';
import{AuthProvider}from'./lib/auth';

// Block pinch-zoom / rotate gestures on touch devices (iOS Safari ignores the
// viewport user-scalable=no flag, so we stop the gestures directly).
if(typeof window!=='undefined'){
  ['gesturestart','gesturechange','gestureend'].forEach(ev=>document.addEventListener(ev,e=>e.preventDefault(),{passive:false}));
  document.addEventListener('touchmove',e=>{if(e.touches&&e.touches.length>1)e.preventDefault();},{passive:false});
  let lastTouch=0;
  document.addEventListener('touchend',e=>{const now=Date.now();if(now-lastTouch<=300)e.preventDefault();lastTouch=now;},{passive:false});
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App/>
    </AuthProvider>
  </StrictMode>
);
