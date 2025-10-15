import { $, $$, STR, apiGet, apiPost, bindPickerInputs, openPicker, stockBadge, setBtnLoading, todayStr, toast } from '../js/shared.js';

function setSubmitState(btn, count, lang){
  const lbl = (lang==='th' ? STR.th.save : STR.en.save);
  btn.querySelector('.btn-label').textContent = `${lbl} (${count})`;
  btn.disabled = count<=0;
}
function countLines(root){ return $$('.line', root).length; }

function outLine(lang){
  const card=document.createElement('div'); card.className='line';
  const name=document.createElement('input'); name.placeholder=(lang==='th' ? 'พิมพ์เพื่อค้นหา…' : 'Type to search…'); name.readOnly=true; name.setAttribute('data-picker','materials');
  const qty=document.createElement('input'); qty.type='number'; qty.min='0'; qty.step='any'; qty.placeholder='0'; qty.inputMode='decimal';
  const grid=document.createElement('div'); grid.className='grid'; grid.appendChild(name); grid.appendChild(qty);
  const meta=document.createElement('div'); meta.className='rowitem'; meta.style.justifyContent='flex-start';
  const label=document.createElement('span'); label.className='meta'; label.textContent=(lang==='th' ? 'คงเหลือ:' : 'Stock: ');
  const badge=document.createElement('span'); badge.className='badge'; badge.textContent='-';
  meta.appendChild(label); meta.appendChild(badge);
  const actions=document.createElement('div'); actions.className='actions';
  const rm=document.createElement('button'); rm.type='button'; rm.className='btn small'; rm.textContent='×'; rm.onclick=()=>{ card.remove(); card.dispatchEvent(new CustomEvent('linechange',{bubbles:true})); };
  actions.appendChild(rm);
  card.appendChild(grid); card.appendChild(meta); card.appendChild(actions);
  name.addEventListener('click', ()=>openPicker(name,'materials'));
  name.addEventListener('change', ()=>{ const v=name.value.trim(); if(!v) return;
    apiGet('getCurrentStock',{payload:{material:v}}).then(res=>{
      const n = (res && res.ok) ? Number(res.stock) : null;
      const mn = (res && res.ok) ? Number(res.min||0) : null;
      const bNew = stockBadge(n, mn);
      meta.replaceChild(bNew, badge);
    });
  });
  qty.addEventListener('input', ()=>card.dispatchEvent(new CustomEvent('linechange',{bubbles:true})));
  name.addEventListener('input', ()=>card.dispatchEvent(new CustomEvent('linechange',{bubbles:true})));
  return card;
}

export default async function mount({ root, lang }){
  const S = STR[lang];
  root.innerHTML = `
    <section class="card glass" id="out-card">
      <h3 id="t_out_title">${S.outTitle}</h3>
      <div class="row">
        <div>
          <label id="t_out_date">${S.outDate}</label>
          <input id="OutDate" type="date" />
        </div>
        <div>
          <label id="t_project">${S.proj}</label>
          <input id="ProjectInput" data-picker="projects" placeholder="${S.pick}" readonly />
        </div>
      </div>
      <div class="row">
        <div>
          <label id="t_contractor">${S.contractor}</label>
          <div style="display:flex;gap:.5rem;align-items:center">
            <input id="ContractorInput" data-picker="contractors" placeholder="${S.pickAdd}" readonly />
            <button class="btn small" id="addContractorBtn" type="button">＋</button>
          </div>
        </div>
        <div>
          <label id="t_requester">${S.requester}</label>
          <div style="display:flex;gap:.5rem;align-items:center">
            <input id="RequesterInput" data-picker="requesters" placeholder="${S.pickAdd}" readonly />
            <button class="btn small" id="addRequesterBtn" type="button">＋</button>
          </div>
        </div>
      </div>
      <div class="row">
        <div>
          <label id="t_note">${S.note}</label>
          <input id="Note" placeholder="${lang==='th'?'ถ้ามี':'Optional'}" />
        </div>
      </div>
      <div class="lines" id="outLines"></div>
    </section>

    <div class="toolbar" id="toolbar-out" aria-label="แถบเครื่องมือจ่ายออก">
      <button class="btn" id="addLineBtnOut" type="button"><span class="btn-label">${S.btnAdd}</span><span class="btn-spinner"><span class="spinner"></span></span></button>
      <button class="btn small" id="resetBtnOut" type="button"><span class="btn-label">${S.btnReset}</span><span class="btn-spinner"><span class="spinner"></span></span></button>
      <button class="btn primary" id="submitBtnOut" type="button" disabled><span class="btn-label">${S.btnSubmit} (0)</span><span class="btn-spinner"><span class="spinner"></span></span></button>
    </div>
  `;

  // Keyboard avoidance for floating toolbar
  const tb = $('#toolbar-out');
  const baseOffset = 16;
  function setToolbarBottom(px){ if(tb) tb.style.bottom = `calc(env(safe-area-inset-bottom) + ${px}px)`; }
  if (window.visualViewport){
    const vv = window.visualViewport;
    const update = ()=>{
      const delta = Math.max(0, window.innerHeight - vv.height);
      setToolbarBottom(baseOffset + (delta>0 ? delta + 8 : 0));
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
  }

  const lines = $('#outLines', root);
  const btnAdd = $('#addLineBtnOut', root);
  const btnReset = $('#resetBtnOut', root);
  const btnSubmit = $('#submitBtnOut', root);

  function updateSubmit(){
    const c = countLines(root);
    setSubmitState(btnSubmit, c, lang);
  }

  function addLine(){
    const ln = outLine(lang);
    lines.appendChild(ln);
    bindPickerInputs(root);
    ln.dispatchEvent(new Event('linechange', {bubbles:true}));
    updateSubmit();
  }

  function hardReset(){
    lines.innerHTML=''; addLine();
    $('#Note').value='';
    $('#OutDate').value=todayStr();
    updateSubmit();
  }

  // Events
  btnAdd.addEventListener('click', ()=> addLine());
  btnReset.addEventListener('click', ()=> hardReset());
  root.addEventListener('linechange', updateSubmit);

  // Header pickers
  bindPickerInputs(root);
  $('#ProjectInput').addEventListener('click', ()=>openPicker($('#ProjectInput'),'projects'));
  $('#ContractorInput').addEventListener('click', ()=>openPicker($('#ContractorInput'),'contractors'));
  $('#RequesterInput').addEventListener('click', ()=>openPicker($('#RequesterInput'),'requesters'));
  $('#addContractorBtn').addEventListener('click', ()=>{ openPicker($('#ContractorInput'),'contractors'); });
  $('#addRequesterBtn').addEventListener('click', ()=>{ openPicker($('#RequesterInput'),'requesters'); });

  // Submit
  btnSubmit.addEventListener('click', async ()=>{
    setBtnLoading(btnSubmit, true);
    const p = {
      type:'OUT',
      project: $('#ProjectInput').value.trim(),
      contractor: $('#ContractorInput').value.trim(),
      requester: $('#RequesterInput').value.trim(),
      note: $('#Note').value.trim(),
      date: $('#OutDate').value.trim(),
      lines: collectLines()
    };
    if (!p.lines.length){ setBtnLoading(btnSubmit,false); return toast(lang==='th'?'กรุณาเพิ่มรายการ':'Add at least one line'); }
    try{
      const res = await apiPost('submitMovementBulk', p);
      if(res && res.ok){ toast((lang==='th'?'บันทึกแล้ว • เอกสาร ':'Saved • Doc ')+(res.docNo||'')); hardReset(); }
      else toast((res && res.message) || 'Error');
    } finally {
      setBtnLoading(btnSubmit, false);
    }
  });

  function collectLines(){
    const out=[];
    $$('.line', root).forEach(c=>{
      const nameEl=c.querySelector('input[data-picker="materials"]');
      const qtyEl=c.querySelector('input[type="number"]');
      const name=nameEl?nameEl.value.trim():'';
      const qty=Number(qtyEl?qtyEl.value:0)||0;
      if (name) out.push({name:name, qty:qty});
    });
    return out;
  }

  // Defaults
  $('#OutDate').value=todayStr();
  hardReset();
}
