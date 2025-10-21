// js/main.js — robust tab router + global FAB hookup + hash routing
import { $, $$, bindPickerInputs, currentLang } from './shared.js';
import { mountGlobalFab, setFab, hideFab } from './fab.js';

const TAB_MODULES = {
  dashboard: () => import('../tabs/dashboard.js'),
  in:        () => import('../tabs/in.js'),
  out:       () => import('../tabs/out.js'),
  adjust:    () => import('../tabs/adjust.js'),
  purchase:  () => import('../tabs/purchase.js'),
};

let LANG = currentLang();
let currentTab = null;

function viewEl() {
  let v = document.getElementById('view');
  if (!v) { v = document.createElement('div'); v.id = 'view'; document.body.appendChild(v); }
  return v;
}
function setActiveNav(tab){ $$('[data-tab]').forEach(n=> n.classList.toggle('active', n.getAttribute('data-tab')===tab)); }
function skeleton(){ return '<section class="card glass"><div class="skeleton-row"><div class="skeleton-bar"></div><div class="skeleton-badge"></div></div></section>'; }

async function mountTab(tab){
  if (!TAB_MODULES[tab]) {
    const first = ($$('[data-tab]')[0]?.getAttribute('data-tab')) || 'dashboard';
    tab = TAB_MODULES[first] ? first : (TAB_MODULES.out ? 'out' : first);
  }
  if (currentTab === tab) return;
  currentTab = tab;
  setActiveNav(tab);
  if (location.hash.replace(/^#/, '') !== tab) location.hash = tab;

  const root = viewEl();
  root.innerHTML = skeleton();
  hideFab();

  try{
    const mod = await TAB_MODULES[tab]();
    await mod.default({ root, lang: LANG });

    mountGlobalFab();
    if (typeof mod.fabActions === 'function') setFab(mod.fabActions({ root, lang: LANG }));
    else hideFab();

    bindPickerInputs(root, LANG);
  }catch(e){
    root.innerHTML = '<section class="card glass"><h3>Load error</h3><p>' + ((e && e.message) || e) + '</p></section>';
    hideFab();
  }
}


function refreshCurrentTab(){
  if (currentTab) mountTab(currentTab);
}

function initNavBindings(){

  // Global refresh triggers
  $$('[data-action="refresh"], #btnRefresh').forEach(el => {
    el.addEventListener('click', (ev) => {
      ev.preventDefault();
      refreshCurrentTab();
    });
  });
  // Optional: expose a programmatic hook
  window.appRefresh = refreshCurrentTab;

  $$('[data-tab]').forEach(el=>{
    el.addEventListener('click', ev=>{
      if (el.tagName === 'A') ev.preventDefault();
      const tab = el.getAttribute('data-tab');
      if (tab) mountTab(tab);
    });
  });
}
function startAtHashOrDefault(){
  const hash = (location.hash || '').replace(/^#/, '');
  const candidate = (hash && TAB_MODULES[hash] ? hash : ($$('[data-tab]')[0]?.getAttribute('data-tab'))) || (TAB_MODULES.dashboard ? 'dashboard' : 'out');
  mountTab(candidate);
}

window.addEventListener('hashchange', ()=>{
  const next = (location.hash || '').replace(/^#/, '');
  if (next && next !== currentTab) mountTab(next);
});

document.addEventListener('DOMContentLoaded', ()=>{
  initNavBindings();
  startAtHashOrDefault();
});
