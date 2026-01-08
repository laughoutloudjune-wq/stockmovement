// tabs/adjust.js
import {
  $, $$, STR, bindPickerInputs, openPicker,
  apiPost, apiGet, setBtnLoading, toast, stockBadge
} from '../js/shared.js';

function AdjLine(lang){
  const card=document.createElement('div'); card.className='line';

  const name=document.createElement('input');
  name.placeholder=(lang==='th' ? 'พิมพ์เพื่อค้นหา…' : 'Type to search…');
  name.readOnly=true; 
  name.setAttribute('data-picker','materials');

  const qty=document.createElement('input'); 
  qty.type='number'; qty.step='any'; qty.placeholder='±'; qty.inputMode='decimal';

  // --- NEW: Stock Badge ---
  const meta=document.createElement('div'); 
  meta.className='rowitem'; 
  meta.style.justifyContent='flex-start';
  meta.style.marginTop='-4px';
  
  const label=document.createElement('span'); 
  label.className='meta'; 
  label.textContent = (lang==='th' ? 'คงเหลือปัจจุบัน: ' : 'Current Stock: ');

  let badge = document.createElement('span'); 
  badge.className='badge'; 
  badge.textContent='-';

  meta.appendChild(label); 
  meta.appendChild(badge);
  // ------------------------

  const grid=document.createElement('div'); grid.className='grid';
  grid.appendChild(name); grid.appendChild(qty);

  const actions=document.createElement('div'); actions.className='actions';
  const rm=document.createElement('button'); rm.type='button'; rm.className='btn small'; rm.textContent='×'; rm.onclick=()=>card.remove();
  actions.appendChild(rm);

  card.appendChild(grid); 
  card.appendChild(meta); // Add meta row
  card.appendChild(actions);

  name.addEventListener('click', ()=>openPicker(name,'materials', lang));

  // Fetch Stock on Change
  name.addEventListener('change', async ()=>{
    const v=name.value.trim();
    if(!v){
        badge.textContent='-'; badge.className='badge';
        return;
    }
    // Spinner
    badge.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px"></span>';
    
    try{
      // Reuse getCurrentStock from backend
      const res = await apiGet('getCurrentStock', { material: v });
      const n  = (res && res.ok) ? Number(res.stock) : null;
      const mn = (res && res.ok) ? Number(res.min||0) : null;
      const bNew = stockBadge(n, mn);
      meta.replaceChild(bNew, badge);
      badge = bNew;
    }catch(e){
      badge.textContent='?'; badge.className='badge red';
    }
  });

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

  addLine();
}
