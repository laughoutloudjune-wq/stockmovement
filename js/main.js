// js/main.js
import { $, $$, STR, applyLangTexts, preloadLookups, bindPickerInputs, toast, currentLang, cleanOldCache, setBtnLoading } from './shared.js';

const TAB_MODULES = {
  dashboard: () => import('../tabs/dashboard.js').catch(()=>({default: async ({root})=> root.innerHTML='<section class="card glass"><h3>Dashboard</h3><p>Coming soon</p></section>' })),
  out:       () => import('../tabs/out.js'),
  in:        () => import('../tabs/in.js').catch(()=>({default: async ({root})=> root.innerHTML='<section class="card glass"><h3>IN</h3><p>Coming soon</p></section>' })),
  adjust:    () => import('../tabs/adjust.js').catch(()=>({default: async ({root})=> root.innerHTML='<section class="card glass"><h3>Adjust</h3><p>Coming soon</p></section>' })),
  purchase:  () => import('../tabs/purchase.js').catch(()=>({default: async ({root})=> root.innerHTML='<section class="card glass"><h3>Purchase</h3><p>Coming soon</p></section>' })),
};

let LANG = 'th';
let currentTab = 'out'; // focus our tab
const viewEl = () => $('#view');

async function mountTab(tab){
  currentTab = tab;
  // set active class
  $$('.tabs button').forEach(b=> b.classList.toggle('active', b.getAttribute('data-tab')===tab));
  // show skeleton
  viewEl().innerHTML = `<section class="card glass"><div class="skeleton-row"><div class="skeleton-bar"></div><div class="skeleton-badge"></div></div></section>`;
  try{
    const mod = await TAB_MODULES[tab]();
    await (mod.default)({root: viewEl(), lang: LANG});
  }catch(e){
    viewEl().innerHTML = `<section class="card glass"><h3>Error</h3><p>${(e && e.message) || e}</p></section>`;
  }
}

async function init(){
  cleanOldCache();

  // set lang from <html lang> if present
  LANG = currentLang();

  // Language switches
  $('#lang-th')?.addEventListener('click', ()=>{ document.documentElement.lang='th'; onLangChange(); });
  $('#lang-en')?.addEventListener('click', ()=>{ document.documentElement.lang='en'; onLangChange(); });

  // Tabs
  $$('.tabs button').forEach(btn => btn.addEventListener('click', ()=> mountTab(btn.dataset.tab)));

  // Preload lookups
  try{ await preloadLookups(); }catch{ toast(LANG==='th' ? 'โหลดข้อมูลเริ่มต้นไม่สำเร็จ' : 'Failed to load lookups'); }

  // Refresh button: rebuild caches server-side
  const refreshBtn = $('#refreshDataBtn');
  refreshBtn?.addEventListener('click', async ()=>{
    setBtnLoading(refreshBtn, true);
    try{ await fetch((window.API_URL||'')+'?fn=admin_RebuildCache').then(r=>r.text()); toast(LANG==='th' ? 'รีเฟรชแคชแล้ว' : 'Cache refreshed'); }
    catch{ toast(LANG==='th' ? 'รีเฟรชไม่สำเร็จ' : 'Refresh failed'); }
    finally{ setBtnLoading(refreshBtn, false); }
  });

  // mount default
  await mountTab(currentTab);
}

function onLangChange(){
  LANG = currentLang();
  applyLangTexts(LANG);
  bindPickerInputs(document, LANG);
  mountTab(currentTab);
}

document.addEventListener('DOMContentLoaded', init);
