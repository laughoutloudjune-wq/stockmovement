// main.js — enhancers: responsive tweaks, autocomplete binding, refresh spinner

import { installResponsiveTweaks, bindPickerInputs, preloadLookups, setBtnLoading, currentLang } from './shared.js';

function afterMount(){
  // Bind autocompletes across the page in case tabs loaded new inputs
  bindPickerInputs(document, currentLang());
}

// Universal refresh wiring: use router hook if present, else reload
function setupRefresh(){
  const els = document.querySelectorAll('[data-action="refresh"], #btnRefresh');
  els.forEach(el=>{
    if (el.__rf_bound) return;
    el.__rf_bound = true;
    el.addEventListener('click', async (e)=>{
      e.preventDefault();
      setBtnLoading(el, true);
      try{
        if (window.appRefresh) { await window.appRefresh(); }
        else if (window.mountTab && window.currentTab){ await window.mountTab(window.currentTab); }
        else { location.reload(); return; }
      } finally {
        setBtnLoading(el, false);
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', async ()=>{
  installResponsiveTweaks();
  await preloadLookups();          // warm cache so autocomplete opens instantly
  bindPickerInputs(document, currentLang());
  setupRefresh();
  // If your router remounts tabs later, call afterMount() afterwards
  // Example glue for your router:
  // document.addEventListener('tab-mounted', afterMount);
});

// If your router is modular and calls mount per tab, expose a helper:
export function uiAfterMount(){
  afterMount();
  setupRefresh();
}
