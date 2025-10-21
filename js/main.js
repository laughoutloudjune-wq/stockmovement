// js/main.js — robust tab router + global FAB hookup + hash routing
import { $, $$, bindPickerInputs, currentLang } from './shared.js';
import { mountGlobalFab, setFab, hideFab } from './fab.js';

// Lazy-load tab modules (adjust these paths only if your folder names differ)
const TAB_MODULES = {
  dashboard: () => import('../tabs/dashboard.js'),
  in:        () => import('../tabs/in.js'),
  out:       () => import('../tabs/out.js'),
  adjust:    () => import('../tabs/adjust.js'),
  purchase:  () => import('../tabs/purchase.js'),
};

let LANG = currentLang();
let currentTab = null;

/* ---------- Utilities ---------- */
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
  $$('[data-tab]').forEach(n => {
    n.classList.toggle('active', n.getAttribute('data-tab') === tab);
  });
}

function skeleton() {
  return `
    <section class="card glass">
      <div class="skeleton-row">
        <div class="skeleton-bar"></div>
        <div class="skeleton-badge"></div>
      </div>
    </section>
  `;
}

/* ---------- Core router ---------- */
async function mountTab(tab) {
  // Unknown tab -> try first nav item or fallback to 'dashboard'/'out'
  if (!TAB_MODULES[tab]) {
    const first = ($$('[data-tab]')[0]?.getAttribute('data-tab')) || 'dashboard';
    tab = TAB_MODULES[first] ? first : (TAB_MODULES.out ? 'out' : first);
  }
  if (currentTab === tab) return;

  currentTab = tab;
  setActiveNav(tab);
  if (location.hash.replace(/^#/, '') !== tab) {
    location.hash = tab; // keep URL in sync
  }

  const root = viewEl();
  root.innerHTML = skeleton();
  hideFab(); // don’t show stale actions while loading

  try {
    const mod = await TAB_MODULES[tab]();
    // Each tab module exports default mount({ root, lang })
    await mod.default({ root, lang: LANG });

    // After mount, update the global FAB with this tab's actions (if any)
    mountGlobalFab();
    if (typeof mod.fabActions === 'function') {
      const actions = mod.fabActions({ root, lang: LANG });
      setFab(actions);
    } else {
      hideFab();
    }

    // Ensure pickers are wired inside the newly mounted tab
    bindPickerInputs(root, LANG);
  } catch (e) {
    root.innerHTML = `<section class="card glass"><h3>Load error</h3><p>${(e && e.message) || e}</p></section>`;
    hideFab();
  }
}

/* ---------- Navigation bindings ---------- */
function initNavBindings() {
  // Any element with data-tab is a nav trigger
  $$('[data-tab]').forEach(el => {
    el.addEventListener('click', ev => {
      // If it’s an <a>, don’t let the browser navigate away
      if (el.tagName === 'A') ev.preventDefault();
      const tab = el.getAttribute('data-tab');
      if (tab) mountTab(tab);
    });
  });
}

function startAtHashOrDefault() {
  const hash = (location.hash || '').replace(/^#/, '');
  const candidate =
    (hash && TAB_MODULES[hash] ? hash : ($$('[data-tab]')[0]?.getAttribute('data-tab'))) ||
    (TAB_MODULES.dashboard ? 'dashboard' : 'out');
  mountTab(candidate);
}

/* ---------- Global listeners ---------- */
window.addEventListener('hashchange', () => {
  const next = (location.hash || '').replace(/^#/, '');
  if (next && next !== currentTab) mountTab(next);
});

/* ---------- Boot ---------- */
document.addEventListener('DOMContentLoaded', () => {
  initNavBindings();
  startAtHashOrDefault();
});
