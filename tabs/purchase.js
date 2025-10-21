// tabs/purchase.js — Purchase tab, wired to global FAB
import { $, $$, esc, todayStr, apiPost, bindPickerInputs, toast, currentLang } from '../js/shared.js';
import { FabIcons } from '../js/fab.js';

function injectStyles(){
  if (document.getElementById('purchase-tab-styles')) return;
  const css = `
  .poWrap{max-width:1100px;margin:0 auto;padding-inline:min(3vw,16px)}
  .po-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:var(--space-3)}
  @media (max-width:980px){.po-grid{grid-template-columns:repeat(6,1fr)}}
  @media (max-width:640px){.po-grid{grid-template-columns:1fr}}
  .col-3{grid-column:span 3}.col-4{grid-column:span 4}.col-6{grid-column:span 6}.col-12{grid-column:1/-1}
  .po-grid input[type="date"]{height:var(--control-h,42px);line-height:var(--control-h,42px);padding:0 .65rem}
  .line-grid{display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:.75rem}
  @media (max-width:720px){.line-grid{grid-template-columns:1fr 1fr 1fr auto}}
  @media (max-width:520px){.line-grid{grid-template-columns:1fr}}`;
  const st=document.createElement('style'); st.id='purchase-tab-styles'; st.textContent=css; document.head.appendChild(st);
}

function viewTemplate(){
  return `
  <div class="poWrap">
    <section class="card glass">
      <h3 style="margin:0 0 .5rem 0">สั่งซื้อ / Purchase</h3>
      <div class="row po-grid">
        <div class="col-3"><label>วันที่</label><input id="poDate" type="date" value="${todayStr()}"></div>
        <div class="col-3"><label>ผู้ขาย</label><input id="poVendor" data-picker="vendors" placeholder="เลือกจากรายการ…"></div>
        <div class="col-3"><label>โครงการ</label><input id="poProject" data-picker="projects" placeholder="เลือกจากรายการ…"></div>
        <div class="col-12"><label>หมายเหตุ</label><input id="poNote" placeholder="…"></div>
      </div>
      <div id="poLines"></div>
    </section>
  </div>`;
}

function lineRow({name='', qty='', unit=''}={}){
  return `<div class="line"><div class="line-grid">
    <div><label>วัสดุ</label><input class="lnName" data-picker="materials" placeholder="เลือก…" value="${esc(name)}"></div>
    <div><label>จำนวน</label><input class="lnQty" type="number" min="0" step="0.01" value="${esc(qty)}"></div>
    <div><label>หน่วย</label><input class="lnUnit" data-picker="units" value="${esc(unit)}"></div>
    <div style="display:flex;align-items:flex-end"><button class="btn small btnRem" type="button">ลบ</button></div>
  </div></div>`;
}

function addLineUI(root){
  $('#poLines',root).insertAdjacentHTML('beforeend', lineRow({}));
  bindPickerInputs(root, currentLang());
  $$('#poLines .btnRem',root).forEach(b=> b.onclick=()=> b.closest('.line')?.remove());
}

function collectLines(root){
  const rows=[];
  $$('#poLines .line',root).forEach(line=>{
    const name=$('.lnName',line).value.trim();
    const qty=Number($('.lnQty',line).value);
    const unit=$('.lnUnit',line).value.trim() || undefined;
    if(name && isFinite(qty) && qty>0) rows.push({name, qty, unit});
  });
  return rows;
}

async function submitPO(root){
  try{
    const lines=collectLines(root);
    if(!lines.length){ toast('เพิ่มรายการก่อน'); return; }
    const body={
      type:'PURCHASE',
      date: $('#poDate',root).value || undefined,
      vendor: $('#poVendor',root).value || undefined,
      project: $('#poProject',root).value || undefined,
      note: $('#poNote',root).value || undefined,
      lines
    };
    const r = await apiPost('submitMovementBulk', body);
    if(!r || r.ok===false) throw new Error(r && r.message || 'Save failed');
    toast('บันทึกใบสั่งซื้อแล้ว: '+(r.docNo||''));
    $('#poLines',root).innerHTML=''; addLineUI(root);
  }catch(e){ toast(e.message); }
}

export function fabActions({root}){
  return [
    { label:'เพิ่มบรรทัด', icon: FabIcons.plus, onClick:()=> addLineUI(root) },
    { label:'บันทึก', icon: FabIcons.save, variant:'primary', onClick:()=> submitPO(root) },
  ];
}

export default async function mountPurchase({root}){
  injectStyles();
  root.innerHTML = viewTemplate();
  bindPickerInputs(root, currentLang());
  addLineUI(root);
}
