"""Generate 200 original, locally stored vector sample-product thumbnails.
Not stock photography or scraped reference-site imagery. Re-run to refresh seed artwork.
"""
import json, pathlib, html, hashlib
root=pathlib.Path(__file__).resolve().parents[1]
data=json.loads((root/'backend/prisma/catalog.json').read_text(encoding='utf-8'))
assets=root/'frontend/public/images'
colors=['#E91584','#8B004E','#FF6BB1','#6B8E23','#A74C80','#C887B8','#D79A65','#728F43','#B95686','#C5A15A']
shapes={
'frame':'<rect x="182" y="135" width="236" height="309" rx="12" fill="{c}" stroke="#8B004E" stroke-width="8"/><rect x="207" y="162" width="186" height="257" fill="#fffafc" rx="5"/><circle cx="295" cy="239" r="39" fill="#FFBBD9"/><path d="M210 390l64-87 46 49 38-51 35 46v72H207Z" fill="{a}"/><path d="M232 178h125" stroke="#fff" opacity=".7" stroke-width="6"/>',
'mug':'<path d="M200 218h169v183q0 31-34 31h-103q-32 0-32-33z" fill="{c}" stroke="#8B004E" stroke-width="8"/><path d="M369 240h42q51 0 51 58t-56 62h-29" stroke="{a}" stroke-width="26" fill="none"/><path d="M244 190q-18-26 4-51m53 51q-18-26 4-51" stroke="{a}" fill="none" stroke-width="8"/><path d="M238 311h91" stroke="#fff" stroke-width="9" opacity=".65"/>',
'flower':'<path d="M298 420L302 234" stroke="#2D4D1E" stroke-width="13"/><path d="M296 331q-72-85-107-38 40 61 107 38m9 30q91-88 119-27-58 47-119 27" fill="#6B8E23"/><g fill="{c}"><ellipse cx="300" cy="185" rx="35" ry="74"/><ellipse cx="300" cy="185" rx="35" ry="74" transform="rotate(72 300 223)"/><ellipse cx="300" cy="185" rx="35" ry="74" transform="rotate(144 300 223)"/><ellipse cx="300" cy="185" rx="35" ry="74" transform="rotate(216 300 223)"/><ellipse cx="300" cy="185" rx="35" ry="74" transform="rotate(288 300 223)"/></g><circle cx="300" cy="223" r="30" fill="#E6BB51"/><path d="M235 390h129l-22 80h-87Z" fill="{a}"/>',
'giftbox':'<rect x="185" y="248" width="229" height="194" rx="11" fill="{c}"/><rect x="164" y="216" width="271" height="51" rx="11" fill="{a}"/><path d="M299 216v224" stroke="#fff2fa" stroke-width="26"/><path d="M300 218q-101-4-69-67 33-29 69 67m0 0q105-8 72-67-31-30-72 67" fill="none" stroke="{c}" stroke-width="22"/>',
'box':'<rect x="174" y="270" width="250" height="176" rx="13" fill="{c}"/><path d="M174 295h250" stroke="#fff" stroke-width="7" opacity=".45"/><rect x="165" y="235" width="270" height="48" rx="12" fill="{a}"/><path d="M288 234v208" stroke="#FFE4F1" stroke-width="24"/><path d="M239 224q-30-64 16-66 39 0 47 66m-3 0q20-67 61-67 42 10-10 67" fill="none" stroke="#FFBBD9" stroke-width="17"/>',
'balloon':'<path d="M299 326q-104-77-88-155 11-95 92-94 89 0 92 96 1 77-96 153Z" fill="{c}" stroke="{a}" stroke-width="9"/><path d="M284 341l16-17 18 17Z" fill="{a}"/><path d="M301 340q-46 59 9 91-45 32-2 54" stroke="#8B004E" stroke-width="5" fill="none"/>',
'figure':'<circle cx="299" cy="204" r="72" fill="#F0B49E"/><path d="M225 210q9-98 98-77 43 18 48 78-56-39-146-1" fill="#684334"/><path d="M258 218h20m43 0h20" stroke="#593829" stroke-width="6"/><path d="M292 256q19 12 36-2" stroke="#B66B72" stroke-width="5" fill="none"/><rect x="222" y="299" width="154" height="131" rx="31" fill="{c}"/><rect x="184" y="434" width="233" height="26" rx="6" fill="{a}"/>',
'trophy':'<path d="M224 178h150v141q0 59-75 66-75-8-75-66Z" fill="#E0AE59" stroke="#A97D37" stroke-width="7"/><path d="M223 204h-62v52q11 77 66 79m147-131h61v52q-12 77-65 79" fill="none" stroke="#D5A65B" stroke-width="17"/><path d="M300 382v55m-88 4h176v28H212Z" fill="{a}" stroke="#A97D37" stroke-width="9"/><path d="M300 214l18 31 37 5-27 26 6 37-34-18-34 18 6-37-27-26 37-5Z" fill="{c}"/>',
'candle':'<rect x="202" y="232" width="194" height="231" rx="30" fill="{c}" stroke="{a}" stroke-width="7"/><path d="M300 147q-46 54-5 90 45-23 5-90" fill="#E4B259"/><path d="M300 203v27" stroke="#8B004E" stroke-width="7"/><path d="M235 328h127" stroke="#fff" opacity=".8" stroke-width="10"/>',
'bottle':'<rect x="263" y="129" width="74" height="54" rx="10" fill="{a}"/><rect x="236" y="180" width="128" height="284" rx="38" fill="{c}" stroke="{a}" stroke-width="9"/><path d="M245 287h109" stroke="#fff" stroke-width="13" opacity=".76"/><path d="M276 350h52" stroke="#fff" opacity=".7" stroke-width="9"/>',
'pen':'<rect x="195" y="178" width="212" height="265" rx="16" fill="{a}" opacity=".35" stroke="{a}" stroke-width="8"/><path d="M228 389l130-163 31 26-131 165-44 22Z" fill="{c}" stroke="#8B004E" stroke-width="7"/><path d="M228 390l31 27" stroke="#fff" stroke-width="6"/>',
'jewel':'<path d="M220 177q79 207 159 0" fill="none" stroke="{a}" stroke-width="14"/><path d="M300 349l-37-32 11-49h53l11 49Z" fill="{c}" stroke="#8B004E" stroke-width="7"/><circle cx="201" cy="364" r="25" fill="{c}"/><circle cx="401" cy="364" r="25" fill="{c}"/><path d="M201 340v-78m200 78v-78" stroke="{a}" stroke-width="11"/>',
'pot':'<path d="M236 380h128l-18 87h-92Z" fill="{c}"/><path d="M299 386V194m0 83q-96-73-118-26 24 72 118 26m0 40q94-107 128-55-48 77-128 55" fill="{a}" stroke="#2D4D1E" stroke-width="10"/><circle cx="298" cy="186" r="31" fill="{c}"/>',
'craft':'<path d="M300 402q-137-103-105-179 35-52 105 6 70-58 105-6 35 76-105 179Z" fill="{c}" stroke="{a}" stroke-width="10"/><path d="M238 314q23 31 62 40 48-12 66-40" fill="none" stroke="#fff" stroke-width="9"/>',
'crystal':'<path d="M300 128l133 132-50 169H216l-49-169Z" fill="{c}" opacity=".72" stroke="{a}" stroke-width="8"/><path d="M169 260h264M300 128l-40 132 40 169 39-169Z" stroke="#fff" stroke-width="9" opacity=".78" fill="none"/><path d="M208 444h183v25H208Z" fill="{a}"/>',
'lamp':'<path d="M177 330l122-185 124 185Z" fill="{c}" stroke="{a}" stroke-width="8"/><circle cx="300" cy="255" r="52" fill="#FFF2A0"/><path d="M300 331v112m-89 0h178" stroke="{a}" stroke-width="23"/>'}
alias={'jewelry':'jewel','gift':'giftbox','hamper':'box','figurine':'figure'}
for i,p in enumerate(data['products']):
    kind=alias.get(p.get('kind'),p.get('kind'))
    shape=shapes.get(kind,shapes['giftbox'])
    c=colors[(i//10+i%10)%len(colors)]; a=colors[(i+3)%len(colors)]
    name=html.escape(p['name'][:42])
    art=shape.format(c=c,a=a)
    svg=f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#FFE4F1"/><stop offset="1" stop-color="#FFFFFF"/></linearGradient><filter id="shadow"><feGaussianBlur stdDeviation="13"/></filter></defs><rect width="600" height="600" fill="url(#bg)"/><circle cx="69" cy="73" r="147" fill="{c}" opacity=".14"/><circle cx="554" cy="503" r="170" fill="#6B8E23" opacity=".11"/><path d="M0 502q300-36 600 0v98H0Z" fill="#fff" opacity=".6"/><ellipse cx="300" cy="483" rx="179" ry="21" fill="#8B004E" opacity=".13" filter="url(#shadow)"/>{art}<text x="300" y="535" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" font-weight="700" fill="#8B004E">{name}</text><text x="300" y="570" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="700" letter-spacing="3" fill="#6B8E23">THE GIFT ZONE</text></svg>'''
    name=f'gift-zone-sample-{i+1:03d}.svg'
    (assets/name).write_text(svg,encoding='utf-8')
    p['image']=f'/images/{name}'
    p['images']=[p['image']]
    if p['category']=='gifts-under-499' and p['price']>499:
        p['price']=int([249,299,349,399,449,499][i%6]);p['compareAtPrice']=p['price']+150
(root/'backend/prisma/catalog.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
print('Generated',len(data['products']),'original product images')
