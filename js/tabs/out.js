// js/tabs/out.js
import { h, $, setPickerSources, openPicker, toast } from "../ui.js";
import { apiGet, apiPost } from "../api.js";

function todayStr(){ const d=new Date(); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,"0"); const day=String(d.getDate()).padStart(2,"0"); return `${y}-${m}-${day}`; }

function lineOUT(STR, lang){
  const card = h("div", { class:"line" });
  const name = h("input", { id:`name-${Math.random().toString(36).slice(2)}`, readOnly:true, placeholder: STR[lang].searchPh, "data-picker":"materials" });
  const qty = h("input", { type:"number", min:"0", step:"any", placeholder:"0", inputmode:"decimal" });
  const grid = h("div", { class:"grid" }, [name, qty]);
  const actions = h("div", { class:"actions" }, [
    h("button", { type:"button", class:"btn", style:"flex:0 0 auto", onClick:()=>card.remove() }, "×"),
  ]);
  name.addEventListener("click", ()=> openPicker(name, "materials"));
  card.appendChild(grid); card.appendChild(actions);
  return card;
}

export function renderOut(container, ctx){
  const { STR, state } = ctx; const S = STR[state.lang];
  const wrap = h("section", { id:"panel-out" }, [
    h("div", { class:"card glass" }, [
      h("h3", {}, [S.outTitle]),
      h("div", { class:"row" }, [
        h("div", {}, [h("label", {}, [S.outDate]), h("input", { id:"OutDate", type:"date", style:"min-width:12rem" })]),
        h("div", {}, [h("label", {}, [S.proj]), h("input", { id:"ProjectInput", placeholder:S.pick, readOnly:true })]),
      ]),
      h("div", { class:"row" }, [
        h("div", {}, [h("label", {}, [S.contractor]), h("div", { style:"display:flex;gap:.5rem;align-items:center" }, [
          h("input", { id:"ContractorInput", placeholder:S.pickAdd, readOnly:true }),
          h("button", { class:"btn small", type:"button", onClick:()=>{ openPicker($("#ContractorInput"), "contractors"); } }, "＋"),
        ])]),
        h("div", {}, [h("label", {}, [S.requester]), h("div", { style:"display:flex;gap:.5rem;align-items:center" }, [
          h("input", { id:"RequesterInput", placeholder:S.pickAdd, readOnly:true }),
          h("button", { class:"btn small", type:"button", onClick:()=>{ openPicker($("#RequesterInput"), "requesters"); } }, "＋"),
        ])]),
      ]),
      h("div", { class:"row" }, [
        h("div", {}, [h("label", {}, [S.note]), h("input", { id:"Note", placeholder: state.lang==="th"?"ถ้ามี":"Optional" })]),
      ]),
      h("div", { class:"lines", id:"outLines" }),
    ]),
    h("div", { class:"toolbar", id:"toolbar-out" }, [
      h("button", { class:"btn", id:"addLineBtnOut", type:"button", onClick:()=> $("#outLines").appendChild(lineOUT(STR, state.lang)) }, S.btnAdd),
      h("button", { class:"btn small", id:"resetBtnOut", type:"button", onClick:()=> resetOut() }, S.btnReset),
      h("button", { class:"btn primary", id:"submitBtnOut", type:"button", onClick:()=> submitOut(ctx) }, S.btnSubmit),
    ]),
  ]);

  $("#OutDate", wrap).value = todayStr();
  $("#outLines", wrap).appendChild(lineOUT(STR, state.lang));

  $("#ProjectInput", wrap).addEventListener("click", ()=> openPicker($("#ProjectInput"), "projects"));
  return wrap;
}

function collectLines(container){
  const out=[];
  container.querySelectorAll(".line").forEach(c=>{
    const name=c.querySelector('input[data-picker="materials"]') || c.querySelector('input[readonly]');
    const qty = c.querySelector('input[type="number"]');
    const n = name ? name.value.trim() : ""; const q = Number(qty?qty.value:0)||0;
    if (n) out.push({ name:n, qty:q, spec:"" });
  });
  return out;
}

function resetOut(){
  const box = document.querySelector("#outLines"); box.innerHTML="";
  box.appendChild(lineOUT({ th:{searchPh:"พิมพ์เพื่อค้นหา…"}, en:{searchPh:"Type to search…"} }, "th"));
  const d=new Date(); document.querySelector("#OutDate").value=[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
  document.querySelector("#Note").value="";
}

async function submitOut(ctx){
  const { state } = ctx;
  const payload = {
    type:"OUT",
    project: document.querySelector("#ProjectInput").value.trim(),
    contractor: document.querySelector("#ContractorInput").value.trim(),
    requester: document.querySelector("#RequesterInput").value.trim(),
    note: document.querySelector("#Note").value.trim(),
    date: document.querySelector("#OutDate").value.trim(),
    lines: collectLines(document.querySelector("#panel-out"))
  };
  if (!payload.lines.length) return toast(state.lang==="th"?"กรุณาเพิ่มรายการ":"Add at least one line");
  try{
    const res = await apiPost("submitMovementBulk", payload);
    if (res && res.ok){ toast((state.lang==="th"?"บันทึกแล้ว • เอกสาร ":"Saved • Doc ")+(res.docNo||"")); resetOut(); }
    else toast((res && res.message) || (state.lang==="th"?"เกิดข้อผิดพลาด":"Error"));
  }catch(e){ toast(state.lang==="th"?"เกิดข้อผิดพลาด":"Error"); }
}
