// js/tabs/dashboard.js
import { h, $, skeletonRow, stockBadge } from "../ui.js";
import { apiGet } from "../api.js";

function clampList(listEl){
  const max = Number(listEl.dataset.limit || "5");
  const items = listEl.children;
  for (let i=0;i<items.length;i++) items[i].style.display = i<max ? "" : "none";
  listEl.dataset.expanded = "false";
}

function toggleBtn(sel, STR, lang){
  const btn = h("div", { class:"toggle" }, [
    h("button", { type:"button", onClick:(e)=>{
      const list = $(sel); if (!list) return;
      const expanded = list.dataset.expanded === "true";
      const items = list.children;
      for (let i=0;i<items.length;i++)
        items[i].style.display = expanded ? (i<Number(list.dataset.limit||"5") ? "" : "none") : "";
      list.dataset.expanded = expanded ? "false" : "true";
      e.target.textContent = expanded ? STR[lang].showMore : STR[lang].showLess;
    }}, STR[lang].showMore)
  ]);
  return btn;
}

export function renderDashboard(container, ctx){
  const { STR, state } = ctx;
  const S = STR[state.lang];
  const wrap = h("section", { id:"panel-dashboard", class:"dash-grid" });

  const lowCard = h("div", { class:"card glass" }, [
    h("h3", {}, [S.dashLow]),
    h("div", { class:"list", id:"lowStockList", "data-limit":"5" }, [skeletonRow(3)]),
    toggleBtn("#lowStockList", STR, state.lang),
  ]);
  const topContract = h("div", { class:"card glass" }, [
    h("h3", {}, [S.dashTopContract]),
    h("div", { class:"list", id:"topContractors", "data-limit":"5" }, [skeletonRow(3)]),
    toggleBtn("#topContractors", STR, state.lang),
  ]);
  const topItems = h("div", { class:"card glass" }, [
    h("h3", {}, [S.dashTopItems]),
    h("div", { class:"list", id:"topItems", "data-limit":"5" }, [skeletonRow(3)]),
    toggleBtn("#topItems", STR, state.lang),
  ]);
  const recent = h("div", { class:"card glass dash-span-2" }, [
    h("h3", {}, [S.dashRecent]),
    h("div", { class:"list", id:"recentMoves", "data-limit":"8" }, [skeletonRow(4)]),
    toggleBtn("#recentMoves", STR, state.lang),
  ]);
  const kpi = h("div", { class:"card glass dash-span-2" }, [
    h("h3", {}, [S.purTitle]),
    h("div", { class:"kpis" }, [
      h("div", { class:"kpi glass" }, [h("div", { class:"v", id:"kpiReq" }, ["0"]), h("div", {}, ["คำขอ"])]),
      h("div", { class:"kpi glass" }, [h("div", { class:"v", id:"kpiLines" }, ["0"]), h("div", {}, ["รายการ"])]),
      h("div", { class:"kpi glass" }, [h("div", { class:"v", id:"kpiUrgent" }, ["0"]), h("div", {}, ["ด่วน"])]),
    ]),
    h("div", { class:"list", id:"purSummaryDetail", "data-limit":"5" }, [skeletonRow(2)]),
    toggleBtn("#purSummaryDetail", STR, state.lang),
  ]);
  const hist = h("div", { class:"card glass dash-span-2" }, [
    h("h3", {}, [state.lang==="th" ? "ประวัติการขอจัดซื้อ" : "Purchasing History"]),
    h("div", { class:"list", id:"purHistory", "data-limit":"10" }, [skeletonRow(3)]),
    toggleBtn("#purHistory", STR, state.lang),
  ]);

  [lowCard, topContract, topItems, recent, kpi, hist].forEach(c=> wrap.appendChild(c));
  container.appendChild(wrap);

  (async()=>{
    try{
      const low = await apiGet("dash_LowStock", {}, { retries:1 });
      const box = $("#lowStockList"); box.innerHTML="";
      if (!low || !low.length){
        box.appendChild(h("div", { class:"rowitem" }, [S.noLow]));
      }else{
        low.forEach(x=>{
          const row = h("div", { class:"rowitem" });
          const left = h("div", {}, [
            h("div", {}, [h("strong", {}, [x.name])]),
            h("div", { class:"meta" }, ["Min ", x.min==null? "-" : String(x.min)])
          ]);
          const right = stockBadge(Number(x.stock), Number(x.min));
          row.appendChild(left); row.appendChild(right); box.appendChild(row);
        });
      }
      clampList(box);
    }catch(e){}

    try{
      const list = await apiGet("dash_TopContractors", {}, { retries:1 });
      const box = $("#topContractors"); box.innerHTML="";
      (list||[]).forEach(x=>{
        box.appendChild(h("div", { class:"rowitem" }, [
          h("div", {}, [h("strong", {}, [x.contractor||"(unknown)"]), h("div", { class:"meta" }, ["Qty ", x.qty||0])])
        ]));
      });
      clampList(box);
    }catch(e){}

    try{
      const list = await apiGet("dash_TopItems", {}, { retries:1 });
      const box = $("#topItems"); box.innerHTML="";
      (list||[]).forEach(x=>{
        box.appendChild(h("div", { class:"rowitem" }, [
          h("div", {}, [h("strong", {}, [x.name]), h("div", { class:"meta" }, ["Used • ", String(x.qty)])])
        ]));
      });
      clampList(box);
    }catch(e){}

    try{
      const rows = await apiGet("dash_Recent", {}, { retries:1 });
      const box = $("#recentMoves"); box.innerHTML="";
      (rows||[]).forEach(x=>{
        box.appendChild(h("div", { class:"rowitem" }, [
          h("div", {}, [h("strong", {}, [`${x.type} • ${x.item}`]), h("div", { class:"meta" }, [`${x.ts} — ${x.doc} • Qty ${x.qty}`])])
        ]));
      });
      clampList(box);
    }catch(e){}

    try{
      const s = await apiGet("pur_Summary", {}, { retries:1 });
      $("#kpiReq").textContent = (s && s.requests) ? s.requests : 0;
      $("#kpiLines").textContent = (s && s.lines) ? s.lines : 0;
      $("#kpiUrgent").textContent = (s && s.urgent) ? s.urgent : 0;

      const rows = await apiGet("pur_History", {}, { retries:1 });
      const sum = $("#purSummaryDetail"); sum.innerHTML="";
      (rows||[]).forEach(x=>{
        sum.appendChild(h("div", { class:"rowitem" }, [
          h("div", {}, [
            h("strong", {}, [`${x.docNo} • ${x.project||"-"}`]),
            h("div", { class:"meta" }, [`👷 ${x.contractor||"-"} • 🙋 ${x.requester||"-"}`]),
            h("div", { class:"meta" }, [`🗓 ${x.ts} → 📆 ${x.needBy||"-"}`]),
          ])
        ]));
      });
      clampList(sum);

      const box = $("#purHistory"); box.innerHTML="";
      (rows||[]).forEach(x=>{
        box.appendChild(h("div", { class:"rowitem" }, [
          h("div", {}, [
            h("strong", {}, [`${x.docNo} • ${x.project||"-"}`]),
            h("div", { class:"meta" }, [`${x.ts} • NeedBy ${x.needBy||"-"} • ${x.priority||"-"} • ${x.status||"-"}`]),
            h("div", { class:"meta" }, [`Lines ${x.lines} • Qty ${x.totalQty} • 👷 ${x.contractor||"-"} • 🙋 ${x.requester||"-"}`]),
          ])
        ]));
      });
      clampList(box);
    }catch(e){}
  })();
}
