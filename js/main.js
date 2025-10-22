// js/main.js
// Adds cache cleanup, refresh button spinner, proper dashboard mounting, and tab routing.

import {
  $, $$, STR, applyLangTexts, preloadLookups, bindPickerInputs,
  toast, currentLang, cleanOldCache, setBtnLoading
} from './shared.js';

// Lazy import tab modules
const TAB_MODULES = {
  dashboard: () => import('../tabs/dashboard.js'),
  out:       () => import('../tabs/out.js'),
  in:        () => import('../tabs/in.js'),
  adjust:    () => import('../tabs/adjust.js'),
  purchase:  () => import('../tabs/purchase.js'),
};

let LANG = currentLang();
let currentTab = 'dashboard';

async function mountTab(tabKey) {
  const loader = TAB_MODULES[tabKey];
  if (!loader) return;
  const mod = await loader();
  const root = $('#view');
  await mod.default({ root, lang: LANG });
  bindPickerInputs(root, LANG);
}

async function init() {
  // 0) Clean stale cache first (keeps fresh, drops old)
  cleanOldCache();

  // Language toggle
  $('#lang-en')?.addEventListener('click', () => { LANG = 'en'; document.documentElement.lang = 'en'; onLangChange(); });
  $('#lang-th')?.addEventListener('click', () => { LANG = 'th'; document.documentElement.lang = 'th'; onLangChange(); });

  // Tabs
  $$('.tabs button').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const key = btn.getAttribute('data-tab');
      if (!key) return;
      $$('.tabs button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = key;
      await mountTab(currentTab);
    });
  });

  // 1) Preload lookups BEFORE first mount
  try {
    await preloadLookups();
  } catch {
    toast(LANG === 'th' ? 'โหลดข้อมูลเริ่มต้นไม่สำเร็จ กำลังใช้ข้อมูลเก่า' : 'Failed to load lookups; using cached data');
  }

  // 2) Apply language and bind pickers
  applyLangTexts(LANG);
  bindPickerInputs(document, LANG);

  // 3) Manual refresh button with spinner
  const refreshBtn = $('#refreshDataBtn');
  refreshBtn?.addEventListener('click', async ()=>{
    try {
      setBtnLoading(refreshBtn, true);
      // remove only our cached keys
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('cache:')) keys.push(k);
      }
      keys.forEach(k => localStorage.removeItem(k));

      await preloadLookups();
      toast(LANG==='th' ? 'รีเฟรชข้อมูลแล้ว' : 'Data refreshed');

      // re-mount current tab so UI picks up fresh lists
      await mountTab(currentTab);
    } catch {
      toast(LANG==='th' ? 'รีเฟรชไม่สำเร็จ' : 'Refresh failed');
    } finally {
      setBtnLoading(refreshBtn, false);
    }
  });

  // 4) Mount default tab
  await mountTab(currentTab);
}

function onLangChange() {
  applyLangTexts(LANG);
  bindPickerInputs(document, LANG);
  mountTab(currentTab);
}

document.addEventListener('DOMContentLoaded', init);
