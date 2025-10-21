// shared.js — utilities, fluid responsive tweaks, autocomplete, API helpers

export const $  = (q, r = document) => r.querySelector(q);
export const $$ = (q, r = document) => Array.from(r.querySelectorAll(q));
export const esc = (v) => v == null ? "" : String(v).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
export const todayStr = () => new Date().toISOString().split("T")[0];

export const STR = {
  th: {
    title: "สต๊อกวัสดุ",
    sub: "ระบบจัดการ",
    tabs: { dash:"แดชบอร์ด", out:"จ่ายออก", in:"รับเข้า", adj:"ปรับยอด", pur:"สั่งซื้อ" },
    emptyList: "ไม่พบรายการ",
  },
  en: {
    title: "Stock",
    sub: "Management",
    tabs: { dash:"Dashboard", out:"Out", in:"In", adj:"Adjust", pur:"Purchase" },
    emptyList: "No results",
  }
};

export function currentLang(){
  const attr = (document.documentElement.getAttribute("lang")||"th").toLowerCase();
  return (attr.startsWith("en") ? "en" : "th");
}

/* ======================= API helpers ======================= */
export const API_URL = window.API_URL || "";

const safeJson = (t) => { try { return JSON.parse(t); } catch { return { ok:false }; } };
const sleep = (ms) => new Promise(r=>setTimeout(r,ms));

function withTimeout(fetcher, ms){
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort("timeout"), ms);
  return fetcher(ctrl.signal).finally(()=>clearTimeout(t));
}
function norm(d){ if (d && Object.prototype.hasOwnProperty.call(d,"result")) return d.result; return d; }
function k(fn,p){ return `cache:${fn}:${p?JSON.stringify(p):""}`; }
function getCache(key, ttl){
  if (!ttl) return null;
  try{
    const raw = localStorage.getItem(key); if(!raw) return null;
    const {ts, data} = JSON.parse(raw);
    if (Date.now()-ts > ttl) return null;
    return data;
  }catch{return null;}
}
function setCache(key, data){ try{ localStorage.setItem(key, JSON.stringify({ts:Date.now(), data})) }catch{} }

export async function apiGet(fn, payload=null, {cacheTtlMs=0, timeoutMs=10000, retries=1, backoffMs=400}={}){
  const key = cacheTtlMs ? k(fn,payload) : null;
  const hit = key ? getCache(key, cacheTtlMs) : null;
  if (hit!=null) return hit;

  let last;
  for (let i=0;i<=retries;i++){
    try{
      const qs = new URLSearchParams({ fn });
      if (payload && Object.keys(payload).length) qs.set("payload", JSON.stringify(payload.payload || payload));
      const text = await withTimeout(sig=>fetch(API_URL+`?${qs.toString()}`, {signal:sig}).then(r=>r.text()), timeoutMs);
      const data = norm(safeJson(text));
      if (key && data!=null) setCache(key, data);
      return data;
    }catch(e){
      last = e; if (i<retries) await sleep(backoffMs*Math.pow(2,i));
    }
  }
  if (key){ const stale = getCache(key, Number.MAX_SAFE_INTEGER); if (stale!=null) return stale; }
  throw last || new Error("GET failed");
}

export async function apiPost(fn, body, {timeoutMs=15000}={}){
  const text = await withTimeout(sig=>fetch(API_URL, {
    method:"POST", headers:{"Content-Type":"text/plain;charset=utf-8"}, signal:sig,
    body: JSON.stringify({ fn, payload: body||{} })
  }).then(r=>r.text()), timeoutMs);
  return norm(safeJson(text));
}

/* ======================= UI helpers ======================= */
export function toast(msg){
  const t = $("#toast"); if(!t) return;
  t.textContent = msg; t.classList.add("show");
  setTimeout(()=> t.classList.remove("show"), 4200);
}

export function setBtnLoading(btn, on){
  if (!btn) return;
  // ensure spinner child
  let sp = btn.querySelector(".btn-spinner");
  let lbl = btn.querySelector(".btn-label");
  if (!sp){ sp = document.createElement("span"); sp.className="btn-spinner"; sp.innerHTML='<span class="spinner"></span>'; btn.appendChild(sp); }
  if (!lbl){ lbl = document.createElement("span"); lbl.className="btn-label"; lbl.textContent = btn.textContent.trim(); btn.textContent=""; btn.appendChild(lbl); }
  btn.classList.toggle("is-loading", !!on);
  sp.style.display = on ? "inline-flex" : "none";
  lbl.style.opacity = on ? ".6" : "1";
  btn.disabled = !!on;
}

/* ======================= Fluid Responsive ======================= */
export function installResponsiveTweaks(){
  if (document.getElementById("responsive-tweaks")) return;
  const s = document.createElement("style"); s.id = "responsive-tweaks";
  s.textContent = `
  :root{ --space-3: 12px; --control-h: 42px; }
  .row { display:flex; flex-wrap:wrap; gap:var(--space-3); }
  .row > * { flex:1 1 clamp(12rem, 28vw, 22rem); min-width: 10rem; }
  .line .grid { display:grid; grid-template-columns: minmax(12rem,2fr) minmax(7rem,.85fr) auto; gap:.75rem; align-items:end; }
  @media (max-width: 720px){ .line .grid{ grid-template-columns: 1fr 1fr auto; } }
  @media (max-width: 460px){ .line .grid{ grid-template-columns: 1fr; } .line .grid .line-actions{ display:flex; justify-content:flex-start; } }
  .line .meta-bar{ display:flex; align-items:center; gap:.5rem; flex-wrap:wrap; }
  .line .lnStock{ display:flex; align-items:center; gap:.4rem; }
  /* Autocomplete panel */
  .autocomplete-panel{ position:fixed; z-index:5001; background:var(--card,#fff); border:1px solid var(--border-weak,#e5e7eb); border-radius:10px; box-shadow:0 8px 28px rgba(0,0,0,.12); max-height:50vh; overflow:auto; }
  .autocomplete-item{ padding:.5rem .75rem; cursor:pointer; }
  .autocomplete-item:hover{ background:#f3f4f6; }
  /* Spinner */
  .spinner{ width:16px; height:16px; border:2px solid currentColor; border-right-color:transparent; border-radius:50%; display:inline-block; animation:spin .8s linear infinite; vertical-align:-3px; }
  @keyframes spin{ to{ transform:rotate(360deg) } }
  `;
  document.head.appendChild(s);
}

/* ======================= Lookups + Autocomplete ======================= */
let LOOKUPS = { MATERIALS: [], PROJECTS: [], CONTRACTORS: [], REQUESTERS: [] };
export function getLookups(){ return LOOKUPS; }

export async function preloadLookups(){
  const [m,p,c,r] = await Promise.allSettled([
    apiGet("listMaterials", null, {cacheTtlMs: 300000, retries:2}),
    apiGet("listProjects", null, {cacheTtlMs: 300000, retries:2}),
    apiGet("listContractors", null, {cacheTtlMs: 300000, retries:2}),
    apiGet("listRequesters", null, {cacheTtlMs: 300000, retries:2}),
  ]);
  LOOKUPS.MATERIALS   = Array.isArray(m.value) ? m.value : [];
  LOOKUPS.PROJECTS    = Array.isArray(p.value) ? p.value : [];
  LOOKUPS.CONTRACTORS = Array.isArray(c.value) ? c.value : [];
  LOOKUPS.REQUESTERS  = Array.isArray(r.value) ? r.value : [];
  return LOOKUPS;
}

function sourceFor(key){
  return key==="materials"   ? LOOKUPS.MATERIALS
       : key==="projects"    ? LOOKUPS.PROJECTS
       : key==="contractors" ? LOOKUPS.CONTRACTORS
       : key==="requesters"  ? LOOKUPS.REQUESTERS
       : [];
}

// Lightweight inline autocomplete (no external overlay dependency)
function attachAutocomplete(input, key){
  let panel=null;
  const ensurePanel = ()=>{
    if (panel && document.body.contains(panel)) return panel;
    panel = document.createElement("div");
    panel.className="autocomplete-panel";
    document.body.appendChild(panel);
    return panel;
  };
  const placePanel = ()=>{
    const r = input.getBoundingClientRect();
    panel.style.left = Math.round(r.left + window.scrollX) + "px";
    panel.style.top  = Math.round(r.bottom + window.scrollY + 4) + "px";
    panel.style.minWidth = Math.max(240, r.width) + "px";
  };
  const close = ()=>{ panel && panel.remove(); panel=null; document.removeEventListener("scroll",placePanel,true); };
  const pick = (val)=>{ input.value = val; input.dispatchEvent(new Event("change")); close(); };

  const render = (q="")=>{
    const list = sourceFor(key);
    const re = String(q).toLowerCase().trim();
    const choices = re ? list.filter(v=>String(v).toLowerCase().includes(re)) : list.slice(0, 50);
    panel.innerHTML = "";
    if (!choices.length){ const d=document.createElement("div"); d.className="autocomplete-item"; d.innerHTML = "<span class='meta'>— ไม่มีผลลัพธ์ —</span>"; panel.appendChild(d); return; }
    for (const v of choices){
      const it=document.createElement("div"); it.className="autocomplete-item"; it.textContent = v;
      it.addEventListener("mousedown", (e)=>{ e.preventDefault(); pick(v); });
      panel.appendChild(it);
    }
  };

  const open = async ()=>{
    ensurePanel(); placePanel(); document.addEventListener("scroll",placePanel, true);
    if (!sourceFor(key).length){ await preloadLookups(); }
    render(input.value);
  };

  input.addEventListener("focus", open);
  input.addEventListener("click", open);
  input.addEventListener("input", ()=>{ if(panel){ render(input.value); placePanel(); } });
  input.addEventListener("blur", ()=> setTimeout(close, 120));
  window.addEventListener("resize", ()=> panel && placePanel());
}

export function bindPickerInputs(root=document, LANG=currentLang()){
  // Bind all inputs with data-picker to our inline autocomplete
  $$('input[data-picker]', root).forEach(inp=>{
    const key = (inp.getAttribute('data-picker')||"").trim();
    if (!key) return;
    if (inp.__ac_bound) return;
    inp.__ac_bound = true;
    attachAutocomplete(inp, key);
  });
}

/* ======================= Little stock badge ======================= */
export function stockBadge(stock=0, min=0){
  const el = document.createElement("span");
  el.className = "badge";
  el.style.cssText = "display:inline-flex;align-items:center;gap:.35rem;border:1px solid var(--border-weak,#e5e7eb);border-radius:999px;padding:.15rem .5rem;font-size:.85rem";
  const dot = document.createElement("span");
  dot.style.cssText = "width:.5rem;height:.5rem;border-radius:50%";
  dot.style.background = stock<=0 ? "#ef4444" : (stock<=min ? "#f59e0b" : "#10b981");
  const txt = document.createElement("span");
  txt.textContent = String(stock);
  el.append(dot, txt);
  return el;
}
