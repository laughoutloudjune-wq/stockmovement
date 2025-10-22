// js/main.js (v0.2-fix-out-tab)
import { $, $$, STR, applyLangTexts, preloadLookups, bindPickerInputs,
         toast, currentLang, cleanOldCache, setBtnLoading } from './shared.js';

const VERSION = 'v0.2-fix-out-tab';

function tabUrl(key) {
  // Build absolute URL for debug visibility + cache busting to avoid stale caches
  const base = new URL(import.meta.url);
  const href = new URL(`../tabs/${key}.js`, base).href;
  return `${href}?v=${VERSION}`;
}

const TAB_MODULES = {
  dashboard: () => import(tabUrl('dashboard')),
  out:       () => import(tabUrl('out')),
  in:        () => import(tabUrl('in')),
  adjust:    () => import(tabUrl('adjust')),
  purchase:  () => import(tabUrl('purchase')),
};

let LANG = currentLang();
let currentTab = 'dashboard';

async function mountTab(tabKey) {
  const root = $('#view');
  if (!root) return;
  root.innerHTML = '<div class="card glass"><div class="skeleton-row"><div class="skeleton-bar" style="width:60%"></div><div class="skeleton-badge"></div></div></div>';
  try{
    const loader = TAB_MODULES[tabKey];
    if (!loader) throw new Error('Tab not found: '+tabKey);
    console.log('[tabs] importing', tabUrl(tabKey));
    const mod = await loader();
    if (!mod || typeof mod.default !== 'function') throw new Error('Tab module invalid: '+tabKey);
    await mod.default({ root, lang: LANG });
    bindPickerInputs(root, LANG);
  }catch(err){
    console.error('[tabs] failed', tabKey, err);
    root.innerHTML = '<div class="card glass"><h3>Load error</h3><p>'+String(err)+'</p><code>'+tabUrl(tabKey)+'</code></div>';
    toast(LANG==='th' ? 'โหลดแท็บไม่สำเร็จ' : 'Failed to load tab');
  }
}

async function init() {
  cleanOldCache();

  $('#lang-en')?.addEventListener('click', () => { LANG = 'en'; document.documentElement.lang = 'en'; onLangChange(); });
  $('#lang-th')?.addEventListener('click', () => { LANG = 'th'; document.documentElement.lang = 'th'; onLangChange(); });

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

  try{
    await preloadLookups();
  }catch{
    toast(LANG === 'th' ? 'โหลดข้อมูลเริ่มต้นไม่สำเร็จ กำลังใช้ข้อมูลเก่า' : 'Failed to load lookups; using cached data');
  }

  applyLangTexts(LANG);
  bindPickerInputs(document, LANG);

  const refreshBtn = $('#refreshDataBtn');
  refreshBtn?.addEventListener('click', async ()=>{
    try {
      setBtnLoading(refreshBtn, true);
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('cache:')) keys.push(k);
      }
      keys.forEach(k => localStorage.removeItem(k));
      await preloadLookups();
      toast(LANG==='th' ? 'รีเฟรชข้อมูลแล้ว' : 'Data refreshed');
      await mountTab(currentTab);
    } catch {
      toast(LANG==='th' ? 'รีเฟรชไม่สำเร็จ' : 'Refresh failed');
    } finally {
      setBtnLoading(refreshBtn, false);
    }
  });

  await mountTab(currentTab);
}

function onLangChange() {
  applyLangTexts(LANG);
  bindPickerInputs(document, LANG);
  mountTab(currentTab);
}

document.addEventListener('DOMContentLoaded', init);
