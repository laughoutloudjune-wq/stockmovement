// js/main.js
import { $, h, setPickerSources } from "./ui.js";
import { apiGet } from "./api.js";
import { renderDashboard } from "./tabs/dashboard.js";
import { renderOut } from "./tabs/out.js";
import { renderIn } from "./tabs/in.js";
import { renderAdjust } from "./tabs/adjust.js";
import { renderPurchase } from "./tabs/purchase.js";

const state = {
  lang:"th",
  tab:"dashboard",
  materials:[], projects:[], contractors:[], requesters:[],
};

export const STR = {
  th:{
    title:"ระบบสต็อกวัสดุ",
    tabs:{ dash:"สรุป", out:"จ่ายออก", in:"รับเข้า", adj:"ปรับปรุง", pur:"ขอจัดซื้อ" },
    searchPh:"พิมพ์เพื่อค้นหา…", pick:"ค้นหาหรือเลือก", pickAdd:"เลือกหรือเพิ่มใหม่",
    proj:"โครงการ / สถานที่", contractor:"ผู้รับเหมา", requester:"ผู้ขอเบิก", note:"หมายเหตุ",
    outTitle:"จ่ายออก", outDate:"วันที่", inTitle:"รับเข้า", inDate:"วันที่รับ", adjTitle:"ปรับปรุงสต็อก",
    btnAdd:"＋ เพิ่ม", btnReset:"ล้าง", btnSubmit:"บันทึก",
    dashLow:"สต็อกใกล้หมด", dashTopContract:"ผู้รับเหมาที่ใช้บ่อย", dashTopItems:"วัสดุยอดใช้", dashRecent:"ความเคลื่อนไหวล่าสุด",
    purTitle:"ขอจัดซื้อ", purProj:"โครงการ / สถานที่", purNeedBy:"ต้องการภายใน (วัน)", purContractor:"ผู้รับเหมา",
    purPriority:"ความเร่งด่วน", purNote:"หมายเหตุคำขอ", showMore:"ดูเพิ่มเติม", showLess:"ย่อ",
    noLow:"ไม่มีรายการใกล้หมด 🎉", saved:"บันทึกแล้ว", error:"เกิดข้อผิดพลาด",
  },
  en:{
    title:"Inventory",
    tabs:{ dash:"Dashboard", out:"OUT", in:"IN", adj:"ADJUST", pur:"PURCHASING" },
    searchPh:"Type to search…", pick:"Search or pick", pickAdd:"Pick or add",
    proj:"Project / Location", contractor:"Contractor", requester:"Requester", note:"Note",
    outTitle:"Material OUT", outDate:"Date", inTitle:"Material IN", inDate:"Date received", adjTitle:"Adjust",
    btnAdd:"＋ Add", btnReset:"Reset", btnSubmit:"Submit",
    dashLow:"Low stock", dashTopContract:"Top contractors (usage)", dashTopItems:"Top items", dashRecent:"Recent movements",
    purTitle:"Purchasing Request", purProj:"Project / Location", purNeedBy:"Need by (date)", purContractor:"Contractor",
    purPriority:"Priority", purNote:"Request note", showMore:"Show more", showLess:"Show less",
    noLow:"No low stock 🎉", saved:"Saved", error:"Error",
  }
};

function renderHeader(){
  const S = STR[state.lang];
  return h("header", {}, [
    h("h1", {}, [S.title]),
    h("div", { class:"spacer" }),
    h("div", { class:"lang" }, [
      h("button", { class: state.lang==="th"?"active":"", onClick:()=>{ state.lang="th"; renderApp(); } }, "ไทย"),
      h("button", { class: state.lang==="en"?"active":"", onClick:()=>{ state.lang="en"; renderApp(); } }, "EN"),
    ])
  ]);
}

function renderTabs(){
  const S = STR[state.lang];
  return h("div", { class:"tabs glass" }, [
    h("button", { class: state.tab==="dashboard"?"active":"", onClick:()=>showTab("dashboard") }, S.tabs.dash),
    h("button", { class: state.tab==="out"?"active":"", onClick:()=>showTab("out") }, S.tabs.out),
    h("button", { class: state.tab==="in"?"active":"", onClick:()=>showTab("in") }, S.tabs.in),
    h("button", { class: state.tab==="adjust"?"active":"", onClick:()=>showTab("adjust") }, S.tabs.adj),
    h("button", { class: state.tab==="purchase"?"active":"", onClick:()=>showTab("purchase") }, S.tabs.pur),
  ]);
}

function showTab(tab){ state.tab = tab; renderApp(); }

async function loadLookups(){
  try{
    const [m,p,c,r] = await Promise.all([
      apiGet("listMaterials", {}, { retries:1 }),
      apiGet("listProjects", {}, { retries:1 }),
      apiGet("listContractors", {}, { retries:1 }),
      apiGet("listRequesters", {}, { retries:1 }),
    ]);
    state.materials = (m||[]).map(String);
    state.projects = (p||[]).map(String);
    state.contractors = (c||[]).map(String);
    state.requesters = (r||[]).map(String);
  }catch(e){
    console.warn("Lookup load failed", e);
  }
  setPickerSources({
    materials:()=>state.materials,
    projects:()=>state.projects,
    contractors:()=>state.contractors,
    requesters:()=>state.requesters,
  }, {
    contractors: async(name)=>{},
    requesters: async(name)=>{},
  });
}

function renderApp(){
  const app = document.getElementById("app"); app.innerHTML="";
  const container = h("div", { class:"container" });
  container.appendChild(renderHeader());
  container.appendChild(renderTabs());

  const ctx = { STR, state };
  if (state.tab==="dashboard") renderDashboard(container, ctx);
  if (state.tab==="out") container.appendChild(renderOut(container, ctx));
  if (state.tab==="in") container.appendChild(renderIn(container, ctx));
  if (state.tab==="adjust") container.appendChild(renderAdjust(container, ctx));
  if (state.tab==="purchase") container.appendChild(renderPurchase(container, ctx));

  app.appendChild(container);
}

(async function(){
  await loadLookups();
  renderApp();
  console.log("App mounted ✅");
})();
