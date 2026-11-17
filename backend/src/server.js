import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mountWebApps} from './webApps.js';
import {db,authenticate,wrap,requireSecret,measureDb,config} from './common.js';
import {originGuard} from './runtimeConfig.js';
import {uploadRoutes} from './uploads.js';
import auth from './auth.js';import catalog from './catalog.js';import customer from './customer.js';import orders from './orders.js';import admin from './admin.js';
import adminAuth from './adminAuth.js';
requireSecret();
const app=express();app.disable('x-powered-by');
if(config.proxyHops>0)app.set('trust proxy',config.proxyHops);
app.use(helmet({crossOriginResourcePolicy:{policy:'cross-origin'}}));
app.use(originGuard(config));
app.use(cors({origin:(o,cb)=>cb(null,!o||config.origins.has(o)),credentials:true}));
app.use('/api',(req,res,next)=>{res.set({'Cache-Control':'private, no-store','Vercel-CDN-Cache-Control':'no-store','CDN-Cache-Control':'no-store'});next()});
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
app.use(uploadRoutes());
if(process.env.VERCEL!=='1'&&process.env.SERVE_WEB==='true')mountWebApps(app);
app.use((req,res)=>res.status(404).json({error:'API endpoint not found'}));
app.use((err,req,res,next)=>{
 if(res.headersSent)return next(err);
 console.error('API error:',config.production?(err.code||err.name):err.message);
 if(err.code==='P2002')return res.status(409).json({error:'A record with this value already exists'});
 if(err.code==='P2025')return res.status(404).json({error:'Record not found'});
 const status=Number(err.status)||500;
 res.status(status).json({error:status===500?'Internal server error':err.message});
});
export default app;
if(process.env.VERCEL!=='1'&&process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
const port=Number(process.env.PORT)||4000;
const server=app.listen(port,()=>console.log(`The Gift Zone API http://localhost:${port}/api/health`));
const shutdown=()=>{
 const timeout=setTimeout(()=>process.exit(1),10000);timeout.unref();
 server.close(async()=>{await db.$disconnect();clearTimeout(timeout);process.exit(0)});
};
process.once('SIGINT',shutdown);
process.once('SIGTERM',shutdown);
}
