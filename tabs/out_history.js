// tabs/out_history.js (Public v1.3 - mobile-friendly outline + expanding search)
// OUT History list shows Date (no time), Contractor, Requester, Project.
// Cards are sized to fit on phones. DocNo is hidden from the list but used internally.
// Detail/Edit overlay reuses OUT form line layout with live stock badges.

import {
  $, $$, STR, bindPickerInputs, openPicker,
  apiGet, apiPost, setBtnLoading, esc, toast, stockBadge
} from '../js/shared.js';

/* ---------- Reuse OUT line UI & stock behavior ---------- */
function OutLine(lang){
  const card=document.createElement('div');
  card.className='line';

  const name=document.createElement('input');
  name.placeholder=(lang==='th'?'พิมพ์เพื่อค้นหา…':'Type to search…');
  name.readOnly=true;
  name.setAttribute('data-picker','materials');

  const qty=document.createElement('input');
  qty.type='number'; qty.min='0'; qty.step='any'; qty.placeholder='0'; qty.inputMode='decimal';

  const meta=document.createElement('div');
  meta.className='rowitem'; meta.style.justifyContent='flex-start';

  const label=document.createElement('span');
  label.className='meta'; label.textContent=(lang==='th'?'คงเหลือ: ':'Stock: ');

  let badge=document.createElement('span');
  badge.className='badge'; badge.textContent='-';

  meta.appendChild(label); meta.appendChild(badge);

  const actions=document.createElement('div'); actions.className='actions';
  const rm=document.createElement('button'); rm.type='button'; rm.className='btn small'; rm.textContent='×'; rm.onclick=()=>card.remove();
  actions.appendChild(rm);

  const grid=document.createElement('div'); grid.className='grid';
  grid.appendChild(name); grid.appendChild(qty);

  card.appendChild(grid); card.appendChild(meta); card.appendChild(actions);

  name.addEventListener('click', ()=>openPicker(name,'materials', lang));
  name.addEventListener('change', async ()=>{
    const v=name.value.trim();
    const spin=document.createElement('span'); spin.className='badge';
    spin.innerHTML='<span class="spinner" style="width:14px;height:14px;border-width:2px"></span>';
    meta.replaceChild(spin, badge); badge=spin;
    try{
      const res=await apiGet('getCurrentStock',{material:v});
      const n=(res&&res.ok)?Number(res.stock):null;
      const mn=(res&&res.ok)?Number(res.min||0):null;
      const bNew=stockBadge(n,mn);
      meta.replaceChild(bNew, badge); badge=bNew;
    }catch{
      const bErr=document.createElement('span'); bErr.className='badge red'; bErr.textContent='!';
      meta.replaceChild(bErr, badge); badge=bErr;
    }
  });
  return card;
}

/* ---------- Mount tab ---------- */
export default async function mount({ root, lang }){
  const S=STR[lang];

  root.innerHTML=`
    <section class="card glass">
      <div class="hist-toolbar" style="display:flex;justify-content:space-between;align-items:center;gap:.75rem;">
        <h3 style="margin:0;">📜 ${lang==='th'?'ประวัติการจ่ายออก (OUT)':'OUT History'}</h3>
        <div class="hist-search">
          <button class="btn small icon" id="histSearchToggle" aria-label="Search" title="${lang==='th'?'ค้นหา':'Search'}">🔍</button>
          <input id="histSearchText" placeholder="${lang==='th'?'ค้นหา...':'Search...'}" />
          <button class="btn small" id="histReload" title="${lang==='th'?'โหลดใหม่':'Reload'}">⟲</button>
        </div>
      </div>
      <div id="histListWrap" class="hist-wrap"></div>
    </section>

    <!-- Detail/Edit overlay -->
    <div id="histOverlay" aria-hidden="true"
         style="position:fixed;inset:0;z-index:1960;display:none;align-items:center;justify-content:center;
                background:rgba(15,18,23,0.12);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);">
      <div id="histBox" class="glass"
           style="border-radius:18px;box-shadow:var(--shadow-l);display:flex;flex-direction:column;overflow:hidden;
                  width:96vw;max-width:860px;height:92vh;max-height:86vh;background:#fff;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:.75rem 1rem;border-bottom:1px solid var(--border-weak);">
          <h3 id="histTitle" style="margin:0;font-size:1rem;">${lang==='th'?'รายละเอียด':'Details'}</h3>
          <button class="btn small" id="histClose" type="button">${lang==='th'?'ปิด':'Close'}</button>
        </div>
        <div id="histBody" style="flex:1;overflow:auto;padding:.75rem;"></div>
        <div id="histFooter" style="display:flex;justify-content:flex-end;gap:.5rem;padding:.75rem;border-top:1px solid var(--border-weak);background:#fff;">
          <button class="btn primary" id="histSave" type="button">${S.save}</button>
        </div>
      </div>
    </div>
  `;

  /* ---------- Scoped styles (mobile-first) ---------- */
  const style=document.createElement('style');
  style.textContent=`
    .hist-wrap { padding: .4rem; }
    .hist-list {
      display:grid;
      grid-template-columns: 1fr; /* single column on phone */
      gap:.5rem;
    }
    @media (min-width: 900px){
      .hist-list { grid-template-columns: 1fr 1fr; } /* two columns on desktop */
    }
    .doc-card {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;

  /* ensure it stays inside parent card on mobile */
  margin: 0 auto;

  border: 1px solid var(--border-weak);
  border-radius: 12px;

  background: var(--glass, #fff);
  box-shadow: var(--shadow-s, 0 1px 2px rgba(0,0,0,.04));

  padding: .65rem .75rem;

  display: flex;
  gap: .65rem;
  align-items: flex-start;

  transition: box-shadow .15s ease, border-color .15s ease, transform .05s ease;
  cursor: pointer;
}

@media (max-width: 480px){
  .doc-card {
    padding: .6rem .6rem;
    border-radius: 10px;
  }
}
    .doc-card:hover { border-color: var(--border,#ddd); box-shadow: var(--shadow-m,0 6px 16px rgba(0,0,0,.08)); }
    .doc-card:active { transform: translateY(1px); }

    /* Compact left date badge (date only, no time) */
    .doc-date {
      min-width: 82px;
      display:flex; align-items:center; justify-content:center;
      font-variant-numeric: tabular-nums;
      padding:.3rem .5rem;
      border:1px dashed var(--border-weak);
      border-radius:10px;
      background: #fafafa;
      color:#333;
    }

    .doc-main { flex:1 1 auto; min-width:0; display:flex; flex-direction:column; gap:.35rem; }
    .doc-topline { display:flex; align-items:center; justify-content:space-between; gap:.5rem; }
    .doc-title { font-weight:600; color:#111; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .doc-meta { font-size:.9rem; color:#666; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

    .chip-row { display:flex; flex-wrap:wrap; gap:.35rem; }
    .chip {
      border:1px solid var(--border-weak);
      padding:.18rem .5rem;
      border-radius:999px;
      background:#fff;
      font-size:.85rem;
      color:#333;
      max-width:100%;
      overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
    }
    .chip b { font-weight:600; margin-right:.35rem; color:#222; }

/* COLLAPSED (icon only) */
.hist-search {
  display:flex;
  align-items:center;
  position:relative;
  gap:.3rem;
}

.hist-search input {
  width:0;
  max-width:0;
  opacity:0;
  transition: width .18s ease, max-width .18s ease, opacity .18s ease;
}

/* EXPANDED — fits inside phone screens */
.hist-search.open input {
  opacity:1;

  /* On phones: never exceed toolbar space */
  width: clamp(90px, 40vw, 160px);
  max-width: clamp(90px, 40vw, 160px);

  /* Desktop: allow larger search field */
}

@media (min-width:900px){
  .hist-search.open input {
    width: 240px;
    max-width: 240px;
  }
}
    .hist-search .icon { min-width:34px; }
  `;
  root.appendChild(style);

  // elements
  const listWrap=$('#histListWrap',root);
  const overlay=$('#histOverlay',root);
  const box=$('#histBox',root);
  const body=$('#histBody',root);
  const title=$('#histTitle',root);
  const closeBtn=$('#histClose',root);
  const saveBtn=$('#histSave',root);
  const searchToggle=$('#histSearchToggle',root);
  const searchInput=$('#histSearchText',root);
  const reloadBtn=$('#histReload',root);
  const toolbarSearch=$('.hist-search',root);

  // search expand/collapse
  searchToggle.onclick=()=>{
    const open=toolbarSearch.classList.toggle('open');
    if(open){ searchInput.focus(); } else { searchInput.value=''; loadHistory(); }
  };
  searchInput.onkeydown=(e)=>{ if(e.key==='Enter'){ loadHistory(); } };
  reloadBtn.onclick=()=>loadHistory();

  closeBtn.onclick=()=>{ overlay.style.display='none'; };

  /* ---------- Load + render outlined cards ---------- */
  async function loadHistory(){
    listWrap.innerHTML=`<div class="meta">${lang==='th'?'กำลังโหลด...':'Loading...'}</div>`;
    try{
      const res=await apiPost('out_SearchHistory',{limit:0});
      const rows=Array.isArray(res.rows)?res.rows:[];
      const q=(searchInput.value||'').toLowerCase().trim();

      const filtered = q
        ? rows.filter(r=>{
            const blob=[r.ts,r.project,r.contractor,r.requester].join(' ').toLowerCase();
            return blob.includes(q);
          })
        : rows;

      if(!filtered.length){
        listWrap.innerHTML = `<div class="meta" style="text-align:center;color:#777;padding:.75rem">
          ${lang==='th'?'ไม่พบข้อมูล':'No data'}
        </div>`;
        return;
      }

      const grid=document.createElement('div');
      grid.className='hist-list';

      filtered.forEach(r=>{
        const card=document.createElement('div');
        card.className='doc-card';
        card.setAttribute('data-doc', r.doc);

        // date only (strip time if present)
        const ts=r.ts||'';
        const dateOnly = ts.includes(' ') ? ts.split(' ')[0] : ts;

        const left=document.createElement('div');
        left.className='doc-date';
        left.textContent = dateOnly;

        const right=document.createElement('div');
        right.className='doc-main';
        right.innerHTML = `
          <div class="chip-row">
            <div class="chip"><b>${lang==='th'?'ผู้รับเหมา':'Contractor'}:</b> ${esc(r.contractor||'-')}</div>
            <div class="chip"><b>${lang==='th'?'ผู้ขอเบิก':'Requester'}:</b> ${esc(r.requester||'-')}</div>
            <div class="chip"><b>${lang==='th'?'โครงการ':'Project'}:</b> ${esc(r.project||'-')}</div>
          </div>
        `;

        card.appendChild(left);
        card.appendChild(right);
        card.addEventListener('click',()=>openDoc(r.doc));
        grid.appendChild(card);
      });

      listWrap.innerHTML='';
      listWrap.appendChild(grid);
    }catch(err){
      console.warn('loadHistory error:', err);
      listWrap.innerHTML = `<div class="meta" style="color:#b91c1c">${lang==='th'?'โหลดไม่สำเร็จ':'Failed to load'}</div>`;
    }
  }

  /* ---------- Open detail/edit overlay ---------- */
  async function openDoc(docNo){
    overlay.style.display='flex';
    title.textContent=`${lang==='th'?'แก้ไขเอกสาร':'Edit Document'} ${docNo}`;
    body.innerHTML=`<div class="meta">${lang==='th'?'กำลังโหลด...':'Loading...'}</div>`;
    saveBtn.onclick=null;

    try{
      const res=await apiPost('out_GetDoc',{docNo});
      if(!res||!res.ok||!res.doc) throw new Error(res?.message||'Not found');
      const d=res.doc;

      const linesWrap=document.createElement('div'); linesWrap.className='lines';
      (d.lines||[]).forEach(li=>{
        const card=OutLine(lang);
        const name=card.querySelector('input[data-picker="materials"]');
        const qty=card.querySelector('input[type="number"]');
        name.value=li.item||''; qty.value=li.qty||'';
        linesWrap.appendChild(card);
      });

      body.innerHTML=`
        <div class="row">
          <div><label>${lang==='th'?'โครงการ':'Project'}</label><input value="${esc(d.project||'')}" disabled /></div>
          <div><label>${lang==='th'?'ผู้รับเหมา':'Contractor'}</label><input value="${esc(d.contractor||'')}" disabled /></div>
        </div>
        <div class="row">
          <div><label>${lang==='th'?'ผู้ขอเบิก':'Requester'}</label><input value="${esc(d.requester||'')}" disabled /></div>
          <div><label>${lang==='th'?'เวลา':'Time'}</label><input value="${esc(d.ts||'')}" disabled /></div>
        </div>
        <div class="lines" id="outEditLines"></div>
        <div style="margin-top:.75rem;text-align:right;">
          <button class="btn small" id="addLine" type="button">＋ ${lang==='th'?'เพิ่มแถว':'Add line'}</button>
        </div>
      `;
      $('#outEditLines',body).appendChild(linesWrap);

      bindPickerInputs(box,lang);
      $$('#outEditLines [data-picker="materials"]', box).forEach(inp=>{
        inp.addEventListener('click', ()=>openPicker(inp,'materials',lang));
      });
      $('#addLine', body).onclick=()=>{
        const wrap=$('#outEditLines', body);
        const c=OutLine(lang); wrap.appendChild(c); bindPickerInputs(box,lang);
        const i=c.querySelector('input[data-picker="materials"]');
        i.addEventListener('click', ()=>openPicker(i,'materials',lang));
        i.click(); // open immediately
      };

      saveBtn.onclick = async ()=>{
        const rows=$$('#outEditLines .line', body);
        const lines=[];
        rows.forEach(r=>{
          const item=(r.querySelector('[data-picker="materials"]')?.value||'').trim();
          const qty=Number(r.querySelector('input[type="number"]')?.value||0)||0;
          if(item) lines.push({name:item,qty});
        });
        if(!lines.length){ return toast(lang==='th'?'ต้องมีอย่างน้อย 1 รายการ':'At least one line required'); }
        setBtnLoading(saveBtn,true);
        try{
          const res2=await apiPost('out_UpdateDoc',{docNo,lines});
          if(res2&&res2.ok){
            toast(lang==='th'?'บันทึกแล้ว':'Saved');
            overlay.style.display='none';
            loadHistory();
          }else{
            toast(res2?.message||'Error');
          }
        }catch{
          toast(lang==='th'?'บันทึกไม่สำเร็จ':'Save failed');
        }finally{
          setBtnLoading(saveBtn,false);
        }
      };

    }catch(err){
      console.warn('openDoc error:',err);
      body.innerHTML=`<div class="meta" style="color:#b91c1c">${lang==='th'?'โหลดไม่สำเร็จ':'Failed to load document'}</div>`;
      saveBtn.onclick=null;
    }
  }

  // initial
  loadHistory();
}
