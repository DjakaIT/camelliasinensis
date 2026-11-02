/* Shop engine shared by both designs: routing, catalog (filters + pagination), product page,
   cart drawer, checkout (Apple Pay / Google Pay / kartica), O nama, Kontakt. Each design supplies UI.card(p). */
const ENGINE=(()=>{
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const PER=12;
const F={q:'',type:[],lv:[],moods:[],flav:[],origin:[],form:[],pmin:0,pmax:0,bio:false,rare:false,isNew:false,sort:'pre',page:1};
let UI=null,PMAX=0;
const ORIGINS=[...new Set(P.map(p=>p.origin).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'hr'));
const ic={
  x:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  arr:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  back:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
  filt:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>',
  truck:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.5"/><circle cx="17" cy="17.5" r="1.5"/></svg>',
  card:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/></svg>',
  mail:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
  thermo:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z"/></svg>',
  clock:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  scale:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M6 20h12M12 4v16M5 8h14M5 8l-3 6a3 3 0 0 0 6 0zM19 8l-3 6a3 3 0 0 0 6 0z"/></svg>',
  check:'<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M7.5 12.5l3 3 6-6.5"/></svg>'
};
const dots=n=>n<0?'':'<span class="x-dots" aria-label="'+LVN[n]+'">'+[0,1,2].map(i=>`<i class="${i<n?'f':''}"></i>`).join('')+'</span>';
const tname=t=>TYPES[t].n;
const imgOf=p=>p.img?`<img src="${p.img}" alt="${p.name}" loading="lazy">`:`<span class="x-noimg">Fotografija<br>uskoro</span>`;

/* ---------- storage ---------- */
const store={get(k,d){try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
let cart=store.get('cs-cart',[]);   // [{id,v,q}]
const variants=p=>p.unit==='50 g'?[{k:'50 g',m:1},{k:'100 g',m:1.9}]:[{k:p.unit,m:1}];
const priceOf=(p,v)=>{const x=variants(p).find(a=>a.k===v)||variants(p)[0];return Math.round(p.price*x.m*10)/10;};

/* ---------- filtering ---------- */
function pass(p,skip){
  if(F.q&&!(p.name+' '+tname(p.type)+' '+p.origin+' '+p.desc).toLowerCase().includes(F.q))return false;
  if(skip!=='type'&&F.type.length&&!F.type.includes(p.type))return false;
  if(skip!=='lv'&&F.lv.length&&!F.lv.includes(String(p.lv)))return false;
  if(skip!=='moods'&&F.moods.length&&!F.moods.some(m=>p.moods.includes(m)))return false;
  if(skip!=='flav'&&F.flav.length&&!F.flav.some(f=>p.flav.includes(f)))return false;
  if(skip!=='origin'&&F.origin.length&&!F.origin.includes(p.origin))return false;
  if(skip!=='form'&&F.form.length&&!F.form.includes(p.form))return false;
  if(F.pmin&&p.price<F.pmin)return false;if(F.pmax&&F.pmax<PMAX&&p.price>F.pmax)return false;
  if(F.bio&&!p.bio)return false;if(F.rare&&!p.rare)return false;if(F.isNew&&!p.isNew)return false;
  return true;
}
function sorted(L){const s=F.sort;L=[...L];
  if(s==='cu')L.sort((a,b)=>a.price-b.price);else if(s==='cd')L.sort((a,b)=>b.price-a.price);
  else if(s==='az')L.sort((a,b)=>a.name.localeCompare(b.name,'hr'));else if(s==='kf')L.sort((a,b)=>a.lv-b.lv);
  else if(s==='novo')L.sort((a,b)=>(b.isNew-a.isNew)||(b.rare-a.rare));
  return L;}
const GROUPS=[
  ['type','Vrsta čaja',Object.keys(TYPES).map(k=>[k,TYPES[k].n])],
  ['lv','Razina kofeina',[['0','Bez kofeina'],['1','Malo'],['2','Srednje'],['3','Puno']]],
  ['moods','Namjena',Object.entries(MOODS)],
  ['flav','Okus',Object.entries(FLAV),'chips'],
  ['origin','Podrijetlo',ORIGINS.map(o=>[o,o])],
  ['form','Oblik',Object.entries(FORMS)]
];
function catalogShell(){
  PMAX=Math.ceil(Math.max(...P.map(p=>p.price)));F.pmax=PMAX;
  $('#v-cat').innerHTML=`<section class="x-cathead"><div class="x-wrap">
    <p class="x-crumbs"><a href="#">Početna</a><span>/</span>Katalog</p>
    <div class="x-cathead-row"><h1 class="x-h1">Katalog</h1><p class="x-sub">${P.length} čajeva i pribora. Filtrirajte po vrsti, okusu, kofeinu ili namjeni.</p></div></div></section>
  <section class="x-cat"><div class="x-wrap x-catgrid">
    <aside class="x-filters" id="xFilters" aria-label="Filteri">
      <div class="x-fhead"><b>Filteri</b><button class="x-link" id="xClear">Očisti sve</button><button class="x-fclose" id="xFclose" aria-label="Zatvori filtere">${ic.x}</button></div>
      <label class="x-search"><span class="sr">Pretraži</span><input id="xQ" type="search" placeholder="Pretraži katalog…"></label>
      <div id="xGroups"></div>
      <details class="x-fg" open><summary>Cijena</summary><div class="x-price-f"><div class="x-prow"><span id="xPminL"></span><span id="xPmaxL"></span></div>
        <input type="range" id="xPmin" min="0" max="${PMAX}" step="1" value="0" aria-label="Najniža cijena"><input type="range" id="xPmax" min="0" max="${PMAX}" step="1" value="${PMAX}" aria-label="Najviša cijena"></div></details>
      <details class="x-fg" open><summary>Posebno</summary>
        <label class="x-check"><input type="checkbox" id="xBio"><span>Organski certificirano</span></label>
        <label class="x-check"><input type="checkbox" id="xRare"><span>Rijetkosti</span></label>
        <label class="x-check"><input type="checkbox" id="xNew"><span>Novo u ponudi</span></label></details>
      <button class="x-btn x-fapply" id="xFapply">Prikaži rezultate</button>
    </aside>
    <div class="x-results">
      <div class="x-toolbar"><button class="x-ftoggle" id="xFopen">${ic.filt}Filteri <em id="xFn"></em></button><span class="x-count" id="xCount"></span>
        <label class="x-sort">Poredaj <select id="xSort"><option value="pre">Preporučeno</option><option value="novo">Novo i rijetko</option><option value="cu">Cijena: niža prema višoj</option><option value="cd">Cijena: viša prema nižoj</option><option value="az">Naziv A–Ž</option><option value="kf">Kofein: manje prema više</option></select></label></div>
      <div class="x-chips" id="xChips"></div>
      <div class="x-grid" id="xGrid"></div>
      <nav class="x-pager" id="xPager" aria-label="Stranice"></nav>
    </div></div></section>`;
  const on=(id,ev,fn)=>$(id).addEventListener(ev,fn);
  on('#xQ','input',e=>{F.q=e.target.value.trim().toLowerCase();F.page=1;renderCat();});
  on('#xSort','change',e=>{F.sort=e.target.value;F.page=1;renderCat();});
  on('#xPmin','input',e=>{F.pmin=Math.min(+e.target.value,F.pmax);e.target.value=F.pmin;F.page=1;renderCat();});
  on('#xPmax','input',e=>{F.pmax=Math.max(+e.target.value,F.pmin);e.target.value=F.pmax;F.page=1;renderCat();});
  on('#xBio','change',e=>{F.bio=e.target.checked;F.page=1;renderCat();});
  on('#xRare','change',e=>{F.rare=e.target.checked;F.page=1;renderCat();});
  on('#xNew','change',e=>{F.isNew=e.target.checked;F.page=1;renderCat();});
  on('#xClear','click',()=>{resetF();syncInputs();renderCat();});
  on('#xFopen','click',()=>{$('#xFilters').classList.add('on');document.body.classList.add('x-lock');});
  const closeF=()=>{$('#xFilters').classList.remove('on');document.body.classList.remove('x-lock');};
  on('#xFclose','click',closeF);on('#xFapply','click',closeF);
  $('#xGroups').addEventListener('change',e=>{const i=e.target.closest('input[data-g]');if(!i)return;const a=F[i.dataset.g];
    i.checked?a.push(i.value):a.splice(a.indexOf(i.value),1);F.page=1;renderCat();});
  $('#xGroups').addEventListener('click',e=>{const b=e.target.closest('button[data-g]');if(!b)return;const a=F[b.dataset.g];
    a.includes(b.dataset.v)?a.splice(a.indexOf(b.dataset.v),1):a.push(b.dataset.v);F.page=1;renderCat();});
  $('#xChips').addEventListener('click',e=>{const b=e.target.closest('[data-rm]');if(!b)return;const [g,v]=b.dataset.rm.split('|');
    if(Array.isArray(F[g]))F[g].splice(F[g].indexOf(v),1);else if(g==='q'){F.q='';$('#xQ').value='';}else if(g==='price'){F.pmin=0;F.pmax=PMAX;}else F[g]=false;
    syncInputs();F.page=1;renderCat();});
  $('#xPager').addEventListener('click',e=>{const b=e.target.closest('[data-p]');if(!b||b.disabled)return;F.page=+b.dataset.p;renderCat();
    const y=$('#xFilters').getBoundingClientRect().top+scrollY-110;scrollTo({top:y,behavior:'smooth'});});
}
function resetF(){Object.assign(F,{q:'',type:[],lv:[],moods:[],flav:[],origin:[],form:[],pmin:0,pmax:PMAX,bio:false,rare:false,isNew:false,page:1});}
function syncInputs(){$('#xQ').value=F.q;$('#xPmin').value=F.pmin;$('#xPmax').value=F.pmax;$('#xBio').checked=F.bio;$('#xRare').checked=F.rare;$('#xNew').checked=F.isNew;$('#xSort').value=F.sort;}
function renderCat(){
  $('#xGroups').innerHTML=GROUPS.map(([g,label,opts,chips])=>{
    const items=opts.map(([v,l])=>{const n=P.filter(p=>pass(p,g)&&(g==='lv'?String(p.lv)===v:g==='moods'||g==='flav'?p[g].includes(v):p[g]===v)).length;
      const on=F[g].includes(v);
      if(chips)return `<button type="button" class="x-fchip ${on?'on':''}" data-g="${g}" data-v="${v}" aria-pressed="${on}">${l} <em>${n}</em></button>`;
      if(!n&&!on)return `<label class="x-check is-off"><input type="checkbox" data-g="${g}" value="${v}" disabled><span>${l}</span><em>0</em></label>`;
      return `<label class="x-check"><input type="checkbox" data-g="${g}" value="${v}" ${on?'checked':''}><span>${l}</span><em>${n}</em></label>`;}).join('');
    return `<details class="x-fg" ${g==='origin'||g==='form'?'':'open'}><summary>${label}${F[g].length?` <i>${F[g].length}</i>`:''}</summary><div class="${chips?'x-fchips':''}">${items}</div></details>`;}).join('');
  $('#xPminL').textContent=eur(F.pmin);$('#xPmaxL').textContent=eur(F.pmax);
  const L=sorted(P.filter(p=>pass(p)));const pages=Math.max(1,Math.ceil(L.length/PER));F.page=Math.min(F.page,pages);
  const a=(F.page-1)*PER,slice=L.slice(a,a+PER);
  $('#xCount').textContent=L.length?`Prikazano ${a+1}–${a+slice.length} od ${L.length}`:'Nema rezultata';
  const chips=[];if(F.q)chips.push(['q|',`„${F.q}”`]);
  GROUPS.forEach(([g,,opts])=>F[g].forEach(v=>chips.push([g+'|'+v,(opts.find(o=>o[0]===v)||[,v])[1]])));
  if(F.pmin>0||F.pmax<PMAX)chips.push(['price|',`${eur(F.pmin)} – ${eur(F.pmax)}`]);
  if(F.bio)chips.push(['bio|','Organski']);if(F.rare)chips.push(['rare|','Rijetkosti']);if(F.isNew)chips.push(['isNew|','Novo']);
  $('#xChips').innerHTML=chips.map(c=>`<button class="x-chip" data-rm="${c[0]}">${c[1]} ${ic.x}</button>`).join('');
  $('#xFn').textContent=chips.length?chips.length:'';
  $('#xGrid').innerHTML=slice.length?slice.map(UI.card).join(''):`<div class="x-empty"><p>Nema proizvoda za odabrane filtre.</p><button class="x-btn" onclick="document.getElementById('xClear').click()">Očisti filtre</button></div>`;
  let pg='';if(pages>1){pg+=`<button class="x-pg x-pgn" data-p="${F.page-1}" ${F.page===1?'disabled':''} aria-label="Prethodna">${ic.back}</button>`;
    for(let i=1;i<=pages;i++)pg+=`<button class="x-pg ${i===F.page?'on':''}" data-p="${i}" aria-current="${i===F.page?'page':'false'}">${i}</button>`;
    pg+=`<button class="x-pg x-pgn" data-p="${F.page+1}" ${F.page===pages?'disabled':''} aria-label="Sljedeća">${ic.arr}</button>`;}
  $('#xPager').innerHTML=pg;
}

/* ---------- product ---------- */
let pv=null,pq=1;
function renderProd(id){const p=P.find(x=>x.id===id);if(!p){location.hash='#katalog';return;}
  pv=variants(p)[0].k;pq=1;
  const rel=P.filter(x=>x.type===p.type&&x.id!==p.id).slice(0,4);
  const flags=[p.bio?'Organski':'',p.rare?'Rijetkost':'',p.isNew?'Novo':''].filter(Boolean);
  $('#v-prod').innerHTML=`<section class="x-prod"><div class="x-wrap">
    <p class="x-crumbs"><a href="#">Početna</a><span>/</span><a href="#katalog">Katalog</a><span>/</span><a href="#katalog?vrsta=${p.type}">${tname(p.type)}</a><span>/</span>${p.name}</p>
    <div class="x-pgrid">
      <div class="x-pimg" id="xPimg">${imgOf(p)}${flags.length?`<div class="x-flags">${flags.map(f=>`<span>${f}</span>`).join('')}</div>`:''}</div>
      <div class="x-pinfo">
        <p class="x-kind">${tname(p.type)}${p.origin?' · '+p.origin:''}</p>
        <h1 class="x-ptitle">${p.name}</h1>
        <div class="x-pprice"><b id="xPp">${eur(priceOf(p,pv))}</b><small id="xPu">/ ${pv}</small>${p.lv>=0?`<span class="x-pkf">${dots(p.lv)} ${LVN[p.lv]}</span>`:''}</div>
        <p class="x-pdesc">${p.desc}</p>
        ${p.flav.length?`<div class="x-pflav">${p.flav.map(f=>`<a href="#katalog?okus=${f}">${FLAV[f]}</a>`).join('')}</div>`:''}
        ${variants(p).length>1?`<div class="x-opts" role="group" aria-label="Pakiranje">${variants(p).map((v,i)=>`<button class="x-opt ${i?'':'on'}" data-v="${v.k}">${v.k}<small>${eur(priceOf(p,v.k))}</small></button>`).join('')}</div>`:''}
        <div class="x-buy"><div class="x-qty"><button id="xQm" aria-label="Manje">−</button><span id="xQv">1</span><button id="xQp" aria-label="Više">+</button></div>
          <button class="x-btn x-addbig" id="xAdd">Dodaj u košaricu</button></div>
        <ul class="x-perks"><li>${ic.truck}Dostava GLS-om, besplatno od ${eur(SHOP.freeFrom)}</li><li>${ic.card}Apple Pay, Google Pay ili kartica</li><li>${ic.mail}Račun odmah na e-mail</li></ul>
        ${p.brew?`<div class="x-brew"><h3>Priprema</h3><div class="x-brew3"><div>${ic.thermo}<b>${p.brew[0]}</b><span>temperatura vode</span></div><div>${ic.clock}<b>${p.brew[1]}</b><span>vrijeme</span></div><div>${ic.scale}<b>${p.brew[2]}</b><span>količina</span></div></div><p class="x-small">Opće smjernice za ovu vrstu čaja, prilagodite ukusu.</p></div>`:''}
        <dl class="x-specs"><div><dt>Vrsta</dt><dd>${tname(p.type)}</dd></div>${p.origin?`<div><dt>Podrijetlo</dt><dd>${p.origin}</dd></div>`:''}<div><dt>Oblik</dt><dd>${FORMS[p.form]}</dd></div><div><dt>Pakiranje</dt><dd>${variants(p).map(v=>v.k).join(' / ')}</dd></div><div><dt>Šifra</dt><dd>${p.sku}</dd></div></dl>
      </div></div>
    ${rel.length?`<div class="x-relhead"><h2 class="x-h2">Iz iste obitelji</h2><a href="#katalog?vrsta=${p.type}" class="x-link">Sve: ${tname(p.type)} ${ic.arr}</a></div><div class="x-grid x-rel">${rel.map(UI.card).join('')}</div>`:''}
  </div></section>`;
  $$('.x-opt').forEach(b=>b.onclick=()=>{pv=b.dataset.v;$$('.x-opt').forEach(x=>x.classList.toggle('on',x===b));$('#xPp').textContent=eur(priceOf(p,pv));$('#xPu').textContent='/ '+pv;});
  $('#xQm').onclick=()=>{pq=Math.max(1,pq-1);$('#xQv').textContent=pq};$('#xQp').onclick=()=>{pq++;$('#xQv').textContent=pq};
  $('#xAdd').onclick=()=>{add(p.id,pv,pq);const b=$('#xAdd');b.textContent='Dodano ✓';b.classList.add('ok');setTimeout(()=>{b.textContent='Dodaj u košaricu';b.classList.remove('ok')},1400);};
}

/* ---------- cart ---------- */
function drawerShell(){
  const d=document.createElement('div');d.innerHTML=`<div class="x-scrim" id="xScrim"></div>
  <aside class="x-drawer" id="xDrawer" aria-label="Košarica" aria-hidden="true">
    <div class="x-dh"><h3>Košarica <em id="xDn"></em></h3><button class="x-icon" id="xDclose" aria-label="Zatvori košaricu">${ic.x}</button></div>
    <div class="x-ship" id="xShip"></div>
    <div class="x-dl" id="xDl"></div>
    <div class="x-df" id="xDf"></div>
  </aside><div class="x-toast" id="xToast" role="status"></div>`;
  document.body.append(...d.children);
  $('#xScrim').onclick=closeCart;$('#xDclose').onclick=closeCart;
  $('#xDl').addEventListener('click',e=>{const b=e.target.closest('[data-cq]');if(!b)return;const [i,dq]=b.dataset.cq.split('|');const it=cart[+i];
    if(dq==='rm')cart.splice(+i,1);else{it.q+=+dq;if(it.q<=0)cart.splice(+i,1);}save();});
}
const subtotal=()=>cart.reduce((s,it)=>{const p=P.find(x=>x.id===it.id);return s+priceOf(p,it.v)*it.q},0);
const count=()=>cart.reduce((s,it)=>s+it.q,0);
function save(){store.set('cs-cart',cart);renderCart();}
function add(id,v,q=1){const p=P.find(x=>x.id===id);v=v||variants(p)[0].k;const it=cart.find(c=>c.id===id&&c.v===v);it?it.q+=q:cart.push({id,v,q});save();
  const b=$('#badge');if(b){b.classList.remove('pop');void b.offsetWidth;b.classList.add('pop');}
  toast(`<b>${p.name}</b> je u košarici <button onclick="ENGINE.openCart()">Pogledaj</button>`);}
let tt;function toast(h){const t=$('#xToast');t.innerHTML=h;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),2600);}
function renderCart(){
  const n=count(),s=subtotal();const b=$('#badge');if(b)b.textContent=n;$('#xDn').textContent=n?`(${n})`:'';
  const left=SHOP.freeFrom-s;
  $('#xShip').innerHTML=n?`<p>${left>0?`Još <b>${eur(left)}</b> do besplatne dostave`:'<b>Besplatna dostava</b> je uključena'}</p><div class="x-bar"><i style="width:${Math.min(100,s/SHOP.freeFrom*100)}%"></i></div>`:'';
  $('#xDl').innerHTML=n?cart.map((it,i)=>{const p=P.find(x=>x.id===it.id);return `<div class="x-di"><a href="#proizvod/${p.id}" class="x-dimg">${imgOf(p)}</a>
    <div class="x-dinfo"><a href="#proizvod/${p.id}"><b>${p.name}</b></a><small>${it.v} · ${eur(priceOf(p,it.v))}</small>
      <div class="x-qty sm"><button data-cq="${i}|-1" aria-label="Manje">−</button><span>${it.q}</span><button data-cq="${i}|1" aria-label="Više">+</button></div></div>
    <div class="x-dright"><b>${eur(priceOf(p,it.v)*it.q)}</b><button class="x-link" data-cq="${i}|rm">Ukloni</button></div></div>`}).join('')
    :`<div class="x-dempty"><p>Košarica je prazna.</p><a href="#katalog" class="x-btn" onclick="ENGINE.closeCart()">Pogledaj katalog</a></div>`;
  $('#xDf').innerHTML=n?`<div class="x-row"><span>Međuzbroj</span><b>${eur(s)}</b></div><p class="x-small">Dostava se odabire na blagajni. Plaćanje: Apple Pay, Google Pay ili kartica.</p>
    <a href="#blagajna" class="x-btn x-wide" onclick="ENGINE.closeCart()">Na blagajnu ${ic.arr}</a>`:'';
}
function openCart(){$('#xDrawer').classList.add('on');$('#xScrim').classList.add('on');$('#xDrawer').setAttribute('aria-hidden','false');}
function closeCart(){$('#xDrawer').classList.remove('on');$('#xScrim').classList.remove('on');$('#xDrawer').setAttribute('aria-hidden','true');}

/* ---------- checkout ---------- */
let pay='apple',ship='paketomat';
function renderCheckout(){
  if(!cart.length){$('#v-checkout').innerHTML=`<section class="x-co"><div class="x-wrap x-narrow"><h1 class="x-h1">Blagajna</h1><p>Košarica je prazna.</p><a href="#katalog" class="x-btn">Pogledaj katalog</a></div></section>`;return;}
  $('#v-checkout').innerHTML=`<section class="x-co"><div class="x-wrap">
    <p class="x-crumbs"><a href="#">Početna</a><span>/</span>Blagajna</p><h1 class="x-h1">Blagajna</h1>
    <div class="x-cogrid"><form class="x-coform" id="xCo" novalidate>
      <div class="x-express"><p class="x-small">Brzo plaćanje</p><div class="x-exp2"><button type="button" class="x-pay apple" data-pay="apple">Apple Pay</button><button type="button" class="x-pay google" data-pay="google">Google Pay</button></div><div class="x-or"><span>ili ispunite podatke</span></div></div>
      <fieldset><legend><span>1</span>Kontakt</legend>
        <div class="x-f2"><label class="x-field"><span>Ime i prezime</span><input name="ime" autocomplete="name" required></label><label class="x-field"><span>E-mail (za račun)</span><input name="email" type="email" autocomplete="email" required></label></div>
        <label class="x-field"><span>Mobitel (za GLS obavijest)</span><input name="tel" type="tel" autocomplete="tel"></label></fieldset>
      <fieldset><legend><span>2</span>Dostava GLS</legend>
        <div class="x-radios">
          <label class="x-radio"><input type="radio" name="ship" value="paketomat" ${ship==='paketomat'?'checked':''}><span><b>GLS paketomat</b><small>Preuzimanje u odabranom paketomatu</small></span><em>${eur(SHOP.ship.paketomat)}</em></label>
          <label class="x-radio"><input type="radio" name="ship" value="adresa" ${ship==='adresa'?'checked':''}><span><b>GLS na adresu</b><small>Dostava na kućnu ili poslovnu adresu</small></span><em>${eur(SHOP.ship.adresa)}</em></label></div>
        <div id="xShipF"></div></fieldset>
      <fieldset><legend><span>3</span>Plaćanje</legend>
        <div class="x-radios">
          <label class="x-radio"><input type="radio" name="pay" value="apple" ${pay==='apple'?'checked':''}><span><b>Apple Pay</b><small>Brzo plaćanje s iPhonea ili Maca</small></span></label>
          <label class="x-radio"><input type="radio" name="pay" value="google" ${pay==='google'?'checked':''}><span><b>Google Pay</b><small>Brzo plaćanje s Androida ili Chromea</small></span></label>
          <label class="x-radio"><input type="radio" name="pay" value="card" ${pay==='card'?'checked':''}><span><b>Kartica</b><small>Visa, Mastercard, Maestro</small></span></label></div>
        <div id="xPayF"></div>
        <label class="x-check"><input type="checkbox" name="r1" id="xR1"><span>Trebam R1 račun (za tvrtku)</span></label><div id="xR1F"></div></fieldset>
      <label class="x-check x-terms"><input type="checkbox" name="terms" required><span>Prihvaćam <a href="#">uvjete kupnje</a> i <a href="#">pravila privatnosti</a>.</span></label>
      <p class="x-err" id="xErr" role="alert"></p>
      <button class="x-btn x-wide x-paybtn" id="xPay" type="submit"></button>
      <p class="x-small x-center">Plaćanje je zaštićeno. Fiskalizirani račun stiže na e-mail odmah nakon plaćanja.</p>
    </form>
    <aside class="x-sum"><h3>Vaša narudžba</h3><div id="xSumL"></div><div id="xSumT"></div></aside></div></div></section>`;
  const f=$('#xCo');
  const upd=()=>{ship=f.ship.value;pay=f.pay.value;
    $('#xShipF').innerHTML=ship==='adresa'?`<label class="x-field"><span>Ulica i kućni broj</span><input name="ulica" autocomplete="street-address" required></label><div class="x-f2"><label class="x-field"><span>Poštanski broj</span><input name="pb" inputmode="numeric" autocomplete="postal-code" required></label><label class="x-field"><span>Grad</span><input name="grad" autocomplete="address-level2" required></label></div>`
      :`<label class="x-field"><span>Paketomat</span><select name="pm" required><option value="">Odaberite paketomat…</option><option>GLS paketomat (odabir s GLS karte)</option></select></label>`;
    $('#xPayF').innerHTML=pay==='card'?`<div class="x-cardf"><label class="x-field"><span>Broj kartice</span><input inputmode="numeric" placeholder="1234 1234 1234 1234" autocomplete="cc-number"></label><div class="x-f2"><label class="x-field"><span>Vrijedi do</span><input placeholder="MM / GG" autocomplete="cc-exp"></label><label class="x-field"><span>CVC</span><input inputmode="numeric" placeholder="123" autocomplete="cc-csc"></label></div><p class="x-small">U pravoj trgovini ovo polje je sigurni Stripe obrazac.</p></div>`:'';
    const tot=total();$('#xPay').innerHTML=(pay==='apple'?'Plati s Apple Pay · ':pay==='google'?'Plati s Google Pay · ':'Plati karticom · ')+eur(tot);
    $('#xPay').className='x-btn x-wide x-paybtn '+pay;sumR();};
  f.addEventListener('change',e=>{if(e.target.name==='ship'||e.target.name==='pay')upd();if(e.target.id==='xR1')$('#xR1F').innerHTML=e.target.checked?`<div class="x-f2"><label class="x-field"><span>Naziv tvrtke</span><input name="tvrtka"></label><label class="x-field"><span>OIB</span><input name="oib" inputmode="numeric" maxlength="11"></label></div>`:'';});
  $$('[data-pay]').forEach(b=>b.onclick=()=>{f.pay.value=b.dataset.pay;upd();$('#xPay').scrollIntoView({behavior:'smooth',block:'center'});});
  f.addEventListener('submit',e=>{e.preventDefault();const errs=[];
    if(!f.ime.value.trim())errs.push('ime i prezime');if(!/^\S+@\S+\.\S+$/.test(f.email.value))errs.push('ispravan e-mail');
    if(ship==='adresa'&&(!f.ulica.value||!f.pb.value||!f.grad.value))errs.push('adresu dostave');if(ship==='paketomat'&&!f.pm.value)errs.push('paketomat');
    if(!f.terms.checked)errs.push('prihvaćanje uvjeta');
    if(errs.length){$('#xErr').textContent='Molimo upišite: '+errs.join(', ')+'.';return;}
    const order={no:'CS-'+String(Date.now()).slice(-6),email:f.email.value,total:total(),items:cart.slice(),pay};
    store.set('cs-last',order);cart=[];save();location.hash='#hvala';});
  upd();
}
const shipCost=()=>subtotal()>=SHOP.freeFrom?0:SHOP.ship[ship];
const total=()=>subtotal()+shipCost();
function sumR(){if(!$('#xSumL'))return;
  $('#xSumL').innerHTML=cart.map(it=>{const p=P.find(x=>x.id===it.id);return `<div class="x-si"><span class="x-simg">${imgOf(p)}<em>${it.q}</em></span><span><b>${p.name}</b><small>${it.v}</small></span><b>${eur(priceOf(p,it.v)*it.q)}</b></div>`}).join('');
  const sc=shipCost();
  $('#xSumT').innerHTML=`<div class="x-row"><span>Međuzbroj</span><span>${eur(subtotal())}</span></div><div class="x-row"><span>Dostava (${ship==='adresa'?'na adresu':'paketomat'})</span><span>${sc?eur(sc):'Besplatno'}</span></div><div class="x-row x-tot"><span>Ukupno</span><b>${eur(total())}</b></div>`;}
function renderDone(){const o=store.get('cs-last',null);
  $('#v-done').innerHTML=`<section class="x-done"><div class="x-wrap x-narrow"><span class="x-donei">${ic.check}</span><h1 class="x-h1">Hvala na narudžbi!</h1>
  ${o?`<p>Narudžba <b>${o.no}</b> je zaprimljena i plaćena (${o.pay==='apple'?'Apple Pay':o.pay==='google'?'Google Pay':'kartica'}, ${eur(o.total)}).</p><p>Fiskalizirani račun poslan je na <b>${o.email}</b>. Kad GLS preuzme paket, dobit ćete poruku s praćenjem.</p>`:'<p>Narudžba je zaprimljena.</p>'}
  <div class="x-donebtns"><a href="#katalog" class="x-btn">Nastavi kupovinu</a><a href="#" class="x-btn x-ghost">Na početnu</a></div></div></section>`;}

/* ---------- static pages ---------- */
function renderAbout(){$('#v-about').innerHTML=`<section class="x-page x-about"><div class="x-wrap">
  <p class="x-crumbs"><a href="#">Početna</a><span>/</span>O nama</p>
  <div class="x-ab-grid"><div><h1 class="x-h1">O nama</h1>
    <p class="x-lead">Camellia sinensis je trgovina čaja i pribora za čaj u Zagrebu.</p>
    <p class="x-ph" style="font-style:normal">U ponudi su bijeli, zeleni, oolong, crni i pu'er čajevi, aromatizirane i biljne mješavine te pribor za pripremu. Uz svaki čaj navodimo podrijetlo, okus i način pripreme, a narudžbe šaljemo GLS-om na adresu ili u paketomat.</p>
    <div class="x-ab-acts"><a href="#katalog" class="x-btn">Pogledaj katalog</a><a href="#kontakt" class="x-btn x-ghost">Kontakt</a></div></div>
    <figure class="x-ab-photo"><img src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Perchs_Thehandel_Copenhagen.jpg/1280px-Perchs_Thehandel_Copenhagen.jpg" alt="Čajna trgovina" loading="lazy" referrerpolicy="no-referrer"><figcaption>Ilustracija · Foto: Ib Rasmussen, javna domena</figcaption></figure></div>
  <div class="x-ab3"><div><b>${P.filter(p=>p.type!=='pribor').length}</b><span>čajeva i biljnih mješavina u ponudi</span></div><div><b>${P.filter(p=>p.type==='puer').length}</b><span>pu'era, rijetkosti u Hrvatskoj</span></div><div><b>${ORIGINS.filter(o=>o!=='Mješavina').length}</b><span>zemalja podrijetla</span></div></div>
  <div class="x-ab-vals"><div><h3>Preporuka na upit</h3><p>Ne znate što izabrati? Pošaljite poruku s onim što inače pijete i dobit ćete prijedlog.</p></div><div><h3>Priprema uz svaki čaj</h3><p>Temperatura vode, vrijeme i količina navedeni su uz svaki proizvod.</p></div><div><h3>Jednostavna kupnja</h3><p>Dostava GLS-om, plaćanje Apple Payem, Google Payem ili karticom i račun odmah na e-mail.</p></div></div>
</div></section>`;}
function renderContact(){$('#v-contact').innerHTML=`<section class="x-page x-contact"><div class="x-wrap">
  <p class="x-crumbs"><a href="#">Početna</a><span>/</span>Kontakt</p><h1 class="x-h1">Kontakt</h1>
  <div class="x-ct-grid"><form class="x-ctform" id="xCt" novalidate>
    <div class="x-f2"><label class="x-field"><span>Ime</span><input name="ime" required></label><label class="x-field"><span>E-mail</span><input name="email" type="email" required></label></div>
    <label class="x-field"><span>Tema</span><select name="tema"><option>Preporuka čaja</option><option>Pitanje o narudžbi</option><option>Poklon i veće narudžbe</option><option>Suradnja</option></select></label>
    <label class="x-field"><span>Poruka</span><textarea name="poruka" rows="6" required placeholder="Npr. inače pijem zeleni čaj ujutro, tražim nešto blaže za večer…"></textarea></label>
    <p class="x-err" id="xCtErr" role="alert"></p><button class="x-btn" type="submit">Pošalji poruku ${ic.arr}</button></form>
    <div class="x-ct-info"><div class="x-ct-card"><h3>Trgovina</h3><p>Zagreb</p><p>Adresu i radno vrijeme objavljujemo uz otvaranje trgovine.</p></div><div class="x-ct-card"><h3>Javite se</h3><p>Najbrže putem obrasca.</p><p>Odgovaramo na e-mail, obično isti ili sljedeći radni dan.</p></div><div class="x-map"><iframe title="Karta: Zagreb" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=Zagreb%2C%20Hrvatska&amp;z=13&amp;output=embed"></iframe></div></div></div>
</div></section>`;
  $('#xCt').addEventListener('submit',e=>{e.preventDefault();const f=e.target;if(!f.ime.value||!/^\S+@\S+\.\S+$/.test(f.email.value)||!f.poruka.value){$('#xCtErr').textContent='Molimo ispunite ime, ispravan e-mail i poruku.';return;}
    f.outerHTML=`<div class="x-ctok">${ic.check}<h3>Hvala, poruka je poslana.</h3><p>Javit ćemo se na ${f.email.value} što prije.</p></div>`;});}

/* ---------- router ---------- */
const VIEWS=['home','cat','prod','about','contact','checkout','done'];
function show(v){VIEWS.forEach(x=>{const el=$('#v-'+x);if(el)el.hidden=x!==v;});document.body.dataset.view=v;
  $$('[data-nav]').forEach(a=>a.classList.toggle('on',a.dataset.nav===v||(v==='prod'&&a.dataset.nav==='cat')));UI.onView&&UI.onView(v);}
function route(){const h=decodeURIComponent(location.hash||'');const was=document.body.dataset.view;
  if(h.startsWith('#katalog')){const ps=new URLSearchParams(h.split('?')[1]||'');resetF();
    const map={vrsta:'type',namjena:'moods',kofein:'lv',okus:'flav',podrijetlo:'origin',oblik:'form'};
    for(const [k,g] of Object.entries(map))if(ps.get(k))F[g]=ps.get(k).split(',');
    if(ps.get('q'))F.q=ps.get('q').toLowerCase();if(ps.get('rijetko'))F.rare=true;
    show('cat');syncInputs();renderCat();scrollTo(0,0);if(ps.get('trazi')!=null)setTimeout(()=>$('#xQ').focus(),50);return;}
  if(h.startsWith('#proizvod/')){show('prod');renderProd(+h.split('/')[1]);scrollTo(0,0);return;}
  if(h==='#o-nama'){show('about');renderAbout();scrollTo(0,0);return;}
  if(h==='#kontakt'){show('contact');renderContact();scrollTo(0,0);return;}
  if(h==='#blagajna'){show('checkout');renderCheckout();scrollTo(0,0);return;}
  if(h==='#hvala'){show('done');renderDone();scrollTo(0,0);return;}
  show('home');const el=h.length>1?document.getElementById(h.slice(1)):null;
  if(el)requestAnimationFrame(()=>el.scrollIntoView({behavior:was==='home'?'smooth':'auto'}));else if(was&&was!=='home')scrollTo(0,0);
  dispatchEvent(new Event('resize'));}

function init(ui){UI=ui;catalogShell();drawerShell();renderCart();
  document.addEventListener('click',e=>{const a=e.target.closest('[data-add]');if(a){e.preventDefault();e.stopPropagation();add(+a.dataset.add);a.classList.add('ok');setTimeout(()=>a.classList.remove('ok'),900);}
    if(e.target.closest('#openCart'))openCart();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeCart();const f=$('#xFilters');f&&f.classList.remove('on');document.body.classList.remove('x-lock');}});
  addEventListener('hashchange',route);route();}
return {init,add,openCart,closeCart,P,dots,imgOf,eur,tname};
})();
