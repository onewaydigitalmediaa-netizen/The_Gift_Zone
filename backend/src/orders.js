import {Router} from 'express';
import crypto from 'node:crypto';
import {ownsPhoto} from './uploadPolicy.js';
import {db,wrap,assert,userOnly,shortId,getBalance,settings,httpError,json} from './common.js';
const r=Router();
const shippingFree = config=>Math.max(0,Number(config.shippingFreeAbove)||1499);
async function priceOrder({items,couponCode,walletRequested},tx,userId){
  assert(Array.isArray(items)&&items.length>0&&items.length<=40,'Add at least one item to your cart');
  let subtotal=0;let detailed=[];const quantities=new Map();
  for(const item of items){
    assert(item?.productId&&Number.isInteger(item.quantity)&&item.quantity>=1&&item.quantity<=50,'Invalid cart item or quantity');
    const p=await tx.product.findUnique({where:{id:item.productId}});
    const totalQuantity=(quantities.get(item.productId)||0)+item.quantity;
    assert(p?.isActive&&p.stock>=totalQuantity,`Sorry, ${p?.name||'this item'} is unavailable or out of stock`,409);
    quantities.set(item.productId,totalQuantity);
    const variantName=String(item.customization?.variant||'');
    const allowedVariants=json(p.variants),allowedAddOns=json(p.addOns);
    const variant=variantName?allowedVariants.find(v=>v.name===variantName):null;
    assert(!variantName||variant,'Invalid product variation');
    const addOns=Array.isArray(item.customization?.addOns)?item.customization.addOns:[];
    assert(addOns.length<=10,'Too many add-ons');
    let addOnPrice=0;
    for(const name of addOns){const option=allowedAddOns.find(a=>a.name===name);assert(option,'Invalid product add-on');addOnPrice+=option.price;}
    const customization={variant:variantName||null,addOns,text:String(item.customization?.text||'').slice(0,500),photoUrl:String(item.customization?.photoUrl||'').slice(0,500),giftMessage:String(item.customization?.giftMessage||'').slice(0,350)};
    assert(ownsPhoto(customization.photoUrl,userId),'Please upload your personalization photo again while signed in');
    const unitPrice=p.price+(variant?.priceDelta||0)+addOnPrice;
    subtotal+=unitPrice*item.quantity;
    detailed.push({productId:p.id,quantity:item.quantity,unitPrice,customization:JSON.stringify(customization),product:p});
  }
  assert(subtotal<=20000000,'Order value exceeds the online maximum');
  let discount=0,usedCoupon=null;
  if(couponCode){
    const c=await tx.coupon.findUnique({where:{code:String(couponCode).toUpperCase()}});
    assert(c?.active&&(!c.expiresAt||c.expiresAt>new Date())&&c.usedCount<c.maxUses&&subtotal>=c.minOrder,'Coupon invalid, expired or minimum order not met');
    discount=c.type==='PERCENT'?Math.floor(subtotal*c.value/100):c.value;
    discount=Math.min(discount,c.maxDiscount??Infinity,subtotal);usedCoupon=c;
  }
  const config=await settings();
  const deliveryFee=subtotal-discount>=shippingFree(config)?0:Math.max(0,Number(config.shippingFlatFee)||79);
  return {detailed,subtotal,discount,deliveryFee,usedCoupon,config};
}
r.post('/quote',userOnly,wrap(async(req,res)=>{
 const {subtotal,discount,deliveryFee,usedCoupon,config}=await priceOrder(req.body,db,req.user.id);
 const balance=await getBalance(req.user.id);
 const walletMax=Math.floor((subtotal-discount)*Math.max(0,Math.min(100,Number(config.walletMaxPercent)||25))/100);
 const requested=Math.max(0,Number(req.body.walletRequested)||0);
 const walletUsed=Math.min(balance,walletMax,requested,subtotal-discount+deliveryFee);
 res.json({subtotal,discount,deliveryFee,walletBalance:balance,walletMax:Math.min(balance,walletMax),walletUsed,total:Math.max(0,subtotal-discount+deliveryFee-walletUsed),coupon:usedCoupon?.code||null});
}));
r.post('/',userOnly,wrap(async(req,res)=>{
 const {addressId,paymentMethod,note}=req.body||{};
 assert(['COD','RAZORPAY'].includes(paymentMethod),'Choose a valid payment method');
 const address=await db.address.findFirst({where:{id:addressId,userId:req.user.id}});assert(address,'Select a saved delivery address');
 if(paymentMethod==='RAZORPAY')assert(process.env.RAZORPAY_KEY_ID&&process.env.RAZORPAY_KEY_SECRET,'Online payments are not configured yet',503);
 const order=await db.$transaction(async tx=>{
   const {detailed,subtotal,discount,deliveryFee,usedCoupon,config}=await priceOrder(req.body,tx,req.user.id);
   const balance=await getBalance(req.user.id,tx);
   const requestWallet=Math.max(0,Number(req.body.walletRequested)||0);
   assert(Number.isInteger(requestWallet),'Invalid wallet redemption amount');
   const walletMax=Math.floor((subtotal-discount)*(Math.max(0,Math.min(100,Number(config.walletMaxPercent)||25)))/100);
   const walletUsed=Math.min(balance,walletMax,requestWallet,subtotal-discount+deliveryFee);
   const total=subtotal-discount+deliveryFee-walletUsed;
   const create=await tx.order.create({data:{number:`GZ${Date.now().toString(36).toUpperCase()}${shortId().slice(0,4)}`,userId:req.user.id,addressId:address.id,paymentMethod,status:paymentMethod==='COD'?'CONFIRMED':'PENDING',subtotal,discount,deliveryFee,walletUsed,total,couponCode:usedCoupon?.code||null,note:String(note||'').slice(0,500),items:{create:detailed.map(({product,...x})=>x)}}});
   if(walletUsed>0)await tx.walletTransaction.create({data:{userId:req.user.id,amount:-walletUsed,type:'REDEEM',note:`Redeemed toward order ${create.number}`,reference:create.id}});
   if(usedCoupon)await tx.coupon.update({where:{id:usedCoupon.id},data:{usedCount:{increment:1}}});
   if(paymentMethod==='COD')for(const x of detailed){
     const changed=await tx.product.updateMany({where:{id:x.productId,stock:{gte:x.quantity}},data:{stock:{decrement:x.quantity}}});
     assert(changed.count===1,`Insufficient stock for ${x.product.name}`,409);
   }
   return create;
 },{timeout:15000});
 res.status(201).json({order});
}));
r.get('/',userOnly,wrap(async(req,res)=>res.json(await db.order.findMany({where:{userId:req.user.id},include:{items:{include:{product:{select:{name:true,image:true,slug:true}}}},address:true},orderBy:{createdAt:'desc'}}))));
r.get('/:id',userOnly,wrap(async(req,res)=>{
 const o=await db.order.findFirst({where:{id:req.params.id,userId:req.user.id},include:{items:{include:{product:true}},address:true}});assert(o,'Order not found',404);res.json(o);
}));
r.post('/:id/razorpay',userOnly,wrap(async(req,res)=>{
 const o=await db.order.findFirst({where:{id:req.params.id,userId:req.user.id}});
 assert(o&&o.paymentMethod==='RAZORPAY'&&o.paymentStatus==='UNPAID'&&o.status==='PENDING','Order not payable',400);
 const key=process.env.RAZORPAY_KEY_ID,sec=process.env.RAZORPAY_KEY_SECRET;assert(key&&sec,'Razorpay not configured',503);
 if(o.razorpayOrderId)return res.json({keyId:key,orderId:o.razorpayOrderId,amount:o.total*100,currency:'INR'});
 const response=await fetch('https://api.razorpay.com/v1/orders',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(`${key}:${sec}`).toString('base64'),'Content-Type':'application/json'},body:JSON.stringify({amount:o.total*100,currency:'INR',receipt:o.number,notes:{giftZoneOrderId:o.id}})});
 assert(response.ok,'Unable to start online payment',502);
 const data=await response.json();await db.order.update({where:{id:o.id},data:{razorpayOrderId:data.id}});
 res.json({keyId:key,orderId:data.id,amount:data.amount,currency:'INR'});
}));
r.post('/:id/verify',userOnly,wrap(async(req,res)=>{
 const {razorpay_payment_id,payment_order_id,razorpay_signature}=req.body||{};
 const o=await db.order.findFirst({where:{id:req.params.id,userId:req.user.id}});
 assert(o?.paymentMethod==='RAZORPAY'&&o.status==='PENDING'&&o.paymentStatus==='UNPAID'&&o.razorpayOrderId===payment_order_id,'Invalid payment order',400);
 const sig=crypto.createHmac('sha256',process.env.RAZORPAY_KEY_SECRET||'').update(`${payment_order_id}|${razorpay_payment_id}`).digest('hex');
 assert(typeof razorpay_signature==='string'&&/^[0-9a-f]{64}$/.test(razorpay_signature)&&crypto.timingSafeEqual(Buffer.from(sig,'hex'),Buffer.from(razorpay_signature,'hex')),'Payment signature verification failed',401);
 await db.$transaction(async tx=>{
  const previous=await tx.order.findUnique({where:{id:o.id}});assert(previous.paymentStatus==='UNPAID','Payment already processed',409);
  const items=await tx.orderItem.findMany({where:{orderId:o.id}});
  for(const item of items){const x=await tx.product.updateMany({where:{id:item.productId,stock:{gte:item.quantity}},data:{stock:{decrement:item.quantity}}});assert(x.count===1,'One of the products is now out of stock; please contact support',409);}
  await tx.order.update({where:{id:o.id},data:{status:'CONFIRMED',paymentStatus:'PAID',razorpayPaymentId:razorpay_payment_id}});
 });
 res.json({ok:true});
}));
// Customers may cancel only before fulfillment. Wallet credits are reversed transactionally.
r.post('/:id/cancel',userOnly,wrap(async(req,res)=>{
 const old=await db.order.findFirst({where:{id:req.params.id,userId:req.user.id}});
 assert(old&&['PENDING','CONFIRMED'].includes(old.status),'Order can no longer be cancelled online');
 assert(old.paymentStatus!=='PAID','Paid orders require support-assisted refunds');
 await db.$transaction(async tx=>{
  const current=await tx.order.findUnique({where:{id:old.id}});assert(['PENDING','CONFIRMED'].includes(current.status),'Already processed');
  await tx.order.update({where:{id:current.id},data:{status:'CANCELLED'}});
  if(current.status==='CONFIRMED')for(const item of await tx.orderItem.findMany({where:{orderId:current.id}}))await tx.product.update({where:{id:item.productId},data:{stock:{increment:item.quantity}}});
  if(current.walletUsed)await tx.walletTransaction.create({data:{userId:req.user.id,amount:current.walletUsed,type:'REFUND',reference:current.id,note:`Wallet restored for cancelled order ${current.number}`}});
  if(current.couponCode)await tx.coupon.updateMany({where:{code:current.couponCode,usedCount:{gt:0}},data:{usedCount:{decrement:1}}});
 });res.json({ok:true});
}));
export default r;
