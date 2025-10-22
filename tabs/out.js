// tabs/out.js (v0.2-fix-out-tab)
import { STR } from '../js/shared.js';

export default async function mountOut({ root, lang }) {
  const S = (STR && STR[lang]) || { tabs: { out: 'Out' } };
  const wrap = document.createElement('section');
  wrap.className = 'card glass';
  wrap.innerHTML = `
    <h3>${S.tabs.out}</h3>
    <p>${lang==='th' ? 'ตัวอย่างแท็บจ่ายออก (ไฟล์ ES module ถูกต้องแล้ว)' : 'Example Out tab (valid ES module).'} </p>
  `;
  root.innerHTML = '';
  root.appendChild(wrap);
}
