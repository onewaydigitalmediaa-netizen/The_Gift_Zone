export function runtimeConfig(env=process.env) {
 const production=env.NODE_ENV==='production'||env.VERCEL==='1';
 function origin(key,fallback) {
  const value=env[key]||(!production?fallback:'');
  if(!value)throw new Error(`${key} is required in production`);
  const url=new URL(value);
  if(url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new Error(`${key} must be an origin without a path, credentials or query`);
  if(production&&(url.protocol!=='https:'||/^(localhost|127\.|\[::1\])/.test(url.hostname)))throw new Error(`${key} must be a public HTTPS origin`);
  return url.origin;
 }
 const frontend=origin('FRONTEND_URL','http://localhost:5173');
 const admin=origin('ADMIN_URL','http://localhost:5174');
 const adminPath=env.ADMIN_APP_PATH??(production?'/admin':'');
 if(!/^\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]*$/.test(adminPath)||adminPath==='//')throw new Error('ADMIN_APP_PATH must be a URL path beginning with /');
 const api=origin('PUBLIC_API_URL','http://localhost:4000');
 const cookieDomain=env.COOKIE_DOMAIN||'';
 if(cookieDomain&&!/^\.?[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/.test(cookieDomain))throw new Error('COOKIE_DOMAIN must be a bare domain such as .example.com');
 const proxyHops=Number(env.TRUST_PROXY??(env.VERCEL==='1'?1:0));
 if(!Number.isInteger(proxyHops)||proxyHops<0||proxyHops>2)throw new Error('TRUST_PROXY must be 0, 1 or 2; never trust arbitrary forwarded headers');
 return {production,frontend,admin,adminPath,api,cookieDomain,proxyHops,origins:new Set([frontend,admin,api])};
}

export const sessionCookieOptions=(production,domain='')=>({httpOnly:true,secure:production,sameSite:'lax',path:'/',...(domain?{domain}: {})});

export function originGuard(config) {
 return (req,res,next)=>{
  const origin=req.get('origin');
  if(origin&&!config.origins.has(origin))return res.status(403).json({error:'Origin not allowed'});
  // CORS alone doesn't prevent cross-site form submissions.
  if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.get('sec-fetch-site')==='cross-site'&&!origin)return res.status(403).json({error:'Cross-site request rejected'});
  next();
 };
}
