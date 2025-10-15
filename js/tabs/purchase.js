// js/tabs/purchase.js
import { h, $, openPicker, toast } from "../ui.js";
import { apiGet, apiPost } from "../api.js";

function todayStr(){ const d=new Date(); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,"0"); const day=String(d.getDate()).padStart(2,"0"); return `${y}-${m}-${day}`; }

function linePUR(STR, lang){
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

export function renderPurchase(container, ctx){
  const { STR, state } = ctx; const S = STR[state.lang];
  const wrap = h("section", { id:"panel-purchase" }, [
    h("div", { class:"card glass" }, [
      h("h3", {}, [S.purTitle]),
      h("div", { class:"row" }, [
        h("div", {}, [h("label", {}, [S.purProj]), h("input", { id:"PurProject", placeholder:S.pick, readOnly:true })]),
        h("div", {}, [h("label", {}, [S.purNeedBy]), h("input", { type:"date", id:"PurNeedBy", style:"min-width:12rem" })]),
      ]),
      h("div", { class:"row" }, [
        h("div", {}, [h("label", {}, [S.purContractor]), h("input", { id:"PurContractor", placeholder:S.pickAdd, readOnly:true })]),
        h("div", {}, [h("label", {}, [S.purPriority]), h("select", { id:"PurPriority" }, [
          h("option", { value:"Normal" }, state.lang==="th"?"ปกติ":"Normal"),
          h("option", { value:"Urgent" }, state.lang==="th"?"ด่วน":"Urgent"),
          h("option", { value:"Critical" }, state.lang==="th"?"วิกฤติ":"Critical"),
        ])]),
      ]),
      h("div", { class:"lines", id:"purLines" }),
      h("div", { class:"row" }, [
        h("div", {}, [h("label", {}, [S.purNote]), h("input", { id:"PurNote", placeholder: state.lang==="th" ? "บันทึกเพิ่มเติม (ถ้ามี)" : "Additional notes (optional)" })]),
      ]),
      h("div", { class:"inline-actions" }, [
        h("button", { class:"btn", type:"button", onClick:()=> document.querySelector("#purLines").appendChild(linePUR(STR, state.lang)) }, S.btnAdd),
        h("button", { class:"btn", type:"button", onClick:()=> resetPur() }, S.btnReset),
        h("button", { class:"btn primary", type:"button", onClick:()=> submitPur(ctx) }, S.btnSubmit),
      ]),
    ]),
    h("div", { class:"card glass", style:"margin-top:.25rem" }, [
      h("h3", {}, [state.lang==="th"?"คำขอเดิม":"Previous Requests"]),
      h("div", { class:"list", id:"purOlderList", "data-limit":"10" }, [h("div", { class:"skeleton" }), h("div", { class:"skeleton" })]),
    ]),
  ]);

  wrap.querySelector("#PurNeedBy").value = todayStr();
  wrap.querySelector("#purLines").appendChild(linePUR(STR, state.lang));
  wrap.querySelector("#PurProject").addEventListener("click", ()=> openPicker(document.querySelector("#PurProject"), "projects"));
  wrap.querySelector("#PurContractor").addEventListener("click", ()=> openPicker(document.querySelector("#PurContractor"), "contractors"));

  (async()=>{
    try{
      const rows = await apiGet("pur_History", {}, { retries:1 });
      const box = document.querySelector("#purOlderList"); box.innerHTML = "";
      (rows||[]).forEach(x=>{
        const row = h("div", { class:"rowitem" }, [
          h("div", {}, [
            h("strong", {}, [`${x.docNo} • ${x.project||"-"}`]),
            h("div", { class:"meta" }, [`${x.ts} • ${x.priority||"-"} • ${x.status||"-"}`]),
            h("div", { class:"meta" }, [`Lines ${x.lines} • Qty ${x.totalQty}`])
          ])
        ]);
        box.appendChild(row);
      });
    }catch(e){}
  })();

  return wrap;
}

function resetPur(){ const box=document.querySelector("#purLines"); box.innerHTML=""; box.appendChild(linePUR({ th:{searchPh:"พิมพ์เพื่อค้นหา…"}, en:{searchPh:"Type to search…"} }, "th")); document.querySelector("#PurNote").value=""; }

async function submitPur(ctx){
  const { state } = ctx;
  const payload = {
    type:"PURCHASE",
    project: document.querySelector("#PurProject").value.trim(),
    contractor: document.querySelector("#PurContractor").value.trim(),
    needBy: document.querySelector("#PurNeedBy").value.trim(),
    priority: document.querySelector("#PurPriority").value,
    note: document.querySelector("#PurNote").value.trim(),
    lines: collectLines(document.querySelector("#panel-purchase"))
  };
  if (!payload.lines.length) return toast(state.lang==="th"?"กรุณาเพิ่มรายการ":"Add at least one line");
  try{
    const res = await apiPost("submitPurchaseRequest", payload);
    if (res && res.ok){ toast((state.lang==="th"?"ส่งคำขอแล้ว • ":"Request sent • ")+(res.docNo||"")); resetPur(); }
    else toast((res && res.message) || (state.lang==="th"?"เกิดข้อผิดพลาด":"Error"));
  }catch(e){ toast(state.lang==="th"?"เกิดข้อผิดพลาด":"Error"); }
}
