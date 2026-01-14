import { reactive } from 'vue';

// 1. API Configuration
export const API_URL = window.API_URL || "https://script.google.com/macros/s/AKfycbwEJDNfo63e0LjEZa-bhXmX3aY2PUs96bUBGz186T-pVlphV4NGNYxGT2tcx1DWgbDI/exec";

export const todayStr = () => new Date().toISOString().split("T")[0];

// 2. Global State (Made Reactive for Vue)
// This fixes the "does not provide export" error AND makes dropdowns update instantly
export const LOOKUPS = reactive({ 
  MATERIALS: [], 
  PROJECTS: [], 
  CONTRACTORS: [], 
  REQUESTERS: [] 
});

// 3. API Core Functions
const safeJson = (t) => { try { return JSON.parse(t); } catch { return { ok: false, error: "Bad JSON" }; } };

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

export async function apiGet(fn, payload = null, { cacheTtlMs = 0 } = {}) {
  const key = cacheTtlMs ? cacheKey(fn, payload) : null;
  const hit = key ? getCache(key, cacheTtlMs) : null;
  if (hit != null) return hit;

  const qs = new URLSearchParams({ fn });
  if (payload) qs.set("payload", JSON.stringify(payload));
  
  const res = await fetch(`${API_URL}?${qs.toString()}`);
  const text = await res.text();
  const data = norm(safeJson(text));
  
  if (cacheTtlMs && data != null) setCache(key, data);
  return data;
}

export async function apiPost(fn, body) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ fn, payload: body || {} }),
  });
  const text = await res.text();
  return norm(safeJson(text));
}

function norm(data) {
  if (data && Object.prototype.hasOwnProperty.call(data, "result")) return data.result;
  return data;
}

// 4. Data Loading Logic
export async function preloadLookups(force = false) {
  const opts = { cacheTtlMs: force ? 0 : 3600 * 1000 };
  
  // Fetch everything in parallel
  const [m, p, c, r] = await Promise.allSettled([
    apiGet("listMaterials", null, opts),
    apiGet("listProjects", null, opts),
    apiGet("listContractors", null, opts),
    apiGet("listRequesters", null, opts),
  ]);

  // Update the Reactive object (Vue will see these changes automatically)
  if(m.status === 'fulfilled' && Array.isArray(m.value)) {
    LOOKUPS.MATERIALS.splice(0, LOOKUPS.MATERIALS.length, ...m.value);
  }
  if(p.status === 'fulfilled' && Array.isArray(p.value)) {
    LOOKUPS.PROJECTS.splice(0, LOOKUPS.PROJECTS.length, ...p.value);
  }
  if(c.status === 'fulfilled' && Array.isArray(c.value)) {
    LOOKUPS.CONTRACTORS.splice(0, LOOKUPS.CONTRACTORS.length, ...c.value);
  }
  if(r.status === 'fulfilled' && Array.isArray(r.value)) {
    LOOKUPS.REQUESTERS.splice(0, LOOKUPS.REQUESTERS.length, ...r.value);
  }
}

// 5. Utilities
export function toast(msg) {
  const t = document.getElementById("toast");
  if(!t) return alert(msg);
  t.textContent = msg;
  t.style.opacity = '1';
  setTimeout(() => t.style.opacity = '0', 3000);
}

export function currentLang() {
  return (localStorage.getItem('app_lang') || 'th');
}

export const STR = {
  th: {
    title: "ระบบสต็อกวัสดุ", 
    tabs: { dash: "สรุป", out: "จ่ายออก", in: "รับเข้า", adj: "ปรับปรุง", pur: "ขอจัดซื้อ", report: "รายงาน" },
    dashLow: "สต็อกใกล้หมด", dashTopContract: "ผู้รับเหมาใช้บ่อย", dashTopItems: "วัสดุใช้บ่อย",
    noLow: "ไม่มีรายการใกล้หมด 🎉", pick: "ค้นหา...", pickAdd: "ค้นหาหรือเพิ่ม...", loading: "กำลังโหลด...",
    btnSubmit: "บันทึก", btnAdd: "เพิ่มรายการ", 
    inTitle: "รับเข้าวัสดุ", inDate: "วันที่รับเข้า",
    outTitle: "เบิกจ่ายวัสดุ", outDate: "วันที่เบิก", proj: "โครงการ", contractor: "ผู้รับเหมา", requester: "ผู้เบิก", note: "หมายเหตุ",
    purProj: "โครงการ", purNeedBy: "วันที่ต้องการ", purContractor: "ผู้รับเหมา", purPriority: "ความเร่งด่วน", purNote: "หมายเหตุ", purOlder: "ประวัติการขอซื้อ",
    reportTitle: "รายงาน", reportGen: "สร้างรายงาน"
  },
  en: {
    title: "Inventory System",
    tabs: { dash: "Dashboard", out: "OUT", in: "IN", adj: "ADJUST", pur: "Purchase", report: "Report" },
    dashLow: "Low Stock", dashTopContract: "Top Contractors", dashTopItems: "Top Items",
    noLow: "No low stock 🎉", pick: "Search...", pickAdd: "Search or Add...", loading: "Loading...",
    btnSubmit: "Submit", btnAdd: "Add Line",
    inTitle: "Stock In", inDate: "Date Received",
    outTitle: "Stock Out", outDate: "Date Issued", proj: "Project", contractor: "Contractor", requester: "Requester", note: "Note",
    purProj: "Project", purNeedBy: "Need By", purContractor: "Contractor", purPriority: "Priority", purNote: "Note", purOlder: "History",
    reportTitle: "Report", reportGen: "Generate"
  }
};
