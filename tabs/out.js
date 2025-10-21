// tabs/out.js
// OUT tab with: main form + stock badge per line, speed-dial FAB (Add, Submit, History),
// History overlay (filter + results), Edit Doc overlay.
// Fixes:
//  - Modal stacking order so Edit appears above History, and both above picker
//  - Proper pointer blocking + body scroll lock while overlay is open
//  - Robust, responsive filter grid so fields don’t break alignment

import {
  $, $$, STR, bindPickerInputs, openPicker,
  apiGet, apiPost, setBtnLoading, esc, toast, todayStr, stockBadge
} from '../js/shared.js';

/* ------------------ helpers ------------------ */
function lockBodyScroll(lock) {
  try {
    if (lock) {
      const prev = document.body.style.overflow;
      document.body.dataset._prevOverflow = prev || '';
      document.body.style.overflow = 'hidden';
    } else {
      const prev = document.body.dataset._prevOverflow || '';
      document.body.style.overflow = prev;
      delete document.body.dataset._prevOverflow;
    }
  } catch {}
}

function mkSpinner(size = 18, bw = 2) {
  const s = document.createElement('span');
  s.className = 'spinner';
  s.style.width = size + 'px';
  s.style.height = size + 'px';
  s.style.borderWidth = bw + 'px';
  return s;
}

/* ------------------ OUT line (main form) ------------------ */
function OutLine(lang){
  const card=document.createElement('div'); 
  card.className='line';

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

  const grid=document.createElement('div'); 
  grid.className='grid';
  grid.appendChild(name);
  grid.appendChild(qty);
  grid.appendChild(note);

  // Stock badge line
  const meta=document.createElement('div'); 
  meta.className='rowitem'; 
  meta.style.justifyContent='flex-start';

  const label=document.createElement('span'); 
  label.className='meta'; 
  label.textContent = (lang==='th' ? 'คงเหลือ: ' : 'Stock: ');

  let badge = document.createElement('span'); 
  badge.className='badge'; 
  badge.textContent='-';

  meta.appendChild(label); 
  meta.appendChild(badge);

  // Remove
  const actions=document.createElement('div'); 
  actions.className='actions';
  const rm=document.createElement('button'); 
  rm.type='button'; 
  rm.className='btn small'; 
  rm.textContent='×'; 
  rm.onclick=()=>card.remove();
  actions.appendChild(rm);

  card.appendChild(grid); 
  card.appendChild(meta); 
  card.appendChild(actions);

  // Picker
  name.addEventListener('click', ()=>openPicker(name,'materials', lang));

  // Fetch stock on change
  name.addEventListener('change', async ()=>{
    const v = name.value.trim();
    if (!v) { 
      const bNew = document.createElement('span');
      bNew.className='badge'; 
      bNew.textContent='-';
      meta.replaceChild(bNew, badge);
      badge = bNew;
      return;
    }
    const spin = document.createElement('span');
    spin.className = 'badge';
    const small = mkSpinner(14,2);
    spin.appendChild(small);
    meta.replaceChild(spin, badge);
    badge = spin;

    try{
      const res = await apiGet('getCurrentStock', { material: v });
      const n  = (res && res.ok) ? Number(res.stock) : null;
      const mn = (res && res.ok) ? Number(res.min||0) : null;
      const bNew = stockBadge(n, mn);
      meta.replaceChild(bNew, badge);
      badge = bNew;
    }catch{
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

/* ------------------ Modal framework ------------------ */
// Z-index ladder: Picker = 2000 (existing), History = 2400, Edit = 2600
function overlayWrap(z = 2400){
  const ov = document.createElement('div');
  ov.style.position = 'fixed';
  ov.style.inset = '0';
  ov.style.zIndex = String(z);
  ov.style.display = 'flex';
  ov.style.alignItems = 'center';
  ov.style.justifyContent = 'center';
  ov.style.background = 'rgba(15,18,23,0.35)';
  ov.style.backdropFilter = 'blur(3px)';
  ov.style.WebkitBackdropFilter = 'blur(3px)';
  ov.style.pointerEvents = 'auto';
  ov.setAttribute('role','dialog');
  ov.setAttribute('aria-modal','true');

  // stop scroll behind and block clicks to page
  ov.addEventListener('wheel', e => e.stopPropagation(), { passive: true });
  ov.addEventListener('touchmove', e => e.stopPropagation(), { passive: true });
  ov.addEventListener('click', e => {
    // clicking translucent background closes only if outside the panel
    if (e.target === ov && ov.dataset.closable === 'true') {
      const closeBtn = ov.querySelector('[data-close="true"]');
      if (closeBtn) closeBtn.click();
    }
  });

  const box = document.createElement('div');
  box.style.position='relative';                // create stacking context
  box.style.width='min(100%, 1000px)';
  box.style.maxHeight='min(90vh, 760px)';
  box.style.borderRadius='16px';
  box.style.border='1px solid rgba(0,0,0,.08)';
  box.style.boxShadow='0 24px 64px rgba(0,0,0,.22)';
  box.style.display='flex';
  box.style.flexDirection='column';
  box.style.overflow='hidden';
  box.style.background='rgba(255,255,255,.82)';
  box.style.backdropFilter='blur(12px)';
  box.style.WebkitBackdropFilter='blur(12px)';

  ov.appendChild(box);
  return { ov, box };
}

function headerBar(title, onClose){
  const h = document.createElement('div');
  h.style.position='sticky'; // stick inside the modal
  h.style.top='0';
  h.style.zIndex='2';
  h.style.display='flex';
  h.style.alignItems='center';
  h.style.gap='.6rem';
  h.style.borderBottom='1px solid rgba(0,0,0,.06)';
  h.style.background='rgba(255,255,255,.9)';
  h.style.padding='.75rem .9rem';
  const t = document.createElement('div');
  t.style.fontWeight='800';
  t.style.fontSize='1.05rem';
  t.textContent = title;
  const sp = document.createElement('div'); sp.style.flex='1';
  const close = document.createElement('button'); close.className='btn'; close.textContent='ปิด / Close';
  close.setAttribute('data-close','true');
  close.onclick = onClose;
  h.appendChild(t); h.appendChild(sp); h.appendChild(close);
  return h;
}

/* ------------------ History overlay ------------------ */
function HistoryOverlay(lang, onClose, onPickEdit){
  const { ov, box } = overlayWrap(2400);
  ov.dataset.closable = 'true';

  const header = headerBar(lang==='th'?'ประวัติการจ่ายออกวัสดุ':'Material OUT History', ()=>{
    try { document.body.removeChild(ov); } catch {}
    lockBodyScroll(false);
    onClose?.();
  });

  // Filters
  const controls = document.createElement('div');
  controls.style.display='grid';
  controls.style.gap='.6rem';
  controls.style.padding='.75rem .9rem';
  controls.style.borderBottom='1px solid rgba(0,0,0,.06)';
  controls.style.background='rgba(255,255,255,.68)';
  // robust grid: collapses nicely
  controls.style.gridTemplateColumns='repeat(auto-fit, minmax(180px, 1fr))';

  const mkField = (labelTxt, node)=>{
    const wrap = document.createElement('label');
    wrap.style.display='grid';
    wrap.style.gap='.35rem';
    const lab = document.createElement('span'); lab.className='meta'; lab.textContent = labelTxt;
    node.className = 'input glass';
    node.style.padding = '.8rem 1rem';
    node.style.borderRadius = '.9rem';
    wrap.appendChild(lab); wrap.appendChild(node);
    return wrap;
  };

  const fProject = document.createElement('input');  fProject.placeholder = (lang==='th'?'โครงการ':'Project'); fProject.readOnly = true; fProject.setAttribute('data-picker','projects');
  const fContractor = document.createElement('input');  fContractor.placeholder = (lang==='th'?'ผู้รับเหมา':'Contractor'); fContractor.readOnly = true; fContractor.setAttribute('data-picker','contractors');
  const fRequester = document.createElement('input');  fRequester.placeholder = (lang==='th'?'ผู้ขอเบิก':'Requester'); fRequester.readOnly = true; fRequester.setAttribute('data-picker','requesters');

  const fFrom = document.createElement('input'); fFrom.type='date';
  const fTo   = document.createElement('input'); fTo.type='date';
  const fQ = document.createElement('input'); fQ.placeholder = (lang==='th'?'ค้นหาเอกสาร/โน้ต/รายการ…':'Search doc/note/item…');

  controls.appendChild(mkField(lang==='th'?'โครงการ':'Project', fProject));
  controls.appendChild(mkField(lang==='th'?'ผู้รับเหมา':'Contractor', fContractor));
  controls.appendChild(mkField(lang==='th'?'ผู้ขอเบิก':'Requester', fRequester));
  controls.appendChild(mkField(lang==='th'?'ตั้งแต่':'From', fFrom));
  controls.appendChild(mkField(lang==='th'?'ถึง':'To', fTo));
  // wide search spans a full row by CSS auto-fit automatically
  controls.appendChild(mkField(lang==='th'?'ค้นหา':'Search', fQ));

  // Actions
  const actions = document.createElement('div');
  actions.style.display='flex';
  actions.style.justifyContent='flex-end';
  actions.style.gap='.5rem';
  actions.style.padding='.4rem .9rem .75rem .9rem';
  actions.style.background='rgba(255,255,255,.68)';
  actions.style.borderBottom='1px solid rgba(0,0,0,.06)';
  const btnSearch = document.createElement('button'); btnSearch.className='btn primary'; btnSearch.innerHTML='<span class="btn-label">🔎</span><span class="btn-spinner"><span class="spinner"></span></span>';
  const btnClear = document.createElement('button'); btnClear.className='btn'; btnClear.textContent = (lang==='th'?'ล้างตัวกรอง':'Clear');
  actions.appendChild(btnClear); actions.appendChild(btnSearch);

  // Results
  const listWrap = document.createElement('div');
  listWrap.style.flex='1';
  listWrap.style.overflow='auto';
  listWrap.style.padding='.6rem .9rem';
  listWrap.style.background='rgba(255,255,255,.5)';

  const table = document.createElement('div');
  table.className='list';

  const putSkeleton = ()=>{
    table.innerHTML='';
    for(let i=0;i<5;i++){
      const r=document.createElement('div'); r.className='skeleton-row';
      table.appendChild(r);
    }
  };

  putSkeleton();
  listWrap.appendChild(table);

  // bind pickers in overlay
  setTimeout(()=>{
    bindPickerInputs(ov, lang);
    fProject.addEventListener('click', ()=>openPicker(fProject, 'projects', lang));
    fContractor.addEventListener('click', ()=>openPicker(fContractor, 'contractors', lang));
    fRequester.addEventListener('click', ()=>openPicker(fRequester, 'requesters', lang));
  }, 0);

  async function runSearch(){
    putSkeleton();
    try{
      const res = await apiGet('out_History', {
        project: fProject.value.trim() || undefined,
        contractor: fContractor.value.trim() || undefined,
        requester: fRequester.value.trim() || undefined,
        dateFrom: fFrom.value || undefined,
        dateTo: fTo.value || undefined,
        q: fQ.value.trim() || undefined
      }, { cacheTtlMs: 5000 });

      table.innerHTML='';

      if (!res || !res.length){
        const empty = document.createElement('div');
        empty.className='rowitem';
        empty.innerHTML = `<div class="meta">${lang==='th'?'ไม่พบข้อมูล':'No results'}</div>`;
        table.appendChild(empty);
        return;
      }

      res.forEach(x=>{
        const row = document.createElement('div');
        row.className='rowitem';
        row.style.alignItems='stretch';
        row.style.flexDirection='column';
        row.style.position='relative';

        const head = document.createElement('div');
        head.style.display='flex';
        head.style.justifyContent='space-between';
        head.style.gap='.5rem';
        head.style.flexWrap='wrap';
        head.innerHTML = `
          <div><strong>${esc(x.docNo)} • ${esc(x.project||'-')}</strong>
            <div class="meta">🗓 ${esc(x.ts)} • 👷 ${esc(x.contractor||'-')} • 🙋 ${esc(x.requester||'-')}</div>
          </div>
          <div class="meta">${(lang==='th'?'บรรทัด ':'Lines ')}${esc(x.lines)} • ${(lang==='th'?'ปริมาณ ':'Qty ')}${esc(x.totalQty||0)}</div>
        `;

        const foot = document.createElement('div');
        foot.style.display='flex';
        foot.style.justifyContent='flex-end';
        foot.style.gap='.5rem';
        const bEdit = document.createElement('button'); bEdit.className='btn'; bEdit.textContent = (lang==='th'?'แก้ไข':'Edit');
        bEdit.addEventListener('click', ()=> onPickEdit?.(x.docNo));
        foot.appendChild(bEdit);

        row.appendChild(head);
        if (x.note){
          const nt = document.createElement('div'); nt.className='meta'; nt.textContent = '📝 ' + x.note; row.appendChild(nt);
        }
        row.appendChild(foot);
        table.appendChild(row);
      });
    }catch{
      table.innerHTML = `<div class="rowitem"><div class="meta" style="color:#b91c1c">${lang==='th'?'เกิดข้อผิดพลาดในการค้นหา':'Search failed'}</div></div>`;
    }
  }

  btnSearch.addEventListener('click', async ()=>{
    try { setBtnLoading(btnSearch, true); await runSearch(); }
    finally { setBtnLoading(btnSearch, false); }
  });

  btnClear.addEventListener('click', ()=>{
    fProject.value=''; fContractor.value=''; fRequester.value=''; fFrom.value=''; fTo.value=''; fQ.value='';
  });

  box.appendChild(header);
  box.appendChild(controls);
  box.appendChild(actions);
  box.appendChild(listWrap);

  document.body.appendChild(ov);
  lockBodyScroll(true);

  // initial search
  runSearch();

  return { destroy: ()=>{ try{ document.body.removeChild(ov); }catch{}; lockBodyScroll(false); } };
}

/* ------------------ Edit OUT Document overlay ------------------ */
function EditDocOverlay(lang, docNo, onClose, onSaved){
  const { ov, box } = overlayWrap(2600); // sits above History
  ov.dataset.closable = 'false'; // require explicit close (avoid accidental loss)

  const header = headerBar((lang==='th'?'แก้ไขเอกสาร ':'Edit Doc ') + docNo, ()=>{
    try { document.body.removeChild(ov); } catch {}
    lockBodyScroll(false);
    onClose?.();
  });

  const body = document.createElement('div');
  body.style.flex='1';
  body.style.overflow='auto';
  body.style.padding='.8rem .9rem';
  body.style.display='grid';
  body.style.gap='.8rem';

  const footer = document.createElement('div');
  footer.style.display='flex';
  footer.style.justifyContent='space-between';
  footer.style.gap='.5rem';
  footer.style.padding='.6rem .9rem .9rem .9rem';
  footer.style.borderTop='1px solid rgba(0,0,0,.06)';
  footer.style.background='rgba(255,255,255,.68)';

  const leftMeta = document.createElement('div'); leftMeta.className='meta';
  leftMeta.textContent = docNo;

  const rightActions = document.createElement('div'); rightActions.style.display='flex'; rightActions.style.gap='.5rem';
  const btnSave = document.createElement('button'); btnSave.className='btn primary';
  btnSave.innerHTML = `<span class="btn-label">${lang==='th'?'บันทึก':'Save'}</span><span class="btn-spinner"><span class="spinner"></span></span>`;
  const btnClose = document.createElement('button'); btnClose.className='btn'; btnClose.textContent = (lang==='th'?'ปิด':'Close');
  btnClose.setAttribute('data-close','true');
  btnClose.onclick = ()=>{ try{ document.body.removeChild(ov); }catch{}; lockBodyScroll(false); onClose?.(); };

  rightActions.appendChild(btnClose); rightActions.appendChild(btnSave);
  footer.appendChild(leftMeta); footer.appendChild(rightActions);

  // skeleton while fetching
  const skel = document.createElement('div');
  skel.className='skeleton-row';
  body.appendChild(skel);

  box.appendChild(header);
  box.appendChild(body);
  box.appendChild(footer);
  document.body.appendChild(ov);
  lockBodyScroll(true);

  // helpers
  const mkRow = ()=>{
    const row = document.createElement('div');
    row.className='row';
    return row;
  };
  const mkField = (labelTxt, input)=>{
    const wrap = document.createElement('div');
    wrap.style.flex = '1 1 14rem';
    const lab = document.createElement('label'); lab.textContent = labelTxt;
    wrap.appendChild(lab); wrap.appendChild(input);
    return wrap;
  };
  const mkDocLine = (lang, line)=>{
    const card=document.createElement('div'); card.className='line';
    const name=document.createElement('input'); name.value = line.item || ''; name.readOnly=true; name.setAttribute('data-picker','materials');
    const qty=document.createElement('input'); qty.type='number'; qty.min='0'; qty.step='any'; qty.placeholder='0'; qty.inputMode='decimal'; qty.value = line.qty ?? '';
    const note=document.createElement('input'); note.placeholder=(lang==='th'?'หมายเหตุ (ถ้ามี)':'Note (optional)'); note.value = line.note || '';
    const grid=document.createElement('div'); grid.className='grid'; grid.appendChild(name); grid.appendChild(qty); grid.appendChild(note);
    const actions=document.createElement('div'); actions.className='actions';
    const rm=document.createElement('button'); rm.type='button'; rm.className='btn small'; rm.textContent='×'; rm.onclick=()=>card.remove();
    actions.appendChild(rm);
    card.appendChild(grid); card.appendChild(actions);
    name.addEventListener('click', ()=>openPicker(name,'materials', lang));
    return card;
  };
  const collectEditLines = (host)=>{
    const out=[];
    $$('.line', host).forEach(c=>{
      const nameEl=c.querySelector('input[data-picker="materials"]');
      const qtyEl=c.querySelector('input[type="number"]');
      const noteEl=c.querySelector('input[placeholder^="หมายเหตุ"],input[placeholder^="Note"]');
      const name=nameEl?nameEl.value.trim():'';
      const qty=Number(qtyEl?qtyEl.value:0)||0;
      const note=noteEl?noteEl.value.trim():'';
      if (name) out.push({item:name, qty, note});
    });
    return out;
  };

  // fetch doc
  (async ()=>{
    try{
      const res = await apiGet('out_Doc', { docNo });
      body.innerHTML = '';

      if (!res || !res.ok || !res.doc){
        body.innerHTML = `<div class="meta" style="color:#b91c1c">${lang==='th'?'ไม่พบเอกสาร':'Document not found'}</div>`;
        return;
      }
      const d = res.doc;

      const r1 = mkRow();
      const iProject = document.createElement('input'); iProject.readOnly=true; iProject.setAttribute('data-picker','projects'); iProject.value = d.project||'';
      const iDate = document.createElement('input'); iDate.type='date'; iDate.value = (d.date||'').slice(0,10);
      r1.appendChild(mkField(lang==='th'?'โครงการ':'Project', iProject));
      r1.appendChild(mkField(lang==='th'?'วันที่':'Date', iDate));
      body.appendChild(r1);

      const r2 = mkRow();
      const iContractor = document.createElement('input'); iContractor.readOnly=true; iContractor.setAttribute('data-picker','contractors'); iContractor.value = d.contractor||'';
      const iRequester = document.createElement('input'); iRequester.readOnly=true; iRequester.setAttribute('data-picker','requesters'); iRequester.value = d.requester||'';
      r2.appendChild(mkField(lang==='th'?'ผู้รับเหมา':'Contractor', iContractor));
      r2.appendChild(mkField(lang==='th'?'ผู้ขอเบิก':'Requester', iRequester));
      body.appendChild(r2);

      const r3 = mkRow();
      const iNote = document.createElement('input'); iNote.placeholder=(lang==='th'?'หมายเหตุ':'Note'); iNote.value = d.note||'';
      r3.appendChild(mkField(lang==='th'?'หมายเหตุ':'Note', iNote));
      body.appendChild(r3);

      const linesHost = document.createElement('div'); linesHost.className='lines';
      (res.lines||[]).forEach(li=> linesHost.appendChild(mkDocLine(lang, li)));

      const addLineBtn = document.createElement('button'); addLineBtn.className='btn'; addLineBtn.textContent = (lang==='th'?'＋ เพิ่มรายการ':'＋ Add line');
      addLineBtn.style.alignSelf='flex-end';
      addLineBtn.addEventListener('click', ()=> linesHost.appendChild(mkDocLine(lang, {item:'', qty:'', note:''})));

      body.appendChild(linesHost);
      body.appendChild(addLineBtn);

      // bind pickers inside overlay
      bindPickerInputs(ov, lang);
      iProject.addEventListener('click', ()=>openPicker(iProject,'projects', lang));
      iContractor.addEventListener('click', ()=>openPicker(iContractor,'contractors', lang));
      iRequester.addEventListener('click', ()=>openPicker(iRequester,'requesters', lang));

      // Save
      btnSave.addEventListener('click', async ()=>{
        setBtnLoading(btnSave, true);
        try{
          const payload = {
            docNo,
            project: iProject.value.trim(),
            contractor: iContractor.value.trim(),
            requester: iRequester.value.trim(),
            note: iNote.value.trim(),
            date: iDate.value,
            lines: collectEditLines(linesHost)
          };
          const r = await apiPost('out_UpdateDoc', payload);
          if (r && r.ok){
            toast(lang==='th'?'บันทึกการแก้ไขแล้ว':'Changes saved');
            try { onSaved?.(); } catch {}
            try { document.body.removeChild(ov); } catch {}
            lockBodyScroll(false);
          } else {
            toast((r && r.message) || 'Error');
          }
        } catch {
          toast(lang==='th'?'ไม่สามารถบันทึกได้':'Failed to save');
        } finally {
          setBtnLoading(btnSave, false);
        }
      });

    } catch{
      body.innerHTML = `<div class="meta" style="color:#b91c1c">${lang==='th'?'โหลดเอกสารไม่สำเร็จ':'Failed to load document'}</div>`;
    }
  })();

  return { destroy: ()=>{ try{ document.body.removeChild(ov); }catch{}; lockBodyScroll(false); } };
}

/* ------------------ main OUT mount ------------------ */
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
      <div class="mini" id="fabHistoryWrap" aria-hidden="true">
        <div class="label">${lang==='th'?'ประวัติ':'History'}</div>
        <button class="btn small" id="fabHistoryBtn" type="button">
          <span class="btn-label">🔎</span>
          <span class="btn-spinner"><span class="spinner"></span></span>
        </button>
      </div>
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

  function addLine(){ 
    lines.appendChild(OutLine(lang)); 
    bindPickerInputs(root, lang); 
  }

  function clearForm(){
    lines.innerHTML=''; 
    addLine();
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
  const fabHistory = $('#fabHistoryBtn', root);

  function toggleFab(){
    const expanded = fab.classList.toggle('expanded');
    fabMain.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }
  fabMain.addEventListener('click', toggleFab);
  fabAdd.addEventListener('click', addLine);

  // Submit
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

  // History + Edit
  fabHistory.addEventListener('click', ()=>{
    const history = HistoryOverlay(lang, null, (docNo)=>{
      // open editor after choose, above history
      EditDocOverlay(lang, docNo, null, ()=>{/* after save hooks here if needed */});
    });
  });

  // Header pickers
  $('#ProjectInput', root).addEventListener('click', ()=>openPicker($('#ProjectInput', root),'projects', lang));
  $('#ContractorInput', root).addEventListener('click', ()=>openPicker($('#ContractorInput', root),'contractors', lang));
  $('#RequesterInput', root).addEventListener('click', ()=>openPicker($('#RequesterInput', root),'requesters', lang));

  // Init
  $('#OutDate', root).value=todayStr();
  addLine();
}
