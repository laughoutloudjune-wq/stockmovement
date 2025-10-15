// js/ui.js
export const $ = (q, root=document) => root.querySelector(q);
export const $$ = (q, root=document) => Array.prototype.slice.call(root.querySelectorAll(q));

export function h(tag, attrs={}, children=[]){
  const el = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs||{})){
    if (k==="class") el.className = v;
    else if (k==="style") el.style.cssText = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v);
  }
  (Array.isArray(children)?children:[children]).forEach(c=>{
    if (c==null) return;
    if (typeof c === "string") el.appendChild(document.createTextNode(c));
    else el.appendChild(c);
  });
  return el;
}

export function toast(msg){
  const t = $("#toast"); if (!t) return;
  t.textContent = msg; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"), 3600);
}

export function skeletonRow(n=3){
  const frag = document.createDocumentFragment();
  for (let i=0;i<n;i++) frag.appendChild(h("div", { class:"skeleton" }));
  return frag;
}

export function stockBadge(stock, min){
  const b = h("span", { class:"badge" }, [isNaN(stock)||stock==null?"-":String(stock)]);
  if (stock<=0 || (min!=null && stock<=Number(min||0))) b.classList.add("red");
  else if (min!=null && stock<=2*Number(min||0)) b.classList.add("yellow");
  else b.classList.add("green");
  return b;
}

let pickerSources = {
  materials: () => [], projects: () => [], contractors: () => [], requesters: () => []
};
let quickAddHandlers = {
  contractors: null, requesters: null
};

export function setPickerSources(sources, handlers={}){
  pickerSources = { ...pickerSources, ...(sources||{}) };
  quickAddHandlers = { ...quickAddHandlers, ...(handlers||{}) };
}

export function openPicker(targetInput, sourceKey){
  const overlay = $("#pickerOverlay"); if (!overlay) return;
  const list = $("#pickerList"); const search = $("#pickerSearch");
  const addBtn = $("#pickerAdd"); const addText = $("#pickerAddText");
  overlay.dataset.targetId = targetInput.id || "";
  overlay.dataset.sourceKey = sourceKey;
  search.value = ""; renderPickerList("", sourceKey, list, addBtn, addText);
  overlay.style.display = "flex"; overlay.classList.add("open");
  setTimeout(()=>search && search.focus(), 20);
}

export function closePicker(){
  const overlay = $("#pickerOverlay"); if (!overlay) return;
  overlay.classList.remove("open"); overlay.style.display = "none";
  overlay.dataset.targetId = ""; overlay.dataset.sourceKey = "";
}

function renderPickerList(query, sourceKey, listEl, addBtn, addText){
  const all = (pickerSources[sourceKey] ? pickerSources[sourceKey]() : []) || [];
  const q = (query||"").toLowerCase().trim();
  const list = q ? all.filter(v=> String(v).toLowerCase().includes(q)) : all.slice();
  listEl.innerHTML = "";
  if (!list.length){ addBtn.classList.remove("hidden"); addText.textContent = query||""; }
  else addBtn.classList.add("hidden");
  list.forEach(v=>{
    const row = h("div", { class:"pick-row" }, [h("strong",{},[v])]);
    row.addEventListener("click", ()=>{
      const overlay = $("#pickerOverlay");
      const targetId = overlay.dataset.targetId; const target = targetId ? document.getElementById(targetId) : null;
      if (target){ target.value = v; target.dispatchEvent(new Event("change")); }
      closePicker();
    });
    listEl.appendChild(row);
  });
}

document.addEventListener("input", (e)=>{
  if (e.target && e.target.id === "pickerSearch"){
    const overlay = $("#pickerOverlay"); if (!overlay) return;
    const sourceKey = overlay.dataset.sourceKey;
    renderPickerList(e.target.value, sourceKey, $("#pickerList"), $("#pickerAdd"), $("#pickerAddText"));
  }
});
document.getElementById("pickerCancel")?.addEventListener("click", closePicker);
document.getElementById("pickerOverlay")?.addEventListener("click", (e)=>{ if (e.target.id==="pickerOverlay") closePicker(); });

document.getElementById("pickerAdd")?.addEventListener("click", async ()=>{
  const overlay = $("#pickerOverlay"); if (!overlay) return;
  const search = $("#pickerSearch"); const text = (search.value||"").trim(); if (!text) return;
  const sourceKey = overlay.dataset.sourceKey;
  try{
    if (sourceKey==="contractors" && typeof quickAddHandlers.contractors === "function"){
      await quickAddHandlers.contractors(text);
    } else if (sourceKey==="requesters" && typeof quickAddHandlers.requesters === "function"){
      await quickAddHandlers.requesters(text);
    } else {
      toast("เพิ่มในชีทมาสเตอร์ก่อน");
    }
    const targetId = overlay.dataset.targetId; const target = targetId ? document.getElementById(targetId) : null;
    if (target){ target.value = text; target.dispatchEvent(new Event("change")); }
  }catch(e){ toast("เกิดข้อผิดพลาด"); }
  closePicker();
});
