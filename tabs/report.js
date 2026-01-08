// tabs/report.js
import {
  $, esc, apiPost, setBtnLoading, toast, todayStr, STR, bindPickerInputs, openPicker
} from '../js/shared.js';

export default async function mount({ root, lang }){
  const S = STR[lang];
  
  root.innerHTML = `
    <section class="card glass">
      <h3>${S.reportTitle}</h3>
      
      <div class="grid" style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;align-items:end;margin-bottom:.75rem">
        <div>
           <label style="font-size:0.8rem;font-weight:700;margin-bottom:4px;display:block">${lang==='th'?'เริ่ม':'Start'}</label>
           <input type="date" id="repStart" />
        </div>
        <div>
           <label style="font-size:0.8rem;font-weight:700;margin-bottom:4px;display:block">${lang==='th'?'ถึง':'End'}</label>
           <input type="date" id="repEnd" />
        </div>
      </div>

      <div class="grid" style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;align-items:end;margin-bottom:.75rem">
        <div>
            <label style="font-size:0.8rem;font-weight:700;margin-bottom:4px;display:block">${lang==='th'?'วัสดุ (ทั้งหมด)':'Material (All)'}</label>
            <input id="repMat" data-picker="materials" placeholder="${S.pick}" readonly />
        </div>
        <div>
            <label style="font-size:0.8rem;font-weight:700;margin-bottom:4px;display:block">${lang==='th'?'ประเภท':'Type'}</label>
            <select id="repType">
                <option value="">${lang==='th'?'ทั้งหมด (All)':'All Types'}</option>
                <option value="IN">IN (รับเข้า)</option>
                <option value="OUT">OUT (เบิกออก)</option>
                <option value="ADJUST">ADJUST (ปรับปรุง)</option>
            </select>
        </div>
      </div>
      
      <div class="grid" style="display:grid;grid-template-columns:1fr;gap:.75rem;align-items:end;margin-bottom:.75rem">
         <div>
            <label style="font-size:0.8rem;font-weight:700;margin-bottom:4px;display:block">${lang==='th'?'โครงการ (ทั้งหมด)':'Project (All)'}</label>
            <input id="repProj" data-picker="projects" placeholder="${S.pick}" readonly />
        </div>
      </div>

      <div style="margin-top:1rem;display:flex;gap:.5rem">
        <button class="btn" id="repReset" type="button" style="flex:0 0 auto">↺</button>
        <button class="btn primary" id="repGenBtn" style="flex:1">
            <span class="btn-label">${S.reportGen}</span>
            <span class="btn-spinner"><span class="spinner"></span></span>
        </button>
      </div>
    </section>

    <section class="card glass" id="repResultSec" style="display:none; margin-top:1rem">
        <h3 id="repResTitle">Result</h3>
        <div style="overflow-x:auto">
            <table id="repTable" style="width:100%;border-collapse:collapse;font-size:0.85rem">
                <thead>
                    <tr style="border-bottom:2px solid #ddd;text-align:left;color:#555">
                        <th style="padding:8px;white-space:nowrap">Date</th>
                        <th style="padding:8px">Type</th>
                        <th style="padding:8px">Item / Project</th>
                        <th style="padding:8px;text-align:right">Qty</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        </div>
        <div id="repSummary" style="margin-top:1rem;padding-top:1rem;border-top:1px solid #eee;font-weight:bold;text-align:right"></div>
    </section>
  `;

  // Init Dates
  const d = new Date();
  $('#repEnd', root).value = todayStr();
  d.setDate(1);
  $('#repStart', root).value = d.toISOString().split('T')[0];

  const btn = $('#repGenBtn', root);
  const resetBtn = $('#repReset', root);
  const resSec = $('#repResultSec', root);
  const tbody = $('#repTable tbody', root);
  const summary = $('#repSummary', root);

  // Bind Pickers
  bindPickerInputs(root, lang);

  // Reset Logic
  resetBtn.onclick = () => {
      $('#repMat', root).value = '';
      $('#repProj', root).value = '';
      $('#repType', root).value = '';
      resSec.style.display = 'none';
      toast('Filters cleared');
  };

  btn.addEventListener('click', async ()=>{
      const start = $('#repStart', root).value;
      const end = $('#repEnd', root).value;
      const material = $('#repMat', root).value.trim();
      const type = $('#repType', root).value;
      const project = $('#repProj', root).value.trim();
      
      if(!start || !end) return toast("Please select dates");
      
      setBtnLoading(btn, true);
      resSec.style.display = 'none';
      tbody.innerHTML = '';
      
      try {
          // Pass all filters to backend
          const res = await apiPost('getMovementReport', { start, end, material, type, project });
          
          if(res && res.ok && Array.isArray(res.data)) {
              if(res.data.length === 0) {
                  toast(lang==='th'?'ไม่พบข้อมูล':'No data found');
              } else {
                  let totalIn = 0;
                  let totalOut = 0;

                  res.data.forEach(row => {
                      const tr = document.createElement('tr');
                      tr.style.borderBottom = '1px solid #eee';
                      
                      const isIn = row.type === 'IN';
                      if(isIn) totalIn += row.qty;
                      else if(row.type === 'OUT') totalOut += row.qty;
                      
                      const color = isIn ? '#10b981' : (row.type==='OUT'?'#ef4444':'#f59e0b');
                      
                      // Combine Item and Project/User info for compactness
                      const detailHtml = `
                        <div style="font-weight:600">${esc(row.item)}</div>
                        <div style="font-size:0.75rem;color:#666">${esc(row.project||'-')} • ${esc(row.by)}</div>
                      `;

                      tr.innerHTML = `
                        <td style="padding:8px;vertical-align:top;white-space:nowrap">${esc(row.date)}</td>
                        <td style="padding:8px;vertical-align:top"><span class="badge" style="font-size:0.65rem;height:1.4rem;min-width:0;padding:0 .4rem;background:${color}">${row.type}</span></td>
                        <td style="padding:8px;vertical-align:top">${detailHtml}</td>
                        <td style="padding:8px;vertical-align:top;text-align:right;font-weight:bold">${row.qty}</td>
                      `;
                      tbody.appendChild(tr);
                  });
                  
                  summary.innerHTML = `
                    <div style="font-size:0.9rem">
                        <span style="color:#10b981;margin-right:1rem">IN: ${totalIn}</span> 
                        <span style="color:#ef4444">OUT: ${totalOut}</span>
                    </div>
                  `;
                  resSec.style.display = 'block';
              }
          } else {
              toast('Error loading report');
          }
      } catch (e) {
          console.error(e);
          toast('Failed to load');
      } finally {
          setBtnLoading(btn, false);
      }
  });
}
