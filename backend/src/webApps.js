import express from 'express';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join,extname} from 'node:path';

export function mountWebApps(app, {
 storefront=fileURLToPath(new URL('../../frontend/dist/',import.meta.url)),
 admin=fileURLToPath(new URL('../../admin panel/dist/',import.meta.url))
}={}) {
 for(const folder of [storefront,admin]) {
  if(!existsSync(join(folder,'index.html')))throw new Error('Production web bundles missing. Run npm run build:deploy from the project root.');
 }
 // Unknown API routes and missing uploads must never return the SPA HTML.
 app.use('/api',(req,res)=>res.status(404).json({error:'API endpoint not found'}));
 app.use('/uploads',(req,res)=>res.sendStatus(404));
 const mount=(prefix,folder)=>{
  const router=express.Router();
  router.use(express.static(folder,{index:false,dotfiles:'deny'}));
  router.get('*',(req,res)=>{
   if(extname(req.path))return res.sendStatus(404);
   res.set('Cache-Control','no-cache').sendFile(join(folder,'index.html'));
  });
  app.use(prefix,router);
 };
 mount('/admin',admin);
 mount('/',storefront);
}
