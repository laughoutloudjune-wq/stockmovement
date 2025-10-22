// js/shared.js
// Robust API helpers, i18n, picker, caching, preload for lookups, and smart cache cleanup.

export const API_URL =
  window.API_URL ||
  "https://script.google.com/macros/s/AKfycbwEJDNfo63e0LjEZa-bhXmX3aY2PUs96bUBGz186T-pVlphV4NGNYxGT2tcx1DWgbDI/exec";

export const $  = (q, r = document) => r.querySelector(q);
export const $$ = (q, r = document) => Array.prototype.slice.call(r.querySelectorAll(q));
export const esc = (v) =>
  v == null ? "" : String(v).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
export const todayStr = () => new Date().toISOString().split("T")[0];

/* ================= API core with timeout + retry + cache ================= */

const safeJson = (t) => {
  try { return JSON.parse(t); } catch { return { ok: false, error: "Bad JSON" }; }
};
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

// Generic GET with retries and optional cache
export async function apiGet(fn, payload = null, { cacheTtlMs = 0, timeoutMs = 12000, retries = 2, backoffMs = 500 } = {}) {
  const key = cacheTtlMs ? cacheKey(fn, payload) : null;
  const hit = key ? getCache(key, cacheTtlMs) : null;
  if (hit != null) return hit;

  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const qs = new URLSearchParams({ fn });
      if (payload && Object.keys(payload).length) {
        qs.set("payload", JSON.stringify(payload.payload || payload));
      }
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
  if (key) {
    const stale = getCache(key, Number.MAX_SAFE_INTEGER);
    if (stale != null) return stale;
  }
  throw lastErr || new Error("GET failed");
}

export async function apiPost(fn, body, { timeoutMs = 15000 } = {}) {
  const resText = await withTimeout(
    (signal) =>
      fetch(API_URL, {
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
  setTimeout(() => t.classList.remove("show"), 4200);
}

export const STR = {
  th: {
    title: "ระบบสต็อกวัสดุ",
    sub: "ระบบเบา เร็ว และใช้ง่าย",
    tabs: { dash: "สรุป", out: "จ่ายออก", in: "รับเข้า", adj: "ปรับปรุง", pur: "ขอจัดซื้อ" },
    searchPh: "พิมพ์เพื่อค้นหา…", pick: "ค้นหาหรือเลือก", pickAdd: "เลือกหรือเพิ่มใหม่",
    proj: "โครงการ / สถานที่", contractor: "ผู้รับเหมา", requester: "ผู้ขอเบิก", note: "หมายเหตุ",
    outTitle: "จ่ายออก", outDate: "วันที่", inTitle: "รับเข้า", inDate: "วันที่รับ", adjTitle: "ปรับปรุงสต็อก",
    btnAdd: "＋ เพิ่ม", btnReset: "ล้าง", btnSubmit: "บันทึก", save: "บันทึก",
    dashLow: "สต็อกใกล้หมด", dashTopContract: "ผู้รับเหมาใช้บ่อย", dashTopItems: "วัสดุใช้บ่อย", dashRecent: "ความเคลื่อนไหวล่าสุด",
    purTitle: "ขอจัดซื้อ", purProj: "โครงการ / สถานที่", purNeedBy: "ต้องการภายใน (วันที่)", purContractor: "ผู้รับเหมา",
    purPriority: "ความเร่งด่วน", purNote: "หมายเหตุคำขอ", purOlder: "ขอจัดซื้อก่อนหน้า",
    showMore: "ดูเพิ่มเติม", showLess: "ย่อ", noLow: "ไม่มีรายการใกล้หมด 🎉",
    stock: "คงเหลือ: ", prev: "คงเหลือก่อนหน้า: ",
    emptyList: "ไม่มีข้อมูล",
    retry: "ลองอีกครั้ง",
  },
  en: {
    title: "Inventory",
    sub: "Lightweight, fast, and friendly",
    tabs: { dash: "Dashboard", out: "OUT", in: "IN", adj: "ADJUST", pur: "PURCHASING" },
    searchPh: "Type to search…", pick: "Search or pick", pickAdd: "Pick or add",
    proj: "Project / Location", contractor: "Contractor", requester: "Requester", note: "Note",
    outTitle: "Material OUT", outDate: "Date", inTitle: "Material IN", inDate: "Date received", adjTitle: "Adjust",
    btnAdd: "＋ Add", btnReset: "Reset", btnSubmit: "Submit", save: "Save",
    dashLow: "Low stock", dashTopContract: "Top contractors (usage)", dashTopItems: "Top items", dashRecent: "Recent movements",
    purTitle: "Purchasing Request", purProj: "Project / Location", purNeedBy: "Need by (date)", purContractor: "Contractor",
    purPriority: "Priority", purNote: "Request note", purOlder: "Older Requests",
    showMore: "Show more", showLess: "Show less", noLow: "No low stock 🎉",
    stock: "Stock: ", prev: "Prev: ",
    emptyList: "No data",
    retry: "Retry",
  },
};

export function applyLangTexts(LANG) {
  const S = STR[LANG];
  $("#t_title") && ($("#t_title").textContent = S.title);
  $("#t_sub") && ($("#t_sub").textContent = S.sub);
  const tabMap = [
    ["dashboard", S.tabs.dash],
    ["out", S.tabs.out],
    ["in", S.tabs.in],
    ["adjust", S.tabs.adj],
    ["purchase", S.tabs.pur],
  ];
  tabMap.forEach(([key, label]) => {
    const btn = document.querySelector(`.tabs [data-tab="${key}"]`);
    if (btn) btn.textContent = label;
  });
}

export function clampList(listEl) {
  const max = Number(listEl.dataset.limit || "5");
  const items = listEl.children;
  for (let i = 0; i < items.length; i++) items[i].style.display = i < max ? "" : "none";
  listEl.dataset.expanded = "false";
}
export function toggleClamp(btn, LANG) {
  const sel = btn.getAttribute("data-toggle");
  const list = $(sel);
  if (!list) return;
  const expanded = list.dataset.expanded === "true";
  const items = list.children;
  for (let i = 0; i < items.length; i++) items[i].style.display = expanded ? (i < Number(list.dataset.limit || "5") ? "" : "none") : "";
  list.dataset.expanded = expanded ? "false" : "true";
  btn.textContent = expanded ? (LANG === "th" ? "ดูเพิ่มเติม" : "Show more") : (LANG === "th" ? "ย่อ" : "Show less");
}

export function setBtnLoading(btn, isLoading) {
  if (!btn) return;
  btn.classList.toggle("is-loading", !!isLoading);
  btn.disabled = !!isLoading;
}

/* ================= Stock badge ================= */
export function stockBadge(stock, min) {
  const b = document.createElement("span");
  b.className = "badge";
  b.textContent = stock == null || isNaN(stock) ? "-" : stock;
  if (stock <= 0 || (min != null && stock <= Number(min || 0))) b.classList.add("red");
  else if (min != null && stock <= 2 * Number(min || 0)) b.classList.add("yellow");
  else b.classList.add("green");
  return b;
}

/* ================= Picker & Lookups ================= */

let LOOKUPS = {
  MATERIALS: [],
  PROJECTS: [],
  CONTRACTORS: [],
  REQUESTERS: [],
};

export function getLookups() { return LOOKUPS; }

export async function preloadLookups() {
  const [m, p, c, r] = await Promise.allSettled([
    apiGet("listMaterials", null, { cacheTtlMs: 5 * 60 * 1000, retries: 2 }),
    apiGet("listProjects",  null, { cacheTtlMs: 5 * 60 * 1000, retries: 2 }),
    apiGet("listContractors", null, { cacheTtlMs: 5 * 60 * 1000, retries: 2 }),
    apiGet("listRequesters",  null, { cacheTtlMs: 5 * 60 * 1000, retries: 2 }),
  ]);

  LOOKUPS.MATERIALS   = Array.isArray(m.value) ? m.value : [];
  LOOKUPS.PROJECTS    = Array.isArray(p.value) ? p.value : [];
  LOOKUPS.CONTRACTORS = Array.isArray(c.value) ? c.value : [];
  LOOKUPS.REQUESTERS  = Array.isArray(r.value) ? r.value : [];

  return LOOKUPS;
}

const pickerOverlay  = $("#pickerOverlay");
const pickerList     = $("#pickerList");
const pickerSearch   = $("#pickerSearch");
const pickerAdd      = $("#pickerAdd");
const pickerAddText  = $("#pickerAddText");
const pickerCancel   = $("#pickerCancel");

let currentTargetInput = null;
let currentSourceKey = null;

const sources = {
  materials:  () => LOOKUPS.MATERIALS,
  projects:   () => LOOKUPS.PROJECTS,
  contractors:() => LOOKUPS.CONTRACTORS,
  requesters: () => LOOKUPS.REQUESTERS,
};

function renderPickerList(query, LANG = "th") {
  const S = STR[LANG];
  const all = (sources[currentSourceKey] ? sources[currentSourceKey]() : []) || [];
  const q = (query || "").toLowerCase().trim();
  const list = q ? all.filter((v) => String(v).toLowerCase().includes(q)) : all.slice();
  pickerList.innerHTML = "";

  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "rowitem";
    empty.style.justifyContent = "space-between";
    empty.innerHTML = `<div class="meta">${S.emptyList}</div><button class="btn small" id="pickerRetry">${S.retry}</button>`;
    pickerList.appendChild(empty);
    const retryBtn = $("#pickerRetry", pickerList);
    retryBtn?.addEventListener("click", async () => {
      await preloadLookups();
      renderPickerList(pickerSearch.value, LANG);
    });
    pickerAdd.classList.remove("hidden");
    pickerAddText.textContent = query || "";
    return;
  } else {
    pickerAdd.classList.add("hidden");
  }

  list.forEach((v) => {
    const row = document.createElement("div");
    row.className = "pick-row";
    row.innerHTML = "<strong>" + esc(v) + "</strong>";
    row.addEventListener("click", () => {
      if (currentTargetInput) {
        currentTargetInput.value = v;
        currentTargetInput.dispatchEvent(new Event("change"));
      }
      closePicker();
    });
    pickerList.appendChild(row);
  });
}

export function openPicker(targetInput, sourceKey, LANG = "th") {
  currentTargetInput = targetInput;
  currentSourceKey = sourceKey;
  if (pickerSearch) pickerSearch.value = "";
  renderPickerList("", LANG);
  pickerOverlay.classList.add("open");
  pickerOverlay.setAttribute("aria-hidden", "false");
  setTimeout(() => pickerSearch && pickerSearch.focus(), 30);
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
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && pickerOverlay.classList.contains("open")) closePicker(); });

pickerAdd && pickerAdd.addEventListener("click", async () => {
  const text = pickerSearch.value.trim();
  if (!text) return;
  const LANG = currentLang();
  if (currentSourceKey === "contractors") {
    const ok = await apiGet("addContractor", { name: text });
    if (ok) {
      LOOKUPS.CONTRACTORS = Array.from(new Set([text, ...LOOKUPS.CONTRACTORS]));
      toast(LANG === "th" ? "เพิ่มผู้รับเหมาแล้ว" : "Added contractor");
    }
    if (currentTargetInput) { currentTargetInput.value = text; currentTargetInput.dispatchEvent(new Event("change")); }
    closePicker();
  } else if (currentSourceKey === "requesters") {
    const ok = await apiGet("addRequester", { name: text });
    if (ok) {
      LOOKUPS.REQUESTERS = Array.from(new Set([text, ...LOOKUPS.REQUESTERS]));
      toast(LANG === "th" ? "เพิ่มผู้ขอแล้ว" : "Added requester");
    }
    if (currentTargetInput) { currentTargetInput.value = text; currentTargetInput.dispatchEvent(new Event("change")); }
    closePicker();
  } else {
    toast(LANG === "th" ? "กรุณาเพิ่มในชีทมาสเตอร์" : "Use master sheet to add new entries");
    closePicker();
  }
});

export function bindPickerInputs(root = document, LANG = "th") {
  $$('input[data-picker]', root).forEach((inp) => {
    inp.addEventListener("click", () => {
      const key = inp.getAttribute("data-picker");
      openPicker(inp, key, LANG);
    });
  });
}

/* current language based on <html lang=""> or default 'th' */
export function currentLang() {
  const l = document.documentElement.lang || "th";
  return l.toLowerCase().startsWith("th") ? "th" : "en";
}

/* ===== smart cache cleanup: remove stale entries on load ===== */
export function cleanOldCache(maxAgeMs = 15 * 60 * 1000) {
  try {
    const now = Date.now();
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith('cache:')) continue;
      try {
        const raw = localStorage.getItem(k);
        const obj = raw ? JSON.parse(raw) : null;
        if (!obj || !obj.ts || (now - obj.ts) > maxAgeMs) toRemove.push(k);
      } catch {
        toRemove.push(k);
      }
    }
    toRemove.forEach(k => localStorage.removeItem(k));
  } catch {}
}