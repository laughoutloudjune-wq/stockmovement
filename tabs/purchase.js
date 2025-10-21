// tabs/purchase.js — Purchase tab (projects, contractors, requesters, remark; no unit) using global FAB
import { $, $$, esc, apiPost, bindPickerInputs, toast, currentLang } from '../js/shared.js';
import { FabIcons } from '../js/fab.js';

function injectStyles(){
  if (document.getElementById('purchase-tab-styles')) return;
  const css = `
  .poWrap{max-width:1100px;margin:0 auto;padding-inline:min(3vw,16px)}
  .po-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:var(--space-3)}
  /* iPad landscape (≈1024px), Pixel Fold/tablet */
  @media (max-width: 1024px){ .po-grid{grid-template-columns:repeat(8,1fr)} }
  /* iPad portrait / large phones in landscape (≈834px–820px) */
  @media (max-width: 834px){ .po-grid{grid-template-columns:repeat(6,1fr)} }
  /* Typical Android phones (≈600px and down) */
  @media (max-width: 600px){ .po-grid{grid-template-columns:repeat(4,1fr)} }
  /* iPhone 14/15 Pro Max width 430, and smaller iPhones */
  @media (max-width: 430px){ .po-grid{grid-template-columns:1fr} }

  .col-2{grid-column:span 2} .col-3{grid-column:span 3} .col-4{grid-column:span 4} .col-6{grid-column:span 6} .col-8{grid-column:span 8} .col-12{grid-column:1/-1}

  /* Prevent overflow and normalize control sizing */
  .po-grid > *{min-width:0}
  .po-grid input,
  .line-grid input{width:100%;min-width:0;box-sizing:border-box;height:var(--control-h,42px);line-height:var(--control-h,42px);padding:0 .65rem}

  /* Line grid responsiveness */
  .line-grid{display:grid;grid-template-columns:2fr 1fr auto;gap:.75rem;align-items:end}
  @media (max-width: 834px){ .line-grid{grid-template-columns:1fr 1fr auto} }
  @media (max-width: 430px){ .line-grid{grid-template-columns:1fr} .line-grid>div:last-child{justify-content:flex-start} }
`;
  const st=document.createElement('style');
  st.id='purchase-tab-styles';
  st.textContent=css;
  document.head.appendChild(st);
}

function viewTemplate(){
  return `
  <div class="poWrap">
    <section class="card glass">
      <h3 style="margin:0 0 .5rem 0">สั่งซื้อ / Purchase</h3>
      <div class="row po-grid">
        <div class="col-4"><label>โครงการ</label><input id="poProject" data-picker="projects" placeholder="ค้นหาโครงการ…"></div>
        <div class="col-4"><label>ผู้รับเหมา</label><input id="poContractor" data-picker="contractors" placeholder="ค้นหาผู้รับเหมา…"></div>
        <div class="col-4"><label>ผู้ขอเบิก</label><input id="poRequester" data-picker="requesters" placeholder="ค้นหาผู้ขอเบิก…"></div>
        <div class="col-12"><label>หมายเหตุ</label><input id="poNote" placeholder="…"></div>
      </div>
      <div id="poLines"></div>
    </section>
  </div>`;
}

function lineRow({name='', qty=''}={}){
  return `<div class="line"><div class="line-grid">
    <div><label>วัสดุ</label><input class="lnName" data-picker="materials" placeholder="ค้นหาวัสดุ…" value="${esc(name)}"></div>
    <div><label>จำนวน</label><input class="lnQty" type="number" min="0" step="0.01" value="${esc(qty)}"></div>
    <div style="display:flex;align-items:flex-end"><button class="btn small btnRem" type="button">ลบ</button></div>
  </div></div>`;
}

export function addLineUI(root){
  $('#poLines',root).insertAdjacentHTML('beforeend', lineRow({}));
  bindPickerInputs(root, currentLang()); // spreadsheet-driven autocomplete for project/contractor/requester/materials
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
