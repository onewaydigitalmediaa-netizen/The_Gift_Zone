import {Router} from 'express';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import jwt from 'jsonwebtoken';
import {get,head} from '@vercel/blob';
import {handleUpload} from '@vercel/blob/client';
import {wrap,assert,secret,db,json} from './common.js';
import {imagePath,canReadPrivate,isStaff,IMAGE_TYPES,MAX_IMAGE_SIZE} from './uploadPolicy.js';

// Dependency injection allows access-control tests without touching live storage.
export function uploadRoutes({blobGet=get,blobHead=head,blobHandle=handleUpload,database=db,env=process.env}={}) {
 const router=Router();
 const tokenFor=scope=>{
  const token=scope==='public'
   ?env.BLOB_PUBLIC_READ_WRITE_TOKEN
   :(env.BLOB_PRIVATE_READ_WRITE_TOKEN||env.BLOB_READ_WRITE_TOKEN);
  assert(token,'Image storage is not configured',503);return token;
 };
 const sign=data=>jwt.sign(data,secret,{algorithm:'HS256',expiresIn:'10m',issuer:'the-gift-zone',audience:'image-upload'});
 const verify=(value,user,scope)=>{
  assert(user,'Please sign in to upload',401);
  let data;try{data=jwt.verify(value,secret,{algorithms:['HS256'],issuer:'the-gift-zone',audience:'image-upload'})}catch{assert(false,'Upload permission expired. Choose the image again.',403)}
  assert(data.sub===user.id&&data.scope===scope&&(scope!=='public'||isStaff(user)),'Upload not allowed',403);
  return data;
 };
 for(const scope of ['private','public']) {
  const base=scope==='public'?'/api/admin/uploads':'/api/uploads';
  router.post(`${base}/prepare`,wrap(async(req,res)=>{
   const {contentType,size}=req.body||{};
   const pathname=imagePath(req.user,scope,contentType,size);tokenFor(scope);
   res.json({pathname,access:scope,ticket:sign({sub:req.user.id,pathname,scope,contentType,size})});
  }));
  router.post(`${base}/token`,wrap(async(req,res)=>{
   assert(req.body?.type==='blob.generate-client-token','Unsupported upload request');
   const result=await blobHandle({request:req,body:req.body,token:tokenFor(scope),onBeforeGenerateToken:async(pathname,clientPayload)=>{
    const data=verify(clientPayload,req.user,scope);assert(pathname===data.pathname,'Invalid upload path',403);
    return {allowedContentTypes:[data.contentType],maximumSizeInBytes:Math.min(data.size,MAX_IMAGE_SIZE),validUntil:Date.now()+10*60*1000,addRandomSuffix:false,allowOverwrite:false};
   }});
   res.json(result);
  }));
  router.post(`${base}/complete`,wrap(async(req,res)=>{
   const data=verify(req.body?.ticket,req.user,scope);
   const blob=await blobHead(data.pathname,{token:tokenFor(scope)});
   assert(blob.pathname===data.pathname&&blob.contentType===data.contentType&&blob.size===data.size,'Uploaded image did not match the request');
   res.status(201).json({url:scope==='private'?`/uploads/private/${data.pathname}`:blob.url});
  }));
 }
 router.get('/uploads/private/*',wrap(async(req,res)=>{
  res.set({'Cache-Control':'private, no-store','Vercel-CDN-Cache-Control':'no-store','CDN-Cache-Control':'no-store','Vary':'Cookie, Origin'});
  assert(req.user,'Please sign in to view this photo',401);
  const pathname=req.params[0];assert(canReadPrivate(pathname,req.user),'Photo not found',404);
  const result=await blobGet(pathname,{access:'private',token:tokenFor('private'),useCache:false});
  assert(result?.statusCode===200&&IMAGE_TYPES[result.blob.contentType],'Photo not found',404);
  res.type(result.blob.contentType).set({'X-Content-Type-Options':'nosniff','Content-Disposition':'inline'});
  await pipeline(Readable.fromWeb(result.stream),res);
 }));
 // Legacy URLs are kept intact after the explicit migration script uploads files
 // to private Blob storage. Never expose an old customer photo as a public file.
 router.get('/uploads/:filename',wrap(async(req,res)=>{
  res.set({'Cache-Control':'private, no-store','Vercel-CDN-Cache-Control':'no-store','CDN-Cache-Control':'no-store'});
  assert(/^[a-f0-9]{32}\.(png|jpg|webp)$/.test(req.params.filename),'Image not found',404);
  const url=`/uploads/${req.params.filename}`;
  const items=await database.orderItem.findMany({where:{customization:{contains:url}},select:{customization:true,order:{select:{userId:true}}}});
  const owners=items.filter(x=>json(x.customization,{}).photoUrl===url).map(x=>x.order.userId);
  if(owners.length)assert(req.user&&(owners.includes(req.user.id)||isStaff(req.user)),'Image not found',404);
  else {
   const [products,banner]=await Promise.all([
    database.product.findMany({where:{OR:[{image:url},{images:{contains:url}}]},select:{image:true,images:true}}),
    database.banner.findFirst({where:{image:url},select:{id:true}})
   ]);
   const published=!!banner||products.some(p=>p.image===url||json(p.images).includes(url));
   assert(published||isStaff(req.user),'Image not found',404);
  }
  const result=await blobGet(`legacy/${req.params.filename}`,{access:'private',token:tokenFor('private'),useCache:false});
  assert(result?.statusCode===200&&IMAGE_TYPES[result.blob.contentType],'Image not found',404);
  res.type(result.blob.contentType).set('X-Content-Type-Options','nosniff');await pipeline(Readable.fromWeb(result.stream),res);
 }));
 return router;
}
