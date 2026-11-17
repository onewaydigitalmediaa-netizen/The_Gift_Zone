import {test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {mountWebApps} from './webApps.js';

test('production hosting serves both SPAs and preserves API and asset boundaries',async()=>{
 const root=mkdtempSync(join(tmpdir(),'gift-zone-web-'));
 const storefront=join(root,'store'),admin=join(root,'admin');
 for(const folder of [storefront,admin])mkdirSync(join(folder,'assets'),{recursive:true});
 writeFileSync(join(storefront,'index.html'),'<h1>Storefront</h1>');
 writeFileSync(join(admin,'index.html'),'<h1>Admin login</h1>');
 writeFileSync(join(admin,'assets/app.js'),'console.log("admin")');
 const app=express();
 app.get('/api/health',(req,res)=>res.json({ok:true}));
 mountWebApps(app,{storefront,admin});
 const server=app.listen(0,'127.0.0.1');
 try {
  await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  for(const path of ['/','/product/sample','/account']){
   const r=await fetch(base+path);assert.equal(r.status,200);assert.match(await r.text(),/Storefront/);
  }
  for(const path of ['/admin/','/admin/orders','/admin/reset-password?token=sample']){
   const r=await fetch(base+path);assert.equal(r.status,200);assert.match(await r.text(),/Admin login/);
  }
  assert.match(await (await fetch(base+'/admin/assets/app.js')).text(),/console.log/);
  assert.deepEqual(await (await fetch(base+'/api/health')).json(),{ok:true});
  for(const path of ['/api/missing','/uploads/missing.jpg','/admin/assets/missing.js','/assets/missing.js'])assert.equal((await fetch(base+path)).status,404,path);
 }finally{await new Promise(resolve=>server.close(resolve));rmSync(root,{recursive:true,force:true})}
});

test('production hosting fails clearly when web bundles were not built',()=>{
 assert.throws(()=>mountWebApps(express(),{storefront:join(tmpdir(),'gift-zone-unbuilt-folder')}),/npm run build:deploy/);
});
