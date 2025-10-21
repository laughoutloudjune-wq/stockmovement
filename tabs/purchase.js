// tabs/purchase.js — refined UI, proportional boxes
import { $, $$, esc, apiPost, bindPickerInputs, toast, currentLang } from '../js/shared.js';
import { FabIcons } from '../js/fab.js';

function injectStyles(){
  if (document.getElementById('purchase-tab-styles')) return;
  const css = `
  :root{ --space-3:12px; --control-h:42px; }
  .poWrap{max-width:1100px;margin:0 auto;padding:16px}
  .tab-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:var(--space-3)}
  .line-grid{display:grid;grid-template-columns:minmax(320px,2fr) minmax(140px,.9fr) auto;gap:.75rem;align-items:end}
  @media (max-width:700px){ .line-grid{grid-template-columns:1fr 1fr auto} }
  @media (max-width:460px){ .line-grid{grid-template-columns:1fr} .line-actions{justify-content:flex-start} }
  input[type="text"],input[type="number"],input[type="date"]{width:100%;height:var(--control-h);line-height:var(--control-h);box-sizing:border-box;padding:0 .65rem;min-width:0}
  label{display:block;margin:.15rem 0 .35rem .1rem;font-size:.9rem;opacity:.8}
  `;
  const st=document.createElement('style'); st.id='purchase-tab-styles'; st.textContent=css; document.head.appendChild(st);
}

function viewTemplate(){
  return `
  <div class="poWrap">
    <section class="card glass">
      <h3 style="margin:0 0 .75rem 0">สั่งซื้อ / Purchase</h3>
      <div class="tab-grid">
        <div><label>โครงการ</label><input id="poProject" data-picker="projects" placeholder="ค้นหาโครงการ…"></div>
        <div><label>ผู้รับเหมา</label><input id="poContractor" data-picker="contractors" placeholder="ค้นหาผู้รับเหมา…"></div>
        <div><label>ผู้ขอเบิก</label><input id="poRequester" data-picker="requesters" placeholder="ค้นหาผู้ขอเบิก…"></div>
        <div style="grid-column:1/-1"><label>หมายเหตุ</label><input id="poNote" placeholder="…"></div>
      </div>
      <div id="poLines"></div>
    </section>
  </div>`;
}

function lineRow({name='', qty=''}={}){
  return `<div class="line"><div class="line-grid">
    <div><label>วัสดุ</label><input class="lnName" data-picker="materials" placeholder="ค้นหาวัสดุ…" value="${esc(name)}"></div>
    <div><label>จำนวน</label><input class="lnQty" type="number" min="0" step="0.01" value="${esc(qty)}"></div>
    <div class="line-actions"><button class="btn small btnRem" type="button">ลบ</button></div>
  </div></div>`;
}

export function addLineUI(root){
  $('#poLines',root).insertAdjacentHTML('beforeend', lineRow({}));
  bindPickerInputs(root, currentLang());
  $$('#poLines .btnRem',root).forEach(b=> b.onclick=()=> b.closest('.line')?.remove());
}

function collectLines(root){
  const rows=[];
  $$('#poLines .line',root).forEach(line=>{
    const name=$('.lnName',line).value.trim();
    const qty=Number($('.lnQty',line).value);
    if(name && isFinite(qty) && qty>0) rows.push({name, qty});
  });
  return rows;
}

export async function submitPO(root){
  try{
    const lines=collectLines(root);
    if(!lines.length){ toast('เพิ่มรายการก่อน'); return; }
    const body={
      type:'PURCHASE',
      project: $('#poProject',root).value || undefined,
      contractor: $('#poContractor',root).value || undefined,
      requester: $('#poRequester',root).value || undefined,
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
