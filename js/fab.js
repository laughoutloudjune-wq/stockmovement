// js/fab.js — Global FAB (Shadow DOM) with robust null-guards
let host, shadow, sdEl, mainBtn;

const ICONS = {
  plus:  '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  save:  '<svg viewBox="0 0 24 24"><path d="M5 7.5h14M8 12h8m-8 4h6"/><rect x="4.5" y="5" width="15" height="15" rx="2.5"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3.5 2"/></svg>'
};

function templateHTML(){
  return `
  <style>
    :host { all: initial; }
    .fab { position: fixed;
      right: calc(16px + env(safe-area-inset-right));
      bottom: calc(18px + env(safe-area-inset-bottom));
      z-index: 42000;
      display: flex; flex-direction: column; align-items: flex-end; gap: 8px;
      pointer-events: none;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial;
    }
    .sd {
      display: flex; flex-direction: column; gap: 8px;
      transform: translateY(6px); opacity: 0; pointer-events: none;
      transition: opacity .12s ease, transform .12s ease;
    }
    .expanded .sd { transform: translateY(0); opacity: 1; pointer-events: auto; }
    .action {
      display: flex; align-items: center; gap: 8px;
      background: var(--card, #ffffff);
      border: 1px solid var(--border-weak, #e5e7eb);
      border-radius: 12px; padding: 6px 8px;
      box-shadow: 0 4px 16px rgba(0,0,0,.08);
    }
    .label { font-size: 14px; color: var(--text-muted, #6b7280); pointer-events: none; }
    .btn { appearance: none; border: 0; background: #f3f4f6;
      width: 40px; height: 40px; border-radius: 10px;
      display: inline-grid; place-items: center; cursor: pointer; color: inherit;
    }
    .btn.primary { background: var(--accent, #2563eb); color: #fff; }
    .main { pointer-events: auto; }
    .main button {
      appearance: none; border: 0; background: var(--accent, #2563eb); color: #fff;
      width: 60px; height: 60px; border-radius: 50%;
      display: inline-grid; place-items: center; cursor: pointer;
      box-shadow: 0 6px 18px rgba(0,0,0,.18);
    }
    .main button:active { transform: translateY(1px); }
    svg { display: block; width: 22px; height: 22px; stroke: currentColor; fill: none;
          stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  </style>
  <div class="fab">
    <div class="sd" role="menu" aria-label="เมนูด่วน"></div>
    <div class="main"><button id="fabMain" type="button" aria-expanded="false" aria-label="เมนูด่วน">${ICONS.plus}</button></div>
  </div>`;
}

function build(){
  host = document.createElement('div');
  host.id = 'global-fab';
  host.style.all = 'initial';
  host.style.position = 'fixed';
  host.style.inset = '0 0 auto auto';
  host.style.zIndex = '42000';
  host.style.opacity = '1';
  host.style.pointerEvents = 'auto';

  shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = templateHTML();
  document.body.appendChild(host);

  sdEl = shadow.querySelector('.sd');
  mainBtn = shadow.getElementById('fabMain');

  const root = shadow.querySelector('.fab');
  if (mainBtn) {
    const toggle = () => {
      const exp = root.classList.toggle('expanded');
      mainBtn.setAttribute('aria-expanded', exp ? 'true' : 'false');
    };
    mainBtn.addEventListener('click', toggle);
  }
  // Close on ESC / outside
  document.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape') root.classList.remove('expanded');
  });
  document.addEventListener('click', (e)=>{
    if (!host.contains(e.target)) root.classList.remove('expanded');
  });
}

export function mountGlobalFab(){
  if (!document.body) return null;
  if (!host || !shadow || !shadow.querySelector('.fab')) {
    build();
  } else if (!document.body.contains(host)) {
    document.body.appendChild(host);
  }
  return host;
}

export function setFab(actions){
  mountGlobalFab();
  if (!shadow) return;
  const root = shadow.querySelector('.fab');
  if (!root) return;

  root.classList.remove('expanded');
  if (mainBtn) mainBtn.setAttribute('aria-expanded','false');

  sdEl = shadow.querySelector('.sd');
  if (!sdEl) return;

  sdEl.innerHTML = '';
  if (!actions || !actions.length){
    host.style.opacity = '0';
    host.style.pointerEvents = 'none';
    return;
  }
  host.style.opacity = '1';
  host.style.pointerEvents = 'auto';

  for (const a of actions){
    const wrap = document.createElement('div');
    wrap.className = 'action';
    const lbl = document.createElement('span');
    lbl.className = 'label';
    lbl.textContent = a.label || '';
    const btn = document.createElement('button');
    btn.className = 'btn' + (a.variant ? ` ${a.variant}` : '');
    btn.type = 'button';
    btn.title = a.title || a.label || '';
    if (typeof a.icon === 'string' && a.icon.trim().startsWith('<svg')) {
      btn.innerHTML = a.icon;
    } else if (a.icon && ICONS[a.icon]) {
      btn.innerHTML = ICONS[a.icon];
    } else {
      btn.innerHTML = ICONS.plus;
    }
    btn.addEventListener('click', (ev)=>{ ev.stopPropagation(); a.onClick && a.onClick(); });
    wrap.appendChild(lbl);
    wrap.appendChild(btn);
    sdEl.appendChild(wrap);
  }
}

export function hideFab(){
  mountGlobalFab();
  if (!host) return;
  host.style.opacity = '0';
  host.style.pointerEvents = 'none';
}

export const FabIcons = ICONS;
