// Minimal sanity-check app to prove the page is wired correctly.
// If you see the buttons and clicking works, your setup is good.

const app = document.getElementById('app');

function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach(child => {
    if (child == null) return;
    if (typeof child === 'string') el.appendChild(document.createTextNode(child));
    else el.appendChild(child);
  });
  return el;
}

function render() {
  app.innerHTML = '';

  // Header + tabs (clicks should work)
  const header = h('div', { class: 'glass', style: 'margin:16px auto; padding:12px; max-width:72rem' }, [
    h('div', { class: 'tabs' }, [
      h('button', { class: 'active', onClick: () => selectTab('dashboard') }, 'สรุป'),
      h('button', { onClick: () => selectTab('out') }, 'จ่ายออก'),
      h('button', { onClick: () => selectTab('in') }, 'รับเข้า'),
      h('button', { onClick: () => selectTab('adjust') }, 'ปรับปรุง'),
      h('button', { onClick: () => selectTab('purchase') }, 'ขอจัดซื้อ')
    ])
  ]);

  const content = h('div', { id: 'content' }, [
    // simple dashboard cards
    h('div', { class: 'dash-grid' }, [
      h('div', { class: 'card glass' }, ['✔ UI loaded (Dashboard)']),
      h('div', { class: 'card glass' }, ['Click tabs to test interactions']),
      h('div', { class: 'card glass dash-span-2' }, ['This proves your JS is executing properly.'])
    ])
  ]);

  app.appendChild(header);
  app.appendChild(content);
}

function selectTab(key) {
  const c = document.getElementById('content');
  c.innerHTML = '';
  if (key === 'dashboard') {
    c.appendChild(h('div', { class: 'dash-grid' }, [
      h('div', { class: 'card glass' }, ['Dashboard active']),
      h('div', { class: 'card glass' }, ['Animations & glass styles applied'])
    ]));
  }
  if (key === 'out') {
    c.appendChild(h('div', { class: 'card glass', style:'margin:16px' }, [
      h('h3', {}, ['จ่ายออก']),
      h('div', { class:'row' }, [
        h('div', {}, [h('label', {}, ['วันที่']), h('input', { type:'date', id:'OutDate' })]),
        h('div', {}, [h('label', {}, ['โครงการ / สถานที่']), h('input', { placeholder:'ค้นหาหรือเลือก', readOnly:true })])
      ]),

      // Floating toolbar preview
      h('div', { class: 'toolbar' }, [
        h('button', { class:'btn', onClick: () => alert('เพิ่ม') }, '＋ เพิ่ม'),
        h('button', { class:'btn small', onClick: () => alert('ล้าง') }, 'ล้าง'),
        h('button', { class:'btn primary', onClick: () => alert('บันทึก') }, 'บันทึก'),
      ])
    ]));
  }
  if (key === 'in') {
    c.appendChild(h('div', { class: 'card glass', style:'margin:16px' }, [
      h('h3', {}, ['รับเข้า']),
      h('div', { class:'row' }, [
        h('div', {}, [h('label', {}, ['วันที่รับ']), h('input', { type:'date', id:'InDate' })]),
      ]),
      h('div', {}, ['Inline actions live here...'])
    ]));
  }
  if (key === 'adjust') {
    c.appendChild(h('div', { class: 'card glass', style:'margin:16px' }, [
      h('h3', {}, ['ปรับปรุงสต็อก']),
      h('div', {}, ['Adjust lines preview…'])
    ]));
  }
  if (key === 'purchase') {
    c.appendChild(h('div', { class: 'card glass', style:'margin:16px' }, [
      h('h3', {}, ['ขอจัดซื้อ']),
      h('div', { class:'row' }, [
        h('div', {}, [h('label', {}, ['โครงการ / สถานที่']), h('input', { readOnly:true, placeholder:'ค้นหาหรือเลือก' })]),
        h('div', {}, [h('label', {}, ['ต้องการภายใน (วัน)']), h('input', { type:'date', id:'PurNeedBy' })]),
      ])
    ]));
  }
}

// Boot
try {
  render();
  console.log('main.js loaded and UI rendered ✅');
} catch (e) {
  console.error('main.js crashed:', e);
  // leave the skeleton content rendered by index.html so page isn’t blank
}
