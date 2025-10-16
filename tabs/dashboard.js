// tabs/dashboard.js
// Per-card skeletons that are cleared immediately after each section loads
// to avoid duplicate/lingering loading animations.

import { $, esc, apiGet, clampList, stockBadge, STR } from '../js/shared.js';

function card(titleHtml) {
  const s = document.createElement('section');
  s.className = 'card glass';
  s.innerHTML = `<h3>${titleHtml}</h3>`;
  return s;
}
function skeletonList(count = 5) {
  const c = document.createElement('div');
  c.className = 'list';
  for (let i=0;i<count;i++){
    const r = document.createElement('div');
    r.className = 'skeleton-row';
    r.innerHTML = `<div style="flex:1">
      <div class="skeleton-bar" style="width:58%"></div>
      <div class="skeleton-bar" style="width:42%;margin-top:6px"></div>
    </div><div class="skeleton-badge"></div>`;
    c.appendChild(r);
  }
  return c;
}
function listBox(id, limit=5){
  const box=document.createElement('div'); box.className='list'; box.id=id; box.dataset.limit=String(limit); return box;
}
function toggleRow(selector, S){
  const wrap = document.createElement('div');
  wrap.className = 'toggle';
  const b = document.createElement('button');
  b.type='button';
  b.setAttribute('data-toggle', selector);
  b.textContent = S.showMore;
  wrap.appendChild(b);
  return wrap;
}
function safeEmpty(box, lang){
  box.innerHTML = `<div class="rowitem"><div class="meta">${lang==='th'?'ไม่มีข้อมูล':'No data'}</div></div>`;
  clampList(box);
}

export default async function mount({ root, lang }){
  const S = STR[lang];
  root.innerHTML = '';

  const grid = document.createElement('div');
  grid.className = 'dashboard-grid';

  // Build cards + content + per-card skeleton refs
  const sections = [
    { key:'low',  title:S.dashLow,          listId:'lowStockList',     fetch:() => apiGet('dash_LowStock', {}, { cacheTtlMs: 30_000 }), fill:fillLowStock },
    { key:'cons', title:S.dashTopContract,  listId:'topContractors',   fetch:() => apiGet('dash_TopContractors', {}, { cacheTtlMs: 30_000 }), fill:fillTopContractors },
    { key:'items',title:S.dashTopItems,     listId:'topItems',         fetch:() => apiGet('dash_TopItems', {}, { cacheTtlMs: 30_000 }), fill:fillTopItems },
    { key:'recent',title:S.dashRecent,      listId:'recentMoves',      fetch:() => apiGet('dash_Recent', {}, { cacheTtlMs: 20_000 }), fill:fillRecent },
  ];

  const nodes = {};

  for (const sec of sections){
    const c = card(sec.title);
    const list = listBox(sec.listId, 5);
    const togg = toggleRow(`#${sec.listId}`, S);
    const skel = skeletonList(5);

    c.appendChild(list);
    c.appendChild(togg);
    c.appendChild(skel);

    nodes[sec.key] = { card: c, list, skel };
    grid.appendChild(c);
  }

  // Purchase summary KPIs
  const purSummary = card(S.purTitle);
  purSummary.insertAdjacentHTML('beforeend', `
    <div class="kpis" style="display:flex;gap:.5rem;flex-wrap:wrap">
      <div class="kpi glass" style="flex:1 1 9rem;padding:.8rem;border-radius:.9rem;border:1px solid rgba(0,0,0,.08);background:#fff;box-shadow:var(--shadow-s)"><div class="v" id="kpiReq">0</div><div>${lang==='th'?'คำขอ':'Requests'}</div></div>
      <div class="kpi glass" style="flex:1 1 9rem;padding:.8rem;border-radius:.9rem;border:1px solid rgba(0,0,0,.08);background:#fff;box-shadow:var(--shadow-s)"><div class="v" id="kpiLines">0</div><div>${lang==='th'?'รายการ':'Lines'}</div></div>
      <div class="kpi glass" style="flex:1 1 9rem;padding:.8rem;border-radius:.9rem;border:1px solid rgba(0,0,0,.08);background:#fff;box-shadow:var(--shadow-s)"><div class="v" id="kpiUrgent">0</div><div>${lang==='th'?'ด่วน':'Urgent'}</div></div>
    </div>
  `);
  const purDetail = listBox('purSummaryDetail', 5);
  const purTogg = toggleRow('#purSummaryDetail', S);
  const purSkel = skeletonList(5);
  purSummary.appendChild(purDetail);
  purSummary.appendChild(purTogg);
  purSummary.appendChild(purSkel);

  // Purchase history
  const purHistory = card(lang==='th'?'ประวัติการขอจัดซื้อ':'Purchase History');
  const purHistList = listBox('purHistory', 5);
  const purHistTogg = toggleRow('#purHistory', S);
  const purHistSkel = skeletonList(5);
  purHistory.appendChild(purHistList);
  purHistory.appendChild(purHistTogg);
  purHistory.appendChild(purHistSkel);

  grid.appendChild(purSummary);
  grid.appendChild(purHistory);
  root.appendChild(grid);

  // Load each section and remove only THAT section's skeleton
  const run = async (sec, fillFn) => {
    const ref = nodes[sec];
    if (!ref) return;
    try{
      const data = await sections.find(s=>s.key===sec).fetch();
      fillFn(data, ref.list, S, lang);
    }catch{
      safeEmpty(ref.list, lang);
    }finally{
      ref.skel.remove(); // clear that card's skeleton
    }
  };

  await Promise.all([
    run('low', fillLowStock),
    run('cons', fillTopContractors),
    run('items', fillTopItems),
    run('recent', fillRecent),
    (async ()=>{
      try{
        const s = await apiGet('pur_Summary', {}, { cacheTtlMs: 15_000 });
        $('#kpiReq').textContent = (s && s.requests) ? s.requests : 0;
        $('#kpiLines').textContent = (s && s.lines) ? s.lines : 0;
        $('#kpiUrgent').textContent = (s && s.urgent) ? s.urgent : 0;
      }catch{} finally { purSkel.remove(); }
    })(),
    (async ()=>{
      try{
        const hist = await apiGet('pur_History', {}, { cacheTtlMs: 20_000 });
        fillPurHistory(hist, purHistList, lang);
      }catch{ safeEmpty(purHistList, lang); }
      finally { purHistSkel.remove(); }
    })()
  ]);

  // Clamp controls
  root.querySelectorAll('.toggle button').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const sel = btn.getAttribute('data-toggle');
      const list = root.querySelector(sel);
      if (!list) return;
      const expanded = list.dataset.expanded === 'true';
      Array.from(list.children).forEach((el, i)=>{
        el.style.display = expanded ? (i < Number(list.dataset.limit||'5') ? '' : 'none') : '';
      });
      list.dataset.expanded = expanded ? 'false' : 'true';
      btn.textContent = expanded ? S.showMore : S.showLess;
    });
  });
}

function fillLowStock(list, box, S, lang){
  box.innerHTML = '';
  if (!list || !list.length){
    box.innerHTML = `<div class="rowitem"><span>${lang==='th'?'ไม่มีรายการใกล้หมด 🎉':'No low stock 🎉'}</span></div>`;
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
}
function fillTopContractors(list, box, lang){
  box.innerHTML = '';
  (list||[]).forEach(x=>{
    const row=document.createElement('div'); row.className='rowitem';
    row.innerHTML = '<div><strong>'+esc(x.contractor||'(unknown)')+'</strong><div class="meta">'+(lang==='th'?'ปริมาณ ':'Qty ')+(x.qty||0)+'</div></div>';
    box.appendChild(row);
  });
  clampList(box);
}
function fillTopItems(list, box){
  box.innerHTML = '';
  (list||[]).forEach(x=>{
    const row=document.createElement('div'); row.className='rowitem';
    row.innerHTML = '<div><strong>'+esc(x.name)+'</strong><div class="meta">Used • '+esc(x.qty)+'</div></div>';
    box.appendChild(row);
  });
  clampList(box);
}
function fillRecent(rows, box){
  box.innerHTML = '';
  (rows||[]).forEach(x=>{
    const row=document.createElement('div'); row.className='rowitem';
    row.innerHTML = '<div><strong>'+esc(x.type)+' • '+esc(x.item)+'</strong><div class="meta">'+esc(x.ts)+' — '+esc(x.doc)+' • Qty '+esc(x.qty)+'</div></div>';
    box.appendChild(row);
  });
  clampList(box);
}
function fillPurHistory(rows, box, lang){
  box.innerHTML='';
  (rows||[]).forEach(x=>{
    const row=document.createElement('div'); row.className='rowitem';
    row.innerHTML = '<div><strong>'+esc(x.docNo)+' • '+esc(x.project||'-')+'</strong>'+
                    '<div class="meta">'+esc(x.ts)+' • '+(lang==='th'?'ครบกำหนด ':'NeedBy ')+esc(x.needBy||'-')+' • '+esc(x.priority||'-')+' • '+esc(x.status||'-')+'</div>'+
                    '<div class="meta">'+(lang==='th'?'จำนวนบรรทัด ':'Lines ')+esc(x.lines)+' • '+(lang==='th'?'ปริมาณรวม ':'Qty ')+esc(x.totalQty)+' • 👷 '+esc(x.contractor||'-')+' • 🙋 '+esc(x.requester||'-')+'</div></div>';
    box.appendChild(row);
  });
  clampList(box);
}