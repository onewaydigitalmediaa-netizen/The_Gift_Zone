import {Router} from 'express';
import {db,wrap,assert,adminOnly,ownerAdmin,pick,json,productDto,settings,getBalance,measureDb} from './common.js';
const r=Router();r.use(adminOnly);
const PAGE_SIZE=20;
function pageArgs(query){const page=Math.max(1,Number.parseInt(query.page,10)||1);return {page,skip:(page-1)*PAGE_SIZE,take:PAGE_SIZE};}
function pageResponse(items,total,page){return {items,page,pageSize:PAGE_SIZE,total,totalPages:Math.max(1,Math.ceil(total/PAGE_SIZE))};}
const resources={
 categories:{model:'category',fields:['name','slug','description','image','sortOrder','isActive']},
 products:{model:'product',fields:['name','slug','description','price','compareAtPrice','image','images','categoryId','sku','stock','rating','ratingCount','featured','bestseller','personalized','variants','addOns','tags','isActive']},
 banners:{model:'banner',fields:['title','subtitle','description','image','cta','link','sortOrder','active']},
 coupons:{model:'coupon',fields:['code','type','value','minOrder','maxDiscount','maxUses','expiresAt','active']}
};
function prepare(k,input){
 const data=pick(input,resources[k].fields);
 if(k==='products'){
  for(const field of ['images','variants','addOns','tags'])if(Array.isArray(data[field]))data[field]=JSON.stringify(data[field]);
  for(const field of ['price','stock','ratingCount'])if(data[field]!==undefined){data[field]=Number(data[field]);assert(Number.isFinite(data[field])&&data[field]>=0,`${field} must be non-negative`)}
  if(data.compareAtPrice!==undefined&&data.compareAtPrice!==null)data.compareAtPrice=Number(data.compareAtPrice);
  if(data.rating!==undefined)data.rating=Number(data.rating);
  if(data.name)assert(String(data.name).length>=3,'Product name too short');
 }else if(k==='categories'){if(data.sortOrder!==undefined)data.sortOrder=Number(data.sortOrder)}
 else if(k==='banners'){if(data.sortOrder!==undefined)data.sortOrder=Number(data.sortOrder)}
 else if(k==='coupons'){
  for(const f of ['value','minOrder','maxDiscount','maxUses'])if(data[f]!==undefined&&data[f]!==null)data[f]=Number(data[f]);
  if(data.expiresAt)data.expiresAt=new Date(data.expiresAt);
  if(data.code)data.code=data.code.toUpperCase();
 }
 return data;
}
r.get('/dashboard',wrap(async(req,res)=>{
 const now=new Date();const windowStart=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-5,1));
 const [orders,customers,products,leads,tickets,stats,latest,monthly]=await measureDb('admin.dashboard.batch',()=>Promise.all([
  db.order.count(),db.user.count({where:{role:'CUSTOMER'}}),db.product.count(),db.bulkLead.count({where:{status:'NEW'}}),db.supportTicket.count({where:{status:'OPEN'}}),
  db.order.aggregate({where:{status:{notIn:['CANCELLED','REFUNDED']}},_sum:{total:true},_count:true}),
  db.order.findMany({take:8,orderBy:{createdAt:'desc'},select:{id:true,number:true,status:true,total:true,createdAt:true,user:{select:{name:true,email:true,phone:true}}}}),
  db.order.findMany({where:{createdAt:{gte:windowStart},status:{notIn:['CANCELLED','REFUNDED']}},select:{createdAt:true,total:true},orderBy:{createdAt:'asc'}})
 ]));
 const salesByMonth=new Map();for(const row of monthly){const key=new Date(row.createdAt).toISOString().slice(0,7);salesByMonth.set(key,(salesByMonth.get(key)||0)+Number(row.total||0))}let months=[];
 for(let i=5;i>=0;i--){const start=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-i,1));months.push({name:start.toLocaleString('en-IN',{month:'short'}),sales:salesByMonth.get(start.toISOString().slice(0,7))||0});}
 res.json({metrics:{orders,customers,products,leads,tickets,revenue:stats._sum.total||0},latest,months});
}));
for(const [key,value] of Object.entries(resources)){
 r.get(`/${key}`,wrap(async(req,res)=>{
  const {page,skip,take}=pageArgs(req.query);
  const where=key==='products'&&req.query.q?{OR:[{name:{contains:String(req.query.q)}},{sku:{contains:String(req.query.q)}}]}:{};
  if(key==='products'){
   if(req.query.isActive!==undefined&&req.query.isActive!=='')where.isActive=req.query.isActive!=='false';
   const [result,total]=await Promise.all([
    db.product.findMany({where,skip,take,orderBy:{createdAt:'desc'},select:{id:true,name:true,slug:true,sku:true,price:true,compareAtPrice:true,image:true,stock:true,isActive:true,category:{select:{id:true,name:true}}}}),
    db.product.count({where})
   ]);
   return res.json(pageResponse(result.map(productDto),total,page));
  }
  const result=await db[value.model].findMany({where,take:500});
  res.json(result);
 }));
 r.post(`/${key}`,wrap(async(req,res)=>{
  const data=prepare(key,req.body||{});
  const record=await db[value.model].create({data});res.status(201).json(record);
 }));
 r.put(`/${key}/:id`,wrap(async(req,res)=>{
  const data=prepare(key,req.body||{});
  const record=await db[value.model].update({where:{id:req.params.id},data});res.json(record);
 }));
 r.delete(`/${key}/:id`,wrap(async(req,res)=>{
  // Products/categories are archived to protect historical orders.
  if(key==='products'||key==='categories')await db[value.model].update({where:{id:req.params.id},data:{isActive:false}});
  else await db[value.model].delete({where:{id:req.params.id}});
  res.json({ok:true});
 }));
}
r.get('/products/:id',wrap(async(req,res)=>{const product=await db.product.findUnique({where:{id:req.params.id},include:{category:true}});assert(product,'Product not found',404);res.json(productDto(product));}));
r.get('/orders',wrap(async(req,res)=>{
 const {page,skip,take}=pageArgs(req.query);const q=String(req.query.q||'').trim();
 const where={...(req.query.status?{status:req.query.status}:{}),...(q?{OR:[{number:{contains:q}},{user:{is:{name:{contains:q}}}},{user:{is:{email:{contains:q}}}},{user:{is:{phone:{contains:q}}}}]}:{})};
 const [orders,total]=await Promise.all([
  db.order.findMany({where,skip,take,orderBy:{createdAt:'desc'},select:{id:true,number:true,status:true,paymentStatus:true,paymentMethod:true,total:true,createdAt:true,trackingNumber:true,courier:true,user:{select:{name:true,email:true,phone:true}},address:{select:{name:true,phone:true,line1:true,line2:true,city:true,state:true,pincode:true}},items:{select:{id:true,quantity:true,unitPrice:true,customization:true,product:{select:{name:true,sku:true,image:true}}}}}}),
  db.order.count({where})
 ]);
 res.json(pageResponse(orders,total,page));
}));
r.patch('/orders/:id',wrap(async(req,res)=>{
 const allowed=['PENDING','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','CANCELLED','REFUNDED'];
 assert(allowed.includes(req.body.status),'Invalid order status');
 const old=await db.order.findUnique({where:{id:req.params.id}});assert(old,'Order not found',404);
 assert(!['CANCELLED','REFUNDED'].includes(old.status),'Cancelled/refunded orders are finalized');
 // Financial refunds need a real payment refund before marking as REFUNDED.
 assert(req.body.status!=='REFUNDED'||old.paymentStatus!=='PAID','Issue the payment-provider refund first; then reconcile manually');
 const updated=await db.$transaction(async tx=>{
  if(req.body.status==='CANCELLED'&&old.status!=='CANCELLED'){
   if(old.status!=='PENDING')for(const item of await tx.orderItem.findMany({where:{orderId:old.id}}))await tx.product.update({where:{id:item.productId},data:{stock:{increment:item.quantity}}});
   if(old.walletUsed)await tx.walletTransaction.create({data:{userId:old.userId,amount:old.walletUsed,type:'REFUND',note:`Wallet refund for order ${old.number}`,reference:old.id}});
  }
  const u=await tx.order.update({where:{id:old.id},data:{status:req.body.status,trackingNumber:String(req.body.trackingNumber??old.trackingNumber??'').slice(0,100)||null,courier:String(req.body.courier??old.courier??'').slice(0,90)||null}});
  if(req.body.status==='DELIVERED'&&old.status!=='DELIVERED'){
   const earned=await tx.walletTransaction.count({where:{userId:old.userId,type:'PURCHASE_REWARD',reference:old.id}});
   const rate=Number((await tx.setting.findUnique({where:{key:'loyaltyRate'}}))?.value||5);
   if(!earned&&rate>0){const points=Math.floor(old.total*Math.min(20,rate)/100);if(points>0)await tx.walletTransaction.create({data:{userId:old.userId,amount:points,type:'PURCHASE_REWARD',note:`Reward for completed order ${old.number}`,reference:old.id}});}
  }
  return u;
 });res.json(updated);
}));
r.get('/customers',wrap(async(req,res)=>{const all=req.query.all==='true';const {page,skip,take}=all?{page:1,skip:0,take:500}:pageArgs(req.query);const q=String(req.query.q||'').trim();const where={role:'CUSTOMER',...(q?{OR:[{name:{contains:q}},{email:{contains:q}},{phone:{contains:q}}]}:{})};const [items,total]=await Promise.all([db.user.findMany({where,skip,take,select:{id:true,name:true,email:true,phone:true,role:true,createdAt:true,referralCode:true,_count:{select:{orders:true,addresses:true}}},orderBy:{createdAt:'desc'}}),db.user.count({where})]);res.json(all?items:pageResponse(items,total,page));}));
r.get('/leads',wrap(async(req,res)=>res.json(await db.bulkLead.findMany({orderBy:{createdAt:'desc'},take:500}))));
r.patch('/leads/:id',wrap(async(req,res)=>res.json(await db.bulkLead.update({where:{id:req.params.id},data:{status:String(req.body.status||'NEW').slice(0,30)}}))));
r.get('/support',wrap(async(req,res)=>res.json(await db.supportTicket.findMany({orderBy:{createdAt:'desc'},take:500}))));
r.patch('/support/:id',wrap(async(req,res)=>res.json(await db.supportTicket.update({where:{id:req.params.id},data:{status:String(req.body.status||'OPEN').slice(0,30)}}))));
r.get('/reviews',wrap(async(req,res)=>res.json(await db.review.findMany({include:{product:{select:{name:true}},user:{select:{name:true}}},orderBy:{createdAt:'desc'},take:500}))));
r.patch('/reviews/:id',wrap(async(req,res)=>{
 const rev=await db.review.update({where:{id:req.params.id},data:{approved:!!req.body.approved}});
 const agg=await db.review.aggregate({where:{productId:rev.productId,approved:true},_avg:{rating:true},_count:true});
 await db.product.update({where:{id:rev.productId},data:{rating:agg._avg.rating||0,ratingCount:agg._count||0}});
 res.json(rev);
}));
r.get('/settings',wrap(async(req,res)=>res.json(await settings())));
r.put('/settings',ownerAdmin,wrap(async(req,res)=>{
 const allowed=['storeName','tagline','shippingFreeAbove','shippingFlatFee','loyaltyRate','walletMaxPercent','supportEmail','supportPhone','whatsappNumber','announcement','primaryColor','secondaryColor','accentColor'];
 const body=pick(req.body||{},allowed);
 await db.$transaction(Object.entries(body).map(([key,value])=>db.setting.upsert({where:{key},update:{value:String(value).slice(0,500)},create:{key,value:String(value).slice(0,500)}})));
 res.json(await settings());
}));
r.post('/wallet/credit',ownerAdmin,wrap(async(req,res)=>{
 const {userId,amount,note}=req.body||{};
 assert(Number.isInteger(Number(amount))&&Math.abs(Number(amount))<=50000&&amount!==0&&String(note||'').length>=5,'Valid amount and reason required');
 const user=await db.user.findUnique({where:{id:userId}});assert(user,'Customer not found',404);
 const balance=await getBalance(userId);assert(balance+Number(amount)>=0,'Debit exceeds customer balance');
 res.status(201).json(await db.walletTransaction.create({data:{userId,amount:Number(amount),type:'ADMIN_ADJUSTMENT',note:String(note).slice(0,250),reference:req.user.id}}));
}));
export default r;
