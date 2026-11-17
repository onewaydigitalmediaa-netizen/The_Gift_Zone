import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import {mkdirSync} from 'node:fs';
import {join,extname,resolve} from 'node:path';
import {mountWebApps} from './webApps.js';
import crypto from 'node:crypto';
import {db,authenticate,userOnly,adminOnly,wrap,httpError,frontend,adminUrl,requireSecret,measureDb} from './common.js';
import auth from './auth.js';import catalog from './catalog.js';import customer from './customer.js';import orders from './orders.js';import admin from './admin.js';
import adminAuth from './adminAuth.js';
requireSecret();
const app=express();app.disable('x-powered-by');
const proxyHops=Number(process.env.TRUST_PROXY||0);
if(!Number.isInteger(proxyHops)||proxyHops<0)throw new Error('TRUST_PROXY must be a non-negative integer');
if(proxyHops>0)app.set('trust proxy',proxyHops);
const origins=[frontend,adminUrl].filter(Boolean).map(value=>new URL(value).origin);
app.use(helmet({crossOriginResourcePolicy:{policy:'cross-origin'}}));
app.use(cors({origin:(o,cb)=>!o||origins.includes(o)?cb(null,true):cb(new Error('Origin blocked')),credentials:true}));
app.use(express.json({limit:'1mb'}));app.use(cookieParser());
app.use('/api',(req,res,next)=>{const started=performance.now();res.on('finish',()=>{const duration=Math.round(performance.now()-started);if(process.env.NODE_ENV!=='production')console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`)});next()});
app.use('/api',rateLimit({windowMs:15*60*1000,limit:500,standardHeaders:'draft-7',legacyHeaders:false,message:{error:'Too many requests. Please try again later.'}}));
// Keep authentication protected while allowing multiple open storefront/admin
// tabs to check the current session without consuming the login budget.
const authLimit=Number(process.env.AUTH_RATE_LIMIT)||(process.env.NODE_ENV==='production'?100:200);
app.use('/api/auth',rateLimit({
 windowMs:15*60*1000,
 limit:authLimit,
 standardHeaders:'draft-7',
 legacyHeaders:false,
 message:{error:'Too many login attempts. Please try again later.'},
 skip:req=>req.path==='/me'||req.path==='/logout'
}));
app.use('/api/admin/auth',rateLimit({windowMs:15*60*1000,limit:5,standardHeaders:'draft-7',legacyHeaders:false,message:{error:'Too many password reset attempts. Please try again later.'}}));
app.use(authenticate);
app.get('/api/health',wrap(async(req,res)=>{await measureDb('health.SELECT 1',()=>db.$queryRaw`SELECT 1`);res.json({ok:true,store:'The Gift Zone',database:'connected'})}));
app.use('/api/auth',auth);app.use('/api/admin/auth',adminAuth);app.use('/api/catalog',catalog);app.use('/api/customer',customer);app.use('/api/orders',orders);app.use('/api/admin',admin);
const uploads=resolve(process.env.UPLOAD_DIR||join(process.cwd(),'uploads'));mkdirSync(uploads,{recursive:true});
const storage=multer.diskStorage({destination:uploads,filename:(req,file,cb)=>cb(null,crypto.randomBytes(16).toString('hex')+'.'+(file.mimetype==='image/png'?'png':file.mimetype==='image/webp'?'webp':'jpg'))});
const upload=multer({storage,limits:{fileSize:5*1024*1024},fileFilter:(req,file,cb)=>['image/jpeg','image/png','image/webp'].includes(file.mimetype)?cb(null,true):cb(httpError(415,'Only JPEG, PNG and WebP images accepted'))});
app.post('/api/uploads',userOnly,upload.single('image'),(req,res)=>req.file?res.status(201).json({url:`/uploads/${req.file.filename}`}):res.status(400).json({error:'Image file required'}));
app.post('/api/admin/uploads',adminOnly,upload.single('image'),(req,res)=>req.file?res.status(201).json({url:`/uploads/${req.file.filename}`}):res.status(400).json({error:'Image file required'}));
app.use('/uploads',express.static(uploads,{dotfiles:'deny',maxAge:'30d',immutable:true}));
if(process.env.SERVE_WEB==='true')mountWebApps(app);
app.use((req,res)=>res.status(404).json({error:'API endpoint not found'}));
app.use((err,req,res,next)=>{
 console.error('API error:',err.message);
 if(err.code==='P2002')return res.status(409).json({error:'A record with this value already exists'});
 if(err.code==='P2025')return res.status(404).json({error:'Record not found'});
 if(err instanceof multer.MulterError)return res.status(400).json({error:err.message});
 const status=Number(err.status)||500;
 res.status(status).json({error:status===500?'Internal server error':err.message});
});
const port=Number(process.env.PORT)||4000;
const server=app.listen(port,()=>console.log(`The Gift Zone API http://localhost:${port}/api/health`));
const shutdown=()=>{
 const timeout=setTimeout(()=>process.exit(1),10000);timeout.unref();
 server.close(async()=>{await db.$disconnect();clearTimeout(timeout);process.exit(0)});
};
process.once('SIGINT',shutdown);
process.once('SIGTERM',shutdown);
