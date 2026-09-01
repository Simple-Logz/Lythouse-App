import{StrictMode}from'react';
import{createRoot}from'react-dom/client';
import'./index.css';
import'./validation-metrics.css';

// Block pinch/rotate gestures on touch devices.
if(typeof window!=='undefined'){
  ['gesturestart','gesturechange','gestureend'].forEach(ev=>document.addEventListener(ev,e=>e.preventDefault(),{passive:false}));
  document.addEventListener('touchmove',e=>{if(e.touches&&e.touches.length>1)e.preventDefault();},{passive:false});

  // Mobile landing-menu tap reliability. The visible X used to have a small
  // touch target and iOS could miss a quick tap. Give it an immediate
  // pointer-down close, and make every point outside the menu card dismiss it
  // with a single touch. This delegates at document level so it also works
  // when the overlay itself is the event target.
  document.addEventListener('pointerdown',e=>{
    if(e.pointerType&&e.pointerType!=='touch'&&e.pointerType!=='pen')return;
    const close=document.querySelector('button[aria-label="Close menu"]') as HTMLButtonElement|null;
    if(!close)return;
    const target=e.target as Node|null;
    if(!target)return;
    if(close.contains(target)){
      e.preventDefault();
      close.click();
      return;
    }
    const card=close.closest('.shadow-2xl');
    if(card&&!card.contains(target)){
      e.preventDefault();
      close.click();
    }
  },{passive:false,capture:true});
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
    // LytHouse Edge Functions that perform privileged validation work must receive
    // the signed-in user's JWT, never the public anonymous project key. Some older
    // workspace code still supplies the anon key explicitly; normalize those calls
    // here so authorization is enforced consistently while those screens are migrated.
    const {supabase}=await import('./lib/supabase');
    const nativeFetch=window.fetch.bind(window);
    const functionPrefix=`${url}/functions/v1/`;
    window.fetch=async(input:RequestInfo|URL,init?:RequestInit)=>{
      const requestUrl=typeof input==='string'?input:input instanceof URL?input.toString():input.url;
      if(requestUrl.startsWith(functionPrefix)){
        const {data:{session}}=await supabase.auth.getSession();
        if(session?.access_token){
          const headers=new Headers(init?.headers||(input instanceof Request?input.headers:undefined));
          headers.set('Authorization',`Bearer ${session.access_token}`);
          headers.set('apikey',anonKey);
          return nativeFetch(input,{...init,headers});
        }
      }
      return nativeFetch(input,init);
    };

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
