import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const base=dirname(fileURLToPath(import.meta.url));
const root=resolve(base,'../..');
const catalog=JSON.parse(readFileSync(resolve(base,'../prisma/catalog.json'),'utf8'));
test('catalog includes exactly 20 categories and 10 products each',()=>{
 assert.equal(catalog.categories.length,20);
 assert.equal(catalog.products.length,200);
 for(const c of catalog.categories)assert.equal(catalog.products.filter(p=>p.category===c.slug).length,10,c.slug);
});
test('product identities and images are complete and unique',()=>{
 assert.equal(new Set(catalog.products.map(p=>p.slug)).size,200);
 assert.equal(new Set(catalog.products.map(p=>p.sku)).size,200);
 assert.equal(new Set(catalog.products.map(p=>p.image)).size,200);
 for(const p of catalog.products){
  assert(p.name.length>=3);assert(Number.isInteger(p.price)&&p.price>0);
  assert(existsSync(resolve(root,'frontend/public',p.image.slice(1))),`Missing ${p.image}`);
 }
});
test('budget collection items cost no more than ₹499',()=>{
 for(const p of catalog.products.filter(p=>p.category==='gifts-under-499'))assert(p.price<=499);
});
