// out_history.js — 3-LEVEL HIERARCHY (floating pill header)
// Group by date → OUT records → chips
// Overlay uses OUT layout + stock badges, unchanged from your previous version.

import {
  $, $$, STR, bindPickerInputs, openPicker,
  apiGet, apiPost, setBtnLoading, esc, toast, stockBadge
} from '../js/shared.js';

/* ---------- Reuse OUT line UI ---------- */
function OutLine(lang){
  const card=document.createElement('div');
  card.className='line';

  const name=document.createElement('input');
  name.placeholder=(lang==='th'?'พิมพ์เพื่อค้นหา…':'Type to search…');
  name.readOnly=true;
  name.setAttribute('data-picker','materials');

  const qty=document.createElement('input');
  qty.type='number'; qty.min='0'; qty.step='any'; qty.placeholder='0';

  const meta=document.createElement('div');
  meta.className='rowitem'; meta.style.justifyContent='flex-start';

  const label=document.createElement('span');
  label.className='meta'; label.textContent=(lang==='th'?'คงเหลือ: ':'Stock: ');

  let badge=document.createElement('span');
  badge.className='badge'; badge.textContent='-';

  meta.appendChild(label); meta.appendChild(badge);

  const actions=document.createElement('div'); actions.className='actions';
  const rm=document.createElement('button');
  rm.type='button'; rm.className='btn small';
  rm.textContent='×'; rm.onclick=()=>card.remove();
  actions.appendChild(rm);

  const grid=document.createElement('div'); grid.className='grid';
  grid.appendChild(name); grid.appendChild(qty);

  card.appendChild(grid); card.appendChild(meta); card.appendChild(actions);

  name.addEventListener('click', ()=>openPicker(name,'materials', lang));

  name.addEventListener('change', async ()=>{
    const v=name.value.trim();
    const spin=document.createElement('span');
    spin.className='badge';
    spin.innerHTML='<span class="spinner" style="width:14px;height:14px;border-width:2px"></span>';
    meta.replaceChild(spin, badge); badge=spin;
    try{
      const res=await apiGet('getCurrentStock',{material:v});
      const n=(res&&res.ok)?Number(res.stock):null;
      const mn=(res&&res.ok)?Number(res.min||0):null;
      const bNew=stockBadge(n,mn);
      meta.replaceChild(bNew, badge); badge=bNew;
    }catch{
      const bErr=document.createElement('span');
      bErr.className='badge red'; bErr.textContent='!';
      meta.replaceChild(bErr, badge); badge=bErr;
    }
  });

  return card;
}

/* ---------- MAIN MOUNT ---------- */
export default async function mount({ root, lang }){
  const S=STR[lang];

  root.innerHTML=`
    <section class="card glass">
      <div class="hist-toolbar">
        <h3 style="margin:0;">📜 ${lang==='th'?'ประวัติการจ่ายออก (OUT)':'OUT History'}</h3>
        <div class="hist-search">
          <button class="btn small icon" id="histSearchToggle">🔍</button>
          <input id="histSearchText" placeholder="${lang==='th'?'ค้นหา...':'Search...'}" />
          <button class="btn small" id="histReload">⟲</button>
        </div>
      </div>
      <div id="histListWrap" class="hist-wrap"></div>
    </section>

    <div id="histOverlay" aria-hidden="true"
         style="position:fixed;inset:0;z-index:1960;display:none;align-items:center;justify-content:center;background:rgba(15,18,23,0.12);backdrop-filter:blur(2px);">
      <div id="histBox" class="glass"
           style="border-radius:18px;box-shadow:var(--shadow-l);display:flex;flex-direction:column;overflow:hidden;width:96vw;max-width:860px;height:92vh;background:#fff;">
        <div class="overlay-header">
          <h3 id="histTitle" style="margin:0;font-size:1rem;">${lang==='th'?'รายละเอียด':'Details'}</h3>
          <button class="btn small" id="histClose">ปิด</button>
        </div>
        <div id="histBody" style="flex:1;overflow:auto;padding:.75rem;"></div>
        <div class="overlay-footer">
          <button class="btn primary" id="histSave">${S.save}</button>
        </div>
      </div>
    </div>
  `;

  /* ---------- Styles (including floating pill header) ---------- */
  const style=document.createElement('style');
  style.textContent=`
    .hist-wrap {
      padding: .4rem;
    }

    /* iOS floating pill header */
    .date-pill {
      width: fit-content;
      margin: 1rem auto .35rem auto;
      padding: .25rem .9rem;
      background: #f0f0f0cc;
      backdrop-filter: blur(6px);
      border-radius: 20px;
      font-size:.85rem;
      font-weight:600;
      color:#333;
      box-shadow: inset 0 0 0 1px var(--border-weak);
    }

    /* Level-2 nested cards */
    .hist-list {
      display: flex;
      flex-direction: column;
      gap: .55rem;
      margin-bottom: 1rem;
      padding: 0 .2rem;
    }

    .doc-card {
      width:100%;
      max-width:100%;
      margin: 0 auto;
      box-sizing:border-box;

      border:1px solid var(--border-weak);
      border-radius:12px;
      background: var(--glass,#fff);
      padding:.65rem .75rem;

      display:flex;
      flex-direction:column;
      gap:.45rem;

      transition: box-shadow .15s ease, border-color .15s ease;
    }
    .doc-card:hover { box-shadow:var(--shadow-m); }

    .doc-title {
      font-weight:600;
      color:#111;
      font-size:.98rem;
    }

    .chip-row { display:flex; flex-wrap:wrap; gap:.35rem; }
    .chip {
      border:1px solid var(--border-weak);
      padding:.18rem .5rem;
      border-radius:999px;
      background:#fff;
      font-size:.82rem;
      max-width:100%;
      overflow:hidden;
    }
    .chip b { margin-right:.25rem; font-weight:600; }

    /* Search */
    .hist-toolbar {
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:.75rem;
    }
    .hist-search {
      display:flex; align-items:center; position:relative; gap:.3rem;
    }
    .hist-search input {
      width:0; max-width:0; opacity:0;
      transition:width .18s ease, max-width .18s ease, opacity .18s ease;
    }
    .hist-search.open input {
      opacity:1;
      width:clamp(90px,40vw,160px);
      max-width:clamp(90px,40vw,160px);
    }
    @media(min-width:900px){
      .hist-search.open input { width:240px; max-width:240px; }
    }

    .overlay-header {
      padding:.75rem 1rem;
      border-bottom:1px solid var(--border-weak);
      display:flex; justify-content:space-between; align-items:center;
    }
    .overlay-footer {
      padding:.75rem; border-top:1px solid var(--border-weak);
      display:flex; justify-content:flex-end;
    }
  `;
  root.appendChild(style);

  /* ---------- Elements ---------- */
  const listWrap=$('#histListWrap',root);
  const overlay=$('#histOverlay');
  const body=$('#histBody');
  const title=$('#histTitle');
  const saveBtn=$('#histSave');
  const closeBtn=$('#histClose');

  const searchToggle=$('#histSearchToggle');
  const searchInput=$('#histSearchText');
  const searchBox=$('.hist-search',root);
  const reloadBtn=$('#histReload');

  /* ---------- Search Interaction ---------- */
  searchToggle.onclick=()=>{
    const open=searchBox.classList.toggle('open');
    if(open) searchInput.focus();
    else { searchInput.value=''; loadHistory(); }
  };
  searchInput.onkeydown=e=>{ if(e.key==='Enter') loadHistory(); };
  reloadBtn.onclick=()=>loadHistory();
  closeBtn.onclick=()=>overlay.style.display='none';

  /* ---------- Load & Group by Date ---------- */
  async function loadHistory(){
    listWrap.innerHTML=`<div class="meta">Loading...</div>`;

    try{
      const res=await apiPost('out_SearchHistory',{limit:0});
      const rows=Array.isArray(res.rows)?res.rows:[];
      const q=(searchInput.value||'').toLowerCase();

      // Filter
      const filtered=q?rows.filter(r=>{
        const blob=[r.contractor,r.project,r.requester,r.ts].join(' ').toLowerCase();
        return blob.includes(q);
      }):rows;

      if(!filtered.length){
        listWrap.innerHTML=`<div class="meta" style="text-align:center;color:#777;padding:1rem">No data</div>`;
        return;
      }

      // Group by date
      const groups={};
      filtered.forEach(r=>{
        const ts=r.ts||'';
        const date = ts.split(' ')[0]; // strip time
        if(!groups[date]) groups[date]=[];
        groups[date].push(r);
      });

      // Build UI
      const wrap=document.createElement('div');

      Object.keys(groups).sort((a,b)=>b.localeCompare(a)).forEach(date=>{
        // Level 1 — floating pill
        const pill=document.createElement('div');
        pill.className='date-pill';
        pill.textContent=date;
        wrap.appendChild(pill);

        // Level 2 — card list under this date
        const list=document.createElement('div');
        list.className='hist-list';

        groups[date].forEach(r=>{
          const card=document.createElement('div');
          card.className='doc-card';

          // Level 3 — chips
          const chipRow=document.createElement('div');
          chipRow.className='chip-row';
          chipRow.innerHTML=`
            <div class="chip"><b>${lang==='th'?'ผู้รับเหมา':'Contractor'}:</b>${esc(r.contractor||'-')}</div>
            <div class="chip"><b>${lang==='th'?'ผู้ขอเบิก':'Requester'}:</b>${esc(r.requester||'-')}</div>
            <div class="chip"><b>${lang==='th'?'โครงการ':'Project'}:</b>${esc(r.project||'-')}</div>
            <div class="chip"><b>${lang==='th'?'จำนวนรายการ':'Items'}:</b>${r.itemCount||'-'}</div>
          `;

          card.innerHTML=`<div class="doc-title">${lang==='th'?'รายการจ่ายออก':'Material OUT'}</div>`;
          card.appendChild(chipRow);
          card.addEventListener('click',()=>openDoc(r.doc));

          list.appendChild(card);
        });

        wrap.appendChild(list);
      });

      listWrap.innerHTML='';
      listWrap.appendChild(wrap);

    }catch(err){
      console.warn(err);
      listWrap.innerHTML=`<div class="meta" style="color:#c00">Error loading</div>`;
    }
  }

  /* ---------- Open document overlay ---------- */
  async function openDoc(docNo){
    overlay.style.display='flex';
    title.textContent=`${lang==='th'?'แก้ไขเอกสาร':'Edit Document'} ${docNo}`;
    body.innerHTML=`<div class="meta">Loading...</div>`;
    saveBtn.onclick=null;

    try{
      const res=await apiPost('out_GetDoc',{docNo});
      if(!res||!res.ok) throw new Error("Not found");

      const d=res.doc;

      const linesWrap=document.createElement('div');
      linesWrap.className='lines';
      (d.lines||[]).forEach(li=>{
        const card=OutLine(lang);
        const name=card.querySelector('[data-picker="materials"]');
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
        <div style="text-align:right;margin-top:.75rem;">
          <button class="btn small" id="addLine">＋ ${lang==='th'?'เพิ่มแถว':'Add line'}</button>
        </div>
      `;
      $('#outEditLines',body).appendChild(linesWrap);

      bindPickerInputs($('#histBox'), lang);

      $('#addLine',body).onclick=()=>{
        const wrap=$('#outEditLines',body);
        const c=OutLine(lang); wrap.appendChild(c);
        const i=c.querySelector('[data-picker="materials"]');
        i.addEventListener('click',()=>openPicker(i,'materials',lang));
        i.click();
      };

      saveBtn.onclick=async()=>{
        const rows=$$('#outEditLines .line',body);
        const lines=[];
        rows.forEach(r=>{
          const item=r.querySelector('[data-picker="materials"]').value.trim();
          const qty=Number(r.querySelector('input[type="number"]').value||0);
          if(item) lines.push({name:item,qty});
        });
        if(!lines.length) return toast("ต้องมีอย่างน้อย 1 รายการ");
        setBtnLoading(saveBtn,true);
        try{
          const res2=await apiPost('out_UpdateDoc',{docNo,lines});
          if(res2.ok){
            toast("บันทึกแล้ว");
            overlay.style.display='none';
            loadHistory();
          }
        }catch{}
        setBtnLoading(saveBtn,false);
      };

    }catch(err){
      console.warn(err);
      body.innerHTML=`<div class="meta">Error loading document</div>`;
    }
  }

  loadHistory();
}
