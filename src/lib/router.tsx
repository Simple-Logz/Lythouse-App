import{createContext,forwardRef,useContext,useEffect,useState,type ReactNode}from'react';
type Ctx={path:string;navigate:(to:string)=>void};
const R=createContext<Ctx|undefined>(undefined);
export function RouterProvider({children}:{children:ReactNode}){
const[p,setP]=useState(window.location.pathname);
useEffect(()=>{const o=()=>setP(window.location.pathname);window.addEventListener('popstate',o);return()=>window.removeEventListener('popstate',o);},[]);
function n(t:string){window.history.pushState({},'',t);setP(t);window.dispatchEvent(new PopStateEvent('popstate'));}
return<R.Provider value={{path:p,navigate:n}}>{children}</R.Provider>;
}
export function useRouter(){const c=useContext(R);if(!c)throw new Error('useRouter');return c;}
// forwardRef + ...rest so callers can attach a ref (e.g. scrollIntoView on the
// active nav item) or pass through aria-* attributes — previously both were
// silently dropped since this only destructured a fixed prop list.
export const Link=forwardRef<HTMLAnchorElement,{to:string;children:ReactNode;className?:string;onClick?:()=>void;[key:string]:any}>(
function Link({to,children,className,onClick,...rest},ref){
const{navigate}=useRouter();
return<a ref={ref} href={to} className={className} onClick={e=>{e.preventDefault();navigate(to);onClick?.();}} {...rest}>{children}</a>;
});
