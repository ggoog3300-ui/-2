/* متجر خضارنا - واجهة الزبائن */
const cfg=window.KHUDARNA_CONFIG||{};
const fx=window.FX||{reduce:false,store:{get:()=>null,set(){}},reveal(){},bump(){},fly(){},confetti(){}};
const money=n=>new Intl.NumberFormat('en-US').format(n)+' د.ع';
const demoProducts=[
{id:'demo1',name:'طماطم طازجة',cat:'خضروات ثمرية',emoji:'🍅',price_iqd:1750,unit:'كغم',description:'طماطم حمراء للسلطة والطبخ'},
{id:'demo2',name:'خيار طازج',cat:'خضروات ثمرية',emoji:'🥒',price_iqd:1500,unit:'كغم',description:'خيار أخضر مقرمش'},
{id:'demo3',name:'بطاطا',cat:'جذريات',emoji:'🥔',price_iqd:1250,unit:'كغم',description:'للقلي والطبخ'},
{id:'demo4',name:'جزر',cat:'جذريات',emoji:'🥕',price_iqd:1000,unit:'كغم',description:'جزر طازج'},
{id:'demo5',name:'بصل',cat:'بصل وثوم',emoji:'🧅',price_iqd:900,unit:'كغم',description:'للاستخدام اليومي'},
{id:'demo6',name:'خس',cat:'خضروات ورقية',emoji:'🥬',price_iqd:1000,unit:'حبة',description:'أوراق طازجة للسلطات'},
{id:'demo7',name:'فلفل ملون',cat:'خضروات ثمرية',emoji:'🫑',price_iqd:2500,unit:'كغم',description:'فلفل حلو طازج'},
{id:'demo8',name:'باذنجان',cat:'خضروات ثمرية',emoji:'🍆',price_iqd:1400,unit:'كغم',description:'للطبخ'},
{id:'demo9',name:'بروكلي',cat:'خضروات ورقية',emoji:'🥦',price_iqd:2000,unit:'حبة',description:'بروكلي أخضر'},
{id:'demo10',name:'ثوم',cat:'بصل وثوم',emoji:'🧄',price_iqd:3000,unit:'كغم',description:'ثوم طازج'},
{id:'demo11',name:'تفاح',cat:'فواكه',emoji:'🍎',price_iqd:2500,unit:'كغم',description:'تفاح لذيذ'},
{id:'demo12',name:'موز',cat:'فواكه',emoji:'🍌',price_iqd:2000,unit:'كغم',description:'موز طازج'}
];
const fallbackCats=[['الكل','🧺'],['خضروات ورقية','🥬'],['خضروات ثمرية','🍅'],['جذريات','🥕'],['بصل وثوم','🧅'],['فواكه','🍎']];
const HUES=[8,28,45,95,125,150,170,350];
const hue=s=>{let h=0;for(const c of String(s))h=(h*31+c.charCodeAt(0))>>>0;return HUES[h%HUES.length]};
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function loadCart(){try{const c=JSON.parse(fx.store.get('kh-cart')||'{}');return c&&typeof c==='object'?c:{}}catch(e){return{}}}
function saveCart(){fx.store.set('kh-cart',JSON.stringify(cart))}
let user=null,sb=null,products=demoProducts,cats=fallbackCats,selected='الكل',term='',cart=loadCart(),zones=[],live=false,done=null,toastT;
const prod=id=>products.find(p=>String(p.id)===String(id));

/* ---------- رسائل ---------- */
function say(s,kind){const t=$('toast');t.textContent=s;t.className='toast show '+(kind||'ok');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),2800)}
function notice(s){$('status').textContent=s;$('status').classList.remove('hidden')}
function configured(){return cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY&&!cfg.SUPABASE_URL.includes('YOUR_')&&!cfg.SUPABASE_ANON_KEY.includes('YOUR_')}

/* ---------- الحساب ---------- */
const meta=()=>(user&&user.user_metadata)||{};
function setUser(u){
  user=u;const m=meta(),name=m.full_name||(u.email||'').split('@')[0];
  $('hello').textContent='👋 أهلاً '+name;$('hello').hidden=false;$('logoutBtn').hidden=false;
}
function hideGate(){const g=$('gate');if(g){g.classList.add('out');setTimeout(()=>g.remove(),500)}}
setTimeout(()=>{if(!sb||user)hideGate()},6000);
$('logoutBtn').onclick=async()=>{if(!sb)return;$('logoutBtn').disabled=true;await sb.auth.signOut();location.replace('login.html')};

/* ---------- البداية ---------- */
async function init(){
  $('year').textContent=new Date().getFullYear();
  $('storePhone').textContent=cfg.STORE_PHONE||'أضف رقم المتجر';
  skeleton();
  if(window.supabase&&configured()){
    try{
      sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
      /* لا متجر بدون تسجيل دخول */
      const {data:{session}}=await sb.auth.getSession();
      if(!session){location.replace('login.html');return}
      setUser(session.user);
      sb.auth.onAuthStateChange(ev=>{if(ev==='SIGNED_OUT')location.replace('login.html')});
      await loadCatalog();
    }
    catch(e){notice('تعذر الاتصال بقاعدة البيانات. تُعرض منتجات تجريبية مؤقتاً.')}
  }else notice('الموقع يعمل بمنتجات تجريبية حالياً. أكمل إعداد config.js وربط Supabase لتفعيل الطلبات الحقيقية.');
  Object.keys(cart).forEach(id=>{if(!prod(id))delete cart[id]});saveCart();
  renderCats();renderProducts();renderCart();loadZones();hideGate();
}
async function loadCatalog(){
  const {data:cs,error:ce}=await sb.from('kh_categories').select('id,name,emoji').eq('active',true).order('sort_order');if(ce)throw ce;
  const {data,error}=await sb.from('kh_products').select('id,name,description,emoji,unit,price_iqd,category_id').eq('is_available',true).order('name');if(error)throw error;
  products=(data||[]).map(p=>({...p,cat:(cs||[]).find(c=>c.id===p.category_id)?.name||'أخرى'}));
  if(cs&&cs.length)cats=[['الكل','🧺'],...cs.map(c=>[c.name,c.emoji||'🥬'])];
  live=true;
}
async function loadZones(){
  if(!sb)return;
  const {data}=await sb.from('kh_delivery_zones').select('id,name,fee_iqd').eq('active',true).order('name');
  zones=data||[];
  const a=$('area');if(a){const v=a.value;a.innerHTML=zoneOptions();a.value=v;updateSum()}
}

/* ---------- الأقسام والمنتجات ---------- */
function skeleton(){$('productsGrid').innerHTML=Array(8).fill('<div class="product sk-card"><div class="pic sk"></div><div class="pb"><i class="sk l1"></i><i class="sk l2"></i><i class="sk l3"></i></div></div>').join('')}
function renderCats(){
  $('cats').innerHTML=cats.map(([n,e],i)=>`<button class="cat reveal ${selected===n?'active':''}" style="--i:${i}" data-cat="${esc(n)}"><span>${esc(e)}</span><b>${n==='الكل'?'كل المنتجات':esc(n)}</b></button>`).join('');
  fx.reveal($('cats'));
}
function syncCats(){$('cats').querySelectorAll('.cat').forEach(b=>b.classList.toggle('active',b.dataset.cat===selected))}
function list(){
  const a=products.filter(p=>(selected==='الكل'||p.cat===selected)&&(p.name+' '+p.cat).toLowerCase().includes(term.toLowerCase()));
  const s=$('sort').value;
  if(s==='low')a.sort((x,y)=>x.price_iqd-y.price_iqd);
  if(s==='high')a.sort((x,y)=>y.price_iqd-x.price_iqd);
  return a;
}
function ctl(p){
  const q=cart[p.id];
  return q?`<div class="stepper"><button data-dec="${esc(p.id)}" aria-label="إنقاص">−</button><b>${q}</b><button data-inc="${esc(p.id)}" aria-label="زيادة">＋</button></div>`
          :`<button class="btn" data-add="${esc(p.id)}">＋ أضف للسلة</button>`;
}
function card(p,i){
  return `<article class="product reveal" style="--i:${i%8};--h:${hue(p.name)}" data-id="${esc(p.id)}"><div class="pic"><span class="emo">${esc(p.emoji||'🥬')}</span><span class="tag">طازج</span></div><div class="pb"><h3>${esc(p.name)}</h3><p>${esc(p.description||'منتج طازج')}</p><div class="price">${money(p.price_iqd)} <small>/ ${esc(p.unit)}</small></div><div class="ctl">${ctl(p)}</div></div></article>`;
}
function renderProducts(){
  const a=list();
  $('productTitle').textContent=selected==='الكل'?'المنتجات المتوفرة':selected;
  $('empty').hidden=!!a.length;
  $('productsGrid').innerHTML=a.map(card).join('');
  fx.reveal($('productsGrid'));
}
function refreshCard(id){
  const p=prod(id);if(!p)return;
  document.querySelectorAll(`.product[data-id="${CSS.escape(String(id))}"] .ctl`).forEach(c=>{c.innerHTML=ctl(p);c.classList.remove('pop');void c.offsetWidth;c.classList.add('pop')});
}

/* ---------- السلة ---------- */
function add(id,src){
  const p=prod(id);if(!p)return;
  cart[id]=(cart[id]||0)+1;done=null;saveCart();
  if(src&&!src.closest('.drawer'))fx.fly(src,$('cartOpen'),p.emoji);
  if(cart[id]===1)say('تمت إضافة '+p.name+' للسلة 🛒');
  sync(id);
}
function change(id,n){cart[id]=(cart[id]||0)+n;if(cart[id]<=0)delete cart[id];saveCart();sync(id)}
function remove(id,btn){
  const row=btn&&btn.closest('.item');
  const go=()=>{delete cart[id];saveCart();sync(id)};
  if(row&&!fx.reduce){row.classList.add('leaving');setTimeout(go,230)}else go();
}
function sync(id){refreshCard(id);renderCart()}
function cartLines(){return Object.entries(cart).map(([id,q])=>({p:prod(id),q})).filter(x=>x.p)}
function subtotal(){return cartLines().reduce((s,x)=>s+x.p.price_iqd*x.q,0)}
function itemHtml({p,q}){
  const id=esc(p.id);
  return `<div class="item"><div class="emoji">${esc(p.emoji||'🥬')}</div><div class="imeta"><h4>${esc(p.name)}</h4><small>${money(p.price_iqd)} / ${esc(p.unit)}</small><br><div class="stepper sm"><button data-dec="${id}" aria-label="إنقاص">−</button><b>${q}</b><button data-inc="${id}" aria-label="زيادة">＋</button></div></div><div class="iend"><strong>${money(p.price_iqd*q)}</strong><button class="del" data-del="${id}" aria-label="حذف">🗑</button></div></div>`;
}
function renderCart(){
  const lines=cartLines(),n=lines.reduce((s,x)=>s+x.q,0),cnt=$('count');
  if(cnt.textContent!==String(n)){cnt.textContent=n;fx.bump(cnt)}
  $('cartOpen').classList.toggle('has',n>0);
  if(done){$('cartItems').innerHTML='';$('checkout').innerHTML=successView();return}
  $('cartItems').innerHTML=lines.length?lines.map(itemHtml).join(''):'<div class="emptycart"><span>🧺</span><p>سلتك فارغة</p><small>أضف بعض الخضار الطازجة وابدأ</small></div>';
  if(!lines.length){$('checkout').innerHTML='';return}
  if(!$('orderForm')){
    $('checkout').innerHTML=checkoutForm();
    $('orderForm').onsubmit=submitOrder;
    $('area').onchange=updateSum;
  }
  updateSum();
}
function zoneOptions(){return `<option value="">اختر المنطقة</option>${zones.map(z=>`<option value="${esc(z.name)}" data-fee="${z.fee_iqd}">${esc(z.name)} — ${money(z.fee_iqd)}</option>`).join('')}<option value="other">منطقة أخرى / يتم التأكيد هاتفياً</option>`}
function checkoutForm(){
  return `<div class="sum"><div class="row"><span>مجموع المنتجات</span><b id="sumSub"></b></div><div class="row"><span id="feeInfo" class="note"></span></div><div class="row tot"><span>الإجمالي</span><span id="sumTotal"></span></div></div>
<form id="orderForm"><div class="field"><label>الاسم الكامل *</label><input name="customer_name" required maxlength="120" value="${esc(meta().full_name||'')}"></div><div class="field"><label>رقم الهاتف *</label><input name="customer_phone" type="tel" required maxlength="30" placeholder="07xxxxxxxxx" value="${esc(meta().phone||'')}"></div><div class="field"><label>منطقة التوصيل *</label><select name="area" id="area" required>${zoneOptions()}</select></div><div class="field"><label>العنوان بالتفصيل *</label><textarea name="address" required maxlength="500" placeholder="الشارع، أقرب نقطة دالة، رقم المنزل"></textarea></div><div class="field"><label>ملاحظات</label><textarea name="notes" maxlength="1000"></textarea></div><button class="btn" style="width:100%;padding:13px">تأكيد الطلب نقداً عند الاستلام</button><p class="note">لا تُرسل بيانات حقيقية قبل إكمال إعداد Supabase.</p></form>`;
}
function updateSum(){
  const s=subtotal();if(!$('sumSub'))return;
  $('sumSub').textContent=money(s);
  const z=$('area'),o=z&&z.options[z.selectedIndex],fee=o&&o.dataset.fee!==undefined?Number(o.dataset.fee):null;
  $('feeInfo').textContent=fee!==null?'أجرة التوصيل: '+money(fee):(z&&z.value==='other'?'أجرة التوصيل تُحدد هاتفياً حسب المنطقة.':'أجرة التوصيل تعتمد على المنطقة، وسيتم تأكيدها قبل التسليم.');
  $('sumTotal').textContent=fee!==null?money(s+fee):money(s)+(z&&z.value==='other'?' + التوصيل':'');
}
function successView(){
  return `<div class="done"><svg class="check" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24"/><path d="M14 27l8 8 16-17"/></svg><h3>تم استلام طلبك 🎉</h3><p style="margin:2px 0 0">رقم الطلب</p><div class="onum">${esc(done)}</div><small>سنتواصل معك هاتفياً لتأكيد التوصيل. الدفع نقداً عند الاستلام.</small><button class="btn" id="keepShop" type="button" style="width:100%;padding:13px">متابعة التسوق</button></div>`;
}
async function submitOrder(e){
  e.preventDefault();
  if(!sb||!live){say('الطلبات غير مفعّلة بعد. أكمل إعداد Supabase في config.js أولاً.','err');return}
  const f=new FormData(e.currentTarget),area=f.get('area'),zone=zones.find(z=>z.name===area);
  if(!zone&&area!=='other'){say('اختر منطقة صحيحة','err');return}
  const items=cartLines().map(({p,q})=>({product_id:p.id,quantity:q}));
  const body={customer_name:f.get('customer_name').trim(),customer_phone:f.get('customer_phone').trim(),area:area==='other'?'يتم التأكيد هاتفياً':area,address:f.get('address').trim(),notes:f.get('notes').trim(),items};
  const button=e.currentTarget.querySelector('button[type="submit"],button:not([type])');
  button.disabled=true;button.textContent='جارٍ إرسال الطلب...';button.classList.add('loading');
  try{
    const {data,error}=await sb.functions.invoke('create-order',{body});
    if(error)throw error;
    const orderedLines=cartLines();
    done=data.order_number||data.order_id;cart={};saveCart();
    document.querySelectorAll('.product').forEach(c=>refreshCard(c.dataset.id));
    renderCart();fx.confetti();say('تم تسجيل طلبك بنجاح. رقم الطلب: '+done);
    showOrderStatusPage(done,orderedLines);
  }catch(err){
    console.error(err);say('تعذر إرسال الطلب. تحقق من إعداد Edge Function والاتصال.','err');
    button.disabled=false;button.textContent='تأكيد الطلب نقداً عند الاستلام';button.classList.remove('loading');
  }
}
function openCart(){$('overlay').classList.add('open');document.body.classList.add('lock')}
function closeCart(){$('overlay').classList.remove('open');document.body.classList.remove('lock')}

/* ---------- صفحة حالة الطلب (تظهر بعد إرسال الطلب) ---------- */
let lastOrderNumber=null;
function ospReset(orderNumber){
  $('ospTitle').textContent='تم إرسال الطلب';
  $('ospMsg').innerHTML='تم استلام طلبك بنجاح. رقم الطلب: <b>'+esc(orderNumber)+'</b><br>سنتواصل معك هاتفياً لتأكيد التوصيل. الدفع نقداً عند الاستلام.';
  const cb=$('ospCancelBtn');cb.hidden=false;cb.disabled=false;cb.textContent='إلغاء الطلب';
  const badge=document.querySelector('.osp-cancelled-badge');if(badge)badge.remove();
}
function showOrderStatusPage(orderNumber,lines){
  lastOrderNumber=orderNumber;
  ospReset(orderNumber);
  $('ospItems').innerHTML=lines.length
    ?lines.map(({p,q})=>`<tr><td>${esc(p.name)}</td><td>${q}</td><td>${money(p.price_iqd)}</td><td>${money(p.price_iqd*q)}</td></tr>`).join('')
    :'<tr><td colspan="4" style="text-align:center">لا توجد تفاصيل متاحة لهذا الطلب</td></tr>';
  closeCart();
  document.querySelector('.top').hidden=true;
  document.querySelector('#siteHeader').hidden=true;
  document.querySelector('main').hidden=true;
  document.querySelector('footer').hidden=true;
  $('orderStatusPage').classList.remove('hidden');
  scrollTo({top:0,behavior:'instant'});
}
function hideOrderStatusPage(){
  $('orderStatusPage').classList.add('hidden');
  document.querySelector('.top').hidden=false;
  document.querySelector('#siteHeader').hidden=false;
  document.querySelector('main').hidden=false;
  document.querySelector('footer').hidden=false;
  done=null;renderCart();
}
async function cancelOrder(){
  if(!lastOrderNumber)return;
  if(!confirm('هل أنت متأكد من إلغاء هذا الطلب؟'))return;
  const btn=$('ospCancelBtn');btn.disabled=true;btn.textContent='جارٍ الإلغاء...';
  try{
    if(sb)await sb.from('kh_orders').update({status:'cancelled'}).eq('order_number',lastOrderNumber);
  }catch(e){console.error('تعذر تحديث حالة الطلب في قاعدة البيانات',e)}
  $('ospTitle').textContent='تم إلغاء الطلب';
  $('ospMsg').innerHTML='تم إلغاء الطلب رقم <b>'+esc(lastOrderNumber)+'</b>. لأي استفسار تواصل معنا هاتفياً.';
  btn.hidden=true;
  btn.insertAdjacentHTML('afterend','<span class="osp-cancelled-badge">تم الإلغاء ✕</span>');
}
$('ospCancelBtn').onclick=cancelOrder;
$('ospBack').onclick=hideOrderStatusPage;

/* ---------- الأحداث ---------- */
function act(e){
  const b=e.target.closest('[data-add],[data-inc],[data-dec],[data-del]');if(!b)return;
  const d=b.dataset;
  if(d.add!==undefined)add(d.add,b);
  else if(d.inc!==undefined)add(d.inc,b);
  else if(d.dec!==undefined)change(d.dec,-1);
  else if(d.del!==undefined)remove(d.del,b);
}
$('productsGrid').addEventListener('click',act);
$('cartItems').addEventListener('click',act);
$('checkout').addEventListener('click',e=>{if(e.target.closest('#keepShop')){closeCart();done=null;renderCart()}});
$('cats').addEventListener('click',e=>{const b=e.target.closest('[data-cat]');if(!b)return;selected=b.dataset.cat;syncCats();renderProducts()});
$('sort').onchange=renderProducts;
$('cartOpen').onclick=openCart;
$('cartClose').onclick=closeCart;
$('overlay').onclick=e=>{if(e.target===$('overlay'))closeCart()};
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeCart()});
$('shopNow').onclick=()=>$('products').scrollIntoView({behavior:'smooth'});

/* بحث فوري + عند الإرسال */
let st;
$('search').addEventListener('input',e=>{clearTimeout(st);st=setTimeout(()=>{term=e.target.value.trim();if(term)selected='الكل';syncCats();renderProducts()},220)});
$('searchForm').onsubmit=e=>{e.preventDefault();term=$('search').value.trim();selected='الكل';syncCats();renderProducts();$('products').scrollIntoView({behavior:'smooth'})};

/* الرأس عند التمرير + زر للأعلى */
const hd=$('siteHeader'),tt=$('toTop');
addEventListener('scroll',()=>{hd.classList.toggle('scrolled',scrollY>40);tt.classList.toggle('show',scrollY>700)},{passive:true});
tt.onclick=()=>scrollTo({top:0,behavior:'smooth'});

/* تمييز القسم الحالي في القائمة */
if('IntersectionObserver' in window){
  const links=[...document.querySelectorAll('.nav a')];
  const spy=new IntersectionObserver(es=>es.forEach(en=>{if(en.isIntersecting)links.forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#'+en.target.id))}),{rootMargin:'-35% 0px -55% 0px'});
  ['home','categories','products','delivery','contact'].forEach(id=>{const el=$(id);if(el)spy.observe(el)});
}

/* حركة الواجهة الرئيسية: تتبّع المؤشر + كلمة متبدلة */
const hero=document.querySelector('.hero');
if(hero&&!fx.reduce&&matchMedia('(pointer:fine)').matches)hero.addEventListener('pointermove',e=>{const r=hero.getBoundingClientRect();hero.style.setProperty('--mx',((e.clientX-r.left)/r.width-.5).toFixed(3));hero.style.setProperty('--my',((e.clientY-r.top)/r.height-.5).toFixed(3))});
const rot=$('rot'),words=['بيتك','مطبخك','عائلتك','سفرتك'];let wi=0;
if(rot&&!fx.reduce)setInterval(()=>{rot.classList.add('out');setTimeout(()=>{wi=(wi+1)%words.length;rot.textContent=words[wi];rot.classList.remove('out')},350)},2600);

init();
