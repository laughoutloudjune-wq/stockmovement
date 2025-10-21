// tabs/adjust.js — refined UI, proportional boxes
import { $, $$, esc, todayStr, apiPost, bindPickerInputs, toast, currentLang } from '../js/shared.js';
import { FabIcons } from '../js/fab.js';

function injectStyles(){
  if (document.getElementById('adjust-tab-styles')) return;
  const css = `
  :root{ --space-3:12px; --control-h:42px; }
  .adjWrap{max-width:1000px;margin:0 auto;padding:16px}
  .tab-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:var(--space-3)}
  .line-grid{display:grid;grid-template-columns:minmax(320px,2fr) minmax(140px,.9fr) auto;gap:.75rem;align-items:end}
  @media (max-width:700px){ .line-grid{grid-template-columns:1fr 1fr auto} }
  @media (max-width:460px){ .line-grid{grid-template-columns:1fr} .line-actions{justify-content:flex-start} }
  input[type="text"],input[type="number"],input[type="date"]{width:100%;height:var(--control-h);line-height:var(--control-h);box-sizing:border-box;padding:0 .65rem;min-width:0}
  label{display:block;margin:.15rem 0 .35rem .1rem;font-size:.9rem;opacity:.8}
  `;
  const st=document.createElement('style'); st.id='adjust-tab-styles'; st.textContent=css; document.head.appendChild(st);
}

function viewTemplate(){
  return `
  <div class="adjWrap">
    <section class="card glass">
      <h3 style="margin:0 0 .75rem 0">ปรับยอด / Adjust</h3>
      <div class="tab-grid">
        <div><label>วันที่</label><input id="adjDate" type="date" value="${todayStr()}"></div>
      </div>
      <div id="adjLines"></div>
    </section>
  </div>`;
}

function lineRow({name='', delta=''}={}){
  return `<div class="line"><div class="line-grid">
    <div><label>วัสดุ</label><input class="lnName" data-picker="materials" placeholder="ค้นหาวัสดุ…" value="${esc(name)}"></div>
    <div><label>ปรับ (+/−)</label><input class="lnDelta" type="number" step="0.01" value="${esc(delta)}"></div>
    <div class="line-actions"><button class="btn small btnRem" type="button">ลบ</button></div>
  </div></div>`;
}

export function addLineUI(root){
  $('#adjLines',root).insertAdjacentHTML('beforeend', lineRow({}));
  bindPickerInputs(root, currentLang());
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
  addLineUI(root);
}
