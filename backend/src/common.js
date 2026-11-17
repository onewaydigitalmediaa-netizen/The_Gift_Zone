import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
export const db=new PrismaClient();
export const isProd=process.env.NODE_ENV==='production';
export const measureDb=async(label,operation)=>{
 const started=performance.now();
 try{return await operation()}
 finally{if(!isProd)console.log(`[prisma] ${label} ${Math.round(performance.now()-started)}ms`)}
};
export const frontend=process.env.FRONTEND_URL||'http://localhost:5173';
export const adminUrl=process.env.ADMIN_URL||'http://localhost:5174';
export const secret=process.env.JWT_SECRET||'';
export const requireSecret=()=>{if(!secret||secret.length<32||secret.startsWith('replace-with-'))throw new Error('Set JWT_SECRET to a random value of at least 32 characters in backend/.env');};
export const wrap=(fn)=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
export const httpError=(status,message)=>Object.assign(new Error(message),{status});
export const assert=(valid,message,status=400)=>{if(!valid)throw httpError(status,message)};
export const json=(s,def=[])=>{try{return JSON.parse(s??'')}catch{return def}};
export const validPhone=v=>/^\+?[1-9]\d{9,14}$/.test(String(v||''));
export const money=n=>Number.isInteger(n)&&n>=0;
export const pick=(obj,keys)=>Object.fromEntries(keys.filter(k=>obj?.[k]!==undefined).map(k=>[k,obj[k]]));
export const publicUser=u=>u&&pick(u,['id','name','email','phone','role','referralCode','createdAt']);
export const productDto=p=>p?{...p,images:json(p.images),variants:json(p.variants),addOns:json(p.addOns),tags:json(p.tags)}:p;
export const createToken=u=>{requireSecret();return jwt.sign({sub:u.id,role:u.role,sv:u.sessionVersion||0},secret,{expiresIn:'7d',issuer:'the-gift-zone'});};
export const setSession=(res,u)=>res.cookie('gz_session',createToken(u),{httpOnly:true,secure:isProd,sameSite:'lax',maxAge:7*24*3600*1000,path:'/'});
export const clearSession=res=>res.clearCookie('gz_session',{httpOnly:true,secure:isProd,sameSite:'lax',path:'/'});
export const authenticate=wrap(async(req,res,next)=>{
  const token=req.cookies?.gz_session;
  if(token){try{let payload=jwt.verify(token,secret,{issuer:'the-gift-zone'});const user=await measureDb('auth.session',()=>db.user.findUnique({where:{id:payload.sub},select:{id:true,name:true,email:true,phone:true,role:true,referralCode:true,createdAt:true,sessionVersion:true}}));req.user=user&&Number(payload.sv||0)===user.sessionVersion?user:null;}catch{req.user=null}}
  next();
});
export const userOnly=(req,res,next)=>req.user?next():next(httpError(401,'Please sign in to continue'));
export const adminOnly=(req,res,next)=>req.user?.role==='ADMIN'||req.user?.role==='STAFF'?next():next(httpError(403,'Admin access required'));
export const ownerAdmin=(req,res,next)=>req.user?.role==='ADMIN'?next():next(httpError(403,'Owner access required'));
export const shortId=()=>crypto.randomBytes(5).toString('hex').toUpperCase();
export const uniqueReferral=()=>`GIFT${shortId()}`;
export const getBalance=async(userId,client=db)=>{const r=await client.walletTransaction.aggregate({where:{userId},_sum:{amount:true}});return r._sum.amount||0};
export const settings=async()=>Object.fromEntries((await db.setting.findMany()).map(x=>[x.key,x.value]));
export const jsonFail=(res,status,message)=>res.status(status).json({error:message});
