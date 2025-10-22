// js/shared.js (wired to backend)
/* ===== ENV ===== */
export const API_URL = (window.API_URL || '').trim(); // e.g., "https://script.google.com/macros/s/AKfy.../exec"
if (!API_URL) console.warn('[shared] API_URL is empty. Set window.API_URL before loading main.js');

/* ===== Small DOM helpers ===== */
export const $  = (q, r = document) => r.querySelector(q);
export const $$ = (q, r = document) => Array.from(r.querySelectorAll(q));
export const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);
export const esc = (v) => v == null ? "" : String(v).replace(/[&<>"']/g,(m)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));

/* ===== i18n ===== */
export const STR = {
  th: {
    tabs: { dash:'สรุป', out:'จ่ายออก', in:'รับเข้า', adj:'ปรับปรุง', pur:'ขอจัดซื้อ' },
    out: {
      title: 'ประวัติการจ่ายออก',
      filters: 'ค้นหา/กรอง',
      project: 'โครงการ', contractor: 'ผู้รับเหมา', requester: 'ผู้ขอเบิก',
      daterange: 'ช่วงวันที่', from:'จาก', to:'ถึง',
      material:'วัสดุ', search:'ค้นหา', reset:'ล้าง', result:'ผลลัพธ์',
      doc:'เลขที่เอกสาร', date:'วันที่', qty:'จำนวน', unit:'หน่วย', location:'สถานที่', note:'หมายเหตุ',
      actions:'การทำงาน', edit:'แก้ไข', save:'บันทึก', cancel:'ยกเลิก', noData:'ไม่พบข้อมูล',
      edited:'บันทึกการแก้ไขแล้ว', invalid:'กรุณากรอกข้อมูลให้ครบ'
    },
    picker:{ placeholder:'ค้นหา…', add:'เพิ่ม' },
    ui:{ refresh:'รีเฟรชข้อมูลแล้ว', failed:'ผิดพลาด' }
  },
  en: {
    tabs: { dash:'Dashboard', out:'Out', in:'In', adj:'Adjust', pur:'Purchase' },
    out: {
      title: 'Material Out History',
      filters: 'Filters',
      project: 'Project', contractor: 'Contractor', requester: 'Requester',
      daterange: 'Date range', from:'From', to:'To',
      material:'Material', search:'Search', reset:'Reset', result:'Results',
      doc:'Doc No', date:'Date', qty:'Qty', unit:'Unit', location:'Location', note:'Note',
      actions:'Actions', edit:'Edit', save:'Save', cancel:'Cancel', noData:'No data',
      edited:'Saved changes', invalid:'Please complete required fields'
    },
    picker:{ placeholder:'Search…', add:'Add' },
    ui:{ refresh:'Data refreshed', failed:'Failed' }
  }
};
export function currentLang(){ const s = localStorage.getItem('lang'); return s || (navigator.language?.startsWith('th') ? 'th':'th'); }
export function applyLangTexts(lang){ localStorage.setItem('lang', lang); }

/* ===== Toast ===== */
export function toast(msg){
  let el = document.getElementById('toast');
  if (!el){ el = document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('show'); clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove('show'), 2000);
}
export function setBtnLoading(btn, on){ if (!btn) return; btn.disabled=!!on; btn.classList.toggle('loading', !!on); }
export function cleanOldCache(){ /* no-op for now */ }

/* ===== Modal & Picker (overlay already in index.html) ===== */
export function openModal(html, { onOpen } = {}){
  const ov = document.createElement('div');
  ov.className = 'modal-ov';
  ov.innerHTML = `<div class="modal glass">${html}</div>`;
  Object.assign(ov.style,{position:'fixed',inset:'0',background:'rgba(0,0,0,.35)',zIndex:4100,display:'grid',placeItems:'center'});
  document.body.appendChild(ov);
  const close = ()=>ov.remove();
  ov.addEventListener('click', e=>{ if (e.target===ov) close(); });
  onOpen && onOpen(ov, close);
  return { close, el: ov };
}

export function bindPickerInputs(root=document, lang='th'){
  const S = STR[lang];
  root.querySelectorAll('input[data-src]').forEach(inp => {
    inp.addEventListener('focus', () => showPicker(inp.getAttribute('data-src'), inp, lang));
  });

  function showPicker(source, target, lang){
    const list = (LOOKUPS[source]) || [];
    const ov = document.getElementById('pickerOverlay');
    const box = document.getElementById('pickerBox');
    const listBox = document.getElementById('pickerList');
    const search = document.getElementById('pickerSearch');
    const addBtn = document.getElementById('pickerAdd');
    const addText = document.getElementById('pickerAddText');
    ov.classList.add('open'); ov.setAttribute('aria-hidden','false');
    const render = (q='') => {
      listBox.innerHTML = '';
      const qn = q.trim().toLowerCase();
      (qn? list.filter(x=>x.toLowerCase().includes(qn)) : list).slice(0,300).forEach((name)=>{
        const btn = document.createElement('button');
        btn.type='button'; btn.className='list-btn'; btn.textContent = name;
        btn.addEventListener('click', () => { setValue(target, name); close(); });
        listBox.appendChild(btn);
      });
      addText.textContent = q.trim();
      addBtn.style.display = q.trim()? 'block':'none';
    };
    const close = () => { ov.classList.remove('open'); ov.setAttribute('aria-hidden','true'); search.value=''; };
    render();
    search.placeholder = S.picker.placeholder;
    search.oninput = (e)=>render(e.target.value);
    document.getElementById('pickerCancel').onclick = close;
    addBtn.onclick = () => { const v = search.value.trim(); if(!v) return; pushLookup(source, v); setValue(target, v); close(); };
    setTimeout(()=>search.focus(), 50);
  }
  function setValue(target, value){
    if (target.tagName === 'INPUT') target.value = value;
    else target.textContent = value;
    target.dispatchEvent(new Event('change'));
  }
}

/* ===== Backend API client (Apps Script style) ===== */
const FN_LOOKUPS    = 'lookups';
const FN_OUT_SEARCH = 'out.search';
const FN_OUT_UPDATE = 'out.update';

function withTimeout(promise, ms = 15000){
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('timeout')), ms);
    promise.then(v => { clearTimeout(t); res(v); }, e => { clearTimeout(t); rej(e); });
  });
}

async function fetchJson(url, opts){
  const r = await withTimeout(fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...opts
  }), 15000);
  if (!r.ok) throw new Error('HTTP '+r.status);
  const text = await r.text();
  try { return JSON.parse(text); }
  catch (e){ console.error('[api] bad json', text); throw e; }
}

export async function apiCall(fn, payload = {}){
  if (!API_URL) throw new Error('API_URL not configured');
  const body = JSON.stringify({ fn, payload });
  const res = await fetchJson(API_URL, { body });
  if (res && res.ok) return res.data ?? res;
  if (res && res.error) throw new Error(res.error);
  return res;
}

/* ===== Lookups (cached) ===== */
let LOOKUPS = { projects:[], contractors:[], requesters:[], materials:[], units:[] };
export function getLookups(){ return LOOKUPS; }
export function pushLookup(key, value){
  LOOKUPS[key] = Array.from(new Set([...(LOOKUPS[key]||[]), value]));
  try{ localStorage.setItem('cache:lookups', JSON.stringify(LOOKUPS)); }catch{}
}
export async function preloadLookups(){
  // prefer live; fall back to cache if API fails
  try{
    const data = await apiCall(FN_LOOKUPS, {});
    if (data && typeof data === 'object'){
      LOOKUPS = { ...LOOKUPS, ...data };
      localStorage.setItem('cache:lookups', JSON.stringify(LOOKUPS));
      return LOOKUPS;
    }
    throw new Error('bad lookups');
  }catch(e){
    const raw = localStorage.getItem('cache:lookups');
    LOOKUPS = raw ? JSON.parse(raw) : LOOKUPS;
    return LOOKUPS;
  }
}

/* ===== Out tab endpoints ===== */
export async function outSearch(filters = {}, page = 1, per = 50){
  const data = await apiCall(FN_OUT_SEARCH, { filters, page, per });
  // Support both {rows,total} and {items,count}
  return {
    rows: data.rows || data.items || [],
    total: data.total ?? data.count ?? (Array.isArray(data) ? data.length : 0),
  };
}
export async function outUpdate(patch){
  const data = await apiCall(FN_OUT_UPDATE, patch);
  return data && (data.ok !== false);
}

/* ===== small UI helper ===== */
export function stockBadge(qty=0){
  const span = document.createElement('span');
  span.className = 'badge';
  span.textContent = String(qty);
  return span;
}
