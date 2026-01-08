// tabs/report.js
// New Reports Tab: Filter movements by date range and view details.

import {
  $, esc, apiPost, setBtnLoading, toast, todayStr, STR
} from '../js/shared.js';

export default async function mount({ root, lang }){
  const S = STR[lang];
  
  root.innerHTML = `
    <section class="card glass">
      <h3>${S.reportTitle}</h3>
      <div class="grid" style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;align-items:end">
        <div>
           <label style="font-size:0.8rem;font-weight:700;margin-bottom:4px;display:block">Start Date</label>
           <input type="date" id="repStart" />
        </div>
        <div>
           <label style="font-size:0.8rem;font-weight:700;margin-bottom:4px;display:block">End Date</label>
           <input type="date" id="repEnd" />
        </div>
      </div>
      <div style="margin-top:0.5rem">
        <button class="btn primary" id="repGenBtn" style="width:100%">
            <span class="btn-label">${S.reportGen}</span>
            <span class="btn-spinner"><span class="spinner"></span></span>
        </button>
      </div>
    </section>

    <section class="card glass" id="repResultSec" style="display:none; margin-top:1rem">
        <h3 id="repResTitle">Result</h3>
        <div style="overflow-x:auto">
            <table id="repTable" style="width:100%;border-collapse:collapse;font-size:0.9rem">
                <thead>
                    <tr style="border-bottom:2px solid #ddd;text-align:left">
                        <th style="padding:8px">Date</th>
                        <th style="padding:8px">Type</th>
                        <th style="padding:8px">Item</th>
                        <th style="padding:8px;text-align:right">Qty</th>
                        <th style="padding:8px">By</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        </div>
        <div id="repSummary" style="margin-top:1rem;padding-top:1rem;border-top:1px solid #eee;font-weight:bold;text-align:right"></div>
    </section>
  `;

  // Defaults: First day of month to Today
  const d = new Date();
  $('#repEnd', root).value = todayStr();
  d.setDate(1);
  $('#repStart', root).value = d.toISOString().split('T')[0];

  const btn = $('#repGenBtn', root);
  const resSec = $('#repResultSec', root);
  const tbody = $('#repTable tbody', root);
  const summary = $('#repSummary', root);

  btn.addEventListener('click', async ()=>{
      const start = $('#repStart', root).value;
      const end = $('#repEnd', root).value;
      
      if(!start || !end) return toast("Please select dates");
      
      setBtnLoading(btn, true);
      resSec.style.display = 'none';
      tbody.innerHTML = '';
      
      try {
          // CALLING BACKEND API
          // You must implement 'getMovementReport' in your Google Apps Script
          const res = await apiPost('getMovementReport', { start, end });
          
          if(res && res.ok && Array.isArray(res.data)) {
              if(res.data.length === 0) {
                  toast(lang==='th'?'ไม่พบข้อมูล':'No data found');
              } else {
                  let totalIn = 0;
                  let totalOut = 0;

                  res.data.forEach(row => {
                      const tr = document.createElement('tr');
                      tr.style.borderBottom = '1px solid #eee';
                      // row structure: { date, type, item, qty, by, doc }
                      
                      const isIn = row.type === 'IN';
                      if(isIn) totalIn += row.qty;
                      else totalOut += row.qty;
                      
                      const color = isIn ? 'green' : (row.type==='OUT'?'red':'orange');
                      
                      tr.innerHTML = `
                        <td style="padding:8px;white-space:nowrap">${esc(row.date)}</td>
                        <td style="padding:8px"><span class="badge" style="font-size:0.7rem;background:${color==='green'?'#10b981':(color==='red'?'#ef4444':'#f59e0b')}">${row.type}</span></td>
                        <td style="padding:8px">${esc(row.item)}</td>
                        <td style="padding:8px;text-align:right">${row.qty}</td>
                        <td style="padding:8px;font-size:0.8rem;color:#666">${esc(row.by)}</td>
                      `;
                      tbody.appendChild(tr);
                  });
                  
                  summary.innerHTML = `
                    <span style="color:#10b981">IN: ${totalIn}</span> &nbsp;|&nbsp; 
                    <span style="color:#ef4444">OUT: ${totalOut}</span>
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
