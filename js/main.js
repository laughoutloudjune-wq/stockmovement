// js/main.js — minimal router + global FAB hookup
import { $, $$, bindPickerInputs, currentLang, toast } from './shared.js';
import { mountGlobalFab, setFab, hideFab } from './fab.js';

const TAB_MODULES = {
  dashboard: () => import('../tabs/dashboard.js'),
  out:       () => import('../tabs/out.js'),
  in:        () => import('../tabs/in.js'),
  adjust:    () => import('../tabs/adjust.js'),
  purchase:  () => import('../tabs/purchase.js'),
};

let LANG = currentLang();
let currentTab = 'out';
function viewEl(){ return document.getElementById('view') || document.body; }

async function mountTab(tab){
  currentTab = tab;
  const root = viewEl();
  root.innerHTML = `<section class="card glass"><div class="skeleton-row"><div class="skeleton-bar"></div><div class="skeleton-badge"></div></div></section>`;
  try{
    const mod = await TAB_MODULES[tab]();
    await mod.default({ root, lang: LANG });
    mountGlobalFab();
    if (typeof mod.fabActions === 'function'){
      setFab(mod.fabActions({ root, lang: LANG }));
    } else {
      hideFab();
    }
  }catch(e){
    root.innerHTML = `<section class="card glass"><h3>Error</h3><p>${(e && e.message) || e}</p></section>`;
    hideFab();
  }
}

document.addEventListener('DOMContentLoaded', ()=> mountTab(currentTab));
