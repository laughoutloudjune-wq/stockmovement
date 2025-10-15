
import { $, $$, STR, applyLangTexts, preloadLookups, todayStr, toast } from './shared.js';

let LANG = 'th';
const view = $('#view');

function setActiveTab(key){
  $$('.tabs button').forEach(b=> b.classList.toggle('active', b.dataset.tab===key));
}

async function mountTab(key){
  setActiveTab(key);
  // Clear current view
  view.innerHTML = '';
  // Dynamically import and mount
  const moduleMap = {
    dashboard: () => import('../tabs/dashboard.js'),
    out:       () => import('../tabs/out.js'),
    in:        () => import('../tabs/in.js'),
    adjust:    () => import('../tabs/adjust.js'),
    purchase:  () => import('../tabs/purchase.js'),
  };
  const load = moduleMap[key];
  if (!load) return;

  const mod = await load();
  await mod.default({ root: view, lang: LANG });
}

// Language switching
function applyLang(){
  applyLangTexts(LANG);
  // Re-mount current tab to refresh inner texts
  const active = document.querySelector('.tabs button.active')?.dataset.tab || 'dashboard';
  mountTab(active);
}

// Tabs events
$('#tabs').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-tab]');
  if(!btn) return;
  mountTab(btn.dataset.tab);
});

$('#lang-en').addEventListener('click', ()=>{ LANG='en'; $('#lang-en').classList.add('active'); $('#lang-th').classList.remove('active'); applyLang(); });
$('#lang-th').addEventListener('click', ()=>{ LANG='th'; $('#lang-th').classList.add('active'); $('#lang-en').classList.remove('active'); applyLang(); });

// Boot
document.addEventListener('DOMContentLoaded', async ()=>{
  try { await preloadLookups(); } catch(e){ toast('Lookup preload failed'); }
  // Defaults for some date fields that may exist later
  // Just set when tab mounts.
  await mountTab('dashboard');
});

// Expose for tabs that need base texts
export function getLang(){ return LANG; }
export function getStrings(){ return STR[LANG]; }
export function getToday(){ return todayStr(); }