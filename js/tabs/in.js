// js/tabs/in.js
import { h, $, openPicker, toast } from "../ui.js";
import { apiPost } from "../api.js";

function todayStr(){ const d=new Date(); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,"0"); const day=String(d.getDate()).padStart(2,"0"); return `${y}-${m}-${day}`; }

function lineIN(STR, lang){
  const card = h("div", { class:"line" });
  const name = h("input", { readOnly:true, placeholder: STR[lang].searchPh, "data-picker":"materials" });
  const qty = h("input", { type:"number", min:"0", step:"any", placeholder:"0", inputmode:"decimal" });
  const grid = h("div", { class:"grid" }, [name, qty]);
  const actions = h("div", { class:"actions" }, [ h("button", { type:"button", class:"btn", style:"flex:0 0 auto", onClick:()=>card.remove() }, "×") ]);
  name.addEventListener("click", ()=> openPicker(name, "materials"));
  card.appendChild(grid); card.appendChild(actions);
  return card;
}

function collectLines(container){
  const out=[];
  container.querySelectorAll(".line").forEach(c=>{
    const name=c.querySelector('input[data-picker="materials"]'); const qty=c.querySelector('input[type="number"]');
    const n = name? name.value.trim() : ""; const q = Number(qty?qty.value:0)||0;
    if (n) out.push({ name:n, qty:q, spec:"" });
  });
  return out;
}

export function renderIn(container, ctx){
  const { STR, state } = ctx; const S = STR[state.lang];
  const wrap = h("section", { id:"panel-in" }, [
    h("div", { class:"card glass" }, [
      h("h3", {}, [S.inTitle]),
      h("div", { class:"row" }, [
        h("div", {}, [h("label", {}, [S.inDate]), h("input", { id:"InDate", type:"date", style:"min-width:12rem" })]),
      ]),
      h("div", { class:"lines", id:"inLines" }),
      h("div", { class:"inline-actions" }, [
        h("button", { class:"btn", type:"button", onClick:()=> document.querySelector("#inLines").appendChild(lineIN(STR, state.lang)) }, S.btnAdd),
        h("button", { class:"btn", type:"button", onClick:()=> resetIn() }, S.btnReset),
        h("button", { class:"btn primary", type:"button", onClick:()=> submitIn(ctx) }, S.btnSubmit),
      ]),
    ]),
  ]);
  wrap.querySelector("#InDate").value = todayStr();
  wrap.querySelector("#inLines").appendChild(lineIN(STR, state.lang));
  return wrap;
}

function resetIn(){ const box=document.querySelector("#inLines"); box.innerHTML=""; box.appendChild(lineIN({ th:{searchPh:"พิมพ์เพื่อค้นหา…"}, en:{searchPh:"Type to search…"} }, "th")); document.querySelector("#InDate").value = todayStr(); }

async function submitIn(ctx){
  const { state } = ctx;
  const payload = { type:"IN", date: document.querySelector("#InDate").value.trim(), lines: collectLines(document.querySelector("#panel-in")) };
  if (!payload.lines.length) return toast(state.lang==="th"?"กรุณาเพิ่มรายการ":"Add at least one line");
  try{
    const res = await apiPost("submitMovementBulk", payload);
    if (res && res.ok){ toast(`${state.lang==="th"?"บันทึกแล้ว":"Saved"} • ${res.docNo||""}`); resetIn(); }
    else toast((res && res.message) || (state.lang==="th"?"เกิดข้อผิดพลาด":"Error"));
  }catch(e){ toast(state.lang==="th"?"เกิดข้อผิดพลาด":"Error"); }
}
