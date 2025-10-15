import { $, $$, STR, bindPickerInputs, openPicker, apiPost, setBtnLoading, toast } from '../js/shared.js';

function setSubmitState(btn, count, lang){
  const lbl = (lang==='th' ? STR.th.save : STR.en.save);
  btn.querySelector('.btn-label').textContent = `${lbl} (${count})`;
  btn.disabled = count<=0;
}
function countLines(root){ return $$('.line', root).length; }

function adjLine(lang){
  const card=document.createElement('div'); card.className='line';
  const name=document.createElement('input'); name.placeholder=(lang==='th' ? 'พิมพ์เพื่อค้นหา…' : 'Type to search…'); name.readOnly=true; name.setAttribute('data-picker','materials');
  const qty=document.createElement('input'); qty.type='number'; qty.step='any'; qty.placeholder='±'; qty.inputMode='decimal';
  const grid=document.createElement('div'); grid.className='grid'; grid.appendChild(name); grid.appendChild(qty);
  const actions=document.createElement('div'); actions.className='actions';
  const rm=document.createElement('button'); rm.type='button'; rm.className='btn small'; rm.textContent='×'; rm.onclick=()=>{ card.remove(); card.dispatchEvent(new CustomEvent('linechange',{bubbles:true})); };
  actions.appendChild(rm);
  card.appendChild(grid); card.appendChild(actions);
  name.addEventListener('click', ()=>openPicker(name,'materials'));
  qty.addEventListener('input', ()=>card.dispatchEvent(new CustomEvent('linechange',{bubbles:true})));
  name.addEventListener('input', ()=>card.dispatchEvent(new CustomEvent('linechange',{bubbles:true})));
  return card;
}

export default async function mount({ root, lang }){
  const S = STR[lang];
  root.innerHTML = `
    <section class="card glass">
      <h3 id="t_adjust_title">${S.adjTitle}</h3>
      <div class="lines" id="adjLines"></div>
      <div class="row" style="justify-content:flex-end; gap:.6rem">
        <button class="btn" id="addLineBtnAdj" type="button"><span class="btn-label">${S.btnAdd}</span><span class="btn-spinner"><span class="spinner"></span></span></button>
        <button class="btn" id="resetBtnAdj" type="button"><span class="btn-label">${S.btnReset}</span><span class="btn-spinner"><span class="spinner"></span></span></button>
        <button class="btn primary" id="submitBtnAdj" type="button" disabled><span class="btn-label">${S.btnSubmit} (0)</span><span class="btn-spinner"><span class="spinner"></span></span></button>
      </div>
    </section>
  `;

  const lines = $('#adjLines', root);
  const btnAdd = $('#addLineBtnAdj', root);
  const btnReset = $('#resetBtnAdj', root);
  const btnSubmit = $('#submitBtnAdj', root);

  function updateSubmit(){
    const c = countLines(root);
    setSubmitState(btnSubmit, c, lang);
  }

  function addLine(){
    const ln = adjLine(lang);
    lines.appendChild(ln);
    bindPickerInputs(root);
    ln.dispatchEvent(new Event('linechange', {bubbles:true}));
    updateSubmit();
  }
  function hardReset(){ lines.innerHTML=''; addLine(); updateSubmit(); }

  btnAdd.addEventListener('click', addLine);
  btnReset.addEventListener('click', hardReset);
  root.addEventListener('linechange', updateSubmit);

  btnSubmit.addEventListener('click', async ()=>{
    setBtnLoading(btnSubmit, true);
    const p = { type:'ADJUST', lines: collectLines() };
    if (!p.lines.length){ setBtnLoading(btnSubmit,false); return toast(lang==='th'?'กรุณาเพิ่มรายการ':'Add at least one line'); }
    try{
      const res = await apiPost('submitMovementBulk', p);
      if(res && res.ok){ toast(lang==='th'?'บันทึกแล้ว':'Saved'); hardReset(); }
      else toast((res && res.message) || 'Error');
    } finally { setBtnLoading(btnSubmit, false); }
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

  hardReset();
}
