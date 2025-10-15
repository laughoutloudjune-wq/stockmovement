// js/tabs/adjust.js
import { h, $, openPicker, toast } from "../ui.js";
import { apiPost } from "../api.js";

function lineADJ(STR, lang){
  const card = h("div", { class:"line" });
  const name = h("input", { readOnly:true, placeholder: STR[lang].searchPh, "data-picker":"materials" });
  const qty = h("input", { type:"number", step:"any", placeholder:"±", inputmode:"decimal" });
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

export function renderAdjust(container, ctx){
  const { STR, state } = ctx; const S = STR[state.lang];
  const wrap = h("section", { id:"panel-adjust" }, [
    h("div", { class:"card glass" }, [
      h("h3", {}, [S.adjTitle]),
      h("div", { class:"lines", id:"adjLines" }),
      h("div", { class:"inline-actions" }, [
        h("button", { class:"btn", type:"button", onClick:()=> document.querySelector("#adjLines").appendChild(lineADJ(STR, state.lang)) }, S.btnAdd),
        h("button", { class:"btn", type:"button", onClick:()=> resetAdj() }, S.btnReset),
        h("button", { class:"btn primary", type:"button", onClick:()=> submitAdj(ctx) }, S.btnSubmit),
      ]),
    ]),
  ]);
  wrap.querySelector("#adjLines").appendChild(lineADJ(STR, state.lang));
  return wrap;
}

function resetAdj(){ const box=document.querySelector("#adjLines"); box.innerHTML=""; box.appendChild(lineADJ({ th:{searchPh:"พิมพ์เพื่อค้นหา…"}, en:{searchPh:"Type to search…"} }, "th")); }

async function submitAdj(ctx){
  const { state } = ctx;
  const payload = { type:"ADJUST", lines: collectLines(document.querySelector("#panel-adjust")) };
  if (!payload.lines.length) return toast(state.lang==="th"?"กรุณาเพิ่มรายการ":"Add at least one line");
  try{
    const res = await apiPost("submitMovementBulk", payload);
    if (res && res.ok){ toast(`${state.lang==="th"?"บันทึกแล้ว":"Saved"} • ${res.docNo||""}`); resetAdj(); }
    else toast((res && res.message) || (state.lang==="th"?"เกิดข้อผิดพลาด":"Error"));
  }catch(e){ toast(state.lang==="th"?"เกิดข้อผิดพลาด":"Error"); }
}
