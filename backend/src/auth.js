import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import {db,wrap,httpError,assert,validPhone,uniqueReferral,setSession,clearSession,publicUser,frontend,isProd,config} from './common.js';
import {sessionCookieOptions} from './runtimeConfig.js';
const router=Router();
router.get('/me',wrap(async(req,res)=>res.json({user:publicUser(req.user)||null})));
router.post('/logout',(req,res)=>{clearSession(res);res.json({ok:true})});
router.post('/request-otp',wrap(async(req,res)=>{
  const phone=String(req.body?.phone||'').trim();assert(validPhone(phone),'Enter a valid mobile number with country code');
  await db.otp.deleteMany({where:{phone}});
  const code=String(crypto.randomInt(100000,1000000));
  await db.otp.create({data:{phone,codeHash:await bcrypt.hash(code,10),expiresAt:new Date(Date.now()+5*60*1000)}});
  if(process.env.TWILIO_ACCOUNT_SID&&process.env.TWILIO_AUTH_TOKEN&&process.env.TWILIO_PHONE_NUMBER){
    const a=process.env.TWILIO_ACCOUNT_SID;let url=`https://api.twilio.com/2010-04-01/Accounts/${a}/Messages.json`;
    let form=new URLSearchParams({From:process.env.TWILIO_PHONE_NUMBER,To:phone,Body:`Your The Gift Zone sign-in code is ${code}. It expires in 5 minutes.`});
    const result=await fetch(url,{method:'POST',headers:{Authorization:'Basic '+Buffer.from(a+':'+process.env.TWILIO_AUTH_TOKEN).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:form});
    if(!result.ok){await db.otp.deleteMany({where:{phone}});throw httpError(502,'Unable to deliver SMS. Please try again.');}
  } else if(!isProd)console.log(`[DEV ONLY] The Gift Zone OTP for ${phone}: ${code}`);
  else {await db.otp.deleteMany({where:{phone}});throw httpError(503,'SMS service is not configured');}
  res.json({ok:true,message:'Verification code sent. Valid for 5 minutes.'});
}));
router.post('/verify-otp',wrap(async(req,res)=>{
 const phone=String(req.body?.phone||'').trim(),code=String(req.body?.code||'');
 assert(validPhone(phone)&&/^\d{6}$/.test(code),'Invalid mobile number or verification code');
 const rec=await db.otp.findFirst({where:{phone},orderBy:{createdAt:'desc'}});
 assert(rec&&rec.expiresAt>new Date()&&rec.attempts<5,'Code expired or too many attempts. Request a new code.',401);
 await db.otp.update({where:{id:rec.id},data:{attempts:{increment:1}}});
 assert(await bcrypt.compare(code,rec.codeHash),'Incorrect code',401);
 await db.otp.deleteMany({where:{phone}});
 let u=await db.user.findUnique({where:{phone}});
 if(!u){
  const ref=String(req.body?.referral||'').toUpperCase().slice(0,30);
  const inviter=ref?await db.user.findUnique({where:{referralCode:ref}}):null;
  u=await db.user.create({data:{phone,name:String(req.body?.name||'Gift Lover').slice(0,90),referralCode:uniqueReferral(),referredBy:inviter?.id||null}});
  if(inviter) await db.$transaction([
    db.walletTransaction.create({data:{userId:u.id,amount:50,type:'REFERRAL_WELCOME',note:'Welcome gift for joining through a friend'}}),
    db.walletTransaction.create({data:{userId:inviter.id,amount:10,type:'REFERRAL_SIGNUP',note:'Friend joined The Gift Zone',reference:u.id}})
  ]);
 }
 setSession(res,u);res.json({user:publicUser(u)});
}));
router.post('/password',wrap(async(req,res)=>{
  const email=String(req.body?.email||'').toLowerCase().trim(),password=String(req.body?.password||'');
  assert(email&&password,'Email and password required');
  const u=await db.user.findUnique({where:{email}});
  assert(u?.passwordHash&&await bcrypt.compare(password,u.passwordHash),'Invalid credentials',401);
  setSession(res,u);res.json({user:publicUser(u)});
}));
router.patch('/profile',wrap(async(req,res)=>{
 assert(req.user,'Sign in first',401);
 const name=String(req.body?.name||'').trim();assert(name.length>=2&&name.length<=90,'Name must be 2–90 characters');
 const user=await db.user.update({where:{id:req.user.id},data:{name}});res.json({user:publicUser(user)});
}));
const providers={
 google:{authorization:'https://accounts.google.com/o/oauth2/v2/auth',token:'https://oauth2.googleapis.com/token',user:'https://www.googleapis.com/oauth2/v3/userinfo',client:'GOOGLE_CLIENT_ID',secret:'GOOGLE_CLIENT_SECRET',scope:'openid email profile'},
 facebook:{authorization:'https://www.facebook.com/v22.0/dialog/oauth',token:'https://graph.facebook.com/v22.0/oauth/access_token',user:'https://graph.facebook.com/me?fields=id,name,email',client:'FACEBOOK_APP_ID',secret:'FACEBOOK_APP_SECRET',scope:'email,public_profile'}
};
// Both navigation and callback travel through the storefront's /api rewrite.
// A cookie set on the API domain would not authenticate the storefront domain.
export function redirectUrl(provider){return `${frontend}/api/auth/${provider}/callback`}
for(const [provider,config] of Object.entries(providers)){
 router.get(`/${provider}`,wrap(async(req,res)=>{
   assert(process.env[config.client]&&process.env[config.secret],`${provider} login is not configured. Add app credentials.`,503);
   const state=crypto.randomBytes(24).toString('hex');
   res.cookie(`gz_oauth_${provider}`,state,{...sessionCookieOptions(isProd,config.cookieDomain),maxAge:10*60*1000});
   const p=new URLSearchParams({client_id:process.env[config.client],redirect_uri:redirectUrl(provider),response_type:'code',scope:config.scope,state});
   res.redirect(`${config.authorization}?${p}`);
 }));
 router.get(`/${provider}/callback`,wrap(async(req,res)=>{
  const state=req.cookies?.[`gz_oauth_${provider}`];res.clearCookie(`gz_oauth_${provider}`,sessionCookieOptions(isProd,config.cookieDomain));
  assert(state&&state===req.query.state&&req.query.code,'OAuth authorization failed',401);
  const body=new URLSearchParams({client_id:process.env[config.client],client_secret:process.env[config.secret],redirect_uri:redirectUrl(provider),code:String(req.query.code),grant_type:'authorization_code'});
  const tokenReq=provider==='google'?await fetch(config.token,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body}):await fetch(`${config.token}?${body}`);
  assert(tokenReq.ok,'Unable to complete social sign in',502);
  const token=await tokenReq.json();assert(token.access_token,'Invalid provider access token',401);
  const infoReq=await fetch(config.user,{headers:{Authorization:`Bearer ${token.access_token}`}});assert(infoReq.ok,'Unable to verify social profile',502);
  const info=await infoReq.json(),id=provider==='google'?info.sub:info.id;
  const socialKey=provider==='google'?'googleId':'facebookId';
  assert(id,'Provider profile is missing an identifier',401);
  let user=await db.user.findUnique({where:{[socialKey]:id}});
  const email=info.email?.toLowerCase();
  if(!user&&email){
   const existing=await db.user.findUnique({where:{email}});
   // A provider's unverified email must not take over a password account.
   assert(!existing||(provider==='google'&&info.email_verified===true),'Sign in with your existing method to use this account',409);
   user=existing;
  }
  if(user){user=await db.user.update({where:{id:user.id},data:{[socialKey]:id}})}
  else user=await db.user.create({data:{[socialKey]:id,email:email||null,name:(info.name||'Gift Lover').slice(0,90),referralCode:uniqueReferral()}});
  setSession(res,user);res.redirect(`${frontend}/account`);
 }));
}
export default router;
