import React,{useEffect,useState} from 'react';
import {RefreshCw,Gift} from 'lucide-react';

export const API=import.meta.env.VITE_API_URL||'';
export const money=n=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(n)||0);
export const img=src=>src?.startsWith('http')?src:src?.startsWith('/uploads')?API+src:src?.startsWith('/images/')?(import.meta.env.VITE_STORE_URL||(import.meta.env.PROD?window.location.origin:'http://localhost:5173'))+src:'/favicon.svg';
export const fmt=s=>s?new Date(s).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}):'—';

const cache=new Map();
const pending=new Map();
const CACHE_TTL=30_000;
const REQUEST_TIMEOUT=10_000;

export async function api(path,opts={}){
 const method=(opts.method||'GET').toUpperCase();
 const {signal:externalSignal,timeoutMs=REQUEST_TIMEOUT,...requestOpts}=opts;
 const isRead=method==='GET';
 const key=isRead&&!path.startsWith('/auth/')?path:null;
 const cached=key&&cache.get(key);
 if(cached&&Date.now()-cached.time<CACHE_TTL)return cached.data;
 // A request with a caller-owned AbortSignal must never share the promise of
 // another caller. Aborting one component would otherwise abort the shared
 // fetch and leave later auth checks waiting on an already-aborted promise.
 if(key&&!externalSignal&&pending.has(key))return pending.get(key);
 const request=(async()=>{
  let response,data,bodyText;
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  const abortRequest=()=>controller.abort();
  if(externalSignal?.aborted)controller.abort();
  else externalSignal?.addEventListener('abort',abortRequest,{once:true});
  try{
   const fetchOptions={credentials:'include',headers:requestOpts.body instanceof FormData?undefined:{'Content-Type':'application/json'},...requestOpts,body:requestOpts.body instanceof FormData?requestOpts.body:requestOpts.body===undefined?undefined:JSON.stringify(requestOpts.body),signal:controller.signal};
   response=await fetch(API+'/api'+path,fetchOptions);
   // Keep the deadline active until the response body has finished arriving.
   bodyText=await response.text();
  }catch(error){
   if(error?.name==='AbortError')throw Error('The request timed out. Please check the backend or database connection.');
   throw Error('API unavailable. Start the backend at http://localhost:4000')
  }finally{clearTimeout(timeout);externalSignal?.removeEventListener('abort',abortRequest)}
  // Rate limiters and proxies may send plain text. A parsing failure is not
  // a connection failure: retain the HTTP status instead of reporting offline.
  try{data=JSON.parse(bodyText)}catch{data=null}
  if(!response.ok){
   if(response.status===429)throw Error('Too many attempts. Wait a few minutes, then try again.');
   throw Error(data?.error||`The server could not complete the request (HTTP ${response.status}). Please try again later.`);
  }
  if(data===null)throw Error('The server returned an unexpected response. Please refresh and try again.');
  if(key)cache.set(key,{time:Date.now(),data});
  else cache.clear();
  return data;
 })();
 if(key&&!externalSignal)pending.set(key,request);
 try{return await request}finally{if(key&&!externalSignal&&pending.get(key)===request)pending.delete(key)}
}

export function invalidate(pathPrefix=''){
 for(const key of cache.keys())if(!pathPrefix||key.startsWith(pathPrefix))cache.delete(key);
}

export function useData(path,rev=0){
 const [state,setState]=useState(()=>{const cached=cache.get(path);return cached&&Date.now()-cached.time<CACHE_TTL?{data:cached.data,loading:false,error:null}:{data:null,loading:true,error:null}});
 useEffect(()=>{let alive=true;const controller=new AbortController();setState(current=>current.data?{...current,loading:false}:{data:null,loading:true,error:null});api(path,{signal:controller.signal}).then(data=>alive&&setState({data,loading:false,error:null})).catch(error=>alive&&setState({data:null,loading:false,error:error.message}));return()=>{alive=false;controller.abort()}},[path,rev]);
 return state;
}

export const Busy=()=> <div className="center-state"><RefreshCw className="spin" size={25}/> Loading…</div>;
export const ErrorBox=({message})=><div className="error-box">{message||'Unable to load data'} <button onClick={()=>location.reload()}>Retry</button></div>;
export function Empty({text='No items yet'}){return <div className="empty-state"><Gift size={34}/><p>{text}</p></div>}
export function Pager({page,totalPages,onChange}){if(totalPages<=1)return null;return <div className="pagination"><button disabled={page<=1} onClick={()=>onChange(page-1)}>Previous</button><span>Page {page} of {totalPages}</span><button disabled={page>=totalPages} onClick={()=>onChange(page+1)}>Next</button></div>}
