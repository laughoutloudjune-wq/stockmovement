// tabs/in.js — IN tab, wired to global FAB
import { $, $$, esc, todayStr, apiGet, apiPost, bindPickerInputs, toast, setBtnLoading, currentLang, stockBadge } from '../js/shared.js';
import { FabIcons } from '../js/fab.js';

function injectStyles(){
  if (document.getElementById('in-tab-styles')) return;
  const css = `
  .inWrap{max-width:1100px;margin:0 auto;padding-inline:min(3vw,16px)}
  .in-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:var(--space-3)}
  @media (max-width:980px){.in-grid{grid-template-columns:repeat(6,1fr)}}
  @media (max-width:640px){.in-grid{grid-template-columns:1fr}}
  .col-3{grid-column:span 3}.col-4{grid-column:span 4}.col-6{grid-column:span 6}.col-12{grid-column:1/-1}
  .in-grid input{width:100%;min-width:0}
  .in-grid input[type="date"]{height:var(--control-h,42px);line-height:var(--control-h,42px);padding:0 .65rem}
  .line-grid{display:grid;grid-template-columns:2fr 1fr auto;gap:.75rem}
  @media (max-width:720px){.line-grid{grid-template-columns:1fr 1fr auto}}
  @media (max-width:520px){.line-grid{grid-template-columns:1fr}}`;
  const st=document.createElement('style'); st.id='in-tab-styles'; st.textContent=css; document.head.appendChild(st);
}

function viewTemplate(){
  return `
  <div class="inWrap">
    <section class="card glass">
      <h3 style="margin:0 0 .5rem 0">รับเข้า / IN</h3>
      <div class="row in-grid">
        <div class="col-3"><label>วันที่</label><input id="inDate" type="date" value="${todayStr()}"></div>
        <div class="col-3"><label>โครงการ</label><input id="inProject" data-picker="projects" placeholder="เลือกจากรายการ…"></div>
        <div class="col-3"><label>ผู้ขาย</label><input id="inVendor" data-picker="vendors" placeholder="เลือกจากรายการ…"></div>
        <div class="col-3"><label>ผู้รับ</label><input id="inReceiver" data-picker="requesters" placeholder="เลือกจากรายการ…"></div>
        <div class="col-12"><label>หมายเหตุ</label><input id="inNote" placeholder="…"></div>
      </div>
      <div id="inLines"></div>
    </section>
  </div>`;
}

function lineRow({name='', qty=''}={}){
  return `<div class="line"><div class="line-grid">
    <div><label>วัสดุ</label><input class="lnName" data-picker="materials" placeholder="เลือก…" value="${esc(name)}"></div>
    <div><label>จำนวน</label><input class="lnQty" type="number" min="0" step="0.01" value="${esc(qty)}"></div>
    <div style="display:flex;align-items:flex-end"><button class="btn small btnRem" type="button">ลบ</button></div>
  </div></div>`;
}

function addLineUI(root){
  $('#inLines',root).insertAdjacentHTML('beforeend', lineRow({}));
  bindPickerInputs(root, currentLang());
  $$('#inLines .btnRem',root).forEach(b=> b.onclick=()=> b.closest('.line')?.remove());
}

function collectLines(root){
  const rows=[];
  $$('#inLines .line',root).forEach(line=>{
    const name=$('.lnName',line).value.trim();
    const qty=Number($('.lnQty',line).value);
    if(name && isFinite(qty) && qty>0) rows.push({name, qty});
  });
  return rows;
}

async function submitIn(root){
  try{
    const lines=collectLines(root);
    if(!lines.length){ toast('เพิ่มรายการก่อน'); return; }
    const body={
      type:'IN',
      date: $('#inDate',root).value || undefined,
      project: $('#inProject',root).value || undefined,
      vendor: $('#inVendor',root).value || undefined,
      receiver: $('#inReceiver',root).value || undefined,
      note: $('#inNote',root).value || undefined,
      lines
    };
    const r = await apiPost('submitMovementBulk', body);
    if(!r || r.ok===false) throw new Error(r && r.message || 'Save failed');
    toast('บันทึกการรับเข้าแล้ว: '+(r.docNo||''));
    $('#inLines',root).innerHTML=''; addLineUI(root);
  }catch(e){ toast(e.message); }
}

export function fabActions({root}){
  return [
    { label:'เพิ่มบรรทัด', icon: FabIcons.plus, onClick:()=> addLineUI(root) },
    { label:'บันทึก', icon: FabIcons.save, variant:'primary', onClick:()=> submitIn(root) },
  ];
}

export default async function mountIn({root}){
  injectStyles();
  root.innerHTML = viewTemplate();
  bindPickerInputs(root, currentLang());
  addLineUI(root);
}
