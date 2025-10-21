// tabs/out.js — refined UI, proportional boxes, qty inline with material
import {
  $, $$, esc, todayStr,
  apiGet, apiPost,
  bindPickerInputs, toast, currentLang, stockBadge
} from '../js/shared.js';
import { FabIcons } from '../js/fab.js';

/* ------------ Styles: fluid grid + consistent control sizes ------------ */
function injectStyles(){
  if (document.getElementById('out-tab-styles')) return;
  const css = `
  :root{ --space-3:12px; --control-h:42px; }
  .outWrap{max-width:1100px;margin:0 auto;padding:16px}
  .tab-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:var(--space-3)}
  .line-grid{display:grid;grid-template-columns:minmax(320px,2fr) minmax(140px,.9fr) auto;gap:.75rem;align-items:end}
  @media (max-width:700px){ .line-grid{grid-template-columns:1fr 1fr auto} }
  @media (max-width:460px){ .line-grid{grid-template-columns:1fr} .line-actions{justify-content:flex-start} }
  input[type="text"],input[type="number"],input[type="date"]{width:100%;height:var(--control-h);line-height:var(--control-h);box-sizing:border-box;padding:0 .65rem;min-width:0}
  label{display:block;margin:.15rem 0 .35rem .1rem;font-size:.9rem;opacity:.8}
  .lnStock{display:flex;align-items:center;gap:.45rem;margin-top:.35rem;border:1px solid var(--border-weak,#e5e7eb);border-radius:10px;padding:.3rem .5rem;min-height:32px}
  .lnStock.loading{opacity:.8}
  .lnStock .stock-spinner{width:14px;height:14px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:spin .8s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  .line-actions{display:flex;align-items:flex-end}
  `;
  const st = document.createElement('style'); st.id = 'out-tab-styles'; st.textContent = css; document.head.appendChild(st);
}

/* ------------ Template ------------ */
function viewTemplate(){
  return `
  <div class="outWrap">
    <section class="card glass" style="overflow:hidden">
      <h3 style="margin:0 0 .75rem 0">จ่ายออก / OUT</h3>
      <div class="tab-grid" id="outHeader">
        <div><label>วันที่</label><input id="outDate" type="date" value="${todayStr()}"></div>
        <div><label>โครงการ</label><input id="outProject" data-picker="projects" placeholder="ค้นหาโครงการ…"></div>
        <div><label>ผู้รับเหมา</label><input id="outContractor" data-picker="contractors" placeholder="ค้นหาผู้รับเหมา…"></div>
        <div><label>ผู้ขอเบิก</label><input id="outRequester" data-picker="requesters" placeholder="ค้นหาผู้ขอเบิก…"></div>
        <div style="grid-column:1/-1"><label>หมายเหตุ</label><input id="outNote" placeholder="…"></div>
      </div>

      <div id="outLines"></div>
    </section>
  </div>

  <!-- History overlay -->
  <div id="histOverlay" class="overlay-backdrop" style="position:fixed;inset:0;z-index:4500;display:none;background:rgba(15,18,23,.28);backdrop-filter:blur(6px)">
    <div class="overlay-panel card glass" style="margin:5vh auto;width:min(980px,94%);max-height:90vh;display:flex;flex-direction:column;overflow:visible">
      <div style="padding:.9rem 1rem;border-bottom:1px solid var(--border-weak);display:flex;gap:.5rem;align-items:center;flex:0 0 auto;background:var(--card)">
        <strong style="font-size:1.05rem">ค้นหาประวัติการจ่ายออก</strong>
        <span class="spacer"></span>
        <button class="btn small" id="btnCloseHist" type="button">ปิด</button>
      </div>
      <div id="histBody" style="padding:1rem;display:flex;flex-direction:column;gap:.75rem;overflow:auto;-webkit-overflow-scrolling:touch;flex:1 1 auto">
        <div class="tab-grid" id="searchHeader">
          <div><label>จากวันที่</label><input id="sFrom" type="date"></div>
          <div><label>ถึงวันที่</label><input id="sTo" type="date"></div>
          <div><label>โครงการ</label><input id="sProj" data-picker="projects"></div>
          <div><label>ผู้รับเหมา</label><input id="sCont" data-picker="contractors"></div>
          <div><label>ผู้ขอเบิก</label><input id="sReq" data-picker="requesters"></div>
          <div><label>วัสดุ</label><input id="sMat" data-picker="materials"></div>
          <div>
            <button class="btn" id="btnSearch" type="button">
              <span class="btn-label">ค้นหา</span><span class="btn-spinner" style="display:none"><span class="spinner"></span></span>
            </button>
          </div>
        </div>
        <div class="list" id="sResults"></div>
        <div style="position:sticky;bottom:0;background:var(--card);padding-top:.25rem;border-top:1px solid var(--border-weak)">
          <button id="btnMore" type="button" style="display:none">ดูเพิ่มเติม</button>
        </div>
      </div>
    </div>
  </div>`;
}

/* ------------ Line UI ------------ */
function lineRow({name="", qty=""}={}) {
  return `
  <div class="line">
    <div class="line-grid">
      <div>
        <label>วัสดุ</label>
        <input class="lnName" data-picker="materials" placeholder="ค้นหาวัสดุ…" value="${esc(name)}">
        <div class="lnStock"></div>
      </div>
      <div>
        <label>จำนวน</label>
        <input class="lnQty" type="number" min="0" step="0.01" value="${esc(qty)}">
      </div>
      <div class="line-actions"><button class="btn small btnRem" type="button">ลบ</button></div>
    </div>
  </div>`;
}

function collectLines(root){
  const rows=[];
  $$('#outLines .line',root).forEach(line=>{
    const name=$('.lnName',line).value.trim();
    const qty=Number($('.lnQty',line).value);
    if(name && isFinite(qty) && qty>0) rows.push({name,qty});
  });
  return rows;
}

/* ------------ Stock handlers ------------ */
function attachStockHandlers(scope){
  $$('.lnName',scope).forEach(inp=>{
    const show = async ()=>{
      const name = inp.value.trim();
      const box = inp.parentElement.querySelector('.lnStock');
      if(!name){ box.innerHTML=''; return; }
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

/* ------------ Search / Edit ------------ */
function renderResults(listEl, rows){
  const map=new Map();
  for(const r of rows||[]){
    const key=r.doc;
    const line=`${r.item} × ${r.qty}${r.spec?' • '+r.spec:''}`;
    if(!map.has(key)){ map.set(key,{doc:r.doc,ts:r.ts,project:r.project,contractor:r.contractor,requester:r.requester,lines:[line]}); }
    else map.get(key).lines.push(line);
  }
  const cards=[];
  for(const v of map.values()){
    const title=`${esc(v.doc)} • ${esc(v.project||'-')} • ${esc(v.contractor||'-')} • ${esc(v.requester||'-')}`;
    const preview=v.lines.slice(0,3).map(x=>`<li>${esc(x)}</li>`).join('');
    const more=v.lines.length>3?`<span class="meta">+${v.lines.length-3} รายการ</span>`:'';
    cards.push(`<div class="rowitem">
      <div style="flex:1 1 auto">
        <div><strong>${title}</strong></div>
        <div class="meta">${esc(v.ts)}</div>
        <ul class="meta" style="margin:.35rem 0 0 .85rem;list-style:disc">${preview}</ul>${more}
      </div>
      <div style="display:flex;gap:.5rem;align-items:center">
        <button class="btn small" data-open="${esc(v.doc)}" type="button">แก้ไข</button>
      </div>
    </div>`);
  }
  listEl.innerHTML = cards.join('');
}

async function doSearch(root, page=0){
  const q = {
    type:'OUT',
    dateFrom: $('#sFrom',root).value || undefined,
    dateTo:   $('#sTo',root).value || undefined,
    project:  $('#sProj',root).value || undefined,
    contractor: $('#sCont',root).value || undefined,
    requester:  $('#sReq',root).value || undefined,
    material:   $('#sMat',root).value || undefined,
    limit: 50, offset: page*50
  };
  const btn = $('#btnSearch',root);
  btn && btn.querySelector('.btn-spinner') && (btn.querySelector('.btn-spinner').style.display='inline-flex');
  try{
    const res = await apiGet('out_SearchHistory', q, {retries:1});
    renderResults($('#sResults',root), (res && res.rows) || []);
    const more = $('#btnMore',root);
    const moreVisible = res && res.total > (q.offset + ((res.rows||[]).length));
    more.style.display = moreVisible ? '' : 'none';
    more.dataset.page = String(page+1);
    if (!res || (res.rows||[]).length===0) toast('ไม่พบรายการ');
  }catch(e){ toast(e.message || 'ค้นหาล้มเหลว'); }
  finally{ btn && btn.querySelector('.btn-spinner') && (btn.querySelector('.btn-spinner').style.display='none'); }
}

function openHist(root){
  const ov = $('#histOverlay',root);
  ov.style.display = 'block';
  bindPickerInputs(ov, currentLang());
  $('#sResults',root).innerHTML='';
  document.body.style.overflow = 'hidden';
}
function closeHist(root){
  $('#histOverlay',root).style.display = 'none';
  document.body.style.overflow = '';
}

/* ------------ OUT save + add line ------------ */
function addLineUI(root){
  $('#outLines',root).insertAdjacentHTML('beforeend', lineRow({}));
  bindPickerInputs(root, currentLang());
  attachStockHandlers(root);
  $$('#outLines .btnRem',root).forEach(btn => btn.onclick = ()=> btn.closest('.line')?.remove());
}

async function submitOut(root){
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
  }catch(e){ toast(e.message || 'บันทึกล้มเหลว'); }
}

/* ------------ FAB actions for this tab ------------ */
export function fabActions({root}){
  return [
    { label:'ประวัติ',   icon: FabIcons.clock, onClick: ()=> openHist(root) },
    { label:'เพิ่มบรรทัด', icon: FabIcons.plus,  onClick: ()=> addLineUI(root) },
    { label:'บันทึก',    icon: FabIcons.save,  variant:'primary', onClick: ()=> submitOut(root) },
  ];
}

/* ------------ Entry ------------ */
export default async function mountOut({root}){
  injectStyles();
  root.innerHTML = viewTemplate();
  bindPickerInputs(root, currentLang());
  addLineUI(root);

  $('#btnCloseHist',root).addEventListener('click', ()=> closeHist(root));
  $('#btnSearch',root).addEventListener('click', ()=> doSearch(root, 0));
  $('#btnMore',root).addEventListener('click', (e)=>{
    const next = Number(e.currentTarget.dataset.page||1);
    doSearch(root, next);
  });
}
