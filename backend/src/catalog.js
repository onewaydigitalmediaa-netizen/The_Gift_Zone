import {Router} from 'express';
import {db,wrap,assert,productDto,json,settings} from './common.js';
const r=Router();
r.get('/meta',wrap(async(req,res)=>{
 const [categories,banners,config]=await Promise.all([db.category.findMany({where:{isActive:true},orderBy:{sortOrder:'asc'}}),db.banner.findMany({where:{active:true},orderBy:{sortOrder:'asc'}}),settings()]);
 res.json({categories,banners,settings:config});
}));
r.get('/categories',wrap(async(req,res)=>res.json(await db.category.findMany({where:{isActive:true},orderBy:{sortOrder:'asc'}}))));
r.get('/banners',wrap(async(req,res)=>res.json(await db.banner.findMany({where:{active:true},orderBy:{sortOrder:'asc'}}))));
r.get('/products',wrap(async(req,res)=>{
 const {category,q,sort,featured,bestseller,minPrice,maxPrice,personalized}=req.query;
 const page=Math.max(1,Math.min(10000,Number(req.query.page)||1));const limit=Math.min(48,Math.max(1,Number(req.query.limit)||12));
 const where={isActive:true,category:{isActive:true}};
 if(category)where.category={slug:String(category),isActive:true};
 if(q)where.OR=[{name:{contains:String(q).slice(0,120)}},{description:{contains:String(q).slice(0,120)}}];
 if(featured==='true')where.featured=true;if(bestseller==='true')where.bestseller=true;if(personalized==='true')where.personalized=true;
 if(minPrice||maxPrice){where.price={};if(minPrice)where.price.gte=Math.max(0,Number(minPrice));if(maxPrice)where.price.lte=Math.max(0,Number(maxPrice));}
 const orderBy=sort==='price-asc'?{price:'asc'}:sort==='price-desc'?{price:'desc'}:sort==='newest'?{createdAt:'desc'}:sort==='rating'?{rating:'desc'}:{featured:'desc'};
 const [products,total]=await Promise.all([db.product.findMany({where,include:{category:true},skip:(page-1)*limit,take:limit,orderBy}),db.product.count({where})]);
 res.json({items:products.map(productDto),total,page,limit,pages:Math.ceil(total/limit)});
}));
r.get('/products/:slug',wrap(async(req,res)=>{
 const p=await db.product.findUnique({where:{slug:req.params.slug},include:{category:true,reviews:{where:{approved:true},include:{user:{select:{name:true}}},orderBy:{createdAt:'desc'},take:15}}});
 assert(p?.isActive&&p.category?.isActive,'Product not found',404);
 const related=await db.product.findMany({where:{categoryId:p.categoryId,isActive:true,id:{not:p.id}},take:6});
 res.json({product:productDto(p),related:related.map(productDto)});
}));
r.get('/finder',wrap(async(req,res)=>{
 const {occasion,recipient,kind,budget}=req.query;
 const where={isActive:true,category:{isActive:true}};
 const and=[];
 if(occasion&&occasion!=='any')and.push({OR:[{category:{slug:String(occasion)}},{name:{contains:String(occasion)}}]});
 if(kind&&kind!=='any')and.push({tags:{contains:String(kind)}});
 if(budget&&Number(budget))where.price={lte:Number(budget)};
 if(and.length)where.AND=and;
 const products=await db.product.findMany({where,orderBy:[{featured:'desc'},{rating:'desc'}],take:24});
 res.json({items:products.map(productDto),filters:{occasion,recipient,kind,budget}});
}));
r.get('/coupons/:code',wrap(async(req,res)=>{
 const c=await db.coupon.findUnique({where:{code:req.params.code.toUpperCase()}});
 assert(c?.active&&(!c.expiresAt||c.expiresAt>new Date())&&c.usedCount<c.maxUses,'Coupon not valid',404);
 res.json({code:c.code,type:c.type,value:c.value,minOrder:c.minOrder,maxDiscount:c.maxDiscount});
}));
export default r;
