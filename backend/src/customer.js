import {Router} from 'express';
import {db,wrap,assert,userOnly,publicUser,pick,getBalance,uniqueReferral} from './common.js';
const r=Router();
r.post('/bulk',wrap(async(req,res)=>{
 const {name,email,phone,company,requirement,quantity}=req.body||{};
 assert(String(name||'').length>=2&&String(phone||'').length>=10&&String(requirement||'').length>=10,'Enter your name, phone and order requirement');
 const lead=await db.bulkLead.create({data:{name:String(name).slice(0,120),email:String(email||'').slice(0,150),phone:String(phone).slice(0,20),company:String(company||'').slice(0,120),requirement:String(requirement).slice(0,3000),quantity:Math.max(1,Number(quantity)||10)}});
 res.status(201).json({id:lead.id,message:'Your bulk order enquiry has been received.'});
}));
r.post('/support',wrap(async(req,res)=>{
 const {name,email,subject,message}=req.body||{};
 assert(String(name||'').length>=2&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email||''))&&String(message||'').length>=10,'Enter a valid name, email and message');
 const ticket=await db.supportTicket.create({data:{userId:req.user?.id||null,name:String(name).slice(0,90),email:String(email).slice(0,150),subject:String(subject||'General enquiry').slice(0,160),message:String(message).slice(0,3000)}});
 res.status(201).json({id:ticket.id,message:'Support ticket created.'});
}));
r.get('/tracking/:number',wrap(async(req,res)=>{
 const order=await db.order.findUnique({where:{number:req.params.number},select:{number:true,status:true,courier:true,trackingNumber:true,createdAt:true,updatedAt:true}});
 assert(order,'Order not found',404);res.json(order);
}));
r.get('/wishlist',userOnly,wrap(async(req,res)=>res.json((await db.wishlist.findMany({where:{userId:req.user.id},include:{product:{include:{category:true}}}})).map(x=>({id:x.id,product:x.product})))));
r.post('/wishlist/:productId',userOnly,wrap(async(req,res)=>{
 const p=await db.product.findUnique({where:{id:req.params.productId}});assert(p?.isActive,'Product not found',404);
 const w=await db.wishlist.upsert({where:{userId_productId:{userId:req.user.id,productId:p.id}},update:{},create:{userId:req.user.id,productId:p.id}});res.status(201).json(w);
}));
r.delete('/wishlist/:productId',userOnly,wrap(async(req,res)=>{await db.wishlist.deleteMany({where:{userId:req.user.id,productId:req.params.productId}});res.json({ok:true})}));
r.get('/addresses',userOnly,wrap(async(req,res)=>res.json(await db.address.findMany({where:{userId:req.user.id},orderBy:{isDefault:'desc'}}))));
r.post('/addresses',userOnly,wrap(async(req,res)=>{
 const x=req.body||{};assert(x.name&&x.phone&&x.line1&&x.city&&x.state&&/^\d{6}$/.test(String(x.pincode||'')),'Enter a complete delivery address and 6-digit pincode');
 const address=await db.address.create({data:{userId:req.user.id,...pick(x,['name','phone','line1','line2','city','state','pincode']),isDefault:!!x.isDefault}});
 res.status(201).json(address);
}));
r.put('/addresses/:id',userOnly,wrap(async(req,res)=>{
 const old=await db.address.findFirst({where:{id:req.params.id,userId:req.user.id}});assert(old,'Address not found',404);
 const x=pick(req.body,['name','phone','line1','line2','city','state','pincode','isDefault']);if(x.pincode)assert(/^\d{6}$/.test(String(x.pincode)),'Invalid pincode');
 res.json(await db.address.update({where:{id:old.id},data:x}));
}));
r.delete('/addresses/:id',userOnly,wrap(async(req,res)=>{
 const used=await db.order.count({where:{addressId:req.params.id,userId:req.user.id}});assert(!used,'Address is used for an order. Edit instead.');
 await db.address.deleteMany({where:{id:req.params.id,userId:req.user.id}});res.json({ok:true});
}));
r.get('/wallet',userOnly,wrap(async(req,res)=>{
 const tx=await db.walletTransaction.findMany({where:{userId:req.user.id},orderBy:{createdAt:'desc'},take:100});
 res.json({balance:await getBalance(req.user.id),transactions:tx});
}));
r.get('/reminders',userOnly,wrap(async(req,res)=>res.json(await db.reminder.findMany({where:{userId:req.user.id},orderBy:{date:'asc'}}))));
r.post('/reminders',userOnly,wrap(async(req,res)=>{
 const {name,date,occasion}=req.body||{};
 assert(name&&/^\d{4}-\d{2}-\d{2}$/.test(String(date||'')),'Enter a name and valid date');
 const x=await db.reminder.create({data:{userId:req.user.id,name:String(name).slice(0,100),date,occasion:String(occasion||'Special Day').slice(0,70)}});
 res.status(201).json(x);
}));
r.delete('/reminders/:id',userOnly,wrap(async(req,res)=>{await db.reminder.deleteMany({where:{userId:req.user.id,id:req.params.id}});res.json({ok:true})}));
r.get('/referrals',userOnly,wrap(async(req,res)=>{
 const invited=await db.user.findMany({where:{referredBy:req.user.id},select:{id:true,name:true,createdAt:true},orderBy:{createdAt:'desc'}});
 res.json({referralCode:req.user.referralCode,invited});
}));
r.post('/reviews/:productId',userOnly,wrap(async(req,res)=>{
 const {rating,comment}=req.body||{};assert(Number.isInteger(Number(rating))&&Number(rating)>=1&&Number(rating)<=5&&String(comment||'').length>=5,'Valid rating and review text required');
 const bought=await db.orderItem.findFirst({where:{productId:req.params.productId,order:{userId:req.user.id,status:{not:'CANCELLED'}}}});
 assert(bought,'Reviews require a product purchase',403);
 const review=await db.review.upsert({where:{userId_productId:{userId:req.user.id,productId:req.params.productId}},update:{rating:Number(rating),comment:String(comment).slice(0,2000),approved:false},create:{userId:req.user.id,productId:req.params.productId,rating:Number(rating),comment:String(comment).slice(0,2000)}});
 res.status(201).json({review,message:'Review submitted for moderation'});
}));
export default r;
