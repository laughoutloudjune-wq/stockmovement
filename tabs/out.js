// tabs/out.js
// Material OUT screen with speed-dial FAB (“Add Item” + “Submit Form”).
// Unit field removed per request.

import {
  $, $$, STR, bindPickerInputs, openPicker,
  apiPost, setBtnLoading, esc, toast, todayStr
} from '../js/shared.js';

function OutLine(lang){
  const card=document.createElement('div'); card.className='line';
  const name=document.createElement('input');
  name.placeholder=(lang==='th' ? 'พิมพ์เพื่อค้นหา…' : 'Type to search…');
  name.readOnly=true; name.setAttribute('data-picker','materials');

  const qty=document.createElement('input');
  qty.type='number'; qty.min='0'; qty.step='any'; qty.placeholder='0'; qty.inputMode='decimal';

  const note=document.createElement('input');
  note.placeholder=(lang==='th'?'หมายเหตุ (ถ้ามี)':'Note (optional)');

  const grid=document.createElement('div'); grid.className='grid';
  grid.appendChild(name);
  grid.appendChild(qty);
  grid.appendChild(note);

  const actions=document.createElement('div'); actions.className='actions';
  const rm=document.createElement('button'); rm.type='button'; rm.className='btn small'; rm.textContent='×'; rm.onclick=()=>card.remove();
  actions.appendChild(rm);

  card.appendChild(grid); card.appendChild(actions);
  name.addEventListener('click', ()=>openPicker(name,'materials', lang));
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

  const lines = $('#outLines', root);

  function addLine(){ lines.appendChild(OutLine(lang)); bindPickerInputs(root, lang); }

  function clearForm(){
    lines.innerHTML=''; addLine();
    $('#Note', root).value='';
    $('#OutDate', root).value=todayStr();
    $('#ProjectInput', root).value='';
    $('#ContractorInput', root).value='';
    $('#RequesterInput', root).value='';
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
  fabAdd.addEventListener('click', ()=>{ addLine(); });

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
    if (!p.lines.length){ setBtnLoading(fabSubmit,false); return toast(lang==='th'?'กรุณาเพิ่มรายการ':'Add at least one line'); }
    try{
      const res = await apiPost('submitMovementBulk', p);
      if(res && res.ok){
        toast((lang==='th'?'บันทึกแล้ว • เอกสาร ':'Saved • Doc ')+(res.docNo||''));
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

  // Header pickers
  $('#ProjectInput', root).addEventListener('click', ()=>openPicker($('#ProjectInput', root),'projects', lang));
  $('#ContractorInput', root).addEventListener('click', ()=>openPicker($('#ContractorInput', root),'contractors', lang));
  $('#RequesterInput', root).addEventListener('click', ()=>openPicker($('#RequesterInput', root),'requesters', lang));

  // Init
  $('#OutDate', root).value=todayStr();
  addLine();
}