// tabs/purchase.js
// Purchasing tab with speed-dial FAB (“Add Item” + “Submit Form”),
// changeable status in history (inside expanded details),
// no preloaded skeleton inside collapsed items (only show after expand),
// and auto-refresh of lookups after submit.

import {
  $, $$, STR, bindPickerInputs, openPicker,
  apiGet, apiPost, setBtnLoading, clampList,
  esc, toast, todayStr, preloadLookups
} from '../js/shared.js';

/* ------------ helpers ------------ */
function statusColor(status){
  if(!status) return '';
  const s = String(status).toLowerCase();
  if (s.includes('approve') || s.includes('อนุมัติ')) return 'green';
  if (s.includes('wait') || s.includes('รอ') || s.includes('order')) return 'yellow';
  if (s.includes('reject') || s.includes('cancel') || s.includes('ยกเลิก') || s.includes('ไม่อนุมัติ')) return 'red';
  if (s.includes('receive') || s.includes('รับ')) return 'green';
  return '';
}

function purLine(lang){
  const card=document.createElement('div'); card.className='line';
  const name=document.createElement('input'); name.placeholder=(lang==='th' ? 'พิมพ์เพื่อค้นหา…' : 'Type to search…'); name.readOnly=true; name.setAttribute('data-picker','materials');
  const qty=document.createElement('input'); qty.type='number'; qty.min='0'; qty.step='any'; qty.placeholder='0'; qty.inputMode='decimal';
  const grid=document.createElement('div'); grid.className='grid'; grid.appendChild(name); grid.appendChild(qty);
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

function renderStatusEditor(docNo, currentStatus, lang, onSaved){
  const wrap = document.createElement('div');
  wrap.style.display='flex'; wrap.style.gap='.5rem'; wrap.style.alignItems='center'; wrap.style.margin='.5rem 0';
  const label = document.createElement('label');
  label.style.minWidth='7rem';
  label.textContent = (lang==='th'?'เปลี่ยนสถานะ':'Change status');
  const sel = document.createElement('select');
  sel.innerHTML = `
    <option value="Requested">Requested</option>
    <option value="Approved">Approved</option>
    <option value="Ordered">Ordered</option>
    <option value="Received">Received</option>
    <option value="Cancelled">Cancelled</option>
  `;
  sel.value = currentStatus || 'Requested';
  const save = document.createElement('button'); save.className='btn small'; save.type='button';
  save.innerHTML = `<span class="btn-label">${lang==='th'?'บันทึก':'Save'} </span><span class="btn-spinner"><span class="spinner"></span></span>`;
  save.addEventListener('click', async ()=>{
    setBtnLoading(save, true);
    try{
      const res = await apiPost('pur_UpdateStatus', {docNo, status: sel.value});
      if (res && res.ok){
        toast(lang==='th'?'อัปเดตสถานะแล้ว':'Status updated');
        onSaved?.(sel.value);
      } else {
        toast((res && res.message) || 'Error');
      }
    } catch {
      toast(lang==='th'?'ไม่สามารถอัปเดตสถานะได้':'Failed to update status');
    } finally {
      setBtnLoading(save, false);
    }
  });
  wrap.appendChild(label); wrap.appendChild(sel); wrap.appendChild(save);
  return wrap;
}

/* ------------ main mount ------------ */
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
    </section>

    <section class="card glass" style="margin-top:.25rem">
      <h3>${lang==='th'?'คำขอก่อนหน้า':'Previous Requests'}</h3>
      <div class="list" id="purOlderList" data-limit="10"></div>
      <div class="toggle"><button type="button" data-toggle="#purOlderList">${S.showMore}</button></div>
    </section>

  const lines = $('#purLines', root);

  function addLine(){
    const ln = purLine(lang);
    lines.appendChild(ln);
    bindPickerInputs(root, lang);
  }
  function clearForm(){
    lines.innerHTML=''; addLine();
    $('#PurNote', root).value=''; $('#PurContractor', root).value=''; $('#PurProject', root).value='';
    $('#PurNeedBy', root).value=todayStr();
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
      type:'PURCHASE',
      project: $('#PurProject', root).value.trim(),
      contractor: $('#PurContractor', root).value.trim(),
      needBy: $('#PurNeedBy', root).value.trim(),
      priority: $('#PurPriority', root).value,
      note: $('#PurNote', root).value.trim(),
      lines: collectLines(root)
    };
    if (!p.lines.length){ setBtnLoading(fabSubmit,false); return toast(lang==='th'?'กรุณาเพิ่มรายการ':'Add at least one line'); }
    try{
      const res = await apiPost('submitPurchaseRequest', p);
      if(res && res.ok){
        toast((lang==='th'?'ส่งคำขอแล้ว • ':'Request sent • ')+(res.docNo||''));
        try { await preloadLookups(); } catch {}
        clearForm();
        loadOlder(); // refresh history panel
      }
      else toast((res && res.message) || 'Error');
    } catch{
      toast(lang==='th'?'เกิดข้อผิดพลาดในการส่งคำขอ':'Failed to submit request');
    } finally {
      setBtnLoading(fabSubmit, false);
      fab.classList.remove('expanded');
      fabMain.setAttribute('aria-expanded','false');
    }
  });

  // Previous requests (no internal skeleton until expanded rows are opened)
  async function loadOlder(){
    const holder = $('#purOlderList', root);
    holder.innerHTML='';
    // show list-level skeletons only
    for(let i=0;i<5;i++){ const r=document.createElement('div'); r.className='skeleton-row'; holder.appendChild(r); }

    try{
      const rows = await apiGet('pur_History', null, {cacheTtlMs: 20*1000});
      holder.innerHTML='';
      (rows||[]).forEach(x=>{
        const card=document.createElement('div'); card.className='rowitem';
        card.style.flexDirection='column'; card.style.alignItems='stretch';

        const headWrap = document.createElement('div');
        headWrap.style.display='flex';
        headWrap.style.justifyContent='space-between';
        headWrap.style.alignItems='center';
        headWrap.style.flexWrap='wrap';
        headWrap.style.gap='.5rem';

        const headLeft = document.createElement('div');
        headLeft.innerHTML = `
          <div><strong>${esc(x.docNo)} • ${esc(x.project||'-')}</strong></div>
          <div class="meta">${esc(x.ts)} • ${(lang==='th'?'ต้องการภายใน ':'NeedBy ')}${esc(x.needBy||'-')}</div>
          <div class="meta">👷 ${esc(x.contractor||'-')} • 🙋 ${esc(x.requester||'-')}</div>
        `;

        const statusBadge = document.createElement('span');
        statusBadge.className = `badge ${statusColor(x.status)}`;
        statusBadge.textContent = esc(x.status || '-');

        headWrap.appendChild(headLeft);
        headWrap.appendChild(statusBadge);

        const meta2 = document.createElement('div');
        meta2.className='meta';
        meta2.innerHTML = `
          ${(lang==='th'?'รายการ ':'Lines ')}${esc(x.lines)} •
          ${(lang==='th'?'จำนวน ':'Qty ')}${esc(x.totalQty)} •
          ${(lang==='th'?'ความสำคัญ ':'Priority ')}${esc(x.priority||'-')}
        `;

        const headClick = document.createElement('div');
        headClick.className='rowhead';
        headClick.style.display='flex';
        headClick.style.justifyContent='space-between';
        headClick.style.alignItems='center';
        headClick.style.cursor='pointer';
        headClick.style.marginTop='.35rem';
        headClick.innerHTML = `<span class="meta">${lang==='th'?'แสดงรายละเอียด':'Show details'}</span><span>›</span>`;

        const body=document.createElement('div'); body.className='hidden';
        body.style.marginTop='.5rem';
        body.setAttribute('data-doc', x.docNo);
        // NOTE: no skeleton here until expanded

        headClick.addEventListener('click', async ()=>{
          const isOpen = !body.classList.contains('hidden');
          if (isOpen){
            body.classList.add('hidden');
            headClick.querySelector('.meta').textContent = (lang==='th'?'แสดงรายละเอียด':'Show details');
            headClick.lastElementChild.textContent = '›';
            return;
          }
          body.classList.remove('hidden');
          headClick.querySelector('.meta').textContent = (lang==='th'?'ซ่อนรายละเอียด':'Hide details');
          headClick.lastElementChild.textContent = '⌄';

          // show a compact loading row only after expanding
          body.innerHTML = `<div class="skeleton-row" style="min-height:40px"></div>`;

          try{
            const lines = await apiGet('pur_DocLines', {payload:{docNo:x.docNo}}, {cacheTtlMs: 10*1000});
            const content = document.createElement('div');

            // Status editor
            const editor = renderStatusEditor(x.docNo, x.status, lang, (newStatus)=>{
              statusBadge.textContent = newStatus;
              statusBadge.className = `badge ${statusColor(newStatus)}`;
            });
            content.appendChild(editor);

            // Lines table
            const tbl = document.createElement('table'); tbl.style.width='100%'; tbl.style.borderCollapse='collapse';
            tbl.innerHTML = '<thead><tr><th style="text-align:left;padding:.25rem 0;">รายการ</th><th style="text-align:left;padding:.25rem 0;">จำนวน</th></tr></thead>';
            const tb=document.createElement('tbody');
            (lines||[]).forEach(li=>{
              const tr=document.createElement('tr');
              tr.innerHTML=`<td style="padding:.25rem 0;">${esc(li.item)}</td><td style="padding:.25rem 0;">${esc(li.qty)}</td>`;
              tb.appendChild(tr);
            });
            tbl.appendChild(tb);
            content.appendChild(tbl);

            body.replaceChildren(content);
          }catch{
            body.innerHTML = `<div class="meta" style="color:#b91c1c">${lang==='th'?'โหลดไม่สำเร็จ':'Failed to load'}</div>`;
          }
        });

        card.appendChild(headWrap);
        card.appendChild(meta2);
        card.appendChild(headClick);
        card.appendChild(body);
        holder.appendChild(card);
      });
      clampList(holder);

      const tbtn = root.querySelector('.toggle button[data-toggle="#purOlderList"]');
      if (tbtn){
        tbtn.onclick = ()=>{
          const expanded = holder.dataset.expanded === 'true';
          if (expanded){
            clampList(holder);
            holder.dataset.expanded = 'false';
            tbtn.textContent = STR[lang].showMore;
          } else {
            Array.from(holder.children).forEach(el=> el.style.display='');
            holder.dataset.expanded = 'true';
            tbtn.textContent = STR[lang].showLess;
          }
        };
      }
    }catch{
      holder.innerHTML = `<div class="rowitem"><div class="meta" style="color:#b91c1c">${lang==='th'?'ไม่สามารถโหลดข้อมูลได้':'Unable to load data'}</div></div>`;
    }
  }

  // Bind pickers
  bindPickerInputs(root, lang);
  $('#PurProject', root).addEventListener('click', ()=>openPicker($('#PurProject', root),'projects', lang));
  $('#PurContractor', root).addEventListener('click', ()=>openPicker($('#PurContractor', root),'contractors', lang));

  // Init defaults and data
  $('#PurNeedBy', root).value=todayStr();
  addLine();
  loadOlder();
}
