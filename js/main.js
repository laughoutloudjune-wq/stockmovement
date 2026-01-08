// js/main.js
import {
  $, $$, STR, applyLangTexts, preloadLookups, bindPickerInputs,
  toast, currentLang, cleanOldCache, setBtnLoading
} from './shared.js';

const TAB_MODULES = {
  dashboard: () => import('../tabs/dashboard.js'),
  out:       () => import('../tabs/out.js'),
  in:        () => import('../tabs/in.js'),
  adjust:    () => import('../tabs/adjust.js'),
  purchase:  () => import('../tabs/purchase.js'),
  out_history: () => import('../tabs/out_history.js'),
  report:    () => import('../tabs/report.js'), // <--- NEW
};

let LANG = currentLang();
let currentTab = 'dashboard';

async function mountTab(tabKey) {
  const loader = TAB_MODULES[tabKey];
  if (!loader) return;
  
  // Highlight Tab Button
  $$('.tabs button').forEach(b => b.classList.remove('active'));
  const btn = $(`.tabs button[data-tab="${tabKey}"]`);
  if(btn) btn.classList.add('active');

  const root = $('#view');
  // Simple loading state for view
  root.innerHTML = '<div style="padding:2rem;text-align:center;opacity:0.6">Loading...</div>';

  try {
      const mod = await loader();
      await mod.default({ root, lang: LANG });
      bindPickerInputs(root, LANG);
  } catch(e) {
      console.error(e);
      root.innerHTML = '<div style="padding:1rem;color:red">Error loading tab</div>';
  }
}

async function init() {
  cleanOldCache(); // 1 hour cleaner

  $('#lang-en')?.addEventListener('click', () => { LANG = 'en'; document.documentElement.lang = 'en'; onLangChange(); });
  $('#lang-th')?.addEventListener('click', () => { LANG = 'th'; document.documentElement.lang = 'th'; onLangChange(); });

  $$('.tabs button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-tab');
      if(key) { currentTab = key; mountTab(key); }
    });
  });

  window.addEventListener('switch-tab', (e) => mountTab(e.detail));

  // Preload lookups in background (non-blocking if possible, but here we await slightly)
  preloadLookups().catch(() => console.log('Background preload failed'));

  applyLangTexts(LANG);
  
  // Refresh Button
  const refreshBtn = $('#refreshDataBtn');
  refreshBtn?.addEventListener('click', async ()=>{
    setBtnLoading(refreshBtn, true);
    localStorage.clear(); // Hard clear
    location.reload();    // Full reload to be safe
  });

  await mountTab(currentTab);
}

function onLangChange() {
  applyLangTexts(LANG);
  mountTab(currentTab);
}

document.addEventListener('DOMContentLoaded', init);
