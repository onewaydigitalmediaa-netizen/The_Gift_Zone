import crypto from 'node:crypto';
export const MAX_IMAGE_SIZE=5*1024*1024;
export const IMAGE_TYPES={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
const customerPath=/^customer\/([a-zA-Z0-9_-]+)\/[a-f0-9-]{36}\.(jpg|png|webp)$/;
export const isStaff=user=>['ADMIN','STAFF'].includes(user?.role);
export function imagePath(user,scope,contentType,size) {
 if(!user)throw Object.assign(new Error('Please sign in to upload'),{status:401});
 if(scope==='public'&&!isStaff(user))throw Object.assign(new Error('Admin access required'),{status:403});
 if(!IMAGE_TYPES[contentType]||!Number.isInteger(size)||size<1||size>MAX_IMAGE_SIZE)throw Object.assign(new Error('Use JPEG, PNG or WebP, up to 5 MB'),{status:400});
 if(!/^[a-zA-Z0-9_-]+$/.test(user.id))throw new Error('Invalid user identifier');
 return `${scope==='public'?'products':`customer/${user.id}`}/${crypto.randomUUID()}.${IMAGE_TYPES[contentType]}`;
}
export function canReadPrivate(path,user) {
 const match=customerPath.exec(path);
 return !!(match&&user&&(match[1]===user.id||isStaff(user)));
}
export function ownsPhoto(url,userId) {
 if(!url)return true;
 const prefix='/uploads/private/';
 if(!url.startsWith(prefix))return false;
 const match=customerPath.exec(url.slice(prefix.length));
 return !!match&&match[1]===userId;
}
