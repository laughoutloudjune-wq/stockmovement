// tabs/out.js — OUT with FAB icons, refined layout, Liquid Glass overlays
import {
  $, $$, esc, todayStr,
  apiGet, apiPost,
  bindPickerInputs, toast, setBtnLoading, currentLang, stockBadge
} from '../js/shared.js';

/* Small inline SVG icons (no external assets) */
const ICONS = {
  save: `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4zM7 5h8v4H7V5zm10 14H7v-6h10v6z" fill="currentColor"/></svg>`,
  plus: `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5h2v14h-2zM5 11h14v2H5z" fill="currentColor"/></svg>`,
  history: `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M13 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-7-7V3zm1 5h-2v6h6v-2h-4V8z" fill="currentColor"/></svg>`
};

function viewTemplate(){
  return `
  <section class="card glass" style="max-width:100%;">
    <h3 style="margin:0 0 .5rem 0">จ่ายออก / OUT</h3>

    <!-- Header form: denser, responsive grid -->
    <div class="row" id="outHeader" style="display:grid; grid-template-columns: repeat(12, 1fr); gap: var(--space-3)">
      <div style="grid-column: span 3; min-width:13rem">
        <label>วันที่</label>
        <input id="outDate" type="date" value="${todayStr()}">
      </div>
      <div style="grid-column: span 3; min-width:16rem">
        <label>โครงการ</label>
        <input id="outProject" data-picker="projects" placeholder="เลือกจากรายการ…">
      </div>
      <div style="grid-column: span 3; min-width:16rem">
        <label>ผู้รับเหมา</label>
        <input id="outContractor" data-picker="contractors" placeholder="เลือกจากรายการ…">
      </div>
      <div style="grid-column: span 3; min-width:16rem">
        <label>ผู้ขอเบิก</label>
        <input id="outRequester" data-picker="requesters" placeholder="เลือกจากรายการ…">
      </div>
      <div style="grid-column: 1 / -1">
        <label>หมายเหตุ</label>
        <input id="outNote" placeholder="…">
      </div>
    </div>

    <!-- Lines with refined grid widths -->
    <div class="lines" id="outLines"></div>

    <!-- Removed inline submit/add buttons; use FAB only -->
  </section>

  <!-- FAB (Speed Dial) with icons -->
  <div class="fab" id="fab">
    <div class="mini">
      <span class="label">ประวัติ</span>
      <button class="btn small" id="fabHistory" type="button" title="ค้นหาประวัติ">${ICONS.history}</button>
    </div>
    <div class="mini">
      <span class="label">เพิ่มบรรทัด</span>
      <button class="btn small" id="fabAdd" type="button" title="เพิ่มบรรทัด">${ICONS.plus}</button>
    </div>
    <div class="mini">
      <span class="label">บันทึก</span>
      <button class="btn small primary" id="fabSubmit" type="button" title="บันทึก">
        <span class="btn-label" style="display:inline-flex; align-items:center; gap:.4rem">${ICONS.save}<span>บันทึก</span></span>
        <span class="btn-spinner"><span class="spinner"></span></span>
      </button>
    </div>
    <button class="fab-main" id="fabMain" type="button" aria-label="เมนูด่วน">
      <span class="icon">＋</span>
    </button>
  </div>

  <!-- History overlay (Liquid Glass) -->
  <div id="histOverlay" style="position:fixed; inset:0; z-index:4500; display:none; background:rgba(15,18,23,0.35); backdrop-filter:blur(5px)">
    <div class="glass card" style="margin:5vh auto; width:min(980px, 94%); max-height:90vh; display:flex; flex-direction:column; overflow:hidden">
      <div style="padding:.9rem 1rem; border-bottom:1px solid var(--border-weak); display:flex; gap:.5rem; align-items:center; flex:0 0 auto; background:var(--card)">
        <strong style="font-size:1.05rem">ค้นหาประวัติการจ่ายออก</strong>
        <span class="spacer"></span>
        <button class="btn small" id="btnCloseHist" type="button">ปิด</button>
      </div>
      <div id="histBody" style="padding:1rem; display:flex; flex-direction:column; gap:.75rem; overflow:auto; -webkit-overflow-scrolling:touch; flex:1 1 auto; background:linear-gradient(135deg, rgba(10,132,255,.06), rgba(255,255,255,.00))">
        <div class="row" id="searchHeader" style="display:grid; grid-template-columns: repeat(12,1fr); gap: var(--space-3)">
          <div style="grid-column: span 3"><label>จากวันที่</label><input id="sFrom" type="date"></div>
          <div style="grid-column: span 3"><label>ถึงวันที่</label><input id="sTo" type="date"></div>
          <div style="grid-column: span 3"><label>โครงการ</label><input id="sProj" data-picker="projects" placeholder="—"></div>
          <div style="grid-column: span 3"><label>ผู้รับเหมา</label><input id="sCont" data-picker="contractors" placeholder="—"></div>
          <div style="grid-column: span 3"><label>ผู้ขอเบิก</label><input id="sReq" data-picker="requesters" placeholder="—"></div>
          <div style="grid-column: span 3"><label>วัสดุ</label><input id="sMat" data-picker="materials" placeholder="—"></div>
          <div style="grid-column: span 6"><label>ค้นหาคำ</label><input id="sText" placeholder="พิมพ์คำค้น…"></div>
          <div style="grid-column: span 2; align-self:end"><button class="btn" id="btnSearch" type="button"><span class="btn-label">ค้นหา</span><span class="btn-spinner"><span class="spinner"></span></span></button></div>
        </div>
        <div class="list" id="sResults" data-limit="10"></div>
        <div class="toggle" style="position:sticky; bottom:0; background:var(--card); padding-top:.25rem; border-top:1px solid var(--border-weak)">
          <button id="btnMore" type="button" style="display:none">ดูเพิ่มเติม</button>
        </div>
      </div>
    </div>
  </div>
  `;
}

function lineRow({name="", qty="", spec=""}={}){
  return `
  <div class="line">
    <div class="grid" style="display:grid; grid-template-columns: 2fr 1fr 2fr auto; gap:.75rem">
      <div>
        <label>วัสดุ</label>
        <input class="lnName" data-picker="materials" placeholder="เลือก…" value="${esc(name)}">
        <div class="lnStock" style="margin-top:.35rem; font-size:.9rem; display:flex; gap:.5rem; align-items:center"></div>
      </div>
      <div>
        <label>จำนวน</label>
        <input class="lnQty" type="number" min="0" step="0.01" value="${esc(qty)}">
      </div>
      <div>
        <label>รายละเอียด (ถ้ามี)</label>
        <input class="lnSpec" placeholder="—" value="${esc(spec)}">
      </div>
      <div style="display:flex; align-items:flex-end"><button class="btn small btnRem" type="button">ลบ</button></div>
    </div>
  </div>`;
}

function collectLines(root){
  const rows = [];
  $$('#outLines .line', root).forEach(line=>{
    const name = $('.lnName', line).value.trim();
    const qty  = Number($('.lnQty', line).value);
    const spec = $('.lnSpec', line).value.trim();
    if (name && isFinite(qty) && qty>0){
      rows.push({name, qty, spec});
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
      <div style="display:flex; gap:.5rem">
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
  edit.style.cssText = 'position:fixed; inset:0; z-index:4600; background:rgba(15,18,23,.35); backdrop-filter:blur(5px)';
  edit.innerHTML = `
    <div class="glass card" style="margin:6vh auto; max-width:860px; width:92%; max-height:88vh; overflow:hidden; display:flex; flex-direction:column">
      <div style="padding:1rem; border-bottom:1px solid var(--border-weak); display:flex; align-items:center; gap:.5rem; flex:0 0 auto; background:var(--card)">
        <strong id="eTitle" style="font-size:1.1rem">เอกสาร: ${esc(docNo)}</strong>
        <span class="spacer"></span>
        <button class="btn small" id="eClose" type="button">ปิด</button>
      </div>
      <div id="eBody" style="padding:1rem; overflow:auto; -webkit-overflow-scrolling:touch; flex:1 1 auto; background:linear-gradient(135deg, rgba(10,132,255,.06), rgba(255,255,255,.00))">
        <div class="skeleton-row"><div class="skeleton-bar" style="width:70%"></div></div>
      </div>
      <div style="padding:1rem; border-top:1px solid var(--border-weak); display:flex; gap:.5rem; justify-content:flex-end; flex:0 0 auto; background:var(--card)">
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
      <div class="row" style="display:grid; grid-template-columns: repeat(12, 1fr); gap: var(--space-3)">
        <div style="grid-column: span 4; min-width:13rem"><label>วันที่</label><input id="eDate" type="date" value="${esc(String(d.ts).slice(0,10))}"></div>
        <div style="grid-column: span 4; min-width:14rem"><label>โครงการ</label><input id="eProj" data-picker="projects" value="${esc(d.project||'')}"></div>
        <div style="grid-column: span 4; min-width:14rem"><label>ผู้รับเหมา</label><input id="eCont" data-picker="contractors" value="${esc(d.contractor||'')}"></div>
        <div style="grid-column: span 4; min-width:14rem"><label>ผู้ขอเบิก</label><input id="eReq" data-picker="requesters" value="${esc(d.requester||'')}"></div>
        <div style="grid-column: 1 / -1"><label>หมายเหตุ</label><input id="eNote" value="${esc(d.note||'')}"></div>
      </div>
      <div class="lines" id="eLines">
        ${d.lines.map(li => lineRow({name:li.item, qty:li.qty, spec:li.spec})).join('')}
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
      const spec = $('.lnSpec', line).value.trim();
      if (name && isFinite(qty) && qty>0) lines.push({name, qty, spec});
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
