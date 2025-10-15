import { $, $$, STR, bindPickerInputs, openPicker, apiGet, apiPost, setBtnLoading, clampList, esc, toast } from '../js/shared.js';

function setSubmitState(btn, count, lang){
  const lbl = (lang==='th' ? STR.th.save : STR.en.save);
  btn.querySelector('.btn-label').textContent = `${lbl} (${count})`;
  btn.disabled = count<=0;
}
function countLines(root){ return $$('.line', root).length; }

function purLine(lang){
  const card=document.createElement('div'); card.className='line';
  const name=document.createElement('input'); name.placeholder=(lang==='th' ? 'พิมพ์เพื่อค้นหา…' : 'Type to search…'); name.readOnly=true; name.setAttribute('data-picker','materials');
  const qty=document.createElement('input'); qty.type='number'; qty.min='0'; qty.step='any'; qty.placeholder='0'; qty.inputMode='decimal';
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
      <h3 id="t_pur_title">${S.purTitle}</h3>
      <div class="row">
        <div>
          <label id="t_pur_project">${S.purProj}</label>
          <input id="PurProject" data-picker="projects" placeholder="${S.pick}" readonly />
        </div>
        <div>
          <label id="t_pur_needby">${S.purNeedBy}</label>
          <input type="date" id="PurNeedBy" />
        </div>
      </div>
      <div class="row">
        <div>
          <label id="t_pur_contractor">${S.purContractor}</label>
          <input id="PurContractor" data-picker="contractors" placeholder="${S.pickAdd}" readonly />
        </div>
        <div>
          <label id="t_pur_priority">${S.purPriority}</label>
          <select id="PurPriority">
            <option value="Normal">${lang==='th'?'ปกติ':'Normal'}</option>
            <option value="Urgent">${lang==='th'?'ด่วน':'Urgent'}</option>
            <option value="Critical">${lang==='th'?'วิกฤติ':'Critical'}</option>
          </select>
        </div>
      </div>
      <div class="lines" id="purLines"></div>
      <div class="row">
        <div>
          <label id="t_pur_note">${S.purNote}</label>
          <input id="PurNote" placeholder="${lang==='th'?'บันทึกเพิ่มเติม (ถ้ามี)':'Optional note'}" />
        </div>
      </div>
      <div class="row" style="justify-content:flex-end; gap:.6rem">
        <button class="btn" id="addLineBtnPur" type="button"><span class="btn-label">${S.btnAdd}</span><span class="btn-spinner"><span class="spinner"></span></span></button>
        <button class="btn" id="resetBtnPur" type="button"><span class="btn-label">${S.btnReset}</span><span class="btn-spinner"><span class="spinner"></span></span></button>
        <button class="btn primary" id="submitBtnPur" type="button" disabled><span class="btn-label">${S.btnSubmit} (0)</span><span class="btn-spinner"><span class="spinner"></span></span></button>
      </div>
    </section>

    <section class="card glass" style="margin-top:.25rem">
      <h3>${lang==='th'?'คำขอก่อนหน้า':'Previous Requests'}</h3>
      <div class="list" id="purOlderList" data-limit="10"></div>
      <div class="toggle"><button type="button" data-toggle="#purOlderList">${S.showMore}</button></div>
    </section>
  `;

  const lines = $('#purLines', root);
  const btnAdd = $('#addLineBtnPur', root);
  const btnReset = $('#resetBtnPur', root);
  const btnSubmit = $('#submitBtnPur', root);

  function updateSubmit(){
    const c = countLines(root);
    setSubmitState(btnSubmit, c, lang);
  }

  function addLine(){
    const ln = purLine(lang);
    lines.appendChild(ln);
    bindPickerInputs(root);
    ln.dispatchEvent(new Event('linechange', {bubbles:true}));
    updateSubmit();
  }
  function hardReset(){
    lines.innerHTML=''; addLine();
    $('#PurNote').value=''; $('#PurContractor').value='';
    const d=new Date().toISOString().split('T')[0];
    $('#PurNeedBy').value=d;
    updateSubmit();
  }

  btnAdd.addEventListener('click', addLine);
  btnReset.addEventListener('click', hardReset);
  root.addEventListener('linechange', updateSubmit);

  btnSubmit.addEventListener('click', async ()=>{
    setBtnLoading(btnSubmit, true);
    const p = {
      type:'PURCHASE',
      project: $('#PurProject').value.trim(),
      contractor: $('#PurContractor').value.trim(),
      needBy: $('#PurNeedBy').value.trim(),
      priority: $('#PurPriority').value,
      note: $('#PurNote').value.trim(),
      lines: collectLines()
    };
    if (!p.lines.length){ setBtnLoading(btnSubmit,false); return toast(lang==='th'?'กรุณาเพิ่มรายการ':'Add at least one line'); }
    try{
      const res = await apiPost('submitPurchaseRequest', p);
      if(res && res.ok){ toast((lang==='th'?'ส่งคำขอแล้ว • ':'Request sent • ')+(res.docNo||'')); hardReset(); loadOlder(); }
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

  function loadOlder(){
    const holder = $('#purOlderList', root);
    holder.innerHTML=''; for(let i=0;i<5;i++){ const r=document.createElement('div'); r.className='skeleton-row'; holder.appendChild(r);}
    apiGet('pur_History').then(rows=>{
      const box=$('#purOlderList', root); box.innerHTML='';
      (rows||[]).forEach(x=>{
        const acc=document.createElement('div'); acc.className='rowitem';
        acc.style.flexDirection='column'; acc.style.alignItems='stretch';
        const head=document.createElement('div');
        head.style.display='flex'; head.style.justifyContent='space-between'; head.style.cursor='pointer';
        head.innerHTML = `<span>${esc(x.docNo)} • ${esc(x.project||'-')} • ${esc(x.ts)}</span><span>›</span>`;

        const body=document.createElement('div'); body.className='hidden';
        body.innerHTML = `
          <div class="meta">👷 ${esc(x.contractor||'-')} • 🙋 ${esc(x.requester||'-')}</div>
          <div class="meta">${lang==='th'?'ต้องการภายใน':'NeedBy'} ${esc(x.needBy||'-')} • ${lang==='th'?'สถานะ':'Status'}: <strong>${esc(x.status||'-')}</strong></div>
          <div id="doc-${esc(x.docNo)}">${lang==='th'?'กำลังโหลด…':'Loading…'}</div>
        `;
        head.addEventListener('click', ()=>{
          const open = !body.classList.contains('hidden');
          if (open){ body.classList.add('hidden'); return; }
          const holder = body.querySelector('#doc-'+CSS.escape(x.docNo));
          holder.innerHTML = ''; for(let i=0;i<3;i++){ const sk=document.createElement('div'); sk.className='skeleton-bar'; sk.style.height='14px'; sk.style.margin='8px 0'; holder.appendChild(sk); }
          apiGet('pur_DocLines', {payload:{docNo:x.docNo}}).then(lines=>{
            const tbl = document.createElement('table'); tbl.style.width='100%'; tbl.style.borderCollapse='collapse';
            tbl.innerHTML='<thead><tr><th style="text-align:left;padding:.25rem 0;">รายการ</th><th style="text-align:left;padding:.25rem 0;">จำนวน</th></tr></thead>';
            const tb=document.createElement('tbody');
            (lines||[]).forEach(li=>{
              const tr=document.createElement('tr');
              tr.innerHTML=`<td style="padding:.25rem 0;">${esc(li.item)}</td><td style="padding:.25rem 0;">${esc(li.qty)}</td>`;
              tb.appendChild(tr);
            });
            tbl.appendChild(tb);
            holder.replaceWith(tbl);
          });
          body.classList.remove('hidden');
        });
        acc.appendChild(head); acc.appendChild(body);
        box.appendChild(acc);
      });
      clampList(box);
      const tbtn = root.querySelector('.toggle button[data-toggle="#purOlderList"]');
      if (tbtn) tbtn.onclick = ()=> clampList(box) || null; // simple reset on click
    });
  }

  // Bind pickers
  bindPickerInputs(root);
  $('#PurProject').addEventListener('click', ()=>openPicker($('#PurProject'),'projects'));
  $('#PurContractor').addEventListener('click', ()=>openPicker($('#PurContractor'),'contractors'));

  hardReset();
  loadOlder();
}
