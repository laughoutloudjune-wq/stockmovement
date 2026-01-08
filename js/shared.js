// js/shared.js
export const API_URL = window.API_URL || "https://script.google.com/macros/s/AKfycbwEJDNfo63e0LjEZa-bhXmX3aY2PUs96bUBGz186T-pVlphV4NGNYxGT2tcx1DWgbDI/exec";

export const $ = (q, r = document) => r.querySelector(q);
export const $$ = (q, r = document) => Array.from(r.querySelectorAll(q));
export const esc = (v) => v == null ? "" : String(v).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
export const todayStr = () => new Date().toISOString().split("T")[0];

/* ================= API core ================= */

const safeJson = (t) => { try { return JSON.parse(t); } catch { return { ok: false, error: "Bad JSON" }; } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function withTimeout(fetcher, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort("timeout"), ms);
  return fetcher(ctrl.signal).finally(() => clearTimeout(t));
}

function norm(data) {
  if (data && Object.prototype.hasOwnProperty.call(data, "result")) return data.result;
  return data;
}

function cacheKey(fn, payload) { return `cache:${fn}:${payload ? JSON.stringify(payload) : ""}`; }
function getCache(key, ttlMs) {
  if (!ttlMs) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > ttlMs) return null;
    return data;
  } catch { return null; }
}
function setCache(key, data) {
  try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch {}
}

export async function apiGet(fn, payload = null, { cacheTtlMs = 0, timeoutMs = 20000, retries = 1, backoffMs = 1000 } = {}) {
  const key = cacheTtlMs ? cacheKey(fn, payload) : null;
  const hit = key ? getCache(key, cacheTtlMs) : null;
  if (hit != null) return hit;

  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const qs = new URLSearchParams({ fn });
      if (payload && Object.keys(payload).length) qs.set("payload", JSON.stringify(payload.payload || payload));
      
      const resText = await withTimeout(
        (signal) => fetch(`${API_URL}?${qs.toString()}`, { method: "GET", signal }),
        timeoutMs
      ).then((r) => r.text());

      const data = norm(safeJson(resText));
      if (cacheTtlMs && data != null) setCache(key, data);
      return data;
    } catch (e) {
      lastErr = e;
      if (attempt < retries) await sleep(backoffMs * Math.pow(2, attempt));
    }
  }
  throw lastErr || new Error("GET failed");
}

export async function apiPost(fn, body, { timeoutMs = 25000 } = {}) {
  const resText = await withTimeout(
    (signal) => fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      signal,
      body: JSON.stringify({ fn, payload: body || {} }),
    }),
    timeoutMs
  ).then((r) => r.text());
  return norm(safeJson(resText));
}

/* ================= UI bits ================= */

export function toast(m) {
  const t = $("#toast"); if (!t) return;
  t.textContent = m;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 4000);
}

export const STR = {
  th: {
    title: "ระบบสต็อกวัสดุ", sub: "ระบบเบา เร็ว และใช้ง่าย",
    tabs: { dash: "สรุป", out: "จ่ายออก", in: "รับเข้า", adj: "ปรับปรุง", pur: "ขอจัดซื้อ", report: "รายงาน" },
    searchPh: "พิมพ์เพื่อค้นหา…", pick: "ค้นหาหรือเลือก", pickAdd: "เลือกหรือเพิ่มใหม่",
    proj: "โครงการ / สถานที่", contractor: "ผู้รับเหมา", requester: "ผู้ขอเบิก", note: "หมายเหตุ",
    outTitle: "จ่ายออก", outDate: "วันที่", inTitle: "รับเข้า", inDate: "วันที่รับ", adjTitle: "ปรับปรุงสต็อก",
    btnAdd: "＋ เพิ่ม", btnReset: "ล้าง", btnSubmit: "บันทึก", save: "บันทึก",
    dashLow: "สต็อกใกล้หมด", dashTopContract: "ผู้รับเหมาใช้บ่อย", dashTopItems: "วัสดุใช้บ่อย", dashRecent: "ความเคลื่อนไหวล่าสุด",
    purTitle: "ขอจัดซื้อ", purProj: "โครงการ / สถานที่", purNeedBy: "ต้องการภายใน (วันที่)", purContractor: "ผู้รับเหมา",
    purPriority: "ความเร่งด่วน", purNote: "หมายเหตุคำขอ", purOlder: "ขอจัดซื้อก่อนหน้า",
    reportTitle: "รายงานความเคลื่อนไหว", reportDateRange: "ช่วงเวลา", reportGen: "สร้างรายงาน",
    showMore: "ดูเพิ่มเติม", showLess: "ย่อ", noLow: "ไม่มีรายการใกล้หมด 🎉",
    stock: "คงเหลือ: ", prev: "คงเหลือก่อนหน้า: ", emptyList: "ไม่พบข้อมูล", retry: "ลองอีกครั้ง",
  },
  en: {
    title: "Inventory", sub: "Lightweight, fast, and friendly",
    tabs: { dash: "Dashboard", out: "OUT", in: "IN", adj: "ADJUST", pur: "PURCHASING", report: "REPORTS" },
    searchPh: "Type to search…", pick: "Search or pick", pickAdd: "Pick or add",
    proj: "Project / Location", contractor: "Contractor", requester: "Requester", note: "Note",
    outTitle: "Material OUT", outDate: "Date", inTitle: "Material IN", inDate: "Date received", adjTitle: "Adjust",
    btnAdd: "＋ Add", btnReset: "Reset", btnSubmit: "Submit", save: "Save",
    dashLow: "Low stock", dashTopContract: "Top contractors", dashTopItems: "Top items", dashRecent: "Recent movements",
    purTitle: "Purchasing Request", purProj: "Project / Location", purNeedBy: "Need by (date)", purContractor: "Contractor",
    purPriority: "Priority", purNote: "Request note", purOlder: "Older Requests",
    reportTitle: "Movement Report", reportDateRange: "Date Range", reportGen: "Generate",
    showMore: "Show more", showLess: "Show less", noLow: "No low stock 🎉",
    stock: "Stock: ", prev: "Prev: ", emptyList: "No data", retry: "Retry",
  },
};

export function applyLangTexts(LANG) {
  const S = STR[LANG];
  $("#t_title") && ($("#t_title").textContent = S.title);
  $("#t_sub") && ($("#t_sub").textContent = S.sub);
  const tabMap = [
    ["dashboard", S.tabs.dash], ["out", S.tabs.out], ["in", S.tabs.in],
    ["adjust", S.tabs.adj], ["purchase", S.tabs.pur], ["report", S.tabs.report]
  ];
  tabMap.forEach(([key, label]) => {
    const btn = document.querySelector(`.tabs [data-tab="${key}"]`);
    if (btn) btn.textContent = label;
  });
}

export function clampList(listEl) {
  const max = Number(listEl.dataset.limit || "5");
  const items = Array.from(listEl.children);
  items.forEach((el, i) => el.style.display = i < max ? "" : "none");
  listEl.dataset.expanded = "false";
}

export function setBtnLoading(btn, isLoading) {
  if (!btn) return;
  btn.classList.toggle("is-loading", !!isLoading);
  btn.disabled = !!isLoading;
}

export function stockBadge(stock, min) {
  const b = document.createElement("span");
  b.className = "badge";
  b.textContent = stock == null || isNaN(stock) ? "-" : stock;
  const n = Number(stock || 0);
  const m = Number(min || 0);
  if (n <= 0 || (min != null && n <= m)) b.classList.add("red");
  else if (min != null && n <= 2 * m) b.classList.add("yellow");
  else b.classList.add("green");
  return b;
}

/* ================= Picker & Lookups ================= */

let LOOKUPS = { MATERIALS: [], PROJECTS: [], CONTRACTORS: [], REQUESTERS: [] };

export function getLookups() { return LOOKUPS; }

export async function preloadLookups(force = false) {
  const opts = { cacheTtlMs: force ? 0 : 3600 * 1000, retries: 2 }; // 1 Hour Cache
  
  // Parallel fetch
  const [m, p, c, r] = await Promise.allSettled([
    apiGet("listMaterials", null, opts),
    apiGet("listProjects", null, opts),
    apiGet("listContractors", null, opts),
    apiGet("listRequesters", null, opts),
  ]);

  if(m.status === 'fulfilled') LOOKUPS.MATERIALS = Array.isArray(m.value) ? m.value : [];
  if(p.status === 'fulfilled') LOOKUPS.PROJECTS = Array.isArray(p.value) ? p.value : [];
  if(c.status === 'fulfilled') LOOKUPS.CONTRACTORS = Array.isArray(c.value) ? c.value : [];
  if(r.status === 'fulfilled') LOOKUPS.REQUESTERS = Array.isArray(r.value) ? r.value : [];

  return LOOKUPS;
}

// Picker DOM Elements
const pickerOverlay = $("#pickerOverlay");
const pickerList = $("#pickerList");
const pickerSearch = $("#pickerSearch");
const pickerAdd = $("#pickerAdd");
const pickerAddText = $("#pickerAddText");
const pickerCancel = $("#pickerCancel");

let currentTargetInput = null;
let currentSourceKey = null;

const sources = {
  materials: () => LOOKUPS.MATERIALS,
  projects: () => LOOKUPS.PROJECTS,
  contractors: () => LOOKUPS.CONTRACTORS,
  requesters: () => LOOKUPS.REQUESTERS,
};

function renderPickerList(query, LANG = "th") {
  const S = STR[LANG];
  const all = (sources[currentSourceKey] ? sources[currentSourceKey]() : []) || [];
  const q = (query || "").toLowerCase().trim();
  
  // OPTIMIZATION: Limit to 50 items if no search query to prevent DOM freeze
  let list;
  if (q) {
    list = all.filter((v) => String(v).toLowerCase().includes(q));
  } else {
    list = all.slice(0, 50); 
  }

  pickerList.innerHTML = "";

  if (!list.length && q) {
    const empty = document.createElement("div");
    empty.className = "rowitem";
    empty.style.justifyContent = "center";
    empty.innerHTML = `<div class="meta">${S.emptyList}</div>`;
    pickerList.appendChild(empty);
    pickerAdd.classList.remove("hidden");
    pickerAddText.textContent = query || "";
    return;
  } else {
    pickerAdd.classList.add("hidden");
  }

  // Fragment for speed
  const frag = document.createDocumentFragment();
  list.forEach((v) => {
    const row = document.createElement("div");
    row.className = "pick-row";
    row.textContent = v; // Safer than innerHTML
    row.addEventListener("click", () => {
      if (currentTargetInput) {
        currentTargetInput.value = v;
        currentTargetInput.dispatchEvent(new Event("change"));
        // Trigger generic input event for frameworks if needed
        currentTargetInput.dispatchEvent(new Event("input"));
      }
      closePicker();
    });
    frag.appendChild(row);
  });
  pickerList.appendChild(frag);
  
  // Helper for truncated list
  if (!q && all.length > 50) {
    const more = document.createElement("div");
    more.className = "meta";
    more.style.textAlign = "center";
    more.style.padding = "1rem";
    more.textContent = LANG === 'th' ? `...แสดง 50 จาก ${all.length} รายการ (พิมพ์เพื่อค้นหา)` : `...showing 50 of ${all.length} (type to search)`;
    pickerList.appendChild(more);
  }
}

export function openPicker(targetInput, sourceKey, LANG = "th") {
  currentTargetInput = targetInput;
  currentSourceKey = sourceKey;
  if (pickerSearch) pickerSearch.value = "";
  renderPickerList("", LANG);
  pickerOverlay.classList.add("open");
  pickerOverlay.setAttribute("aria-hidden", "false");
  setTimeout(() => pickerSearch && pickerSearch.focus(), 50);
}

export function closePicker() {
  pickerOverlay.classList.remove("open");
  pickerOverlay.setAttribute("aria-hidden", "true");
  currentTargetInput = null;
  currentSourceKey = null;
}

pickerSearch && pickerSearch.addEventListener("input", (e) => renderPickerList(e.target.value, currentLang()));
pickerCancel && pickerCancel.addEventListener("click", closePicker);
pickerOverlay && pickerOverlay.addEventListener("click", (e) => { if (e.target === pickerOverlay) closePicker(); });
// Handle Add new
pickerAdd && pickerAdd.addEventListener("click", async () => {
  const text = pickerSearch.value.trim();
  if (!text) return;
  const LANG = currentLang();
  
  const endpoints = { contractors: "addContractor", requesters: "addRequester" };
  const ep = endpoints[currentSourceKey];

  if (ep) {
    const ok = await apiGet(ep, { name: text });
    if (ok) {
      if(currentSourceKey === 'contractors') LOOKUPS.CONTRACTORS.push(text);
      if(currentSourceKey === 'requesters') LOOKUPS.REQUESTERS.push(text);
      
      toast(LANG === "th" ? "เพิ่มรายการแล้ว" : "Added entry");
      if (currentTargetInput) { 
        currentTargetInput.value = text; 
        currentTargetInput.dispatchEvent(new Event("change")); 
      }
      closePicker();
    }
  } else {
    toast(LANG === "th" ? "ต้องเพิ่มในฐานข้อมูลหลัก" : "Must add in Master DB");
  }
});

export function bindPickerInputs(root = document, LANG = "th") {
  $$('input[data-picker]', root).forEach((inp) => {
    // remove old listener to avoid dupes? simplified: just ensure we don't double bind if logic changes
    // simpler to just bind onclick. 
    inp.onclick = () => {
      const key = inp.getAttribute("data-picker");
      openPicker(inp, key, LANG);
    };
  });
}

export function currentLang() {
  const l = document.documentElement.lang || "th";
  return l.toLowerCase().startsWith("th") ? "th" : "en";
}

export function cleanOldCache(maxAgeMs = 3600 * 1000) { // 1 Hour default clean
  try {
    const now = Date.now();
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('cache:')) {
        try {
          const raw = localStorage.getItem(k);
          const obj = JSON.parse(raw);
          if (!obj.ts || (now - obj.ts) > maxAgeMs) localStorage.removeItem(k);
        } catch { localStorage.removeItem(k); }
      }
    }
  } catch {}
}
