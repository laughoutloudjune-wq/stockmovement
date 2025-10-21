// tabs/out.js
import {
  $, $$, esc, todayStr,
  apiGet, apiPost,
  getLookups, preloadLookups,
  bindPickerInputs, toast, setBtnLoading, currentLang, stockBadge
} from '../js/shared.js';

function h(str){ return str.trim(); }

function viewTemplate(){
  return `
  <section class="card glass">
    <h3>จ่ายออก / OUT</h3>

    <div class="row" id="outHeader">
      <div>
        <label>วันที่</label>
        <input id="outDate" type="date" value="${todayStr()}">
      </div>
      <div>
        <label>โครงการ</label>
        <input id="outProject" data-picker="projects" placeholder="เลือกจากรายการ…">
      </div>
      <div>
        <label>ผู้รับเหมา</label>
        <input id="outContractor" data-picker="contractors" placeholder="เลือกจากรายการ…">
      </div>
      <div>
        <label>ผู้ขอเบิก</label>
        <input id="outRequester" data-picker="requesters" placeholder="เลือกจากรายการ…">
      </div>
      <div style="flex:1 1 100%">
        <label>หมายเหตุ</label>
        <input id="outNote" placeholder="…">
      </div>
    </div>

    <div class="lines" id="outLines"></div>

    <div class="row">
      <button class="btn" id="btnAddLine">＋ เพิ่มบรรทัด</button>
      <span class="spacer"></span>
      <button class="btn primary" id="btnSubmitOut">
        <span class="btn-label">บันทึก</span>
        <span class="btn-spinner"><span class="spinner"></span></span>
      </button>
    </div>
  </section>

  <section class="card glass">
    <h3>ค้นหาประวัติการจ่ายออก</h3>
    <div class="row" id="searchHeader">
      <div><label>จากวันที่</label><input id="sFrom" type="date"></div>
      <div><label>ถึงวันที่</label><input id="sTo" type="date"></div>
      <div><label>โครงการ</label><input id="sProj" data-picker="projects" placeholder="—"></div>
      <div><label>ผู้รับเหมา</label><input id="sCont" data-picker="contractors" placeholder="—"></div>
      <div><label>ผู้ขอเบิก</label><input id="sReq" data-picker="requesters" placeholder="—"></div>
      <div><label>วัสดุ</label><input id="sMat" data-picker="materials" placeholder="—"></div>
      <div style="flex:1 1 100%"><label>ค้นหาคำ</label><input id="sText" placeholder="พิมพ์คำค้น…"></div>
      <div><label>&nbsp;</label><button class="btn" id="btnSearch"><span class="btn-label">ค้นหา</span><span class="btn-spinner"><span class="spinner"></span></span></button></div>
    </div>

    <div class="list" id="sResults" data-limit="10"></div>

    <div class="toggle">
      <button id="btnMore" type="button">ดูเพิ่มเติม</button>
    </div>
  </section>

  <!-- Edit modal -->
  <div id="editOverlay" style="display:none; position:fixed; inset:0; z-index:5000; background:rgba(15,18,23,.35); backdrop-filter:blur(3px);">
    <div style="margin:5vh auto; max-width:860px; width:92%; background:#fff; border-radius:18px; border:1px solid rgba(0,0,0,.08); box-shadow:0 18px 36px rgba(0,0,0,.18); overflow:hidden">
      <div style="padding:1rem; border-bottom:1px solid rgba(0,0,0,.06); display:flex; align-items:center; gap:.5rem">
        <strong id="eTitle" style="font-size:1.1rem"></strong>
        <span class="spacer"></span>
        <button class="btn small" id="eClose">ปิด</button>
      </div>
      <div style="padding:1rem" id="eBody"></div>
      <div style="padding:1rem; border-top:1px solid rgba(0,0,0,.06); display:flex; gap:.5rem; justify-content:flex-end">
        <button class="btn" id="eReload">รีเฟรช</button>
        <button class="btn primary" id="eSave"><span class="btn-label">บันทึกการแก้ไข</span><span class="btn-spinner"><span class="spinner"></span></span></button>
      </div>
    </div>
  </div>
  `;
}

function lineRow({name="", qty="", spec=""}={}){
  return `
  <div class="line">
    <div class="grid">
      <div><label>วัสดุ</label><input class="lnName" data-picker="materials" placeholder="เลือก…" value="${esc(name)}"></div>
      <div><label>จำนวน</label><input class="lnQty" type="number" min="0" step="0.01" value="${esc(qty)}"></div>
      <div><label>รายละเอียด (ถ้ามี)</label><input class="lnSpec" placeholder="—" value="${esc(spec)}"></div>
      <div style="display:flex; align-items:flex-end"><button class="btn small btnRem">ลบ</button></div>
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
        <button class="btn small" data-open="${esc(r.doc)}">แก้ไข</button>
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
    $('#btnMore', root).style.display = (res.total> (q.offset + (res.rows||[]).length)) ? '' : 'none';
    $('#btnMore', root).dataset.page = String(page+1);
    if ((res.rows||[]).length===0) toast('ไม่พบรายการ');
  }catch(e){
    toast(e.message);
  }finally{
    setBtnLoading(btn, false);
  }
}

function openEdit(root, docNo){
  $('#editOverlay', root).style.display = 'block';
  $('#eTitle', root).textContent = 'เอกสาร: ' + docNo;
  $('#eBody', root).innerHTML = '<div class="skeleton-row"><div class="skeleton-bar" style="width:70%"></div></div>';
  loadDoc(root, docNo);
}

async function loadDoc(root, docNo){
  try{
    const r = await apiGet('out_GetDoc', {docNo});
    if (!r || r.ok===false) throw new Error(r && r.message || 'Load failed');
    const d = r.doc;
    const html = `
      <div class="row">
        <div><label>วันที่</label><input id="eDate" type="date" value="${esc(String(d.ts).slice(0,10))}"></div>
        <div><label>โครงการ</label><input id="eProj" data-picker="projects" value="${esc(d.project||'')}"></div>
        <div><label>ผู้รับเหมา</label><input id="eCont" data-picker="contractors" value="${esc(d.contractor||'')}"></div>
        <div><label>ผู้ขอเบิก</label><input id="eReq" data-picker="requesters" value="${esc(d.requester||'')}"></div>
        <div style="flex:1 1 100%"><label>หมายเหตุ</label><input id="eNote" value="${esc(d.note||'')}"></div>
      </div>
      <div class="lines" id="eLines">
        ${d.lines.map(li => lineRow({name:li.item, qty:li.qty, spec:li.spec})).join('')}
      </div>
      <div><button class="btn" id="eAddLine">＋ เพิ่มบรรทัด</button></div>
    `;
    $('#eBody', root).innerHTML = html;
    bindPickerInputs($('#eBody', root), currentLang());
    // wire remove + add
    $$('#eLines .btnRem', root).forEach(btn => btn.addEventListener('click', ()=> {
      const box = btn.closest('.line'); box?.remove();
    }));
    $('#eAddLine', root).addEventListener('click', ()=>{
      $('#eLines', root).insertAdjacentHTML('beforeend', lineRow({}));
      bindPickerInputs($('#eBody', root), currentLang());
      $$('#eLines .btnRem', root).forEach(btn => btn.onclick = ()=> btn.closest('.line')?.remove());
    });
    // save handler
    $('#eSave', root).onclick = () => saveEdit(root, d.docNo);
  }catch(e){
    toast(e.message);
  }
}

async function saveEdit(root, docNo){
  const btn = $('#eSave', root);
  setBtnLoading(btn, true);
  try{
    const lines = [];
    $$('#eLines .line', root).forEach(line=>{
      const name = $('.lnName', line).value.trim();
      const qty  = Number($('.lnQty', line).value);
      const spec = $('.lnSpec', line).value.trim();
      if (name && isFinite(qty) && qty>0) lines.push({name, qty, spec});
    });
    const p = {
      docNo,
      date: $('#eDate', root).value || undefined,
      project: $('#eProj', root).value || undefined,
      contractor: $('#eCont', root).value || undefined,
      requester: $('#eReq', root).value || undefined,
      note: $('#eNote', root).value || undefined,
      lines
    };
    const res = await apiPost('out_UpdateDoc', p);
    if (!res || res.ok===false) throw new Error(res && res.message || 'Save failed');
    toast('บันทึกการแก้ไขแล้ว');
    $('#editOverlay', root).style.display = 'none';
    // refresh last search page
    const more = $('#btnMore', root);
    const page = Number(more.dataset.page||1)-1;
    await doSearch(root, Math.max(0,page));
  }catch(e){
    toast(e.message);
  }finally{
    setBtnLoading(btn, false);
  }
}

function addLineUI(root){
  $('#outLines', root).insertAdjacentHTML('beforeend', lineRow({}));
  bindPickerInputs(root, currentLang());
  $$('#outLines .btnRem', root).forEach(btn => btn.onclick = ()=> btn.closest('.line')?.remove());
}

async function submitOut(root){
  const btn = $('#btnSubmitOut', root);
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

  // events
  $('#btnAddLine', root).addEventListener('click', ()=> addLineUI(root));
  $('#btnSubmitOut', root).addEventListener('click', ()=> submitOut(root));
  $('#btnSearch', root).addEventListener('click', ()=> doSearch(root, 0));
  $('#btnMore', root).addEventListener('click', (e)=> {
    const next = Number(e.currentTarget.dataset.page||1);
    doSearch(root, next);
  });

  $('#sResults', root).addEventListener('click', (e)=>{
    const btn = e.target.closest('button[data-open]'); if(!btn) return;
    openEdit(root, btn.getAttribute('data-open'));
  });
  $('#eClose', root).addEventListener('click', ()=> $('#editOverlay', root).style.display='none');
  $('#eReload', root).addEventListener('click', ()=> {
    const doc = $('#eTitle', root).textContent.replace('เอกสาร: ','').trim();
    if (doc) loadDoc(root, doc);
  });
}
