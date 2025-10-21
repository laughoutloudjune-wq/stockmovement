// tabs/out.js — responsive + themed overlays + iOS FAB icons
import {
  $, $$, esc, todayStr,
  apiGet, apiPost,
  bindPickerInputs, toast, setBtnLoading, currentLang, stockBadge
} from '../js/shared.js';

/* Ensure tab-scoped CSS is present (mobile-safe grids, FAB icon sizing, overlay theming) */
function injectStyles(){
  if (document.getElementById('out-tab-styles')) return;
  const css = `
  /* ----- Layout wrapper ----- */
  .outWrap{max-width:1100px;margin:0 auto;padding-inline:min(3vw,16px)}
  /* ----- Header grid (12col -> 6col -> 1col) ----- */
  .out-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:var(--space-3)}
  @media (max-width: 980px){ .out-grid{grid-template-columns:repeat(6,1fr)} }
  @media (max-width: 640px){ .out-grid{grid-template-columns:1fr} }
  .col-3{grid-column:span 3}
  .col-4{grid-column:span 4}
  .col-12{grid-column:1/-1}
  /* Avoid input overflow on small devices */
  .out-grid input{width:100%;min-width:0}

  /* ----- Line rows grid (Material / Qty / Remove) ----- */
  .line-grid{display:grid;grid-template-columns:2fr 1fr auto;gap:.75rem}
  @media (max-width: 720px){ .line-grid{grid-template-columns:1fr 1fr auto} }
  @media (max-width: 520px){ .line-grid{grid-template-columns:1fr;gap:.5rem} .line-grid>div:last-child{justify-content:flex-start} }

  /* ----- Overlay: use app theme classes only, add smooth scrolling ----- */
  .overlay-backdrop{position:fixed;inset:0;z-index:4500;display:none;background:rgba(15,18,23,.28);backdrop-filter:blur(6px)}
  .overlay-panel{margin:5vh auto;width:min(980px,94%);max-height:90vh;display:flex;flex-direction:column;overflow:hidden}
  .overlay-body{padding:1rem;display:flex;flex-direction:column;gap:.75rem;overflow:auto;-webkit-overflow-scrolling:touch;flex:1 1 auto}
  .overlay-sticky{position:sticky;bottom:0;background:var(--card);padding-top:.25rem;border-top:1px solid var(--border-weak)}

  /* ----- Edit overlay above history ----- */
  .overlay-backdrop.edit{z-index:4600}

  /* ----- FAB icons: make sure SVGs show regardless of global btn styles ----- */
  .fab .btn.small svg{display:inline-block;width:20px;height:20px;vertical-align:middle}
  .fab-main .icon svg{display:block;width:24px;height:24px}
  `;
  const style = document.createElement('style');
  style.id = 'out-tab-styles';
  style.textContent = css;
  document.head.appendChild(style);
}

/* iOS-like stroke icons */
const ICONS = {
  save: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7.5h16M6.5 5h11A2.5 2.5 0 0 1 20 7.5v10A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-10A2.5 2.5 0 0 1 6.5 5Z"/><path d="M8 12h8m-8 4h5"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`,
  clock:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3.5 2"/></svg>`
};

function viewTemplate(){
  return `
  <div class="outWrap">
    <section class="card glass" style="max-width:100%;overflow:hidden">
      <h3 style="margin:0 0 .5rem 0">จ่ายออก / OUT</h3>

      <!-- Header form -->
      <div class="row out-grid" id="outHeader">
        <div class="col-3"><label>วันที่</label><input id="outDate" type="date" value="${todayStr()}"></div>
        <div class="col-3"><label>โครงการ</label><input id="outProject" data-picker="projects" placeholder="เลือกจากรายการ…"></div>
        <div class="col-3"><label>ผู้รับเหมา</label><input id="outContractor" data-picker="contractors" placeholder="เลือกจากรายการ…"></div>
        <div class="col-3"><label>ผู้ขอเบิก</label><input id="outRequester" data-picker="requesters" placeholder="เลือกจากรายการ…"></div>
        <div class="col-12"><label>หมายเหตุ</label><input id="outNote" placeholder="…"></div>
      </div>

      <!-- Lines -->
      <div class="lines" id="outLines"></div>
    </section>
  </div>

  <!-- FAB (Speed Dial) -->
  <div class="fab" id="fab">
    <div class="mini"><span class="label">ประวัติ</span><button class="btn small" id="fabHistory" type="button" title="ค้นหาประวัติ">${ICONS.clock}</button></div>
    <div class="mini"><span class="label">เพิ่มบรรทัด</span><button class="btn small" id="fabAdd" type="button" title="เพิ่มบรรทัด">${ICONS.plus}</button></div>
    <div class="mini"><span class="label">บันทึก</span><button class="btn small primary" id="fabSubmit" type="button" title="บันทึก"><span class="btn-label" style="display:inline-flex;align-items:center;gap:.4rem">${ICONS.save}<span>บันทึก</span></span><span class="btn-spinner"><span class="spinner"></span></span></button></div>
    <button class="fab-main" id="fabMain" type="button" aria-label="เมนูด่วน"><span class="icon">${ICONS.plus}</span></button>
  </div>

  <!-- History overlay: themed -->
  <div id="histOverlay" class="overlay-backdrop">
    <div class="overlay-panel card glass">
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
          <div class="col-6"><label>ค้นหาคำ</label><input id="sText" placeholder="พิมพ์คำค้น…"></div>
          <div class="col-3" style="align-self:end"><button class="btn" id="btnSearch" type="button"><span class="btn-label">ค้นหา</span><span class="btn-spinner"><span class="spinner"></span></span></button></div>
        </div>
        <div class="list" id="sResults" data-limit="10"></div>
        <div class="overlay-sticky"><button id="btnMore" type="button" style="display:none">ดูเพิ่มเติม</button></div>
      </div>
    </div>
  </div>
  `;
}

/* OUT line row: Material + Qty only */
function lineRow({name="", qty=""}={}){
  return `
  <div class="line">
    <div class="line-grid">
      <div>
        <label>วัสดุ</label>
        <input class="lnName" data-picker="materials" placeholder="เลือก…" value="${esc(name)}">
        <div class="lnStock" style="margin-top:.35rem;font-size:.9rem;display:flex;gap:.5rem;align-items:center"></div>
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

function renderResults(listEl, rows){
  listEl.innerHTML = rows.map(r=>{
    const title = `${esc(r.doc)} • ${esc(r.project||'-')} • ${esc(r.contractor||'-')} • ${esc(r.requester||'-')}`;
    return `<div class="rowitem">
      <div>
        <div><strong>${title}</strong></div>
        <div class="meta">${esc(r.ts)} • ${esc(r.item)} × ${esc(r.qty)} ${r.spec? '• '+esc(r.spec):''}</div>
      </div>
      <div style="display:flex;gap:.5rem">
        <button class="btn small" data-open="${esc(r.doc)}" type="button">แก้ไข</button>
      </div>
    </div>`;
  }).join('');
}

async function doSearch(root, page=0){
  const q = {
    type: 'OUT',
    dateFrom: $('#sFrom', root).value || undefined,
    dateTo:   $('#sTo', root).value || undefined,
    project:  $('#sProj', root).value || undefined,
    contractor: $('#sCont', root).value || undefined,
    requester:  $('#sReq', root).value || undefined,
    material:   $('#sMat', root).value || undefined,
    text: $('#sText', root).value || undefined,
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

function attachStockHandlers(scope){
  $$('.lnName', scope).forEach(inp => {
    const show = async ()=>{
      const name = inp.value.trim();
      const box = inp.parentElement.querySelector('.lnStock');
      if (!name){ box.innerHTML=''; return; }
      try{
        const r = await apiGet('getCurrentStock', { material:name }, { cacheTtlMs: 4000 });
        if (!r || r.ok===false){ box.innerHTML = '<span class="meta">ไม่พบคงเหลือ</span>'; return; }
        box.innerHTML = '';
        box.appendChild(stockBadge(Number(r.stock||0), Number(r.min||0)));
        const meta = document.createElement('span');
        meta.className = 'meta';
        meta.textContent = ` คงเหลือ / Min: ${r.stock ?? '-'} / ${r.min ?? '-'}`;
        box.appendChild(meta);
      }catch{
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
  const btn = $('#fabSubmit', root);
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

export default async function mountOut({root}){
  injectStyles();
  root.innerHTML = viewTemplate();
  bindPickerInputs(root, currentLang());
  addLineUI(root);

  // FAB behaviour
  const fab = $('#fab', root);
  $('#fabMain', root).addEventListener('click', ()=> fab.classList.toggle('expanded'));
  $('#fabAdd', root).addEventListener('click', ()=> addLineUI(root));
  $('#fabSubmit', root).addEventListener('click', ()=> submitOut(root));
  $('#fabHistory', root).addEventListener('click', ()=> openHist(root));

  // History overlay open/close
  $('#btnCloseHist', root).addEventListener('click', ()=> closeHist(root));
  // History search + paginate + open editor
  $('#btnSearch', root).addEventListener('click', ()=> doSearch(root, 0));
  $('#btnMore', root).addEventListener('click', (e)=>{
    const next = Number(e.currentTarget.dataset.page||1);
    doSearch(root, next);
  });
  $('#histBody', root).addEventListener('click', (e)=>{
    const btn = e.target.closest('button[data-open]'); if(!btn) return;
    openEdit(btn.getAttribute('data-open'));
  });
}
