// tabs/adjust.js
// Stock ADJUST screen with speed-dial FAB (“Add Item” + “Submit Form”).
// Reset button removed.

import {
  $, $$, STR, bindPickerInputs, openPicker,
  apiPost, setBtnLoading, esc, toast
} from '../js/shared.js';

function AdjLine(lang){
  const card=document.createElement('div'); card.className='line';
  const name=document.createElement('input'); name.placeholder=(lang==='th' ? 'พิมพ์เพื่อค้นหา…' : 'Type to search…'); name.readOnly=true; name.setAttribute('data-picker','materials');
  const qty=document.createElement('input'); qty.type='number'; qty.step='any'; qty.placeholder='±'; qty.inputMode='decimal';
  const grid=document.createElement('div'); grid.className='grid';
  grid.appendChild(name); grid.appendChild(qty);
  const actions=document.createElement('div'); actions.className='actions';
  const rm=document.createElement('button'); rm.type='button'; rm.className='btn small'; rm.textContent='×'; rm.onclick=()=>card.remove();
  actions.appendChild(rm);
  card.appendChild(grid); card.appendChild(actions);
  name.addEventListener('click', ()=>openPicker(name,'materials', lang));
  return card;
}

function collectLines(root){
  const out=[];
  $$('.line', root).forEach(c=>{
    const nameEl=c.querySelector('input[data-picker="materials"]');
    const qtyEl=c.querySelector('input[type="number"]');
    const name=nameEl?nameEl.value.trim():'';
    const qty=Number(qtyEl?qtyEl.value:0)||0;
    if (name) out.push({name, qty});
  });
  return out;
}

export default async function mount({ root, lang }){
  const S = STR[lang];

  root.innerHTML = `
    <section class="card glass">
      <h3>${S.adjTitle}</h3>
      <div class="lines" id="adjLines"></div>
    </section>

    <!-- Speed-Dial FAB -->
    <div class="fab" id="fab">
      <div class="mini" id="fabSubmitWrap" aria-hidden="true">
        <div class="label">${S.btnSubmit}</div>
        <button class="btn small primary" id="fabSubmitBtn" type="button">
          <span class="btn-label">💾</span>
          <span class="btn-spinner"><span class="spinner"></span></span>
        </button>
      </div>
      <div class="mini" id="fabAddWrap" aria-hidden="true">
        <div class="label">${S.btnAdd}</div>
        <button class="btn small" id="fabAddBtn" type="button">
          <span class="btn-label">＋</span>
          <span class="btn-spinner"><span class="spinner"></span></span>
        </button>
      </div>
      <button class="fab-main" id="fabMain" aria-expanded="false" aria-controls="fab">
        <span class="icon">＋</span>
      </button>
    </div>
  `;

  const lines = $('#adjLines', root);

  function addLine(){ lines.appendChild(AdjLine(lang)); bindPickerInputs(root, lang); }
  function clearForm(){ lines.innerHTML=''; addLine(); }

  // FAB
  const fab = $('#fab', root);
  const fabMain = $('#fabMain', root);
  const fabAdd = $('#fabAddBtn', root);
  const fabSubmit = $('#fabSubmitBtn', root);

  function toggleFab(){
    const expanded = fab.classList.toggle('expanded');
    fabMain.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }
  fabMain.addEventListener('click', toggleFab);
  fabAdd.addEventListener('click', ()=>{ addLine(); });

  fabSubmit.addEventListener('click', async ()=>{
    setBtnLoading(fabSubmit, true);
    const p = { type:'ADJUST', lines: collectLines(root) };
    if (!p.lines.length){ setBtnLoading(fabSubmit,false); return toast(lang==='th'?'กรุณาเพิ่มรายการ':'Add at least one line'); }
    try{
      const res = await apiPost('submitMovementBulk', p);
      if(res && res.ok){
        toast(lang==='th'?'บันทึกแล้ว':'Saved');
        clearForm();
      } else {
        toast((res && res.message) || 'Error');
      }
    } catch{
      toast(lang==='th'?'เกิดข้อผิดพลาดในการบันทึก':'Failed to submit');
    } finally {
      setBtnLoading(fabSubmit, false);
      fab.classList.remove('expanded');
      fabMain.setAttribute('aria-expanded','false');
    }
  });

  // Init
  addLine();
}