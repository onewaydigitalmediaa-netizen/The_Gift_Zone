import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { readFile } from 'node:fs/promises';
const db = new PrismaClient();
const catalog = JSON.parse(await readFile(new URL('./catalog.json',import.meta.url),'utf8'));
const json = x => JSON.stringify(x);
try {
  for(const c of catalog.categories) await db.category.upsert({where:{slug:c.slug},update:{},create:c});
  for(const p of catalog.products){
    const cat=await db.category.findUnique({where:{slug:p.category}});
    const data={name:p.name,slug:p.slug,categoryId:cat.id,description:p.description,price:p.price,compareAtPrice:p.compareAtPrice,image:p.image,images:json(p.images),sku:p.sku,stock:p.stock,featured:p.featured,bestseller:p.bestseller,personalized:p.personalized,rating:p.rating,ratingCount:p.ratingCount,tags:json(p.tags),variants:json(p.variants),addOns:json(p.addOns)};
    await db.product.upsert({where:{slug:p.slug},update:{},create:data});
  }
  const banners=[
    {title:'Make every moment bloom',subtitle:'THE ART OF THOUGHTFUL GIFTING',description:'Thoughtful treasures, personal touches, unforgettable smiles.',cta:'Explore personalized gifts',link:'/category/personalized-gifts',image:'/images/hero-bloom.svg',sortOrder:0},
    {title:'Wrapped with love, gifted with joy',subtitle:'THE CELEBRATION EDIT',description:'Brighten birthdays and anniversaries with gifts made just for them.',cta:'Shop birthday gifts',link:'/category/birthday',image:'/images/hero-bloom.svg',sortOrder:1},
    {title:'Celebrate your people',subtitle:'CORPORATE & BULK GIFTING',description:'Beautiful branded gifts to help your team feel appreciated.',cta:'Explore corporate gifting',link:'/category/corporate-gifts',image:'/images/hero-bloom.svg',sortOrder:2}
  ];
  for(let i=0;i<banners.length;i++) {const prev=await db.banner.findFirst({where:{sortOrder:i}});if(!prev) await db.banner.create({data:banners[i]});}
  for(const c of [{code:'WELCOME10',type:'PERCENT',value:10,minOrder:699,maxDiscount:300,maxUses:500},{code:'GIFT100',type:'FLAT',value:100,minOrder:999,maxUses:200}])await db.coupon.upsert({where:{code:c.code},update:{},create:c});
  for(const [key,value] of Object.entries({storeName:'The Gift Zone',tagline:'A little love in every gift',shippingFreeAbove:'1499',shippingFlatFee:'79',loyaltyRate:'5',walletMaxPercent:'25',supportEmail:'hello@thegiftzone.example',supportPhone:'',whatsappNumber:'',announcement:'A little surprise! Free shipping on orders over ₹1,499',primaryColor:'#8B004E',secondaryColor:'#E91584',accentColor:'#6B8E23'}))await db.setting.upsert({where:{key},update:{},create:{key,value}});
  const email=process.env.ADMIN_EMAIL, password=process.env.ADMIN_PASSWORD;
  if(email && password && password!=='change-this-strong-admin-password'){
    const existing=await db.user.findUnique({where:{email}});
    const hash=existing?.passwordHash?undefined:await bcrypt.hash(password,12);
    await db.user.upsert({where:{email},update:{role:'ADMIN',...(hash?{passwordHash:hash}:{})},create:{email,name:'The Gift Zone Admin',passwordHash:hash,role:'ADMIN',referralCode:'ADMIN'+Date.now().toString(36).toUpperCase()}});
    console.log('Admin account is configured:',email);
  }else console.log('Admin NOT created. Set a strong ADMIN_EMAIL and ADMIN_PASSWORD in backend/.env and run npm run db:seed');
  console.log(`Seeded ${catalog.categories.length} categories, ${catalog.products.length} products, ${banners.length} banners, 2 coupons.`);
}finally{await db.$disconnect();}
