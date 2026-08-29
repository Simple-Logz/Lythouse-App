import{StrictMode}from'react';
import{createRoot}from'react-dom/client';
import'./index.css';

// Block pinch/rotate gestures on touch devices.
if(typeof window!=='undefined'){
  ['gesturestart','gesturechange','gestureend'].forEach(ev=>document.addEventListener(ev,e=>e.preventDefault(),{passive:false}));
  document.addEventListener('touchmove',e=>{if(e.touches&&e.touches.length>1)e.preventDefault();},{passive:false});
}

const rootElement=document.getElementById('root');
if(!rootElement) throw new Error('LytHouse root element was not found.');
const root=createRoot(rootElement);

function StartupError({message}:{message:string}){
  return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f8fafc',padding:'24px',fontFamily:'Inter,system-ui,sans-serif'}}>
    <div style={{maxWidth:'620px',width:'100%',background:'#fff',border:'1px solid #e2e8f0',borderRadius:'16px',padding:'32px',boxShadow:'0 8px 30px rgba(15,23,42,.08)'}}>
      <h1 style={{margin:'0 0 12px',fontSize:'24px',color:'#0f172a'}}>LytHouse configuration required</h1>
      <p style={{margin:'0 0 16px',lineHeight:1.6,color:'#475569'}}>The application loaded, but its production environment is missing required runtime configuration.</p>
      <p style={{margin:0,lineHeight:1.6,color:'#64748b',fontSize:'14px'}}>{message}</p>
    </div>
  </div>;
}

async function start(){
  const url=import.meta.env.VITE_SUPABASE_URL;
  const anonKey=import.meta.env.VITE_SUPABASE_ANON_KEY;
  if(!url||!anonKey){
    console.error('[LytHouse] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
    root.render(<StartupError message="Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the Vercel project Environment Variables, then redeploy."/>);
    return;
  }

  try{
    const [{App},{AuthProvider},{ErrorBoundary}]=await Promise.all([
      import('./App'),
      import('./lib/auth'),
      import('./lib/ErrorBoundary'),
    ]);
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <AuthProvider>
            <App/>
          </AuthProvider>
        </ErrorBoundary>
      </StrictMode>
    );
  }catch(error){
    console.error('[LytHouse] Application startup failed:',error);
    const message=error instanceof Error?error.message:'An unknown startup error occurred.';
    root.render(<StartupError message={message}/>);
  }
}

void start();
