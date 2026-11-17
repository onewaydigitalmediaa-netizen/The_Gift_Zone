import React from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {Heart,ShoppingBag,Star,ArrowRight,Sparkles} from 'lucide-react';
import {useStore,INR,IMAGE,Loading,ErrorState,useLoad} from '../lib';
export function ProductCard({p}){
 const {wishlist,toggleWishlist,addToCart}=useStore();const saved=wishlist.some(w=>w.product?.id===p.id);
 return <article className="product-card"><div className="product-photo"><Link to={`/product/${p.slug}`}><img src={IMAGE(p.image)} alt={p.name} loading="lazy"/></Link>{p.compareAtPrice>p.price&&<span className="discount-badge">{Math.round(100*(1-p.price/p.compareAtPrice))}% OFF</span>}<button className={`wish-icon ${saved?'selected':''}`} onClick={()=>toggleWishlist(p)} aria-label={saved?'Remove from favorites':'Add to favorites'}><Heart size={19} fill={saved?'currentColor':'none'}/></button><button className="quick-add" onClick={()=>addToCart(p,1,{})}><ShoppingBag size={16}/> Quick add</button></div><div className="product-details"><span className="product-kicker">{p.category?.name||'Thoughtful Gift'}</span><Link to={`/product/${p.slug}`} className="product-title">{p.name}</Link><div className="product-rating"><Star fill="#E8AF4B" size={13} stroke="#E8AF4B"/> {Number(p.rating||4.8).toFixed(1)} <span>({p.ratingCount||0})</span> {p.personalized&&<span className="personalize-tag">Personalizable</span>}</div><div className="price-line"><strong>{INR(p.price)}</strong>{p.compareAtPrice&&<del>{INR(p.compareAtPrice)}</del>}</div></div></article>
}
export function ProductSection({heading,subheading,path,filter=''}){
 const {data,loading,error}=useLoad(`/catalog/products?limit=8&${filter}`);
 return <section className="section section-products container"><div className="section-heading"><div><p className="eyebrow">THE GIFT ZONE EDIT</p><h2>{heading}</h2><p>{subheading}</p></div><Link className="view-all" to={path||'/search'}>View all <ArrowRight size={18}/></Link></div>{loading?<Loading/>:error?<ErrorState message={error}/>:<div className="product-grid">{data.items.map(p=><ProductCard key={p.id} p={p}/>)}</div>}</section>
}
export function Empty({title='Nothing here just yet',detail='Explore our thoughtful collections and find something lovely.'}){return <div className="empty"><div className="empty-icon"><Sparkles size={35}/></div><h3>{title}</h3><p>{detail}</p><Link to="/" className="button primary">Explore gifts <ArrowRight size={17}/></Link></div>}
