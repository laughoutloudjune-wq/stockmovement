// js/shared.js (minimal, valid)
export const API_URL = window.API_URL || "";

export const $  = (q, r = document) => r.querySelector(q);
export const $$ = (q, r = document) => Array.from(r.querySelectorAll(q));

export function toast(msg) {
  let el = $('#toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.textContent = msg || '';
  el.classList.add('show');
  setTimeout(()=> el.classList.remove('show'), 2000);
}

export function currentLang(){
  const saved = localStorage.getItem('lang');
  return saved || (navigator.language?.startsWith('th') ? 'th' : 'th');
}
export function applyLangTexts(lang){
  localStorage.setItem('lang', lang);
}

export function setBtnLoading(btn, isLoading){
  if (!btn) return;
  btn.disabled = !!isLoading;
  btn.classList.toggle('loading', !!isLoading);
}

export function cleanOldCache(){
  // no-op stub for now
}

export const STR = {
  th: { tabs: { dash: 'สรุป', out:'จ่ายออก', in:'รับเข้า', adj:'ปรับปรุง', pur:'ขอจัดซื้อ' } },
  en: { tabs: { dash: 'Dashboard', out:'Out', in:'In', adj:'Adjust', pur:'Purchase' } },
};

// Picker stubs so bindPickerInputs doesn't explode later if called
export function bindPickerInputs(root=document, lang='th'){
  // no-op for now; real implementation can be wired later
}

// Dummy lookups
let _lookups = { projects: [], contractors: [], requesters: [], materials: [] };
export function getLookups(){ return _lookups; }

export async function preloadLookups(){
  // Load from localStorage or leave defaults
  try{
    const raw = localStorage.getItem('cache:lookups');
    if (raw) _lookups = JSON.parse(raw);
  }catch{}
  return _lookups;
}

// API helpers (stubs)
export async function apiGet(fn, payload=null){ return { ok: true, fn, payload }; }

// Small UI helpers
export function stockBadge(qty=0){
  const span = document.createElement('span');
  span.className = 'badge';
  span.textContent = String(qty);
  return span;
}
