import React,{createContext,useContext,useEffect,useMemo,useState} from 'react';
import {toast} from 'sonner';
export const BASE=import.meta.env.VITE_API_URL||'';
export const INR=n=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(n)||0);
export const IMAGE=src=>src?.startsWith('http')?src:src?.startsWith('/uploads')?BASE+src:src||'/images/logo-mark.svg';
export const api=async(path,options={})=>{
 const {body,headers,...rest}=options;
 const isForm=body instanceof FormData;
 let response;
 try{response=await fetch(`${BASE}/api${path}`,{credentials:'include',headers:isForm?headers:{'Content-Type':'application/json',...headers},...rest,body:isForm?body:body===undefined?undefined:JSON.stringify(body)});}catch{throw new Error('Cannot connect to the API. Start the backend on port 4000.');}
 const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||`Request failed (${response.status})`);return data;
};
const C=createContext(null);
export function StoreProvider({children}){
 const [meta,setMeta]=useState({categories:[],banners:[],settings:{}});
 const [user,setUser]=useState(null);
 const [authLoading,setAuthLoading]=useState(true);
 const [cart,setCart]=useState(()=>{try{return JSON.parse(localStorage.getItem('gz-cart')||'[]')}catch{return []}});
 const [wishlist,setWishlist]=useState([]);
 useEffect(()=>{
  const loadMeta=()=>api('/catalog/meta').then(setMeta).catch(()=>{});
  loadMeta();
  // Store settings are edited from the separate admin app. Refresh the public
  // catalog metadata so an open storefront picks up published changes quickly.
  const timer=setInterval(loadMeta,5000);
  api('/auth/me').then(r=>setUser(r.user)).catch(()=>{}).finally(()=>setAuthLoading(false));
  return()=>clearInterval(timer);
 },[]);
 useEffect(()=>{
  const settings=meta.settings||{};
  const root=document.documentElement;
  if(settings.primaryColor)root.style.setProperty('--wine',settings.primaryColor);
  if(settings.secondaryColor){
   root.style.setProperty('--hot',settings.secondaryColor);
   root.style.setProperty('--pink',settings.secondaryColor);
   root.style.setProperty('--soft',`color-mix(in srgb, ${settings.secondaryColor} 42%, white)`);
   root.style.setProperty('--pale',`color-mix(in srgb, ${settings.secondaryColor} 14%, white)`);
  }
  if(settings.accentColor){
   root.style.setProperty('--olive',settings.accentColor);
   root.style.setProperty('--forest',`color-mix(in srgb, ${settings.accentColor} 62%, black)`);
  }
  if(settings.primaryColor)root.style.setProperty('--line',`color-mix(in srgb, ${settings.primaryColor} 14%, white)`);
 },[meta.settings]);
 useEffect(()=>{localStorage.setItem('gz-cart',JSON.stringify(cart))},[cart]);
 useEffect(()=>{if(!user){setWishlist([]);return}api('/customer/wishlist').then(setWishlist).catch(()=>{})},[user]);
 const addToCart=(product,quantity=1,customization={})=>{
  const key=`${product.id}-${JSON.stringify(customization)}`;
  const selected=(product.variants||[]).find(v=>v.name===customization.variant);
  const extras=(customization.addOns||[]).reduce((sum,name)=>sum+((product.addOns||[]).find(a=>a.name===name)?.price||0),0);
  const unitPrice=product.price+(selected?.priceDelta||0)+extras;
  setCart(old=>{const exists=old.some(x=>x.key===key);return exists?old.map(x=>x.key===key?{...x,quantity:Math.min(50,x.quantity+quantity)}:x):[...old,{key,productId:product.id,slug:product.slug,name:product.name,image:product.image,price:unitPrice,quantity,customization}]});
  toast.success('Added to your gift bag');
 };
 const updateQty=(key,quantity)=>setCart(old=>old.map(x=>x.key===key?{...x,quantity:Math.min(50,Math.max(1,quantity))}:x));
 const removeCart=key=>setCart(old=>old.filter(x=>x.key!==key));
 const toggleWishlist=async product=>{
   if(!user){toast.info('Please log in to save your favorites');return false}
   const exists=wishlist.some(x=>x.product?.id===product.id);
   try{if(exists)await api(`/customer/wishlist/${product.id}`,{method:'DELETE'});else await api(`/customer/wishlist/${product.id}`,{method:'POST'});
    setWishlist(old=>exists?old.filter(x=>x.product?.id!==product.id):[...old,{product}]);toast.success(exists?'Removed from favorites':'Saved to favorites');return true;
   }catch(err){toast.error(err.message);return false}
 };
 const cartCount=cart.reduce((s,x)=>s+x.quantity,0);
 const value={meta,setMeta,user,setUser,authLoading,cart,setCart,cartCount,addToCart,updateQty,removeCart,wishlist,toggleWishlist};
 return <C.Provider value={value}>{children}</C.Provider>
}
export const useStore=()=>useContext(C);
export function useLoad(path,deps=[]){const [state,setState]=useState({data:null,loading:true,error:null});useEffect(()=>{let alive=true;setState({data:null,loading:true,error:null});api(path).then(data=>alive&&setState({data,loading:false,error:null})).catch(error=>alive&&setState({data:null,loading:false,error:error.message}));return()=>{alive=false}},[path,...deps]);return state}
export function ErrorState({message}){return <div className="error-state"><span>Something went wrong</span><p>{message||'Unable to load this section.'}</p><button className="button secondary" onClick={()=>window.location.reload()}>Try again</button></div>}
export function Loading({text='Finding lovely things…'}){return <div className="loading"><div className="spinner"/><span>{text}</span></div>}
export const fullDate=d=>new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
