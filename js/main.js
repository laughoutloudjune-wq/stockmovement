// js/main.js — robust tab router + global FAB hookup + hash routing
import { $, $$, bindPickerInputs, currentLang, toast } from './shared.js';
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
  // Use #view if present; otherwise create one so we never fail
  let v = document.getElementById('view');
  if (!v) {
    v = document.createElement('div');
    v.id = 'view';
    document.body.appendChild(v);
  }
  return v;
}

function setActiveNav(tab) {
  const nodes = $$('[data-tab]');
  nodes.forEach(n => n.classList.toggle('active', n.getAttribute('data-tab') === tab));
}

async function mountTab(tab) {
  // Guard: unknown tab -> first available or dashboard
  if (!TAB_MODULES[tab]) {
    const first = ($$('[data-tab]')[0]?.getAttribute('data-tab')) || 'dashboard';
    tab = TAB_MODULES[first] ? first : 'out';
  }
  if (currentTab === tab) return;

  currentTab = tab;
  setActiveNav(tab);
  location.hash = tab;

  const root = viewEl();
  root.innerHTML = `<section class="card glass">
    <div class="skeleton-row"><div class="skeleton-bar"></div><div class="skeleton-badge"></div></div>
  </section>`;

  hideFab(); // don’t show stale actions while loading

  try {
    const mod = await TAB_MODULES[tab]();
    await mod.default({ root, lang: LANG });

    // Global FAB actions for this tab (if provided)
    mountGlobalFab();
    if (typeof mod.fabActions === 'function') {
      setFab(mod.fabActions({ root, lang: LANG }));
    } else {
      hideFab();
    }

    // Ensure pickers work inside the mounted tab
    bindPickerInputs(root, LANG);
  } catch (e) {
    root.innerHTML = `<section class="card glass"><h3>Load error</h3><p>${(e && e.message) || e}</p></section>`;
    hideFab();
  }
}

function initNavBindings() {
  // Any element with data-tab is a nav trigger
  $$('[data-tab]').forEach(el => {
    el.addEventListener('click', (ev) => {
      // If it’s an <a>, don’t navigate away
      if (el.tagName === 'A') ev.preventDefault();
      const tab = el.getAttribute('data-tab');
      if (tab) mountTab(tab);
    });
  });
}

function startAtHashOrDefault() {
  const hash = (location.hash || '').replace(/^#/, '');
  const candidate = hash && TAB_MODULES[hash] ? hash : ($$('[data-tab]')[0]?.getAttribute('data-tab')) || 'dashboard';
  mountTab(candidate);
}

window.addEventListener('hashchange', () => {
  const next = (location.hash || '').replace(/^#/, '');
  if (next && next !== currentTab) mountTab(next);
});

document.addEventListener('DOMContentLoaded', () => {
  initNavBindings();
  startAtHashOrDefault();
});
