// tabs/out.js
import { STR, stockBadge, apiGet, getLookups } from '../js/shared.js';

export default async function mount{cap}({ root, lang }) {
  const S = STR[lang];
  // Example content; replace with your real UI for this tab
  const wrap = document.createElement('section');
  wrap.className = 'card glass';
  wrap.innerHTML = `
    <h3>${S.tabs.out}</h3>
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
