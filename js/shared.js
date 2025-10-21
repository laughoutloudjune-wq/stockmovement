// js/shared.js — SAFE core utilities with guards to prevent UI from disappearing

/* ========== Tiny DOM helpers ========== */
export const $  = (q, r=document) => r.querySelector(q);
export const $$ = (q, r=document) => Array.from(r.querySelectorAll(q));
export const esc = (v) => v == null ? "" : String(v).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
export const todayStr = () => new Date().toISOString().split("T")[0];

/* ========== i18n (kept for compatibility) ========== */
export const STR = {
  th: {
    title:"สต๊อกวัสดุ",
    sub:"ระบบจัดการ",
    tabs:{ dash:"แดชบอร์ด", out:"จ่ายออก", in:"รับเข้า", adj:"ปรับยอด", pur:"สั่งซื้อ" },
    emptyList:"ไม่พบรายการ"
  },
  en: {
    title:"Stock",
    sub:"Management",
    tabs:{ dash:"Dashboard", out:"Out", in:"In", adj:"Adjust", pur:"Purchase" },
    emptyList:"No results"
  }
};
export function currentLang(){
  const lang = (document.documentElement.getAttribute('lang')||'th').toLowerCase();
  return lang.startsWith('en') ? 'en' : 'th';
}
export function applyLangTexts(LANG=currentLang()){
  try {
    const S = STR[LANG];
    const map = [
      ["dashboard", S.tabs.dash],
      ["out",       S.tabs.out],
      ["in",        S.tabs.in],
      ["adjust",    S.tabs.adj],
      ["purchase",  S.tabs.pur],
    ];
    map.forEach(([key,label])=>{
      const el = document.querySelector(`.tabs [data-tab="${key}"]`);
      if (el) el.textContent = label;
    });
  } catch {}
}

/* ========== API helpers with retries (safe) ========== */
export const API_URL = window.API_URL || "";

const sleep = (ms)=> new Promise(r=>setTimeout(r,ms));
const safeJson = (t)=>{ try { return JSON.parse(t); } catch { return { ok:false, error:"Bad JSON" }; } };
const withTimeout = (fetcher, ms)=>{
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort("timeout"), ms);
  return fetcher(ctrl.signal).finally(()=>clearTimeout(t));
};
const normalize = (d)=> (d && Object.prototype.hasOwnProperty.call(d,'result')) ? d.result : d;

function cacheKey(fn,p){ return `cache:${fn}:${p?JSON.stringify(p):""}`; }
function getCache(key, ttl){
  if (!ttl) return null;
  try {
    const raw = localStorage.getItem(key); if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now()-ts > ttl) return null;
    return data;
  } catch { return null; }
}
function setCache(key, data){ try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })) } catch {} }

export async function apiGet(fn, payload=null, { cacheTtlMs=0, timeoutMs=10000, retries=1, backoffMs=400 }={}){
  const key = cacheTtlMs ? cacheKey(fn,payload) : null;
  const hit = key ? getCache(key, cacheTtlMs) : null;
  if (hit != null) return hit;

  let lastErr;
  for (let i=0;i<=retries;i++){
    try {
      const qs = new URLSearchParams({ fn });
      if (payload && Object.keys(payload).length) qs.set("payload", JSON.stringify(payload.payload || payload));
      const text = await withTimeout(sig => fetch(`${API_URL}?${qs.toString()}`, { signal:sig }).then(r=>r.text()), timeoutMs);
      const data = normalize(safeJson(text));
      if (key && data != null) setCache(key, data);
      return data;
    } catch(e){
      lastErr = e;
      if (i<retries) await sleep(backoffMs*Math.pow(2,i));
    }
  }
  if (key){
    const stale = getCache(key, Number.MAX_SAFE_INTEGER);
    if (stale != null) return stale;
  }
  throw lastErr || new Error('GET failed');
}

export async function apiPost(fn, payload, { timeoutMs=15000 }={}){
  const text = await withTimeout(sig => fetch(API_URL, {
    method:'POST', headers:{ 'Content-Type': 'text/plain;charset=utf-8' }, signal:sig,
    body: JSON.stringify({ fn, payload: payload || {} })
  }).then(r=>r.text()), timeoutMs);
  return normalize(safeJson(text));
}

/* ========== UI helpers ========== */
export function toast(msg){
  const t = $('#toast'); if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(()=> t.classList.remove('show'), 4200);
}
export function setBtnLoading(btn, on){
  if (!btn) return;
  let sp = btn.querySelector('.btn-spinner');
  let lbl = btn.querySelector('.btn-label');
  if (!sp){ sp = document.createElement('span'); sp.className='btn-spinner'; sp.innerHTML='<span class="spinner"></span>'; btn.appendChild(sp); }
  if (!lbl){
    lbl = document.createElement('span'); lbl.className='btn-label';
    const txt = btn.textContent.trim(); btn.textContent=''; lbl.textContent = txt || '…'; btn.prepend(lbl);
  }
  btn.classList.toggle('is-loading', !!on);
  sp.style.display = on ? 'inline-flex' : 'none';
  btn.disabled = !!on;
}
export function installResponsiveTweaks(){
  if (document.getElementById('responsive-tweaks')) return;
  const s = document.createElement('style'); s.id='responsive-tweaks';
  s.textContent = `
    :root{ --space-3:12px; --control-h:42px; }
    .row{ display:flex; flex-wrap:wrap; gap:var(--space-3) }
    .row > *{ flex:1 1 clamp(12rem, 28vw, 22rem); min-width:10rem }
    .line .grid{ display:grid; grid-template-columns: minmax(12rem,2fr) minmax(7rem,.85fr) auto; gap:.75rem; align-items:end }
    @media (max-width:720px){ .line .grid{ grid-template-columns: 1fr 1fr auto } }
    @media (max-width:460px){ .line .grid{ grid-template-columns: 1fr } .line .grid .line-actions{ display:flex; justify-content:flex-start } }
    .picker-popover, .picker-menu, .autocomplete-panel, .picker-dropdown { position: fixed; z-index: 5001; }
    .spinner{ width:16px; height:16px; border:2px solid currentColor; border-right-color:transparent; border-radius:50%; animation:spin .8s linear infinite }
    @keyframes spin{ to{ transform:rotate(360deg) } }
  `;
  document.head.appendChild(s);
}

/* ========== Lookups & autocomplete ========== */
let LOOKUPS = { MATERIALS: [], PROJECTS: [], CONTRACTORS: [], REQUESTERS: [] };
export function getLookups(){ return LOOKUPS; }

export async function preloadLookups(){
  const [m,p,c,r] = await Promise.allSettled([
    apiGet('listMaterials', null, { cacheTtlMs:300000, retries:2 }),
    apiGet('listProjects', null, { cacheTtlMs:300000, retries:2 }),
    apiGet('listContractors', null, { cacheTtlMs:300000, retries:2 }),
    apiGet('listRequesters', null, { cacheTtlMs:300000, retries:2 }),
  ]);
  LOOKUPS.MATERIALS   = Array.isArray(m.value) ? m.value : [];
  LOOKUPS.PROJECTS    = Array.isArray(p.value) ? p.value : [];
  LOOKUPS.CONTRACTORS = Array.isArray(c.value) ? c.value : [];
  LOOKUPS.REQUESTERS  = Array.isArray(r.value) ? r.value : [];
  return LOOKUPS;
}

/* Overlay-based picker (if DOM exists), otherwise no-op to avoid crashes */
const pickerOverlay = $('#pickerOverlay');
const pickerList    = $('#pickerList');
const pickerSearch  = $('#pickerSearch');
const pickerAdd     = $('#pickerAdd');
const pickerCancel  = $('#pickerCancel');
const pickerAddText = $('#pickerAddText');

let currentTargetInput = null;
let currentSourceKey = null;

const srcMap = {
  materials:   ()=> LOOKUPS.MATERIALS,
  projects:    ()=> LOOKUPS.PROJECTS,
  contractors: ()=> LOOKUPS.CONTRACTORS,
  requesters:  ()=> LOOKUPS.REQUESTERS,
};

function renderPickerList(query, LANG=currentLang()){
  if (!pickerList) return;
  const S = STR[LANG];
  const all = (srcMap[currentSourceKey] ? srcMap[currentSourceKey]() : []) || [];
  const q = (query||'').toLowerCase().trim();
  const list = q ? all.filter(v=>String(v).toLowerCase().includes(q)) : all.slice(0,150);
  pickerList.innerHTML = '';
  if (!list.length){
    const row = document.createElement('div');
    row.className='rowitem'; row.innerHTML = `<div class="meta">${S.emptyList}</div>`;
    pickerList.appendChild(row);
    if (pickerAdd && pickerAddText){
      pickerAdd.classList.remove('hidden'); pickerAddText.textContent = query || '';
    }
    return;
  }
  if (pickerAdd) pickerAdd.classList.add('hidden');
  list.forEach(v=>{
    const row = document.createElement('div');
    row.className='pick-row'; row.textContent = v;
    row.addEventListener('click', ()=>{
      if (currentTargetInput){ currentTargetInput.value = v; currentTargetInput.dispatchEvent(new Event('change')); }
      closePicker();
    });
    pickerList.appendChild(row);
  });
}

export async function openPicker(targetInput, sourceKey, LANG=currentLang()){
  if (!pickerOverlay || !pickerList){
    // No overlay present; silently do nothing to avoid breaking existing flows
    return;
  }
  currentTargetInput = targetInput;
  currentSourceKey = sourceKey;
  if (!srcMap[currentSourceKey] || !targetInput) return;
  if (pickerSearch) pickerSearch.value = '';
  if (!srcMap[currentSourceKey]().length) await preloadLookups();
  renderPickerList('', LANG);
  pickerOverlay.classList.add('open');
  pickerOverlay.setAttribute('aria-hidden','false');
  setTimeout(()=> pickerSearch && pickerSearch.focus(), 30);
}
export function closePicker(){
  if (!pickerOverlay) return;
  pickerOverlay.classList.remove('open');
  pickerOverlay.setAttribute('aria-hidden','true');
  currentTargetInput = null; currentSourceKey = null;
}
pickerSearch && pickerSearch.addEventListener('input', (e)=> renderPickerList(e.target.value, currentLang()));
pickerCancel && pickerCancel.addEventListener('click', closePicker);
pickerOverlay && pickerOverlay.addEventListener('click', (e)=>{ if (e.target === pickerOverlay) closePicker(); });
pickerAdd && pickerAdd.addEventListener('click', ()=> closePicker());

/* Bind inputs to open overlay on focus/click */
export function bindPickerInputs(root=document, LANG=currentLang()){
  $$('input[data-picker]', root).forEach(inp=>{
    const key = (inp.getAttribute('data-picker')||'').trim();
    if (!key) return;
    if (inp.__picker_bound) return;
    inp.__picker_bound = true;
    const open = ()=> openPicker(inp, key, LANG);
    inp.addEventListener('focus', open);
    inp.addEventListener('click', open);
  });
}

/* Compatibility stub (some code may import it) */
export function cleanOldCache(){ /* no-op */ }

/* Stock badge helper used by tabs */
export function stockBadge(stock=0, min=0){
  const el = document.createElement('span');
  el.className='badge';
  el.style.cssText='display:inline-flex;align-items:center;gap:.35rem;border:1px solid var(--border-weak,#e5e7eb);border-radius:999px;padding:.15rem .5rem;font-size:.85rem';
  const dot = document.createElement('span');
  dot.style.cssText='width:.5rem;height:.5rem;border-radius:50%';
  dot.style.background = stock<=0 ? '#ef4444' : (stock<=min ? '#f59e0b' : '#10b981');
  const txt = document.createElement('span'); txt.textContent = String(stock);
  el.append(dot, txt);
  return el;
}
