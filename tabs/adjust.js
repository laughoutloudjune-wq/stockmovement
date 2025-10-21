// tabs/adjust.js — Adjust tab (date + material list only, no unit) using global FAB
import { $, $$, esc, todayStr, apiPost, bindPickerInputs, toast, currentLang } from '../js/shared.js';
import { FabIcons } from '../js/fab.js';

function injectStyles(){
  if (document.getElementById('adjust-tab-styles')) return;
  const css = `
  .adjWrap{max-width:1100px;margin:0 auto;padding-inline:min(3vw,16px)}
  .adj-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:var(--space-3)}
  /* iPad landscape (≈1024px), Pixel Fold/tablet */
  @media (max-width: 1024px){ .adj-grid{grid-template-columns:repeat(8,1fr)} }
  /* iPad portrait / large phones in landscape (≈834px–820px) */
  @media (max-width: 834px){ .adj-grid{grid-template-columns:repeat(6,1fr)} }
  /* Typical Android phones (≈600px and down) */
  @media (max-width: 600px){ .adj-grid{grid-template-columns:repeat(4,1fr)} }
  /* iPhone 14/15 Pro Max width 430, and smaller iPhones */
  @media (max-width: 430px){ .adj-grid{grid-template-columns:1fr} }

  .col-2{grid-column:span 2} .col-3{grid-column:span 3} .col-4{grid-column:span 4} .col-6{grid-column:span 6} .col-8{grid-column:span 8} .col-12{grid-column:1/-1}

  /* Prevent overflow and normalize control sizing */
  .adj-grid > *{min-width:0}
  .adj-grid input,
  .line-grid input{width:100%;min-width:0;box-sizing:border-box;height:var(--control-h,42px);line-height:var(--control-h,42px);padding:0 .65rem}

  /* Line grid responsiveness */
  .line-grid{display:grid;grid-template-columns:2fr 1fr auto;gap:.75rem;align-items:end}
  @media (max-width: 834px){ .line-grid{grid-template-columns:1fr 1fr auto} }
  @media (max-width: 430px){ .line-grid{grid-template-columns:1fr} .line-grid>div:last-child{justify-content:flex-start} }

  /* Ensure pickers are visible above cards/overlays */
  .picker-popover, .picker-menu, .autocomplete-panel, .picker-dropdown { position: fixed; z-index: 5001; }
`;
  const st=document.createElement('style'); st.id='adjust-tab-styles'; st.textContent=css; document.head.appendChild(st);
}

function viewTemplate(){
  return `
  <div class="adjWrap">
    <section class="card glass">
      <h3 style="margin:0 0 .5rem 0">ปรับยอด / Adjust</h3>
      <div class="row adj-grid">
        <div class="col-3"><label>วันที่</label><input id="adjDate" type="date" value="${todayStr()}"></div>
      </div>
      <div id="adjLines"></div>
    </section>
  </div>`;
}

function lineRow({name='', delta=''}={}){
  return `<div class="line"><div class="line-grid">
    <div><label>วัสดุ</label><input class="lnName" data-picker="materials" placeholder="ค้นหาวัสดุ…" value="${esc(name)}"></div>
    <div><label>ปรับ (+/−)</label><input class="lnDelta" type="number" step="0.01" value="${esc(delta)}"></div>
    <div style="display:flex;align-items:flex-end"><button class="btn small btnRem" type="button">ลบ</button></div>
  </div></div>`;
}

export function addLineUI(root){
  $('#adjLines',root).insertAdjacentHTML('beforeend', lineRow({}));
  bindPickerInputs(root, currentLang());
  bindPickerInputs(document, currentLang()); // spreadsheet autocomplete for materials
  $$('#adjLines .btnRem',root).forEach(b=> b.onclick=()=> b.closest('.line')?.remove());
}

function collectLines(root){
  const rows=[];
  $$('#adjLines .line',root).forEach(line=>{
    const name=$('.lnName',line).value.trim();
    const delta=Number($('.lnDelta',line).value);
    if(name && delta){ rows.push({name, delta}); }
  });
  return rows;
}

export async function submitAdjust(root){
  try{
    const lines=collectLines(root);
    if(!lines.length){ toast('เพิ่มรายการก่อน'); return; }
    const body={ type:'ADJUST', date: $('#adjDate',root).value || undefined, lines };
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
  bindPickerInputs(document, currentLang());
  addLineUI(root);
}
