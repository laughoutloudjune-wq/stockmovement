import { reactive } from 'vue';
import { db } from './firebase.js';
import { collection, onSnapshot } from 'firebase/firestore';

export const todayStr = () => new Date().toISOString().split("T")[0];

/** Same rules everywhere: picker badges, IN/OUT/Adjust line previews */
export function materialStockStyle(stock, min) {
  const s = Number(stock || 0);
  const m = Number(min ?? 0);
  let color = 'bg-green-100 text-green-700';
  if (s <= 0 || s <= m) color = 'bg-red-100 text-red-700';
  else if (s <= 2 * m) color = 'bg-yellow-100 text-yellow-700';
  return { val: s, color };
}

export function materialStockBadgeClass(stock, min) {
  return materialStockStyle(stock, min).color;
}

// 2. Global State (Reactive)
export const LOOKUPS = reactive({ 
  MATERIALS: [], 
  PROJECTS: [], 
  PROJECT_META: {},
  CONTRACTORS: [], 
  REQUESTERS: [] 
});

// 4. Data Loading Logic (REALTIME)
export let lookupsUnsubscribers = [];

export function setupRealtimeLookups() {
  // Clear old listeners if any
  lookupsUnsubscribers.forEach(unsub => unsub());
  lookupsUnsubscribers = [];

  const unsubM = onSnapshot(collection(db, 'materials'), (snap) => {
    const matList = snap.docs.map(d => ({ 
        name: d.data().name, 
        stock: Number(d.data().stock || 0),
        min: Number(d.data().min || 0)
    })).sort((a,b) => a.name.localeCompare(b.name));
    LOOKUPS.MATERIALS.splice(0, LOOKUPS.MATERIALS.length, ...matList);
  }, e => console.error("Materials sync error:", e));

  const unsubP = onSnapshot(collection(db, 'projects'), (snap) => {
    const projMeta = {};
    const projList = snap.docs
      .map(d => d.data())
      .filter(x => x && x.name)
      .map(x => {
        const subs = Array.isArray(x.subProjects)
          ? x.subProjects.map(s => String(s).trim()).filter(Boolean)
          : [];
        projMeta[x.name] = subs;
        return x.name;
      })
      .sort();
    LOOKUPS.PROJECTS.splice(0, LOOKUPS.PROJECTS.length, ...projList);
    Object.keys(LOOKUPS.PROJECT_META).forEach(k => delete LOOKUPS.PROJECT_META[k]);
    Object.entries(projMeta).forEach(([k, v]) => LOOKUPS.PROJECT_META[k] = v);
  }, e => console.error("Projects sync error:", e));

  const unsubC = onSnapshot(collection(db, 'contractors'), (snap) => {
    const contList = snap.docs.map(d => d.data().name).sort();
    LOOKUPS.CONTRACTORS.splice(0, LOOKUPS.CONTRACTORS.length, ...contList);
  }, e => console.error("Contractors sync error:", e));

  const unsubR = onSnapshot(collection(db, 'requesters'), (snap) => {
    const reqList = snap.docs.map(d => d.data().name).sort();
    LOOKUPS.REQUESTERS.splice(0, LOOKUPS.REQUESTERS.length, ...reqList);
  }, e => console.error("Requesters sync error:", e));

  lookupsUnsubscribers.push(unsubM, unsubP, unsubC, unsubR);
  console.log("✅ Realtime lookups initialized");
}

export async function preloadLookups(force = false) {
  // No-op for backward compatibility
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
    tabs: { dash: "สรุป", out: "จ่ายออก", in: "รับเข้า", adj: "ปรับปรุง", pur: "ขอจัดซื้อ", report: "รายงาน", settings: "ตั้งค่า" },
    dashLow: "สต็อกใกล้หมด", dashTopContract: "ผู้รับเหมาใช้บ่อย", dashTopItems: "วัสดุใช้บ่อย",
    noLow: "ไม่มีรายการใกล้หมด 🎉", pick: "ค้นหา...", pickAdd: "ค้นหาหรือเพิ่ม...", loading: "กำลังโหลด...",
    btnSubmit: "บันทึก", btnAdd: "เพิ่มรายการ", 
    inTitle: "รับเข้าวัสดุ", inDate: "วันที่รับเข้า",
    adjSys: "ในระบบ", adjPhysical: "นับจริง", adjHint: "นับสต็อกจริง ระบบจะปรับเป็นตัวเลขนี้และบันทึกผลต่างในรายงาน",
    outTitle: "เบิกจ่ายวัสดุ", outDate: "วันที่เบิก", proj: "โครงการ", subProj: "โครงการย่อย", contractor: "ผู้รับเหมา", requester: "ผู้เบิก", note: "หมายเหตุ", lineNote: "หมายเหตุรายตัว...", history: "ประวัติ",
    purProj: "โครงการ", purNeedBy: "วันที่ต้องการ", purContractor: "ผู้รับเหมา", purPriority: "ความเร่งด่วน", purNote: "หมายเหตุ", purOlder: "ประวัติการขอซื้อ",
    reportTitle: "รายงาน", reportGen: "สร้างรายงาน"
  },
  en: {
    title: "Inventory System",
    tabs: { dash: "Dashboard", out: "OUT", in: "IN", adj: "ADJUST", pur: "Purchase", report: "Report", settings: "Settings" },
    dashLow: "Low Stock", dashTopContract: "Top Contractors", dashTopItems: "Top Items",
    noLow: "No low stock 🎉", pick: "Search...", pickAdd: "Search or Add...", loading: "Loading...",
    btnSubmit: "Submit", btnAdd: "Add Line",
    inTitle: "Stock In", inDate: "Date Received",
    adjSys: "System", adjPhysical: "Physical count", adjHint: "Enter the quantity you counted. Stock will be set to this value; the report shows system → counted and the difference.",
    outTitle: "Stock Out", outDate: "Date Issued", proj: "Project", subProj: "Sub Project", contractor: "Contractor", requester: "Requester", note: "Note", lineNote: "Line note...", history: "History",
    purProj: "Project", purNeedBy: "Need By", purContractor: "Contractor", purPriority: "Priority", purNote: "Note", purOlder: "History",
    reportTitle: "Report", reportGen: "Generate"
  }
};
