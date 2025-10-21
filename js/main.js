// js/main.js — full bootstrap + router so UI renders
import { installResponsiveTweaks, bindPickerInputs, preloadLookups, setBtnLoading, currentLang, applyLangTexts } from './shared.js';
import { mountGlobalFab, setFab, hideFab } from './fab.js';

const root = document.getElementById('view');

// Map tabs to lazy imports (relative to /js/)
const TAB_MAP = {
  dashboard: () => import('../tabs/dashboard.js'),
  out:       () => import('../tabs/out.js'),
  in:        () => import('../tabs/in.js'),
  adjust:    () => import('../tabs/adjust.js'),
  purchase:  () => import('../tabs/purchase.js'),
};

let currentModule = null;
export let currentTab = null;

export async function mountTab(tab){
  currentTab = tab;
  // update active tab UI
  document.querySelectorAll('.tabs .tab').forEach(t => t.classList.toggle('active', t.getAttribute('data-tab')===tab));
  try{
    const loader = TAB_MAP[tab] || TAB_MAP.dashboard;
    const mod = await loader();
    currentModule = mod;
    // render
    await (mod.default && mod.default({root}));
    // after-mount bindings
    bindPickerInputs(document, currentLang());

    // FAB
    mountGlobalFab();
    if (mod.fabActions) {
      const actions = mod.fabActions({root});
      if (actions && actions.length) setFab(actions); else hideFab();
    } else {
      hideFab();
    }
  }catch(e){
    console.error('Mount failed', e);
    root.innerHTML = `<section class="card glass"><h3>เกิดข้อผิดพลาด</h3><div class="meta">${e.message||e}</div></section>`;
    hideFab();
  }
}

// simple hash router
function getTabFromHash(){
  const h = (location.hash || '').replace('#','').trim();
  if (TAB_MAP[h]) return h;
  return 'dashboard';
}
function handleHash(){
  const t = getTabFromHash();
  mountTab(t);
}

// refresh button binding
function setupRefresh(){
  document.querySelectorAll('[data-action="refresh"], #btnRefresh').forEach(el=>{
    if (el.__rf_bound) return;
    el.__rf_bound = true;
    el.addEventListener('click', async (e)=>{
      e.preventDefault();
      setBtnLoading(el, true);
      try{ await mountTab(currentTab || getTabFromHash()); } finally { setBtnLoading(el, false); }
    });
  });
}

// global exposure for other scripts
window.mountTab = mountTab;
window.currentTab = currentTab;
window.appRefresh = async () => mountTab(currentTab || getTabFromHash());

document.addEventListener('DOMContentLoaded', async ()=>{
  installResponsiveTweaks();
  applyLangTexts(currentLang());
  await preloadLookups();
  setupRefresh();
  window.addEventListener('hashchange', handleHash);
  handleHash(); // initial mount
});
