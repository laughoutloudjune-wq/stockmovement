// js/fab.js — Global FAB in Shadow DOM (icons safe from global CSS)
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

    /* Container is fixed to viewport with iOS safe-area support */
    .fab { position: fixed;
      right: calc(16px + env(safe-area-inset-right));
      bottom: calc(18px + env(safe-area-inset-bottom));
      z-index: 42000;
      display: flex; flex-direction: column; align-items: flex-end; gap: 8px;
      pointer-events: none;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Apple Color Emoji","Segoe UI Emoji";
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
      border-radius: 12px;
      padding: 6px 8px;
      box-shadow: 0 4px 16px rgba(0,0,0,.08);
    }
    .label { font-size: 14px; color: var(--text-muted, #6b7280); pointer-events: none; }

    .btn { appearance: none; border: 0; background: #f3f4f6;
      width: 40px; height: 40px; border-radius: 10px;
      display: inline-grid; place-items: center; cursor: pointer;
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

    /* SVGs: enforce visibility + sizing inside the Shadow DOM */
    svg { display: block; width: 22px; height: 22px; stroke: currentColor; fill: none;
          stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

    @media (prefers-reduced-motion: reduce) {
      .sd { transition: none; }
      .main button { transition: none; }
    }
  </style>

  <div class="fab">
    <div class="sd" role="menu" aria-label="เมนูด่วน"></div>
    <div class="main"><button id="fabMain" type="button" aria-expanded="false" aria-label="เมนูด่วน">${ICONS.plus}</button></div>
  </div>
  `;
}

export function mountGlobalFab(){
  if (host) return host;
  host = document.createElement('div');
  host.id = 'global-fab';
  host.style.all = 'initial';                   // hard isolate the host itself
  host.style.position = 'fixed';                // resist ancestor layout weirdness
  host.style.inset = '0 0 auto auto';           // still positioned by inner CSS
  host.style.zIndex = '42000';

  shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = templateHTML();

  document.body.appendChild(host);

  sdEl = shadow.querySelector('.sd');
  mainBtn = shadow.getElementById('fabMain');

  const root = shadow.querySelector('.fab');
  const toggle = () => {
    const exp = root.classList.toggle('expanded');
    mainBtn.setAttribute('aria-expanded', exp ? 'true' : 'false');
  };
  mainBtn.addEventListener('click', toggle);

  // Close on outside click / ESC
  document.addEventListener('click', (e)=>{
    if (!host.contains(e.target)) {
      root.classList.remove('expanded');
      mainBtn.setAttribute('aria-expanded','false');
    }
  });
  document.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape') {
      root.classList.remove('expanded');
      mainBtn.setAttribute('aria-expanded','false');
    }
  });
  return host;
}

export function setFab(actions){
  mountGlobalFab();
  const root = shadow.querySelector('.fab');
  // collapse first
  root.classList.remove('expanded');
  mainBtn.setAttribute('aria-expanded','false');

  sdEl.innerHTML = '';
  if (!actions || !actions.length){
    host.style.display = 'none';
    return;
  }
  host.style.display = '';

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
    btn.innerHTML = (typeof a.icon === 'string' && a.icon.trim().startsWith('<svg')) ? a.icon : (ICONS[a.icon] || ICONS.plus);
    btn.addEventListener('click', (ev)=>{ ev.stopPropagation(); a.onClick && a.onClick(); });
    wrap.appendChild(lbl);
    wrap.appendChild(btn);
    sdEl.appendChild(wrap);
  }
}

export function hideFab(){
  mountGlobalFab();
  host.style.display = 'none';
}

export const FabIcons = ICONS;
