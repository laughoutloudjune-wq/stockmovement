// Shared helpers, API, i18n, picker, and UI primitives
export const API_URL = "https://script.google.com/macros/s/AKfycbwEJDNfo63e0LjEZa-bhXmX3aY2PUs96bUBGz186T-pVlphV4NGNYxGT2tcx1DWgbDI/exec";

export const $ = (q, r = document) => r.querySelector(q);
export const $$ = (q, r = document) => Array.prototype.slice.call(r.querySelectorAll(q));
export const esc = v => (v==null)?'':String(v).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
export const todayStr = () => new Date().toISOString().split('T')[0];

const safeJson = t => { try { return JSON.parse(t); } catch(e){ return {ok:false,error:'Bad JSON'}; } };
export function apiGet(fn, payload){
  const q = new URLSearchParams(); q.set('fn',fn);
  if (payload && payload.payload && Object.keys(payload.payload).length) q.set('payload', JSON.stringify(payload.payload));
  return fetch(API_URL + "?" + q.toString(), { method:'GET' })
    .then(r=>r.text()).then(safeJson)
    .then(d=> (d.result !== undefined ? d.result : d));
}
export function apiPost(fn, body){
  return fetch(API_URL, {
    method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'},
    body: JSON.stringify({fn:fn, payload:body||{}})
  }).then(r=>r.text()).then(safeJson)
    .then(d=> (d.result !== undefined ? d.result : d));
}

export function toast(m){
  const t = $('#toast'); if(!t) return;
  t.textContent = m; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), 4600);
}

export const STR = {
  th:{
    title:'ระบบสต็อกวัสดุ', sub:'ระบบเบา เร็ว และใช้ง่าย',
    tabs:{dash:'สรุป', out:'จ่ายออก', in:'รับเข้า', adj:'ปรับปรุง', pur:'ขอจัดซื้อ'},
    searchPh:'พิมพ์เพื่อค้นหา…', pick:'ค้นหาหรือเลือก', pickAdd:'เลือกหรือเพิ่มใหม่',
    proj:'โครงการ / สถานที่', contractor:'ผู้รับเหมา', requester:'ผู้ขอเบิก', note:'หมายเหตุ',
    outTitle:'จ่ายออก', outDate:'วันที่', inTitle:'รับเข้า', inDate:'วันที่รับ', adjTitle:'ปรับปรุงสต็อก',
    btnAdd:'＋ เพิ่ม', btnReset:'ล้าง', btnSubmit:'บันทึก',
    dashLow:'สต็อกใกล้หมด', dashTopContract:'ผู้รับเหมาที่ใช้บ่อย', dashTopItems:'วัสดุใช้บ่อย', dashRecent:'ความเคลื่อนไหวล่าสุด',
    purTitle:'ขอจัดซื้อ', purProj:'โครงการ / สถานที่', purNeedBy:'ต้องการภายใน (วันที่)', purContractor:'ผู้รับเหมา',
    purPriority:'ความเร่งด่วน', purNote:'หมายเหตุคำขอ', purOlder:'ขอจัดซื้อก่อนหน้า',
    showMore:'ดูเพิ่มเติม', showLess:'ย่อ', noLow:'ไม่มีรายการใกล้หมด 🎉',
    stock:'คงเหลือ: ', prev:'คงเหลือก่อนหน้า: ', save:'บันทึก',
  },
  en:{
    title:'Inventory', sub:'Lightweight, fast, and friendly',
    tabs:{dash:'Dashboard', out:'OUT', in:'IN', adj:'ADJUST', pur:'PURCHASING'},
    searchPh:'Type to search…', pick:'Search or pick', pickAdd:'Pick or add',
    proj:'Project / Location', contractor:'Contractor', requester:'Requester', note:'Note',
    outTitle:'Material OUT', outDate:'Date', inTitle:'Material IN', inDate:'Date received', adjTitle:'Adjust',
    btnAdd:'＋ Add', btnReset:'Reset', btnSubmit:'Submit',
    dashLow:'Low stock', dashTopContract:'Top contractors (usage)', dashTopItems:'Top items', dashRecent:'Recent movements',
    purTitle:'Purchasing Request', purProj:'Project / Location', purNeedBy:'Need by (date)', purContractor:'Contractor',
    purPriority:'Priority', purNote:'Request note', purOlder:'Older Requests',
    showMore:'Show more', showLess:'Show less', noLow:'No low stock 🎉',
    stock:'Stock: ', prev:'Prev: ', save:'Save',
  }
};

export function applyLangTexts(LANG){
  const S = STR[LANG];
  $('#t_title').textContent = S.title;
  $('#t_sub').textContent = S.sub;

  // Update tab labels
  const tabMap = [
    ['dashboard', S.tabs.dash],
    ['out', S.tabs.out],
    ['in', S.tabs.in],
    ['adjust', S.tabs.adj],
    ['purchase', S.tabs.pur],
  ];
  tabMap.forEach(([key, label])=>{
    const btn = document.querySelector(`.tabs [data-tab="${key}"]`);
    if (btn) btn.textContent = label;
  });
}

export function clampList(listEl){
  const max = Number(listEl.dataset.limit||'5');
  const items = listEl.children;
  for (let i=0;i<items.length;i++){ items[i].style.display = (i<max) ? '' : 'none'; }
  listEl.dataset.expanded = 'false';
}
export function toggleClamp(btn, LANG){
  const sel = btn.getAttribute('data-toggle');
  const list = $(sel); if(!list) return;
  const expanded = list.dataset.expanded === 'true';
  const items = list.children;
  for (let i=0;i<items.length;i++){
    items[i].style.display = expanded ? ((i<Number(list.dataset.limit||'5'))? '' : 'none') : '';
  }
  list.dataset.expanded = expanded ? 'false' : 'true';
  btn.textContent = expanded ? (LANG==='th'?'ดูเพิ่มเติม':'Show more') : (LANG==='th'?'ย่อ':'Show less');
}

export function setCardLoading(cardEl, count = 5){
  if(!cardEl) return;
  const list = cardEl.querySelector('.list');
  if(!list) return;
  list.innerHTML='';
  for(let i=0;i<count;i++){
    const row = document.createElement('div'); row.className = 'skeleton-row';
    const left = document.createElement('div'); left.style.flex='1';
    const bar1 = document.createElement('div'); bar1.className='skeleton-bar'; bar1.style.width='60%';
    const bar2 = document.createElement('div'); bar2.className='skeleton-bar'; bar2.style.width='40%'; bar2.style.marginTop='6px';
    left.appendChild(bar1); left.appendChild(bar2);
    const right = document.createElement('div'); right.className='skeleton-badge';
    row.appendChild(left); row.appendChild(right);
    list.appendChild(row);
  }
}

export function setBtnLoading(btn, isLoading){
  if(!btn) return;
  btn.classList.toggle('is-loading', !!isLoading);
  btn.disabled = !!isLoading;
}

export function stockBadge(stock, min){
  const b=document.createElement('span');
  b.className='badge';
  b.textContent = (stock==null || isNaN(stock)) ? '-' : stock;
  if (stock<=0 || (min!=null && stock<=Number(min||0))) b.classList.add('red');
  else if (min!=null && stock <= 2*Number(min||0)) b.classList.add('yellow');
  else b.classList.add('green');
  return b;
}

/* ====== Shared item/person/project picker ====== */
let MATERIALS=[], PROJECTS=[], CONTRACTORS=[], REQUESTERS=[];
const pickerOverlay = $('#pickerOverlay');
const pickerList   = $('#pickerList');
const pickerSearch = $('#pickerSearch');
const pickerAdd    = $('#pickerAdd');
const pickerAddText= $('#pickerAddText');
const pickerCancel = $('#pickerCancel');

const sources = {
  materials: () => MATERIALS,
  projects:  () => PROJECTS,
  contractors: () => CONTRACTORS,
  requesters: () => REQUESTERS
};

let currentTargetInput = null;
let currentSourceKey = null;

export function preloadLookups(){
  return Promise.all([
    apiGet('listMaterials'),
    apiGet('listProjects'),
    apiGet('listContractors'),
    apiGet('listRequesters')
  ]).then(([m,p,c,r])=>{
    MATERIALS=Array.isArray(m)?m:[]; PROJECTS=Array.isArray(p)?p:[]; CONTRACTORS=Array.isArray(c)?c:[]; REQUESTERS=Array.isArray(r)?r:[];
  });
}

function renderPickerList(query){
  const all = (sources[currentSourceKey] ? sources[currentSourceKey]() : []) || [];
  const q = (query||'').toLowerCase().trim();
  const list = q ? all.filter(v => String(v).toLowerCase().includes(q)) : all.slice();
  pickerList.innerHTML = '';
  if (!list.length){
    pickerAdd.classList.remove('hidden');
    pickerAddText.textContent = query || '';
  } else {
    pickerAdd.classList.add('hidden');
  }
  list.forEach(v=>{
    const row = document.createElement('div');
    row.className = 'pick-row';
    row.innerHTML = '<strong>'+esc(v)+'</strong>';
    row.addEventListener('click', ()=>{
      if (currentTargetInput){ currentTargetInput.value = v; currentTargetInput.dispatchEvent(new Event('change')); }
      closePicker();
    });
    pickerList.appendChild(row);
  });
}

export function openPicker(targetInput, sourceKey){
  currentTargetInput = targetInput;
  currentSourceKey = sourceKey;
  if (pickerSearch) pickerSearch.value = '';
  renderPickerList('');
  pickerOverlay.classList.add('open');
  pickerOverlay.setAttribute('aria-hidden','false');
  setTimeout(()=>pickerSearch && pickerSearch.focus(), 30);
}
export function closePicker(){
  pickerOverlay.classList.remove('open');
  pickerOverlay.setAttribute('aria-hidden','true');
  currentTargetInput = null;
  currentSourceKey = null;
}
pickerSearch && pickerSearch.addEventListener('input', e => renderPickerList(e.target.value));
pickerCancel && pickerCancel.addEventListener('click', closePicker);
pickerOverlay && pickerOverlay.addEventListener('click', e=>{ if(e.target===pickerOverlay) closePicker(); });
document.addEventListener('keydown', e=>{ if(e.key==='Escape' && pickerOverlay.classList.contains('open')) closePicker(); });

pickerAdd && pickerAdd.addEventListener('click', ()=>{
  const text = pickerSearch.value.trim();
  if (!text) return;
  if (currentSourceKey === 'contractors'){
    apiGet('addContractor', {payload:{name:text}}).then(ok=>{
      if (ok){ CONTRACTORS = Array.from(new Set([text, ...CONTRACTORS])); toast('Added contractor'); }
      if (currentTargetInput) { currentTargetInput.value = text; currentTargetInput.dispatchEvent(new Event('change')); }
      closePicker();
    });
  } else if (currentSourceKey === 'requesters'){
    apiGet('addRequester', {payload:{name:text}}).then(ok=>{
      if (ok){ REQUESTERS = Array.from(new Set([text, ...REQUESTERS])); toast('Added requester'); }
      if (currentTargetInput) { currentTargetInput.value = text; currentTargetInput.dispatchEvent(new Event('change')); }
      closePicker();
    });
  } else {
    toast('Use master sheet to add new entries');
    closePicker();
  }
});

export function bindPickerInputs(root = document){
  $$('input[data-picker]', root).forEach(inp=>{
    inp.addEventListener('click', ()=>{
      const key = inp.getAttribute('data-picker');
      openPicker(inp, key);
    });
  });
}
