// tabs/dashboard.js
import { STR } from '../js/shared.js';

export default async function mountDashboard({ root, lang }) {
  const S = (STR && STR[lang]) || { tabs: { dash: 'Dashboard', out: 'Out', in: 'In', adj: 'Adjust', pur: 'Purchase' } };
  const title = S.tabs.dash;
  const wrap = document.createElement('section');
  wrap.className = 'card glass';
  wrap.innerHTML = `
    <h3>${title}</h3>
    <div class="row">
      <div>
        <label>${lang==='th' ? 'ตัวอย่าง' : 'Example'}</label>
        <p class="meta">${lang==='th' ? 'แท็บนี้พร้อมเชื่อม API แล้ว' : 'This tab is wired and ready.'}</p>
      </div>
    </div>
  `;
  root.innerHTML = '';
  root.appendChild(wrap);
}
