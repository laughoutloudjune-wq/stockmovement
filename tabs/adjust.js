// tabs/adjust.js — Adjust tab, wired to global FAB
import { $, $$, esc, todayStr, apiPost, bindPickerInputs, toast, currentLang } from '../js/shared.js';
import { FabIcons } from '../js/fab.js';

function injectStyles(){
  if (document.getElementById('adjust-tab-styles')) return;
  const css = `
  .adjWrap{max-width:1000px;margin:0 auto;padding-inline:min(3vw,16px)}
  .adj-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:var(--space-3)}
  @media (max-width:980px){.adj-grid{grid-template-columns:repeat(6,1fr)}}
  @media (max-width:640px){.adj-grid{grid-template-columns:1fr}}
  .col-3{grid-column:span 3}.col-4{grid-column:span 4}.col-6{grid-column:span 6}.col-12{grid-column:1/-1}
  .adj-grid input[type="date"]{height:var(--control-h,42px);line-height:var(--control-h,42px);padding:0 .65rem}
  .line-grid{display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:.75rem}
  @media (max-width:720px){.line-grid{grid-template-columns:1fr 1fr 1fr auto}}
  @media (max-width:520px){.line-grid{grid-template-columns:1fr}}`;
  const st=document.createElement('style'); st.id='adjust-tab-styles'; st.textContent=css; document.head.appendChild(st);
}

function viewTemplate(){
  return `
  <div class="adjWrap">
    <section class="card glass">
      <h3 style="margin:0 0 .5rem 0">ปรับยอด / Adjust</h3>
      <div class="row adj-grid">
        <div class="col-3"><label>วันที่</label><input id="adjDate" type="date" value="${todayStr()}"></div>
        <div class="col-6"><label>สาเหตุ</label><input id="adjReason" placeholder="เช่น นับสต๊อก/ชำรุด/อื่นๆ"></div>
        <div class="col-12"><label>หมายเหตุ</label><input id="adjNote" placeholder="…"></div>
      </div>
      <div id="adjLines"></div>
    </section>
  </div>`;
}

function lineRow({name='', delta=''}={}){
  return `<div class="line"><div class="line-grid">
    <div><label>วัสดุ</label><input class="lnName" data-picker="materials" placeholder="เลือก…" value="${esc(name)}"></div>
    <div><label>เพิ่ม/ลด</label><input class="lnDelta" type="number" step="0.01" value="${esc(delta)}"></div>
    <div><label>หน่วย</label><input class="lnUnit" data-picker="units" placeholder="—"></div>
    <div style="display:flex;align-items:flex-end"><button class="btn small btnRem" type="button">ลบ</button></div>
  </div></div>`;
}

function addLineUI(root){
  $('#adjLines',root).insertAdjacentHTML('beforeend', lineRow({}));
  bindPickerInputs(root, currentLang());
  $$('#adjLines .btnRem',root).forEach(b=> b.onclick=()=> b.closest('.line')?.remove());
}

function collectLines(root){
  const rows=[];
  $$('#adjLines .line',root).forEach(line=>{
    const name=$('.lnName',line).value.trim();
    const delta=Number($('.lnDelta',line).value);
    const unit=$('.lnUnit',line).value.trim() || undefined;
    if(name && delta){ rows.push({name, delta, unit}); }
  });
  return rows;
}

async function submitAdjust(root){
  try{
    const lines=collectLines(root);
    if(!lines.length){ toast('เพิ่มรายการก่อน'); return; }
    const body={
      type:'ADJUST',
      date: $('#adjDate',root).value || undefined,
      reason: $('#adjReason',root).value || undefined,
      note: $('#adjNote',root).value || undefined,
      lines
    };
    const r = await apiPost('submitMovementBulk', body);
    if(!r || r.ok===false) throw new Error(r && r.message || 'Save failed');
    toast('บันทึกการปรับยอดแล้ว: '+(r.docNo||''));
    $('#adjLines',root).innerHTML=''; addLineUI(root);
  }catch(e){ toast(e.message); }
}

export function fabActions({root}){
  return [
    { label:'เพิ่มบรรทัด', icon: FabIcons.plus, onClick:()=> addLineUI(root) },
    { label:'บันทึก', icon: FabIcons.save, variant:'primary', onClick:()=> submitAdjust(root) },
  ];
}

export default async function mountAdjust({root}){
  injectStyles();
  root.innerHTML = viewTemplate();
  bindPickerInputs(root, currentLang());
  addLineUI(root);
}
