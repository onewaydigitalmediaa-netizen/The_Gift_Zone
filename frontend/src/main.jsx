import React from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,Routes,Route,Navigate,useParams} from 'react-router-dom';
import {Toaster} from 'sonner';
import {StoreProvider} from './lib';
import {Layout} from './components/Layout';
import Home from './pages/Home';
import Catalog from './pages/Catalog';
import Product from './pages/Product';
import {Wishlist,Cart,Checkout,OrderSuccess} from './pages/Shopping';
import {Login,Account} from './pages/Account';
import {Bulk,Finder,Offers,Track,Support,Info,Blog} from './pages/More';
import './styles.css';
function InfoRoute(){const {slug}=useParams();return <Info slug={slug}/>}
function NotFound(){return <section className="container section simple-page"><h1>404 · We can't find that gift</h1><p>But there are plenty of lovely things to explore.</p><a className="button primary" href="/">Back to The Gift Zone</a></section>}
function App(){return <StoreProvider><Layout><Routes><Route path="/" element={<Home/>}/><Route path="/category/:slug" element={<Catalog/>}/><Route path="/search" element={<Catalog mode="search"/>}/><Route path="/product/:slug" element={<Product/>}/><Route path="/login" element={<Login/>}/><Route path="/account/*" element={<Account/>}/><Route path="/wishlist" element={<Wishlist/>}/><Route path="/cart" element={<Cart/>}/><Route path="/checkout" element={<Checkout/>}/><Route path="/order-success/:id" element={<OrderSuccess/>}/><Route path="/bulk-order" element={<Bulk/>}/><Route path="/gift-finder" element={<Finder/>}/><Route path="/offers" element={<Offers/>}/><Route path="/track-order" element={<Track/>}/><Route path="/support" element={<Support/>}/><Route path="/franchise-enquiry" element={<Support franchise/>}/><Route path="/info/:slug" element={<InfoRoute/>}/><Route path="/blog" element={<Blog/>}/><Route path="*" element={<NotFound/>}/></Routes></Layout><Toaster richColors position="top-right"/></StoreProvider>}
createRoot(document.getElementById('root')).render(<BrowserRouter><App/></BrowserRouter>);
