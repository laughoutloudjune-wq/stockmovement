// js/main.js — SAFE bootstrap that won't blank the UI
// It does NOT replace your router; it only enhances UI and avoids crashes.

import {
  installResponsiveTweaks, bindPickerInputs, preloadLookups,
  setBtnLoading, currentLang, applyLangTexts
} from './shared.js';

// Optional: if your app exposes mountTab/currentTab, we'll use them for refresh
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
        else if (window.mountTab && window.currentTab) { await window.mountTab(window.currentTab); }
        else { location.reload(); return; }
      } finally {
        setBtnLoading(el, false);
      }
    });
  });
}

// Enhance UI after any tab mount
export function uiAfterMount(){
  try { bindPickerInputs(document, currentLang()); } catch {}
  try { setupRefresh(); } catch {}
}

document.addEventListener('DOMContentLoaded', async ()=>{
  try { installResponsiveTweaks(); } catch {}
  try { applyLangTexts(currentLang()); } catch {}
  // Warm lookup cache so autocomplete opens immediately
  try { await preloadLookups(); } catch {}
  // Initial bindings
  uiAfterMount();

  // If your router emits a custom event after mounting a tab, wire it here:
  // document.addEventListener('tab-mounted', uiAfterMount);
});
