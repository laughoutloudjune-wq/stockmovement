import { reactive } from 'vue';
import { db } from './firebase.js';
import { collection, getDocs } from 'firebase/firestore';

export const todayStr = () => new Date().toISOString().split("T")[0];

// 2. Global State (Reactive)
export const LOOKUPS = reactive({ 
  MATERIALS: [], 
  PROJECTS: [], 
  PROJECT_META: {},
  CONTRACTORS: [], 
  REQUESTERS: [] 
});

// 4. Data Loading Logic (NOW USING FIREBASE)
export async function preloadLookups(force = false) {
  try {
    // Parallel Fetch from Firestore
    const [m, p, c, r] = await Promise.all([
      getDocs(collection(db, 'materials')),
      getDocs(collection(db, 'projects')),
      getDocs(collection(db, 'contractors')),
      getDocs(collection(db, 'requesters'))
    ]);

    // Map Materials to Object {name, stock, min}
    const matList = m.docs.map(d => ({ 
        name: d.data().name, 
        stock: Number(d.data().stock || 0),
        min: Number(d.data().min || 0)
    })).sort((a,b) => a.name.localeCompare(b.name));

    const projMeta = {};
    const projList = p.docs
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
    const contList = c.docs.map(d => d.data().name).sort();
    const reqList  = r.docs.map(d => d.data().name).sort();

    // Update Reactive State
    LOOKUPS.MATERIALS.splice(0, LOOKUPS.MATERIALS.length, ...matList);
    LOOKUPS.PROJECTS.splice(0, LOOKUPS.PROJECTS.length, ...projList);
    Object.keys(LOOKUPS.PROJECT_META).forEach(k => delete LOOKUPS.PROJECT_META[k]);
    Object.entries(projMeta).forEach(([k, v]) => LOOKUPS.PROJECT_META[k] = v);
    LOOKUPS.CONTRACTORS.splice(0, LOOKUPS.CONTRACTORS.length, ...contList);
    LOOKUPS.REQUESTERS.splice(0, LOOKUPS.REQUESTERS.length, ...reqList);

    console.log("✅ Lookups refreshed from Firebase");
  } catch (e) {
    console.error("❌ Failed to load lookups from Firebase:", e);
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
    tabs: { dash: "สรุป", out: "จ่ายออก", in: "รับเข้า", adj: "ปรับปรุง", pur: "ขอจัดซื้อ", report: "รายงาน", settings: "ตั้งค่า" },
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
    tabs: { dash: "Dashboard", out: "OUT", in: "IN", adj: "ADJUST", pur: "Purchase", report: "Report", settings: "Settings" },
    dashLow: "Low Stock", dashTopContract: "Top Contractors", dashTopItems: "Top Items",
    noLow: "No low stock 🎉", pick: "Search...", pickAdd: "Search or Add...", loading: "Loading...",
    btnSubmit: "Submit", btnAdd: "Add Line",
    inTitle: "Stock In", inDate: "Date Received",
    outTitle: "Stock Out", outDate: "Date Issued", proj: "Project", contractor: "Contractor", requester: "Requester", note: "Note",
    purProj: "Project", purNeedBy: "Need By", purContractor: "Contractor", purPriority: "Priority", purNote: "Note", purOlder: "History",
    reportTitle: "Report", reportGen: "Generate"
  }
};
