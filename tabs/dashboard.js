import { $, STR, clampList, toggleClamp, setCardLoading, apiGet, stockBadge, esc } from '../js/shared.js';

export default async function mount({ root, lang }){
  const S = STR[lang];

  root.innerHTML = `
    <section class="dashboard-grid">
      <div class="card glass" id="card-low">
        <h3 id="t_dash_lowstock">${S.dashLow}</h3>
        <div class="list" id="lowStockList" data-limit="5"></div>
        <div class="toggle"><button type="button" data-toggle="#lowStockList">${S.showMore}</button></div>
      </div>

      <div class="card glass" id="card-topcontract">
        <h3 id="t_dash_topcontractors">${S.dashTopContract}</h3>
        <div class="list" id="topContractors" data-limit="5"></div>
        <div class="toggle"><button type="button" data-toggle="#topContractors">${S.showMore}</button></div>
      </div>

      <div class="card glass" id="card-topitems">
        <h3 id="t_dash_topitems">${S.dashTopItems}</h3>
        <div class="list" id="topItems" data-limit="5"></div>
        <div class="toggle"><button type="button" data-toggle="#topItems">${S.showMore}</button></div>
      </div>

      <div class="card glass span-2" id="card-recent">
        <h3 id="t_dash_recent">${S.dashRecent}</h3>
        <div class="list" id="recentMoves" data-limit="5"></div>
        <div class="toggle"><button type="button" data-toggle="#recentMoves">${S.showMore}</button></div>
      </div>

      <div class="card glass" id="card-pursum">
        <h3 id="t_pur_summary">${lang==='th'?'สรุปการขอจัดซื้อ':'Purchasing Summary'}</h3>
        <div class="kpis">
          <div class="kpi"><div class="v" id="kpiReq">0</div><div>${lang==='th'?'คำขอ':'Requests'}</div></div>
          <div class="kpi"><div class="v" id="kpiLines">0</div><div>${lang==='th'?'รายการ':'Lines'}</div></div>
          <div class="kpi"><div class="v" id="kpiUrgent">0</div><div>${lang==='th'?'ด่วน':'Urgent'}</div></div>
        </div>
        <div class="list" id="purSummaryDetail" data-limit="5"></div>
        <div class="toggle"><button type="button" data-toggle="#purSummaryDetail">${S.showMore}</button></div>
      </div>

      <div class="card glass span-2" id="card-purhist">
        <h3 id="t_pur_history">${lang==='th'?'ประวัติการขอจัดซื้อ':'Purchasing History'}</h3>
        <div class="list" id="purHistory" data-limit="5"></div>
        <div class="toggle"><button type="button" data-toggle="#purHistory">${S.showMore}</button></div>
      </div>
    </section>
  `;

  // Wire "show more/less"
  root.querySelectorAll('.toggle button').forEach(btn=>{
    btn.onclick = ()=> toggleClamp(btn, lang);
  });

  // Load cards with skeletons
  setCardLoading($('#card-low'), 4);
  setCardLoading($('#card-topcontract'), 4);
  setCardLoading($('#card-topitems'), 4);
  setCardLoading($('#card-recent'), 6);
  setCardLoading($('#card-pursum'), 3);
  setCardLoading($('#card-purhist'), 6);

  // Low stock
  apiGet('dash_LowStock').then(list=>{
    const box = $('#lowStockList'); box.innerHTML='';
    if (!list || !list.length){ 
      box.innerHTML = `<div class="rowitem"><span>${STR[lang].noLow}</span></div>`; 
      return clampList(box); 
    }
    list.forEach(x=>{
      const row=document.createElement('div'); row.className='rowitem';
      const left=document.createElement('div');
      const title=document.createElement('div'); title.innerHTML='<strong>'+esc(x.name)+'</strong>';
      const meta=document.createElement('div'); meta.className='meta'; meta.textContent='Min '+(x.min==null?'-':x.min);
      left.appendChild(title); left.appendChild(meta);
      const right=stockBadge(Number(x.stock), Number(x.min));
      row.appendChild(left); row.appendChild(right);
      box.appendChild(row);
    });
    clampList(box);
  });

  // Top contractors
  apiGet('dash_TopContractors').then(list=>{
    const box = $('#topContractors'); box.innerHTML='';
    (list||[]).forEach(x=>{
      const row=document.createElement('div'); row.className='rowitem';
      row.innerHTML = `<div><strong>${esc(x.contractor||'(unknown)')}</strong><div class="meta">Qty ${esc(x.qty||0)}</div></div>`;
      box.appendChild(row);
    });
    clampList(box);
  });

  // Top items
  apiGet('dash_TopItems').then(list=>{
    const box = $('#topItems'); box.innerHTML='';
    (list||[]).forEach(x=>{
      const row=document.createElement('div'); row.className='rowitem';
      row.innerHTML = `<div><strong>${esc(x.name)}</strong><div class="meta">${lang==='th'?'ใช้ไป • ':'Used • '}${esc(x.qty)}</div></div>`;
      box.appendChild(row);
    });
    clampList(box);
  });

  // Recent moves
  apiGet('dash_Recent').then(rows=>{
    const box = $('#recentMoves'); box.innerHTML='';
    (rows||[]).forEach(x=>{
      const row=document.createElement('div'); row.className='rowitem';
      row.innerHTML = `<div><strong>${esc(x.type)} • ${esc(x.item)}</strong><div class="meta">${esc(x.ts)} — ${esc(x.doc)} • Qty ${esc(x.qty)}</div></div>`;
      box.appendChild(row);
    });
    clampList(box);
  });

  // Purchasing summary + history
  apiGet('pur_Summary').then(s=>{
    $('#kpiReq').textContent = (s && s.requests) ? s.requests : 0;
    $('#kpiLines').textContent = (s && s.lines) ? s.lines : 0;
    $('#kpiUrgent').textContent = (s && s.urgent) ? s.urgent : 0;
  }).finally(()=>{
    apiGet('pur_History').then(rows=>{
      const sum = $('#purSummaryDetail'); sum.innerHTML='';
      (rows||[]).slice(0,5).forEach(x=>{
        const row=document.createElement('div'); row.className='rowitem';
        row.innerHTML = `<div><strong>${esc(x.docNo)} • ${esc(x.project||'-')}</strong>
          <div class="meta">👷 ${esc(x.contractor||'-')} • 🙋 ${esc(x.requester||'-')}</div>
          <div class="meta">🗓 ${esc(x.ts)} → 📆 ${esc(x.needBy||'-')}</div></div>`;
        sum.appendChild(row);
      });
      clampList(sum);
    });
  });

  apiGet('pur_History').then(rows=>{
    const box = $('#purHistory'); box.innerHTML='';
    (rows||[]).forEach(x=>{
      const row=document.createElement('div'); row.className='rowitem';
      row.innerHTML = `<div><strong>${esc(x.docNo)} • ${esc(x.project||'-')}</strong>
        <div class="meta">${esc(x.ts)} • ${(lang==='th'?'ต้องการภายใน ':'NeedBy ')}${esc(x.needBy||'-')} • ${esc(x.priority||'-')} • ${esc(x.status||'-')}</div>
        <div class="meta">${(lang==='th'?'รายการ ':'Lines ')}${esc(x.lines)} • ${(lang==='th'?'จำนวน ':'Qty ')}${esc(x.totalQty)} • 👷 ${esc(x.contractor||'-')} • 🙋 ${esc(x.requester||'-')}</div></div>`;
      box.appendChild(row);
    });
    clampList(box);
  });
}
