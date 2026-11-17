export function publicOrigin(value,name){
 if(!value)throw Error(`${name} is required for this deployment`);
 const url=new URL(value);
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash||/^(localhost|127\.|\[::1\])/.test(url.hostname))throw Error(`${name} must be a public HTTPS origin without a path`);
 return url.origin;
}
export function webConfig(admin=false,env=process.env){
 const api=publicOrigin(env.API_ORIGIN,'API_ORIGIN');
 const routes=[
  {src:'/api',dest:`${api}/api`},
  {src:'/api/(.*)',dest:`${api}/api/$1`},
  {src:'/uploads/(.*)',dest:`${api}/uploads/$1`}
 ];
 if(admin){const store=publicOrigin(env.VITE_STORE_URL,'VITE_STORE_URL');routes.push({src:'/images/(.*)',dest:`${store}/images/$1`})}
 routes.push({handle:'filesystem'},{src:'/(assets|images)/(.*)',status:404},{src:'/.*',dest:'/index.html'});
 return {framework:'vite',installCommand:'cd .. && npm ci --include=dev',buildCommand:'npm run build',outputDirectory:'dist',routes};
}
