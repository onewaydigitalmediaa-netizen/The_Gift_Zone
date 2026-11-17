import React,{useEffect,useState} from 'react';
import {Link,NavLink,useLocation,useNavigate} from 'react-router-dom';
import {Menu,Search,Heart,ShoppingCart,UserRound,Phone,Gift,Lightbulb,Wallet,ChevronDown,ChevronRight,ArrowUp,X,Headphones,Package,CalendarDays,LogIn,Tag,Users,Truck,MapPin,Mail,Instagram,Facebook,ShoppingBasket,Sparkles,Grid3X3,ShieldCheck,MoreVertical,Leaf,HandHeart,Star,ClipboardList,LogOut,ChevronLeft} from 'lucide-react';
import {useStore,api,INR} from '../lib';
import {toast} from 'sonner';
const SIDE=[
 {heading:'Popular Collections',links:[['Birthday','/category/birthday'],['Anniversary','/category/anniversary'],['Corporate Gifts','/category/corporate-gifts'],['Personalized Gifts','/category/personalized-gifts'],['Gift Hampers','/category/gift-hampers'],['Mini You Series','/category/mini-you-series'],['Trophies','/category/trophies'],['Handmade Gifts','/category/handmade-gifts'],['3D Crystals','/category/3d-crystals'],['LED Lamps','/category/led-lamps'],['Branded Pens','/category/branded-pens'],['Artificial Flower Pots','/category/home-decor'],['Jewellery for Women','/category/jewellery'],['Luxury Fragrance Candles','/category/candles'],['Luxury Gift Items','/category/gift-hampers']]},
 {heading:'Assistance',links:[['Account','/account'],['Wallet','/account/wallet'],['Loyalty Program','/account/loyalty'],['Refer & Earn','/account/referrals'],['Offers','/offers'],['Track Your Order','/track-order'],['Customer Support','/support'],['Franchise Enquiry','/franchise-enquiry'],['Login','/login']]}
];
export const menuGroups=SIDE;
export function Logo(){const {meta}=useStore();const name=meta.settings.storeName||'The Gift Zone';const tagline=meta.settings.tagline||'A little love in every gift';return <Link to="/" className="brand" aria-label={`${name} home`}><img src="/images/logo-mark.svg" alt={`${name} logo mark`}/><span><b>{name}</b><small>{tagline}</small></span></Link>}
function IconLink({to,title,children,count}){return <Link to={to} className="header-icon" aria-label={title} title={title}>{children}{count>0&&<span className="count-dot">{count}</span>}</Link>}
export function Header(){
 const {meta,user,cartCount,wishlist}=useStore();const [drawer,setDrawer]=useState(false),[more,setMore]=useState(false),[searchFocus,setSearchFocus]=useState(false),[q,setQ]=useState(''),[balance,setBalance]=useState(0);
 const navigate=useNavigate(),location=useLocation();
 useEffect(()=>{setDrawer(false);setMore(false);setSearchFocus(false)},[location.pathname,location.search]);
 useEffect(()=>{if(user)api('/customer/wallet').then(x=>setBalance(x.balance)).catch(()=>setBalance(0));else setBalance(0)},[user,location.pathname]);
 const submit=e=>{e.preventDefault();if(q.trim())navigate('/search?q='+encodeURIComponent(q.trim()));setSearchFocus(false)};
 const popular=['Birthday Gifts','Anniversary Gifts','Corporate Gifts','Miniatures','Photo Collage','Trophies','3D Crystals','LED Lamps'];
 return <>
 <div className="announce"><Sparkles size={14}/> {meta.settings.announcement||'Thoughtful gifts, unforgettable moments'} <span className="announce-right">Handpicked with love <Heart size={12} fill="currentColor"/></span></div>
 <header className="site-header">
   <div className="container header-top">
     <button className="icon-only hamburger" onClick={()=>setDrawer(true)} aria-label="Open menu"><Menu/></button>
     <Logo/>
     <form className="search-box" onSubmit={submit}><Search size={19}/><input placeholder="Search for gifts, memories & more..." value={q} onFocus={()=>setSearchFocus(true)} onChange={e=>setQ(e.target.value)} aria-label="Search for gifts"/><button type="submit" aria-label="Search"><Search size={20}/></button>
       {searchFocus&&<div className="search-suggestions glass"><p className="eyebrow">POPULAR SEARCHES</p><div className="chip-row">{popular.map(term=><button key={term} type="button" className="chip" onClick={()=>{setQ(term);navigate('/search?q='+encodeURIComponent(term));setSearchFocus(false)}}>{term}</button>)}</div>{q.trim()&&<button className="full-search" type="submit">Search all gifts for “{q}” <ChevronRight size={16}/></button>}</div>}
     </form>
     <Link to="/bulk-order" className="header-pill bulk"><ShoppingBasket size={19}/> <span>Bulk Order</span></Link>
     <Link to="/gift-finder" className="header-pill finder"><Lightbulb size={19}/><span>Smart Gift Finder</span></Link>
     <Link to="/account/wallet" className="header-balance"><Wallet size={17}/> <span>Balance <b>{INR(balance)}</b></span></Link>
     <div className="header-actions">
       <IconLink to="/support" title="Customer support"><Phone/></IconLink>
       <IconLink to="/wishlist" title="Wishlist" count={wishlist.length}><Heart/></IconLink>
       <IconLink to="/cart" title="Cart" count={cartCount}><ShoppingCart/></IconLink>
       <IconLink to={user?'/account':'/login'} title="Account"><UserRound/></IconLink>
       <div className="more-wrap"><button className="header-icon" onClick={()=>setMore(x=>!x)} aria-label="More options"><MoreVertical/></button>{more&&<div className="more-menu glass"><Link to="/account/wallet"><Wallet size={17}/> My Wallet · {INR(balance)}</Link><Link to="/track-order"><Package size={17}/> Track Order</Link><Link to="/account/reminders"><CalendarDays size={17}/> Reminders</Link><Link to="/account/referrals"><Users size={17}/> Refer & Earn</Link><Link to="/support"><Headphones size={17}/> Support</Link></div>}</div>
     </div>
   </div>
   <nav className="desktop-nav container"><Link to="/category/birthday">Birthday</Link><Link to="/category/anniversary">Anniversary</Link><Link to="/category/personalized-gifts">Personalized Gifts</Link><Link to="/category/corporate-gifts">Corporate Gifting</Link><Link to="/category/gift-hampers">Gift Hampers</Link><Link to="/category/flowers">Flowers</Link><Link to="/category/trophies">Trophies</Link><Link to="/offers" className="nav-offer">Offers <Tag size={14}/></Link><Link to="/account/wallet" className="balance-link"><Wallet size={16}/> Balance: {INR(balance)}</Link></nav>
 </header>
 {searchFocus&&<button className="search-catcher" aria-label="Close search suggestions" onClick={()=>setSearchFocus(false)}/>}
 {drawer&&<div className="drawer-overlay" onClick={()=>setDrawer(false)}><aside className="drawer" onClick={e=>e.stopPropagation()}><div className="drawer-head"><Logo/><button className="icon-only" onClick={()=>setDrawer(false)} aria-label="Close menu"><X/></button></div><div className="drawer-action-row"><Link to="/account"><UserRound/>Account</Link><Link to="/account/wallet"><Wallet/>Wallet</Link><Link to="/account/reminders"><CalendarDays/>Reminder</Link></div><div className="drawer-scroll">{SIDE.map(group=><section key={group.heading}><h4>{group.heading}</h4>{group.links.map(([label,to])=><Link key={label+to} to={to} className={group.heading==='Assistance'?'drawer-assist':''}>{group.heading==='Assistance'&&<ChevronRight size={15}/>} {label} <ChevronRight size={14} className="drawer-chevron"/></Link>)}</section>)}<section><h4>All collections</h4>{meta.categories.map(c=><Link key={c.id} to={`/category/${c.slug}`}>{c.name}<ChevronRight size={14} className="drawer-chevron"/></Link>)}</section></div><div className="drawer-bottom"><Link to="/bulk-order" className="button primary">Request Bulk Order <ShoppingBasket size={16}/></Link></div></aside></div>}
 </>
}
const footerGroups=[
 {title:'Explore Gifts',links:[['Birthday Gifts','/category/birthday'],['Anniversary Gifts','/category/anniversary'],['Personalized Gifts','/category/personalized-gifts'],['Mini You Series','/category/mini-you-series'],['Handmade Gifts','/category/handmade-gifts'],['Gift Hampers','/category/gift-hampers']]},
 {title:'Our Collections',links:[['Corporate Gifts','/category/corporate-gifts'],['Trophies & Awards','/category/trophies'],['Photo Gifts','/category/photo-gifts'],['Luxury Candles','/category/candles'],['Branded Pens','/category/branded-pens'],['Gifts Under ₹499','/category/gifts-under-499']]},
 {title:'Help & Support',links:[['Track Your Order','/track-order'],['FAQs','/info/faq'],['Contact Us','/support'],['Bulk Orders','/bulk-order'],['Return Policy','/info/returns'],['Shipping Policy','/info/shipping']]},
 {title:'About The Gift Zone',links:[['Our Story','/info/about'],['Blog','/blog'],['Offers','/offers'],['Loyalty Program','/account/loyalty'],['Privacy Policy','/info/privacy'],['Terms of Service','/info/terms']]}
];
export function Footer(){const {meta}=useStore();const name=meta.settings.storeName||'The Gift Zone';return <footer className="footer"><div className="container"><div className="footer-intro"><div><p className="eyebrow">A LITTLE LOVE IN EVERY GIFT</p><h2>Every gift tells a story.<br/><em>Make yours unforgettable.</em></h2></div><Link to="/category/personalized-gifts" className="button light">Discover thoughtful gifts <ChevronRight size={17}/></Link></div><div className="footer-grid"><div className="footer-brand"><Logo/><p>A thoughtful destination for personalized presents, everyday celebrations, handcrafted treasures, and meaningful corporate gifting.</p><div className="footer-perks"><span><ShieldCheck size={16}/> Secure shopping</span><span><Gift size={16}/> Made with love</span><span><Truck size={16}/> Shipping across India</span></div></div>{footerGroups.map(g=><div key={g.title}><h4>{g.title}</h4>{g.links.map(([label,to])=><Link key={label} to={to}>{label}</Link>)}</div>)}</div><div className="footer-bottom"><span>© {new Date().getFullYear()} {name}. All rights reserved.</span><span>Made for moments that matter <Heart size={14} fill="currentColor"/></span></div></div></footer>}
export function Floaters(){const {meta}=useStore();const n=meta.settings.whatsappNumber?.replace(/\D/g,'');return <div className="floaters">{n&&<a className="float-chat" href={`https://wa.me/${n}`} target="_blank" rel="noreferrer" aria-label="WhatsApp us"><Phone/></a>}<button className="float-top" onClick={()=>window.scrollTo({top:0,behavior:'smooth'})} aria-label="Back to top"><ArrowUp/></button></div>}
export function Layout({children}){const location=useLocation();useEffect(()=>{window.scrollTo({top:0,behavior:'instant'})},[location.pathname]);return <><Header/><main>{children}</main><Footer/><Floaters/><div className="mobile-bottom"><Link to="/"><Grid3X3/>Home</Link><Link to="/search"><Search/>Search</Link><Link to="/wishlist"><Heart/>Saved</Link><Link to="/cart"><ShoppingCart/>Bag</Link><Link to="/account"><UserRound/>Account</Link></div></>}
