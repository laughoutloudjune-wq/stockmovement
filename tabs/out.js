// tabs/out.js
// Material OUT screen with speed-dial FAB (“Add Item” + “Submit Form”).
// Unit field removed. Restores "Current Stock" badge per line.

import {
  $, $$, STR, bindPickerInputs, openPicker,
  apiGet, apiPost, setBtnLoading, esc, toast, todayStr, stockBadge
} from '../js/shared.js';

function OutLine(lang){
  const card=document.createElement('div'); 
  card.className='line';

  // Inputs
  const name=document.createElement('input');
  name.placeholder=(lang==='th' ? 'พิมพ์เพื่อค้นหา…' : 'Type to search…');
  name.readOnly=true; 
  name.setAttribute('data-picker','materials');

  const qty=document.createElement('input');
  qty.type='number'; 
  qty.min='0'; 
  qty.step='any'; 
  qty.placeholder='0'; 
  qty.inputMode='decimal';

  const note=document.createElement('input');
  note.placeholder=(lang==='th'?'หมายเหตุ (ถ้ามี)':'Note (optional)');

  // Grid (name, qty, note)
  const grid=document.createElement('div'); 
  grid.className='grid';
  grid.appendChild(name);
  grid.appendChild(qty);
  grid.appendChild(note);

  // Meta row: Stock badge
  const meta=document.createElement('div'); 
  meta.className='rowitem'; 
  meta.style.justifyContent='flex-start';

  const label=document.createElement('span'); 
  label.className='meta'; 
  label.textContent = (lang==='th' ? 'คงเหลือ: ' : 'Stock: ');

  // start as "-" badge
  let badge = document.createElement('span'); 
  badge.className='badge'; 
  badge.textContent='-';

  meta.appendChild(label); 
  meta.appendChild(badge);

  // Row actions
  const actions=document.createElement('div'); 
  actions.className='actions';
  const rm=document.createElement('button'); 
  rm.type='button'; 
  rm.className='btn small'; 
  rm.textContent='×'; 
  rm.onclick=()=>card.remove();
  actions.appendChild(rm);

  // Compose line
  card.appendChild(grid); 
  card.appendChild(meta); 
  card.appendChild(actions);

  // Open picker
  name.addEventListener('click', ()=>openPicker(name,'materials', lang));

  // Stock badge
  name.addEventListener('change', async ()=>{
    const v=name.value.trim();
    if(!v){
      const bNew = document.createElement('span');
      bNew.className='badge'; 
      bNew.textContent='-';
      meta.replaceChild(bNew, badge);
      badge = bNew;
      return;
    }

    const spin=document.createElement('span');
    spin.className = 'badge';
    spin.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px"></span>';
    meta.replaceChild(spin, badge);
    badge = spin;

    try{
      const res = await apiGet('getCurrentStock', { material: v });
      const n  = (res && res.ok) ? Number(res.stock) : null;
      const mn = (res && res.ok) ? Number(res.min||0) : null;
      const bNew = stockBadge(n, mn); // uses shared color logic (red/yellow/green)
      meta.replaceChild(bNew, badge);
      badge = bNew;
    }catch(e){
      const bErr = document.createElement('span');
      bErr.className='badge red';
      bErr.textContent='!';
      meta.replaceChild(bErr, badge);
      badge = bErr;
    }
  });

  return card;
}

function collectLines(rootSel){
  const out=[];
  $$(rootSel+' .line').forEach(c=>{
    const nameEl=c.querySelector('input[data-picker="materials"]');
    const qtyEl=c.querySelector('input[type="number"]');
    const noteEl=c.querySelector('input[placeholder^="หมายเหตุ"],input[placeholder^="Note"]');
    const name=nameEl?nameEl.value.trim():'';
    const qty=Number(qtyEl?qtyEl.value:0)||0;
    const note=noteEl?noteEl.value.trim():'';
    if (name) out.push({name, qty, note});
  });
  return out;
}

export default async function mount({ root, lang }){
  const S = STR[lang];

  root.innerHTML = `
    <section class="card glass">
      <h3>${S.outTitle}</h3>
      <div class="row">
        <div>
          <label>${S.outDate}</label>
          <input id="OutDate" type="date" />
        </div>
        <div>
          <label>${S.proj}</label>
          <input id="ProjectInput" data-picker="projects" placeholder="${S.pick}" readonly />
        </div>
      </div>
      <div class="row">
        <div>
          <label>${S.contractor}</label>
          <input id="ContractorInput" data-picker="contractors" placeholder="${S.pickAdd}" readonly />
        </div>
        <div>
          <label>${S.requester}</label>
          <input id="RequesterInput" data-picker="requesters" placeholder="${S.pickAdd}" readonly />
        </div>
      </div>
      <div class="row">
        <div>
          <label>${S.note}</label>
          <input id="Note" placeholder="${lang==='th'?'ถ้ามี':'Optional'}" />
        </div>
      </div>

      <div class="lines" id="outLines"></div>

      <div style="text-align:right;margin-top:.5rem;">
        <button class="btn small" id="openOutHistoryBtn">📜 ${lang==='th'?'ประวัติการจ่ายออก':'OUT History'}</button>
      </div>
    </section>

    <div class="fab" id="fab">
      <div class="mini" id="fabSubmitWrap" aria-hidden="true">
        <div class="label">${S.btnSubmit}</div>
        <button class="btn small primary" id="fabSubmitBtn" type="button">
          <span class="btn-label">💾</span><span class="btn-spinner"><span class="spinner"></span></span>
        </button>
      </div>
      <div class="mini" id="fabAddWrap" aria-hidden="true">
        <div class="label">${S.btnAdd}</div>
        <button class="btn small" id="fabAddBtn" type="button">
          <span class="btn-label">＋</span><span class="btn-spinner"><span class="spinner"></span></span>
        </button>
      </div>
      <button class="fab-main" id="fabMain" aria-expanded="false" aria-controls="fab"><span class="icon">＋</span></button>
    </div>
  `;

  // local helpers
  const lines=$('#outLines',root);
  function addLine(){ lines.appendChild(OutLine(lang)); bindPickerInputs(root,lang); }
  function clearForm(){
    lines.innerHTML=''; addLine();
    $('#Note',root).value=''; $('#OutDate',root).value=todayStr();
    $('#ProjectInput',root).value=''; $('#ContractorInput',root).value=''; $('#RequesterInput',root).value='';
  }

  // FAB behavior
  const fab = $('#fab', root);
  const fabMain = $('#fabMain', root);
  const fabAdd = $('#fabAddBtn', root);
  const fabSubmit = $('#fabSubmitBtn', root);

  function toggleFab(){
    const expanded = fab.classList.toggle('expanded');
    fabMain.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }
  fabMain.addEventListener('click', toggleFab);
  fabAdd.addEventListener('click', addLine);

  fabSubmit.addEventListener('click', async ()=>{
    setBtnLoading(fabSubmit, true);
    const p = {
      type:'OUT',
      project: $('#ProjectInput', root).value.trim(),
      contractor: $('#ContractorInput', root).value.trim(),
      requester: $('#RequesterInput', root).value.trim(),
      note: $('#Note', root).value.trim(),
      date: $('#OutDate', root).value.trim(),
      lines: collectLines('#outLines')
    };
    if (!p.lines.length){
      setBtnLoading(fabSubmit,false); 
      return toast(lang==='th'?'กรุณาเพิ่มรายการ':'Add at least one line');
    }
    try{
      const res = await apiPost('submitMovementBulk', p);
      if(res && res.ok){
        toast((lang==='th'?'บันทึกแล้ว • เอกสาร ':'Saved • Doc ') + (res.docNo||''));
        clearForm();
      }else{
        toast((res && res.message) || 'Error');
      }
    }catch{
      toast(lang==='th'?'เกิดข้อผิดพลาดในการบันทึก':'Failed to submit');
    }finally{
      setBtnLoading(fabSubmit, false);
      fab.classList.remove('expanded');
      fabMain.setAttribute('aria-expanded','false');
    }
  });

  // Header pickers
  $('#ProjectInput', root).addEventListener('click', ()=>openPicker($('#ProjectInput', root),'projects', lang));
  $('#ContractorInput', root).addEventListener('click', ()=>openPicker($('#ContractorInput', root),'contractors', lang));
  $('#RequesterInput', root).addEventListener('click', ()=>openPicker($('#RequesterInput', root),'requesters', lang));

  // Init
  $('#OutDate', root).value=todayStr();
  addLine();

  // 🔗 Open OUT History tab (no layout change)
  $('#openOutHistoryBtn', root)?.addEventListener('click', ()=>{
    window.dispatchEvent(new CustomEvent('switch-tab',{ detail:'out_history' }));
  });
}
