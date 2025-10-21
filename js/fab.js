// js/fab.js — Global, reusable FAB (hardened icons + alignment + safe‑area)
let fabRoot, styleTag;

const ICONS = {
  plus: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  save: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7.5h14M8 12h8m-8 4h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><rect x="4.5" y="5" width="15" height="15" rx="2.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  clock:`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 7.5V12l3.5 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
};

function ensureStyles(){
  if (styleTag) return;
  styleTag = document.createElement('style');
  styleTag.id = 'global-fab-styles';
  styleTag.textContent = `
  .fab-global{position:fixed;right:calc(16px + env(safe-area-inset-right));bottom:calc(18px + env(safe-area-inset-bottom));z-index:4200;display:flex;flex-direction:column;align-items:flex-end;gap:.5rem;pointer-events:none}
  .fab-global .sd{display:flex;flex-direction:column;gap:.5rem;transform:translateY(6px);opacity:0;pointer-events:none;transition:opacity .12s ease,transform .12s ease}
  .fab-global.expanded .sd{transform:translateY(0);opacity:1;pointer-events:auto}
  .fab-global .sd .action{display:flex;align-items:center;gap:.5rem;background:var(--card,#fff);border:1px solid var(--border-weak,#e5e7eb);border-radius:12px;padding:.35rem .5rem;box-shadow:0 4px 16px rgba(0,0,0,.08)}
  .fab-global .sd .action .btn.small{min-width:40px;height:40px;display:inline-grid;place-items:center;border-radius:10px}
  .fab-global .sd .label{font:inherit;font-size:.9rem;color:var(--text-muted,#6b7280)}
  .fab-global .main{pointer-events:auto}
  .fab-global .main button{width:60px;height:60px;border-radius:50%;display:inline-grid;place-items:center;background:var(--accent,#2563eb);color:#fff;border:none;box-shadow:0 6px 18px rgba(0,0,0,.18)}
  .fab-global .main button:active{transform:translateY(1px)}
  .fab-global svg{display:block;width:22px;height:22px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
  .fab-global .btn.small svg{display:block !important}
  .fab-global .btn.small{overflow:visible}
  @media (prefers-reduced-motion: reduce){ .fab-global .sd{transition:none} .fab-global .main button{transition:none} }
  `;
  document.head.appendChild(styleTag);
}

export function mountGlobalFab(){
  ensureStyles();
  if (fabRoot) return fabRoot;
  fabRoot = document.createElement('div');
  fabRoot.id = 'global-fab';
  fabRoot.className = 'fab-global';
  fabRoot.innerHTML = `
    <div class="sd" role="menu" aria-label="เมนูด่วน"></div>
    <div class="main"><button id="fabMainBtn" type="button" aria-expanded="false" aria-label="เมนูด่วน">${ICONS.plus}</button></div>
  `;
  document.body.appendChild(fabRoot);

  const mainBtn = fabRoot.querySelector('#fabMainBtn');
  const toggle = ()=>{
    const expanded = fabRoot.classList.toggle('expanded');
    mainBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  };
  mainBtn.addEventListener('click', toggle);

  document.addEventListener('click', (e)=>{ if (!fabRoot.contains(e.target)) collapseFab(); });
  document.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') collapseFab(); });
  return fabRoot;
}

export function collapseFab(){
  if (!fabRoot) return;
  fabRoot.classList.remove('expanded');
  const mainBtn = fabRoot.querySelector('#fabMainBtn');
  if (mainBtn) mainBtn.setAttribute('aria-expanded','false');
}

export function setFab(actions){
  mountGlobalFab();
  collapseFab();
  const sd = fabRoot.querySelector('.sd');
  sd.innerHTML = '';
  if (!actions || !actions.length){
    fabRoot.style.display = 'none';
    return;
  }
  fabRoot.style.display = '';
  for (const a of actions){
    const div = document.createElement('div');
    div.className = 'action';
    div.innerHTML = `<span class="label">${a.label||''}</span><button class="btn small ${a.variant||''}" type="button" title="${a.title||a.label||''}">${a.icon||ICONS.plus}</button>`;
    const btn = div.querySelector('button');
    btn.addEventListener('click', (e)=>{ e.stopPropagation(); a.onClick?.(); });
    sd.appendChild(div);
  }
}

export function hideFab(){ mountGlobalFab(); fabRoot.style.display = 'none'; }

export const FabIcons = ICONS;
