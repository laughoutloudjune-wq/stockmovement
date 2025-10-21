// js/main.js — App router + global FAB integration
import {
  $, $$, STR, applyLangTexts, preloadLookups, bindPickerInputs,
  toast, currentLang, cleanOldCache, setBtnLoading
} from './shared.js';
import { mountGlobalFab, setFab, hideFab } from './fab.js';

// Lazy-load tab modules
const TAB_MODULES = {
  dashboard: () => import('../tabs/dashboard.js'),
  out:       () => import('../tabs/out.js'),
  in:        () => import('../tabs/in.js'),
  adjust:    () => import('../tabs/adjust.js'),
  purchase:  () => import('../tabs/purchase.js'),
};

let LANG = currentLang();
let currentTab = 'dashboard';

function viewEl(){ return $('#view'); }

async function mountTab(tab){
  currentTab = tab;
  $$('.tabs button').forEach(b=> b.classList.toggle('active', b.getAttribute('data-tab')===tab));

  const root = viewEl();
  root.innerHTML = `<section class="card glass">
    <div class="skeleton-row"><div class="skeleton-bar"></div><div class="skeleton-badge"></div></div>
  </section>`;

  try{
    const mod = await TAB_MODULES[tab]();
    await mod.default({ root, lang: LANG });
    // Global FAB: update actions for this tab
    mountGlobalFab();
    if (typeof mod.fabActions === 'function'){
      const actions = mod.fabActions({ root, lang: LANG });
      setFab(actions);
    } else {
      hideFab();
    }
  }catch(e){
    root.innerHTML = `<section class="card glass"><h3>Error</h3><p>${(e && e.message) || e}</p></section>`;
    hideFab();
  }
}

async function init(){
  cleanOldCache();

  // Language toggle
  $('#lang-en')?.addEventListener('click', ()=>{ LANG='en'; document.documentElement.lang='en'; onLangChange(); });
  $('#lang-th')?.addEventListener('click', ()=>{ LANG='th'; document.documentElement.lang='th'; onLangChange(); });

  // Tabs
  $$('.tabs button').forEach((btn)=>{
    btn.addEventListener('click', async ()=>{
      const key = btn.getAttribute('data-tab');
      if (!key) return;
      await mountTab(key);
    });
  });

  // Preload lookups before first mount
  try{
    await preloadLookups();
  }catch{
    toast(LANG==='th' ? 'โหลดข้อมูลเริ่มต้นไม่สำเร็จ ใช้ข้อมูลเก่า' : 'Failed to load lookups; using cached data');
  }

  // Language texts
  applyLangTexts(LANG);
  bindPickerInputs(document, LANG);

  // Refresh button (top right)
  const refreshBtn = $('#refreshDataBtn');
  refreshBtn?.addEventListener('click', async ()=>{
    try {
      setBtnLoading(refreshBtn, true);
      // clear caches
      const keys = [];
      for (let i=0;i<localStorage.length;i++){
        const k = localStorage.key(i);
        if (k && k.startsWith('cache:')) keys.push(k);
      }
      keys.forEach(k=>localStorage.removeItem(k));
      await preloadLookups();
      toast(LANG==='th' ? 'รีเฟรชข้อมูลแล้ว' : 'Data refreshed');
      await mountTab(currentTab);
    }catch{
      toast(LANG==='th' ? 'รีเฟรชไม่สำเร็จ' : 'Refresh failed');
    }finally{
      setBtnLoading(refreshBtn, false);
    }
  });

  await mountTab(currentTab);
}

function onLangChange(){
  applyLangTexts(LANG);
  bindPickerInputs(document, LANG);
  mountTab(currentTab);
}

document.addEventListener('DOMContentLoaded', init);
