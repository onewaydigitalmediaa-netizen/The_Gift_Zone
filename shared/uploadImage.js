import {upload} from '@vercel/blob/client';

export async function uploadImage(file,api,admin=false){
 if(!['image/jpeg','image/png','image/webp'].includes(file?.type)||!file.size||file.size>5*1024*1024)throw Error('Use JPEG, PNG or WebP, up to 5 MB');
 const base=admin?'/admin/uploads':'/uploads';
 const permission=await api(`${base}/prepare`,{method:'POST',body:{contentType:file.type,size:file.size}});
 await upload(permission.pathname,file,{
  access:permission.access,contentType:file.type,
  handleUploadUrl:`/api${base}/token`,clientPayload:permission.ticket,
  multipart:true
 });
 return api(`${base}/complete`,{method:'POST',body:{ticket:permission.ticket}});
}
