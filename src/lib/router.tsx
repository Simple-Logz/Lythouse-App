import{createContext,useContext,useEffect,useState,type ReactNode}from'react';
type Ctx={path:string;navigate:(to:string)=>void};
const R=createContext<Ctx|undefined>(undefined);
export function RouterProvider({children}:{children:ReactNode}){
const[p,setP]=useState(window.location.pathname);
useEffect(()=>{const o=()=>setP(window.location.pathname);window.addEventListener('popstate',o);return()=>window.removeEventListener('popstate',o);},[]);
function n(t:string){window.history.pushState({},'',t);setP(t);window.dispatchEvent(new PopStateEvent('popstate'));}
return<R.Provider value={{path:p,navigate:n}}>{children}</R.Provider>;
}
export function useRouter(){const c=useContext(R);if(!c)throw new Error('useRouter');return c;}
export function Link({to,children,className,onClick}:{to:string;children:ReactNode;className?:string;onClick?:()=>void}){
const{navigate}=useRouter();return<a href={to} className={className} onClick={e=>{e.preventDefault();navigate(to);onClick?.();}}>{children}</a>;
}
