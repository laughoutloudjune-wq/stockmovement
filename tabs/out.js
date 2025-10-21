// tabs/out.js — OUT tab with stable, body-level FAB (iOS icons), consistent with other tabs
import {
  $, $$, esc, todayStr,
  apiGet, apiPost,
  bindPickerInputs, toast, setBtnLoading, currentLang, stockBadge
} from '../js/shared.js';

/* ---------- Tab-scoped CSS: layout, overlays, and FAB (consistent + low-glitch) ---------- */
function injectStyles(){
  if (document.getElementById('out-tab-styles')) return;
  const css = `
  .outWrap{max-width:1100px;margin:0 auto;padding-inline:min(3vw,16px)}
  .out-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:var(--space-3)}
  @media (max-width: 980px){ .out-grid{grid-template-columns:repeat(6,1fr)} }
  @media (max-width: 640px){ .out-grid{grid-template-columns:1fr} }
  .col-3{grid-column:span 3}.col-4{grid-column:span 4}.col-6{grid-column:span 6}.col-12{grid-column:1/-1}
  .out-grid input{width:100%;min-width:0}
  .out-grid input[type="date"], .overlay-body input[type="date"]{height:var(--control-h,42px);line-height:var(--control-h,42px);padding:0 .65rem}

  .line-grid{display:grid;grid-template-columns:2fr 1fr auto;gap:.75rem}
  @media (max-width: 720px){ .line-grid{grid-template-columns:1fr 1fr auto} }
  @media (max-width: 520px){ .line-grid{grid-template-columns:1fr;gap:.5rem} .line-grid>div:last-child{justify-content:flex-start} }
  .line-grid .btnRem{align-self:end}

  .overlay-backdrop{position:fixed;inset:0;z-index:4500;display:none;background:rgba(15,18,23,.28);backdrop-filter:blur(6px)}
  .overlay-panel{margin:5vh auto;width:min(980px,94%);max-height:90vh;display:flex;flex-direction:column;overflow:hidden}
  .overlay-body{padding:1rem;display:flex;flex-direction:column;gap:.75rem;overflow:auto;-webkit-overflow-scrolling:touch;flex:1 1 auto}
  .overlay-sticky{position:sticky;bottom:0;background:var(--card);padding-top:.25rem;border-top:1px solid var(--border-weak)}
  .overlay-backdrop.edit{z-index:4600}

  /* Stable FAB: one body-level node, simple fade/slide, no 3D transforms */
  .fab-out{position:fixed; right:16px; bottom:18px; z-index:4200; display:flex; flex-direction:column; align-items:flex-end; gap:.5rem; pointer-events:none}
  .fab-out .sd{display:flex; flex-direction:column; gap:.5rem; transform:translateY(6px); opacity:0; pointer-events:none; transition:opacity .12s ease, transform .12s ease}
  .fab-out.expanded .sd{transform:translateY(0); opacity:1; pointer-events:auto}
  .fab-out .sd .action{display:flex; align-items:center; gap:.5rem; background:var(--card); border:1px solid var(--border-weak); border-radius:12px; padding:.35rem .5rem; box-shadow:0 4px 16px rgba(0,0,0,.08)}
  .fab-out .sd .action .btn.small{min-width:36px; height:36px; display:inline-grid; place-items:center}
  .fab-out .sd .label{font:inherit; font-size:.9rem; color:var(--text-muted)}
  .fab-out .main{pointer-events:auto}
  .fab-out .main button{width:56px; height:56px; border-radius:50%; display:inline-grid; place-items:center; background:var(--accent, #2563eb); color:#fff; border:none; box-shadow:0 6px 18px rgba(0,0,0,.18)}
  .fab-out .main button:active{transform:translateY(1px)}
  .fab-out svg{width:22px; height:22px; stroke:currentColor; fill:none; stroke-width:1.9; stroke-linecap:round; stroke-linejoin:round}
  @media (prefers-reduced-motion: reduce){
    .fab-out .sd{transition:none}
    .fab-out .main button{transition:none}
  }

  .lnStock{border:1px solid var(--border-weak); border-radius:10px; padding:.35rem .5rem; min-height:32px}
  .lnStock.loading{display:flex;align-items:center;gap:.5rem}
  .lnStock .stock-spinner{width:14px;height:14px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:spin .8s linear infinite;opacity:.8}
  @keyframes spin{to{transform:rotate(360deg)}}
  `;
  const style = document.createElement('style');
  style.id = 'out-tab-styles';
  style.textContent = css;
  document.head.appendChild(style);
}

/* iOS-like outline icons */
const ICONS = {
  plus: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`,
  save: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7.5h14M8 12h8m-8 4h6"/><rect x="4.5" y="5" width="15" height="15" rx="2.5"/></svg>`,
  clock:`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3.5 2"/></svg>`
};

/* ---------- View (UNCHANGED content; FAB removed from markup) ---------- */
function viewTemplate(){
  return `
  <div class="outWrap">
    <section class="card glass" style="max-width:100%;overflow:hidden">
      <h3 style="margin:0 0 .5rem 0">จ่ายออก / OUT</h3>
      <div class="row out-grid" id="outHeader">
        <div class="col-3"><label>วันที่</label><input id="outDate" type="date" value="${todayStr()}"></div>
        <div class="col-3"><label>โครงการ</label><input id="outProject" data-picker="projects" placeholder="เลือกจากรายการ…"></div>
        <div class="col-3"><label>ผู้รับเหมา</label><input id="outContractor" data-picker="contractors" placeholder="เลือกจากรายการ…"></div>
        <div class="col-3"><label>ผู้ขอเบิก</label><input id="outRequester" data-picker="requesters" placeholder="เลือกจากรายการ…"></div>
        <div class="col-12"><label>หมายเหตุ</label><input id="outNote" placeholder="…"></div>
      </div>
      <div class="lines" id="outLines"></div>
    </section>
  </div>

  <div id="histOverlay" class="overlay-backdrop" aria-hidden="true">
    <div class="overlay-panel card glass" role="dialog" aria-modal="true" aria-label="ประวัติการจ่ายออก">
      <div style="padding:.9rem 1rem;border-bottom:1px solid var(--border-weak);display:flex;gap:.5rem;align-items:center;flex:0 0 auto;background:var(--card)">
        <strong style="font-size:1.05rem">ค้นหาประวัติการจ่ายออก</strong>
        <span class="spacer"></span>
        <button class="btn small" id="btnCloseHist" type="button">ปิด</button>
      </div>
      <div id="histBody" class="overlay-body">
        <div class="row out-grid" id="searchHeader">
          <div class="col-3"><label>จากวันที่</label><input id="sFrom" type="date"></div>
          <div class="col-3"><label>ถึงวันที่</label><input id="sTo" type="date"></div>
          <div class="col-3"><label>โครงการ</label><input id="sProj" data-picker="projects" placeholder="—"></div>
          <div class="col-3"><label>ผู้รับเหมา</label><input id="sCont" data-picker="contractors" placeholder="—"></div>
          <div class="col-3"><label>ผู้ขอเบิก</label><input id="sReq" data-picker="requesters" placeholder="—"></div>
          <div class="col-3"><label>วัสดุ</label><input id="sMat" data-picker="materials" placeholder="—"></div>
          <div class="col-3" style="align-self:end"><button class="btn" id="btnSearch" type="button"><span class="btn-label">ค้นหา</span><span class="btn-spinner"><span class="spinner"></span></span></button></div>
        </div>
        <div class="list" id="sResults" data-limit="10"></div>
        <div class="overlay-sticky"><button id="btnMore" type="button" style="display:none">ดูเพิ่มเติม</button></div>
      </div>
    </div>
  </div>
  `;
}

/* ---------- Line helpers ---------- */
function lineRow({name="", qty=""}={}){
  return `
  <div class="line">
    <div class="line-grid">
      <div>
        <label>วัสดุ</label>
        <input class="lnName" data-picker="materials" placeholder="เลือก…" value="${esc(name)}">
        <div class="lnStock" style="margin-top:.35rem;display:flex;gap:.5rem;align-items:center"></div>
      </div>
      <div>
        <label>จำนวน</label>
        <input class="lnQty" type="number" min="0" step="0.01" value="${esc(qty)}">
      </div>
      <div style="display:flex;align-items:flex-end"><button class="btn small btnRem" type="button">ลบ</button></div>
    </div>
  </div>`;
}

function collectLines(root){
  const rows = [];
  $$('#outLines .line', root).forEach(line=>{
    const name = $('.lnName', line).value.trim();
    const qty  = Number($('.lnQty', line).value);
    if (name && isFinite(qty) && qty>0){
      rows.push({name, qty});
    }
  });
  return rows;
}

/* ---------- History renderer with preview ---------- */
function renderResults(listEl, rows){
  const map = new Map();
  for (const r of rows||[]){
    const key = r.doc;
    const line = `${r.item} × ${r.qty}${r.spec ? ' • '+r.spec : ''}`;
    if (!map.has(key)){
      map.set(key, {doc:r.doc, ts:r.ts, project:r.project, contractor:r.contractor, requester:r.requester, lines:[line]});
    }else{
      map.get(key).lines.push(line);
    }
  }
  const cards = [];
  for (const v of map.values()){
    const title = `${esc(v.doc)} • ${esc(v.project||'-')} • ${esc(v.contractor||'-')} • ${esc(v.requester||'-')}`;
    const preview = v.lines.slice(0,3).map(x=>`<li>${esc(x)}</li>`).join('');
    const more = v.lines.length>3 ? `<span class="meta">+${v.lines.length-3} รายการ</span>` : '';
    cards.push(`<div class="rowitem">
      <div style="flex:1 1 auto">
        <div><strong>${title}</strong></div>
        <div class="meta">${esc(v.ts)}</div>
        <ul class="meta" style="margin:.35rem 0 0 .85rem; list-style:disc">${preview}</ul>${more}
      </div>
      <div style="display:flex; gap:.5rem; align-items:center">
        <button class="btn small" data-open="${esc(v.doc)}" type="button">แก้ไข</button>
      </div>
    </div>`);
  }
  listEl.innerHTML = cards.join('');
}

/* ---------- API actions ---------- */
async function doSearch(root, page=0){
  const q = {
    type: 'OUT',
    dateFrom: $('#sFrom', root).value || undefined,
    dateTo:   $('#sTo', root).value || undefined,
    project:  $('#sProj', root).value || undefined,
    contractor: $('#sCont', root).value || undefined,
    requester:  $('#sReq', root).value || undefined,
    material:   $('#sMat', root).value || undefined,
    limit: 50,
    offset: page*50
  };
  const btn = $('#btnSearch', root);
  setBtnLoading(btn, true);
  try{
    const res = await apiGet('out_SearchHistory', q, {retries:1});
    if (!res || res.ok===false) throw new Error(res && res.message || 'Search failed');
    renderResults($('#sResults', root), res.rows||[]);
    const more = $('#btnMore', root);
    const moreVisible = res.total> (q.offset + (res.rows||[]).length);
    more.style.display = moreVisible ? '' : 'none';
    more.dataset.page = String(page+1);
    if ((res.rows||[]).length===0) toast('ไม่พบรายการ');
  }catch(e){
    toast(e.message);
  }finally{
    setBtnLoading(btn, false);
  }
}

function openHist(root){
  const ov = $('#histOverlay', root);
  ov.style.display = 'block';
  bindPickerInputs(ov, currentLang());
  $('#sResults', root).innerHTML = '';
  document.body.style.overflow = 'hidden';
}
function closeHist(root){
  $('#histOverlay', root).style.display = 'none';
  document.body.style.overflow = '';
}

function openEdit(docNo){
  const edit = document.createElement('div');
  edit.id = 'editOverlay';
  edit.className = 'overlay-backdrop edit';
  edit.innerHTML = `
    <div class="overlay-panel card glass">
      <div style="padding:1rem;border-bottom:1px solid var(--border-weak);display:flex;align-items:center;gap:.5rem;flex:0 0 auto;background:var(--card)">
        <strong id="eTitle" style="font-size:1.1rem">เอกสาร: ${esc(docNo)}</strong>
        <span class="spacer"></span>
        <button class="btn small" id="eClose" type="button">ปิด</button>
      </div>
      <div id="eBody" class="overlay-body">
        <div class="skeleton-row"><div class="skeleton-bar" style="width:70%"></div></div>
      </div>
      <div style="padding:1rem;border-top:1px solid var(--border-weak);display:flex;gap:.5rem;justify-content:flex-end;flex:0 0 auto;background:var(--card)">
        <button class="btn" id="eReload" type="button">รีเฟรช</button>
        <button class="btn primary" id="eSave" type="button"><span class="btn-label">บันทึกการแก้ไข</span><span class="btn-spinner"><span class="spinner"></span></span></button>
      </div>
    </div>`;
  document.body.appendChild(edit);
  loadDoc(edit, docNo);
  edit.addEventListener('click', (e)=> { if (e.target===edit) edit.remove(); });
  $('#eClose', edit).addEventListener('click', ()=> edit.remove());
  $('#eReload', edit).addEventListener('click', ()=> loadDoc(edit, docNo));
}

async function loadDoc(overlayRoot, docNo){
  try{
    const r = await apiGet('out_GetDoc', {docNo});
    if (!r || r.ok===false) throw new Error(r && r.message || 'Load failed');
    const d = r.doc;
    const html = `
      <div class="row out-grid">
        <div class="col-4"><label>วันที่</label><input id="eDate" type="date" value="${esc(String(d.ts).slice(0,10))}"></div>
        <div class="col-4"><label>โครงการ</label><input id="eProj" data-picker="projects" value="${esc(d.project||'')}"></div>
        <div class="col-4"><label>ผู้รับเหมา</label><input id="eCont" data-picker="contractors" value="${esc(d.contractor||'')}"></div>
        <div class="col-4"><label>ผู้ขอเบิก</label><input id="eReq" data-picker="requesters" value="${esc(d.requester||'')}"></div>
        <div class="col-12"><label>หมายเหตุ</label><input id="eNote" value="${esc(d.note||'')}"></div>
      </div>
      <div class="lines" id="eLines">
        ${d.lines.map(li => lineRow({name:li.item, qty:li.qty})).join('')}
      </div>
      <div><button class="btn" id="eAddLine" type="button">＋ เพิ่มบรรทัด</button></div>
    `;
    $('#eBody', overlayRoot).innerHTML = html;
    bindPickerInputs($('#eBody', overlayRoot), currentLang());
    attachStockHandlers($('#eBody', overlayRoot));
    $$('#eLines .btnRem', overlayRoot).forEach(btn => btn.addEventListener('click', ()=> btn.closest('.line')?.remove()));
    $('#eAddLine', overlayRoot).addEventListener('click', ()=>{
      $('#eLines', overlayRoot).insertAdjacentHTML('beforeend', lineRow({}));
      bindPickerInputs($('#eBody', overlayRoot), currentLang());
      attachStockHandlers($('#eBody', overlayRoot));
      $$('#eLines .btnRem', overlayRoot).forEach(btn => btn.onclick = ()=> btn.closest('.line')?.remove());
    });
    $('#eSave', overlayRoot).onclick = () => saveEdit(overlayRoot, d.docNo);
  }catch(e){
    toast(e.message);
  }
}

async function saveEdit(overlayRoot, docNo){
  const btn = $('#eSave', overlayRoot);
  setBtnLoading(btn, true);
  try{
    const lines = [];
    $$('#eLines .line', overlayRoot).forEach(line=>{
      const name = $('.lnName', line).value.trim();
      const qty  = Number($('.lnQty', line).value);
      if (name && isFinite(qty) && qty>0) lines.push({name, qty});
    });
    const p = {
      docNo,
      date: $('#eDate', overlayRoot).value || undefined,
      project: $('#eProj', overlayRoot).value || undefined,
      contractor: $('#eCont', overlayRoot).value || undefined,
      requester: $('#eReq', overlayRoot).value || undefined,
      note: $('#eNote', overlayRoot).value || undefined,
      lines
    };
    const res = await apiPost('out_UpdateDoc', p);
    if (!res || res.ok===false) throw new Error(res && res.message || 'Save failed');
    toast('บันทึกการแก้ไขแล้ว');
    overlayRoot.remove();
  }catch(e){
    toast(e.message);
  }finally{
    setBtnLoading(btn, false);
  }
}

/* ---------- Stock helpers ---------- */
function attachStockHandlers(scope){
  $$('.lnName', scope).forEach(inp => {
    const show = async ()=>{
      const name = inp.value.trim();
      const box = inp.parentElement.querySelector('.lnStock');
      if (!name){ box.innerHTML=''; return; }
      box.classList.add('loading');
      box.innerHTML = '<span class="stock-spinner"></span><span class="meta">กำลังโหลดคงเหลือ…</span>';
      try{
        const r = await apiGet('getCurrentStock', { material:name }, { cacheTtlMs: 4000 });
        box.classList.remove('loading');
        if (!r || r.ok===false){ box.innerHTML = '<span class="meta">ไม่พบคงเหลือ</span>'; return; }
        box.innerHTML = '';
        box.appendChild(stockBadge(Number(r.stock||0), Number(r.min||0)));
        const meta = document.createElement('span');
        meta.className = 'meta';
        meta.textContent = ` คงเหลือ / Min: ${r.stock ?? '-'} / ${r.min ?? '-'}`;
        box.appendChild(meta);
      }catch{
        box.classList.remove('loading');
        box.innerHTML = '<span class="meta">โหลดคงเหลือไม่สำเร็จ</span>';
      }
    };
    inp.addEventListener('change', show);
    inp.addEventListener('blur', show);
    if (inp.value) show();
  });
}

function addLineUI(root){
  $('#outLines', root).insertAdjacentHTML('beforeend', lineRow({}));
  bindPickerInputs(root, currentLang());
  attachStockHandlers(root);
  $$('#outLines .btnRem', root).forEach(btn => btn.onclick = ()=> btn.closest('.line')?.remove());
}

async function submitOut(root){
  const btn = document.getElementById('fabOutSubmit');
  setBtnLoading(btn, true);
  try{
    const lines = collectLines(root);
    if (!lines.length){ toast('เพิ่มรายการก่อน'); return; }
    const body = {
      type: 'OUT',
      date: $('#outDate', root).value || undefined,
      project: $('#outProject', root).value || undefined,
      contractor: $('#outContractor', root).value || undefined,
      requester: $('#outRequester', root).value || undefined,
      note: $('#outNote', root).value || undefined,
      lines
    };
    const res = await apiPost('submitMovementBulk', body);
    if (!res || res.ok===false) throw new Error(res && res.message || 'Submit failed');
    toast('บันทึกเอกสารแล้ว: '+ (res.docNo||''));
    $('#outLines', root).innerHTML = '';
    addLineUI(root);
  }catch(e){
    toast(e.message);
  }finally{
    setBtnLoading(btn, false);
  }
}

/* ---------- FAB (body-level, shared feel) ---------- */
function mountFab(root){
  // Remove any existing OUT FAB to avoid duplicates
  $('#fab-out')?.remove();

  const fab = document.createElement('div');
  fab.id = 'fab-out';
  fab.className = 'fab-out';
  fab.innerHTML = `
    <div class="sd" role="menu" aria-label="เมนูด่วน OUT">
      <div class="action"><span class="label">ประวัติ</span><button class="btn small" id="fabOutHistory" type="button" title="ค้นหาประวัติ" aria-haspopup="dialog">${ICONS.clock}</button></div>
      <div class="action"><span class="label">เพิ่มบรรทัด</span><button class="btn small" id="fabOutAdd" type="button" title="เพิ่มบรรทัด">${ICONS.plus}</button></div>
      <div class="action"><span class="label">บันทึก</span><button class="btn small primary" id="fabOutSubmit" type="button" title="บันทึก" aria-label="บันทึก">${ICONS.save}</button></div>
    </div>
    <div class="main"><button id="fabOutMain" type="button" aria-expanded="false" aria-label="เมนูด่วน">${ICONS.plus}</button></div>
  `;
  document.body.appendChild(fab);

  const main = $('#fabOutMain');
  const sd   = fab.querySelector('.sd');

  const close = ()=>{ fab.classList.remove('expanded'); main.setAttribute('aria-expanded','false'); };
  const open  = ()=>{ fab.classList.add('expanded'); main.setAttribute('aria-expanded','true'); };

  main.addEventListener('click', ()=> fab.classList.contains('expanded') ? close() : open());

  // Close on outside click / Esc
  document.addEventListener('click', (e)=>{
    if (!fab.contains(e.target)) close();
  });
  document.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape') close();
  });

  // Wire actions
  $('#fabOutHistory').addEventListener('click', ()=>{
    close();
    openHist(root);
  });
  $('#fabOutAdd').addEventListener('click', ()=>{
    addLineUI(root);
  });
  $('#fabOutSubmit').addEventListener('click', ()=>{
    submitOut(root);
  });
}

export default async function mountOut({root}){
  injectStyles();
  root.innerHTML = viewTemplate();
  bindPickerInputs(root, currentLang());
  addLineUI(root);

  // Mount stable FAB once for this tab
  mountFab(root);

  // History overlay open/close
  $('#btnCloseHist', root).addEventListener('click', ()=> closeHist(root));
  // History search + paginate + open editor
  $('#btnSearch', root).addEventListener('click', ()=> doSearch(root, 0));
  $('#btnMore', root).addEventListener('click', (e)=>{ const next = Number(e.currentTarget.dataset.page||1); doSearch(root, next); });
  $('#histBody', root).addEventListener('click', (e)=>{
    const btn = e.target.closest('button[data-open]'); if(!btn) return;
    openEdit(btn.getAttribute('data-open'));
  });
}
