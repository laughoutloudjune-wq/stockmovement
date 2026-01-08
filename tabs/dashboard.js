// tabs/dashboard.js
import { $, esc, apiGet, clampList, stockBadge, STR, toast } from '../js/shared.js';

// --- Helpers ---
function card(titleHtml) {
  const s = document.createElement('section');
  s.className = 'card glass';
  s.innerHTML = `<h3>${titleHtml}</h3>`;
  return s;
}
function skeletonList(count = 5) {
  const c = document.createElement('div'); c.className = 'list';
  for (let i=0;i<count;i++){
    const r = document.createElement('div'); r.className = 'skeleton-row';
    r.innerHTML = `<div style="flex:1"><div class="skeleton-bar" style="width:58%"></div><div class="skeleton-bar" style="width:42%;margin-top:6px"></div></div><div class="skeleton-badge"></div>`;
    c.appendChild(r);
  }
  return c;
}
function listBox(id, limit=5){
  const box=document.createElement('div'); box.className='list'; box.id=id; box.dataset.limit=String(limit); return box;
}
function toggleRow(selector, S){
  const wrap = document.createElement('div'); wrap.className = 'toggle';
  const b = document.createElement('button'); b.type='button';
  b.setAttribute('data-toggle', selector); b.textContent = S.showMore;
  wrap.appendChild(b); return wrap;
}
function safeEmpty(box, lang){
  box.innerHTML = `<div class="rowitem"><div class="meta">${lang==='th'?'ไม่มีข้อมูล':'No data'}</div></div>`;
  clampList(box);
}

// --- Detail Popups ---
function showDetail(title, htmlContent) {
    // A simple reuse of toast or create a simple modal. 
    // For now, let's use a standard alert or a custom modal if you have one.
    // Since we have a pickerOverlay, let's inject a modal into DOM or use alert for simplicity 
    // OR: Reuse the 'histOverlay' from out_history if we moved it to index.html. 
    // To keep it self-contained, we'll just alert nicely or use a custom div.
    
    // Simple custom modal injection:
    let m = $('#detailModal');
    if(!m) {
        m = document.createElement('div'); m.id='detailModal';
        m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:3000;display:flex;align-items:center;justify-content:center;padding:1rem';
        m.onclick = (e)=>{ if(e.target===m) m.remove(); };
        document.body.appendChild(m);
    }
    m.innerHTML = `
        <div class="card glass" style="width:100%;max-width:400px;max-height:80vh;overflow:auto;background:#fff">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
                <h3 style="margin:0">${title}</h3>
                <button class="btn small" onclick="document.getElementById('detailModal').remove()">×</button>
            </div>
            <div>${htmlContent}</div>
        </div>
    `;
}

// --- Main Mount ---
export default async function mount({ root, lang }){
  const S = STR[lang];
  root.innerHTML = '';
  const grid = document.createElement('div'); grid.className = 'dashboard-grid';

  // Define sections with sequential execution support
  const sections = [
    { key:'low',  title:S.dashLow,          listId:'lowStockList',     fetch:() => apiGet('dash_LowStock', {}, { cacheTtlMs: 60_000 }), fill:fillLowStock },
    { key:'cons', title:S.dashTopContract,  listId:'topContractors',   fetch:() => apiGet('dash_TopContractors', {}, { cacheTtlMs: 60_000 }), fill:fillTopContractors },
    { key:'items',title:S.dashTopItems,     listId:'topItems',         fetch:() => apiGet('dash_TopItems', {}, { cacheTtlMs: 60_000 }), fill:fillTopItems },
    { key:'recent',title:S.dashRecent,      listId:'recentMoves',      fetch:() => apiGet('dash_Recent', {}, { cacheTtlMs: 30_000 }), fill:fillRecent },
  ];

  const nodes = {};
  for (const sec of sections){
    const c = card(sec.title);
    const list = listBox(sec.listId, 5);
    const togg = toggleRow(`#${sec.listId}`, S);
    const skel = skeletonList(5);
    c.appendChild(list); c.appendChild(togg); c.appendChild(skel);
    nodes[sec.key] = { card: c, list, skel };
    grid.appendChild(c);
  }

  // Pur Summary (Keep simple)
  const purSummary = card(S.purTitle);
  purSummary.innerHTML += `<div class="kpis" style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.5rem">
      <div class="kpi glass" style="flex:1;padding:.8rem;border-radius:.9rem;background:#fff;text-align:center"><div class="v" id="kpiReq" style="font-size:1.5rem;font-weight:800">0</div><div class="meta">${lang==='th'?'คำขอ':'Requests'}</div></div>
      <div class="kpi glass" style="flex:1;padding:.8rem;border-radius:.9rem;background:#fff;text-align:center"><div class="v" id="kpiUrgent" style="font-size:1.5rem;font-weight:800;color:#ef4444">0</div><div class="meta">${lang==='th'?'ด่วน':'Urgent'}</div></div>
    </div>`;
  grid.appendChild(purSummary);
  root.appendChild(grid);

  // --- SEQUENTIAL LOADER ---
  // We execute one by one to prevent overloading GAS
  async function loadSequence() {
      for (const sec of sections) {
          const ref = nodes[sec.key];
          try {
              const data = await sec.fetch(); // Wait for this to finish
              sec.fill(data, ref.list, S, lang);
          } catch(e) {
              safeEmpty(ref.list, lang);
          } finally {
              ref.skel.remove();
          }
          // Small delay to let UI breathe
          await new Promise(r => setTimeout(r, 100)); 
      }
      
      // Load Purchase stats last
      try {
          const s = await apiGet('pur_Summary', {}, { cacheTtlMs: 30_000 });
          if(s) { $('#kpiReq').textContent = s.requests||0; $('#kpiUrgent').textContent = s.urgent||0; }
      } catch {}
  }
  
  // Start the loading chain
  loadSequence();

  // Clamp controls
  root.addEventListener('click', (e)=>{
      if(e.target.matches('.toggle button')){
          const btn = e.target;
          const list = root.querySelector(btn.dataset.toggle);
          if(!list) return;
          const expanded = list.dataset.expanded === 'true';
          Array.from(list.children).forEach((el, i)=> el.style.display = expanded ? (i < 5 ? '' : 'none') : '');
          list.dataset.expanded = expanded ? 'false' : 'true';
          btn.textContent = expanded ? S.showMore : S.showLess;
      }
  });
}

// --- FILLERS with CLICK EVENTS ---

function fillLowStock(list, box, S, lang){
  box.innerHTML = '';
  if (!list || !list.length) return safeEmpty(box, lang);
  
  list.forEach(x=>{
    const row=document.createElement('div'); row.className='rowitem';
    // Make clickable
    row.style.cursor = 'pointer';
    row.onclick = () => showDetail(esc(x.name), `
        <div style="display:flex;flex-direction:column;gap:1rem">
            <div>
                <label class="meta">${lang==='th'?'คงเหลือ':'Current Stock'}</label>
                <div style="font-size:1.5rem;font-weight:bold;color:${x.stock<=0?'red':'black'}">${x.stock}</div>
            </div>
            <div>
                <label class="meta">Min Limit</label>
                <div>${x.min || 0}</div>
            </div>
            <hr style="border:0;border-top:1px solid #eee;width:100%">
            <button class="btn primary full" onclick="document.querySelector('[data-tab=adjust]').click();document.getElementById('detailModal').remove();">${lang==='th'?'ไปหน้าปรับปรุงสต็อก':'Go to Adjust'}</button>
        </div>
    `);

    row.innerHTML = `<div><strong>${esc(x.name)}</strong><div class="meta">Min ${x.min==null?'-':x.min}</div></div>`;
    row.appendChild(stockBadge(Number(x.stock), Number(x.min)));
    box.appendChild(row);
  });
  clampList(box);
}

function fillTopContractors(list, box, S, lang){
  box.innerHTML = '';
  if (!list || !list.length) return safeEmpty(box, lang);
  list.forEach(x=>{
    const row=document.createElement('div'); row.className='rowitem';
    row.innerHTML = `<div><strong>${esc(x.contractor||'(unknown)')}</strong><div class="meta">${lang==='th'?'เบิกไป ':'Used '}${x.qty||0}</div></div>`;
    box.appendChild(row);
  });
  clampList(box);
}

function fillTopItems(list, box, S, lang){
  box.innerHTML = '';
  if (!list || !list.length) return safeEmpty(box, lang);
  list.forEach(x=>{
    const row=document.createElement('div'); row.className='rowitem';
    row.innerHTML = `<div><strong>${esc(x.name)}</strong><div class="meta">Total ${esc(x.qty)}</div></div>`;
    box.appendChild(row);
  });
  clampList(box);
}

function fillRecent(rows, box, S, lang){
  box.innerHTML = '';
  if (!rows || !rows.length) return safeEmpty(box, lang);
  rows.forEach(x=>{
    const row=document.createElement('div'); row.className='rowitem';
    row.style.cursor='pointer';
    // On click, maybe show full details (simplified)
    row.onclick = () => showDetail('Details', `
        <p><strong>Date:</strong> ${x.ts}</p>
        <p><strong>Doc:</strong> ${x.doc}</p>
        <p><strong>Item:</strong> ${x.item}</p>
        <p><strong>Qty:</strong> ${x.qty}</p>
    `);
    
    row.innerHTML = `<div><strong>${esc(x.type)} • ${esc(x.item)}</strong><div class="meta">${esc(x.ts)} • Qty ${esc(x.qty)}</div></div>`;
    box.appendChild(row);
  });
  clampList(box);
}
