// tabs/out.js — Out tab wired to global FAB (icons + alignment guaranteed)
import {
  $, $$, esc, todayStr,
  apiGet, apiPost,
  bindPickerInputs, toast, setBtnLoading, currentLang, stockBadge
} from '../js/shared.js';
import { FabIcons } from '../js/fab.js';

/* ------------ Styles (layout, overlay, stock spinner) ------------ */
function injectStyles(){
  if (document.getElementById('out-tab-styles')) return;
  const css = `
  .outWrap{max-width:1100px;margin:0 auto;padding-inline:min(3vw,16px)}
  .out-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:var(--space-3)}
  /* iPad landscape (≈1024px), Pixel Fold/tablet */
  @media (max-width: 1024px){ .out-grid{grid-template-columns:repeat(8,1fr)} }
  /* iPad portrait / large phones in landscape (≈834px–820px) */
  @media (max-width: 834px){ .out-grid{grid-template-columns:repeat(6,1fr)} }
  /* Typical Android phones (≈600px and down) */
  @media (max-width: 600px){ .out-grid{grid-template-columns:repeat(4,1fr)} }
  /* iPhone 14/15 Pro Max width 430, and smaller iPhones */
  @media (max-width: 430px){ .out-grid{grid-template-columns:1fr} }

  .col-2{grid-column:span 2}.col-3{grid-column:span 3}.col-4{grid-column:span 4}.col-6{grid-column:span 6}.col-8{grid-column:span 8}.col-12{grid-column:1/-1}

  /* Normalize and prevent overflow */
  .out-grid > *{min-width:0}
  .out-grid input,
  .overlay-body input,
  .line-grid input{width:100%;min-width:0;box-sizing:border-box;height:var(--control-h,42px);line-height:var(--control-h,42px);padding:0 .65rem}

  .line-grid{display:grid;grid-template-columns:2fr 1fr auto;gap:.75rem;align-items:end}
  @media (max-width: 834px){ .line-grid{grid-template-columns:1fr 1fr auto} }
  @media (max-width: 430px){ .line-grid{grid-template-columns:1fr} .line-grid>div:last-child{justify-content:flex-start} }

  .overlay-backdrop{position:fixed;inset:0;z-index:4500;display:none;background:rgba(15,18,23,.28);backdrop-filter:blur(6px)}
  .overlay-panel{margin:5vh auto;width:min(980px,94%);max-height:90vh;display:flex;flex-direction:column;overflow:hidden}
  .overlay-body{padding:1rem;display:flex;flex-direction:column;gap:.75rem;overflow:auto;-webkit-overflow-scrolling:touch;flex:1 1 auto}
  .overlay-sticky{position:sticky;bottom:0;background:var(--card);padding-top:.25rem;border-top:1px solid var(--border-weak)}
  .overlay-backdrop.edit{z-index:4600}
  .lnStock{border:1px solid var(--border-weak); border-radius:10px; padding:.35rem .5rem; min-height:32px}
  .lnStock.loading{display:flex;align-items:center;gap:.5rem}
  .lnStock .stock-spinner{width:14px;height:14px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:spin .8s linear infinite;opacity:.8}
  @keyframes spin{to{transform:rotate(360deg)}}

  /* Ensure pickers are visible above cards/overlays */
  .picker-popover, .picker-menu, .autocomplete-panel, .picker-dropdown { position: fixed; z-index: 5001; }
  .overlay-panel{ overflow: visible }
`;
  const st = document.createElement('style');
  st.id = 'out-tab-styles';
  st.textContent = css;
  document.head.appendChild(st);
}

/* ------------ Template ------------ */
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

  <!-- History overlay -->
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
          <div class="col-3"><label>โครงการ</label><input id="sProj" data-picker="projects"></div>
          <div class="col-3"><label>ผู้รับเหมา</label><input id="sCont" data-picker="contractors"></div>
          <div class="col-3"><label>ผู้ขอเบิก</label><input id="sReq" data-picker="requesters"></div>
          <div class="col-3"><label>วัสดุ</label><input id="sMat" data-picker="materials"></div>
          <div class="col-3" style="align-self:end">
            <button class="btn" id="btnSearch" type="button">
              <span class="btn-label">ค้นหา</span><span class="btn-spinner"><span class="spinner"></span></span>
            </button>
          </div>
        </div>
        <div class="list" id="sResults"></div>
        <div class="overlay-sticky"><button id="btnMore" type="button" style="display:none">ดูเพิ่มเติม</button></div>
      </div>
    </div>
  </div>`;
}

/* ------------ Helpers ------------ */
function lineRow({name="", qty=""}={}) {
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
  setBtnLoading(btn,true);
  try{
    const res = await apiGet('out_SearchHistory', q, {retries:1});
    if (!res || res.ok===false) throw new Error(res && res.message || 'Search failed');
    renderResults($('#sResults',root), res.rows||[]);
    const more = $('#btnMore',root);
    const moreVisible = res.total > (q.offset + (res.rows||[]).length);
    more.style.display = moreVisible ? '' : 'none';
    more.dataset.page = String(page+1);
    if ((res.rows||[]).length===0) toast('ไม่พบรายการ');
  }catch(e){ toast(e.message); }
  finally{ setBtnLoading(btn,false); }
}

function openHist(root){
  const ov = $('#histOverlay',root);
  ov.style.display = 'block';
  bindPickerInputs(ov, currentLang());
  bindPickerInputs(document, currentLang());
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
  bindPickerInputs(document, currentLang());
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
  }catch(e){ toast(e.message); }
}

/* ------------ Global FAB actions for this tab ------------ */
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
  bindPickerInputs(document, currentLang());
  addLineUI(root);

  $('#btnCloseHist',root).addEventListener('click', ()=> closeHist(root));
  $('#btnSearch',root).addEventListener('click', ()=> doSearch(root, 0));
  $('#btnMore',root).addEventListener('click', (e)=>{
    const next = Number(e.currentTarget.dataset.page||1);
    doSearch(root, next);
  });
}
