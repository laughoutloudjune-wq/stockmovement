/* main.js — Stock Inventory Web App (Liquid Glass)
   - Plain ES module (no frameworks)
   - Mobile-first, refined animations (no full-screen overlay)
   - Per-section inline skeletons while loading
   - Floating pill toolbar (OUT tab only)
   - Picker overlay (materials/projects/contractors/requesters) with search + quick-add
   - i18n (TH/EN), accurate Thai copy
   - Wired to Google Apps Script backend (update API_URL)
   - Safe fetch with timeout + retry
*/

///////////////////////
// 0) CONFIG & STATE //
///////////////////////

const API_URL =
  "https://script.google.com/macros/s/AKfycbwEJDNfo63e0LjEZa-bhXmX3aY2PUs96bUBGz186T-pVlphV4NGNYxGT2tcx1DWgbDI/exec"; // ← change if needed

// App state (in-memory cache)
const state = {
  lang: "th",
  materials: [],
  projects: [],
  contractors: [],
  requesters: [],
  tab: "dashboard",
  // dashboard caches
  dash: { low: null, topContractors: null, topItems: null, recent: null, purSummary: null, purHistory: null },
};

// i18n strings
const STR = {
  th: {
    title: "ระบบสต็อกวัสดุ",
    tabs: { dash: "สรุป", out: "จ่ายออก", in: "รับเข้า", adj: "ปรับปรุง", pur: "ขอจัดซื้อ" },
    searchPh: "พิมพ์เพื่อค้นหา…",
    pick: "ค้นหาหรือเลือก",
    pickAdd: "เลือกหรือเพิ่มใหม่",
    proj: "โครงการ / สถานที่",
    contractor: "ผู้รับเหมา",
    requester: "ผู้ขอเบิก",
    note: "หมายเหตุ",
    outTitle: "จ่ายออก",
    outDate: "วันที่",
    inTitle: "รับเข้า",
    inDate: "วันที่รับ",
    adjTitle: "ปรับปรุงสต็อก",
    btnAdd: "＋ เพิ่ม",
    btnReset: "ล้าง",
    btnSubmit: "บันทึก",
    dashLow: "สต็อกใกล้หมด",
    dashTopContract: "ผู้รับเหมาที่ใช้บ่อย",
    dashTopItems: "วัสดุยอดใช้",
    dashRecent: "ความเคลื่อนไหวล่าสุด",
    purTitle: "ขอจัดซื้อ",
    purProj: "โครงการ / สถานที่",
    purNeedBy: "ต้องการภายใน (วัน)",
    purContractor: "ผู้รับเหมา",
    purPriority: "ความเร่งด่วน",
    purNote: "หมายเหตุคำขอ",
    purOlder: "คำขอเดิม",
    showMore: "ดูเพิ่มเติม",
    showLess: "ย่อ",
    noLow: "ไม่มีรายการใกล้หมด 🎉",
    stock: "คงเหลือ: ",
    prev: "คงเหลือก่อนหน้า: ",
    loading: "กำลังโหลด…",
    saved: "บันทึกแล้ว",
    error: "เกิดข้อผิดพลาด",
    addedContractor: "เพิ่มผู้รับเหมาแล้ว",
    addedRequester: "เพิ่มผู้ขอแล้ว",
    requestSent: "ส่งคำขอแล้ว",
  },
  en: {
    title: "Inventory",
    tabs: { dash: "Dashboard", out: "OUT", in: "IN", adj: "ADJUST", pur: "PURCHASING" },
    searchPh: "Type to search…",
    pick: "Search or pick",
    pickAdd: "Pick or add",
    proj: "Project / Location",
    contractor: "Contractor",
    requester: "Requester",
    note: "Note",
    outTitle: "Material OUT",
    outDate: "Date",
    inTitle: "Material IN",
    inDate: "Date received",
    adjTitle: "Adjust",
    btnAdd: "＋ Add",
    btnReset: "Reset",
    btnSubmit: "Submit",
    dashLow: "Low stock",
    dashTopContract: "Top contractors (usage)",
    dashTopItems: "Top items",
    dashRecent: "Recent movements",
    purTitle: "Purchasing Request",
    purProj: "Project / Location",
    purNeedBy: "Need by (date)",
    purContractor: "Contractor",
    purPriority: "Priority",
    purNote: "Request note",
    purOlder: "Older Requests",
    showMore: "Show more",
    showLess: "Show less",
    noLow: "No low stock 🎉",
    stock: "Stock: ",
    prev: "Prev: ",
    loading: "Loading…",
    saved: "Saved",
    error: "Error",
    addedContractor: "Added contractor",
    addedRequester: "Added requester",
    requestSent: "Request sent",
  },
};

//////////////////////
// 1) DOM UTILITIES //
//////////////////////

const $ = (q, root = document) => root.querySelector(q);
const $$ = (q, root = document) => Array.prototype.slice.call(root.querySelectorAll(q));

function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") el.className = v;
    else if (k === "style") el.style.cssText = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v);
  }
  (Array.isArray(children) ? children : [children]).forEach((child) => {
    if (child == null) return;
    if (typeof child === "string") el.appendChild(document.createTextNode(child));
    else el.appendChild(child);
  });
  return el;
}

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toast(msg) {
  const t = $("#toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3600);
}

function skeletonRow(n = 3) {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < n; i++) frag.appendChild(h("div", { class: "skeleton" }));
  return frag;
}

//////////////////////////
// 2) FETCH & BACKEND   //
//////////////////////////

function safeJson(t) {
  try {
    return JSON.parse(t);
  } catch (e) {
    return { ok: false, error: "Bad JSON" };
  }
}

async function fetchWithTimeout(url, options = {}, ms = 12000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

async function apiGet(fn, payload = {}, { retries = 1 } = {}) {
  const q = new URLSearchParams();
  q.set("fn", fn);
  if (payload && Object.keys(payload).length) q.set("payload", JSON.stringify(payload));
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await fetchWithTimeout(`${API_URL}?${q.toString()}`, { method: "GET" });
      const text = await r.text();
      const data = safeJson(text);
      return data.result !== undefined ? data.result : data;
    } catch (e) {
      if (i === retries) throw e;
      await new Promise((res) => setTimeout(res, 400 * (i + 1)));
    }
  }
}

async function apiPost(fn, payload = {}, { retries = 0 } = {}) {
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await fetchWithTimeout(
        API_URL,
        {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ fn, payload }),
        },
        15000
      );
      const text = await r.text();
      const data = safeJson(text);
      return data.result !== undefined ? data.result : data;
    } catch (e) {
      if (i === retries) throw e;
      await new Promise((res) => setTimeout(res, 500 * (i + 1)));
    }
  }
}

/////////////////////
// 3) PICKER LOGIC //
/////////////////////

const picker = {
  overlay: $("#pickerOverlay"),
  list: $("#pickerList"),
  search: $("#pickerSearch"),
  addBtn: $("#pickerAdd"),
  addText: $("#pickerAddText"),
  cancel: $("#pickerCancel"),
  currentTarget: null,
  sourceKey: null,
};

const sources = {
  materials: () => state.materials,
  projects: () => state.projects,
  contractors: () => state.contractors,
  requesters: () => state.requesters,
};

function openPicker(targetInput, sourceKey) {
  picker.currentTarget = targetInput;
  picker.sourceKey = sourceKey;
  if (!picker.overlay) return;
  picker.search.value = "";
  renderPickerList("");
  picker.overlay.style.display = "flex";
  picker.overlay.classList.add("open");
  setTimeout(() => picker.search && picker.search.focus(), 30);
}

function closePicker() {
  if (!picker.overlay) return;
  picker.overlay.classList.remove("open");
  picker.overlay.style.display = "none";
  picker.currentTarget = null;
  picker.sourceKey = null;
}

function renderPickerList(query) {
  const all = (sources[picker.sourceKey] ? sources[picker.sourceKey]() : []) || [];
  const q = (query || "").toLowerCase().trim();
  const list = q ? all.filter((v) => String(v).toLowerCase().includes(q)) : all.slice();
  picker.list.innerHTML = "";
  if (!list.length) {
    picker.addBtn.classList.remove("hidden");
    picker.addText.textContent = query || "";
  } else {
    picker.addBtn.classList.add("hidden");
  }

  list.forEach((v) => {
    const row = h("div", { class: "pick-row" }, [h("strong", {}, [v])]);
    row.addEventListener("click", () => {
      if (picker.currentTarget) {
        picker.currentTarget.value = v;
        picker.currentTarget.dispatchEvent(new Event("change"));
      }
      closePicker();
    });
    picker.list.appendChild(row);
  });
}

// Picker events
if (picker.search) picker.search.addEventListener("input", (e) => renderPickerList(e.target.value));
if (picker.cancel) picker.cancel.addEventListener("click", closePicker);
if (picker.overlay)
  picker.overlay.addEventListener("click", (e) => {
    if (e.target === picker.overlay) closePicker();
  });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && picker.overlay && picker.overlay.classList.contains("open")) closePicker();
});

if (picker.addBtn)
  picker.addBtn.addEventListener("click", async () => {
    const text = picker.search.value.trim();
    if (!text) return;
    try {
      if (picker.sourceKey === "contractors") {
        const ok = await apiGet("addContractor", { name: text });
        if (ok) {
          state.contractors = Array.from(new Set([text, ...state.contractors]));
          toast(STR[state.lang].addedContractor);
        }
      } else if (picker.sourceKey === "requesters") {
        const ok = await apiGet("addRequester", { name: text });
        if (ok) {
          state.requesters = Array.from(new Set([text, ...state.requesters]));
          toast(STR[state.lang].addedRequester);
        }
      } else {
        toast(state.lang === "th" ? "กรุณาเพิ่มในชีทมาสเตอร์" : "Use master sheet to add new entries");
      }
      if (picker.currentTarget) {
        picker.currentTarget.value = text;
        picker.currentTarget.dispatchEvent(new Event("change"));
      }
    } catch (e) {
      toast(STR[state.lang].error);
      console.error(e);
    } finally {
      closePicker();
    }
  });

/////////////////////////
// 4) SMALL COMPONENTS //
/////////////////////////

function stockBadge(stock, min) {
  const b = h("span", { class: "badge" }, [isNaN(stock) || stock == null ? "-" : String(stock)]);
  if (stock <= 0 || (min != null && stock <= Number(min || 0))) b.classList.add("red");
  else if (min != null && stock <= 2 * Number(min || 0)) b.classList.add("yellow");
  else b.classList.add("green");
  return b;
}

function lineOUT() {
  const card = h("div", { class: "line" });
  const name = h("input", { readOnly: true, placeholder: STR[state.lang].searchPh, "data-picker": "materials" });
  const qty = h("input", { type: "number", min: "0", step: "any", placeholder: "0", inputmode: "decimal" });

  const grid = h("div", { class: "grid" }, [name, qty]);

  const meta = h("div", { class: "rowitem", style: "justify-content:flex-start" }, [
    h("span", { class: "meta" }, [STR[state.lang].stock]),
    h("span", { class: "badge" }, ["-"]),
  ]);

  const actions = h("div", { class: "actions" }, [
    h("button", { type: "button", class: "btn", style: "flex:0 0 auto", onClick: () => card.remove() }, "×"),
  ]);

  name.addEventListener("click", () => openPicker(name, "materials"));
  name.addEventListener("change", async () => {
    const v = name.value.trim();
    if (!v) return;
    try {
      const res = await apiGet("getCurrentStock", { material: v }, { retries: 1 });
      const n = res && res.ok ? Number(res.stock) : null;
      const mn = res && res.ok ? Number(res.min || 0) : null;
      const bNew = stockBadge(n, mn);
      meta.replaceChild(bNew, meta.querySelector(".badge"));
    } catch (e) {
      console.warn(e);
    }
  });

  card.appendChild(grid);
  card.appendChild(meta);
  card.appendChild(actions);
  return card;
}

function lineIN() {
  const card = h("div", { class: "line" });
  const name = h("input", { readOnly: true, placeholder: STR[state.lang].searchPh, "data-picker": "materials" });
  const qty = h("input", { type: "number", min: "0", step: "any", placeholder: "0", inputmode: "decimal" });
  const grid = h("div", { class: "grid" }, [name, qty]);
  const actions = h("div", { class: "actions" }, [
    h("button", { type: "button", class: "btn", style: "flex:0 0 auto", onClick: () => card.remove() }, "×"),
  ]);
  name.addEventListener("click", () => openPicker(name, "materials"));
  card.appendChild(grid);
  card.appendChild(actions);
  return card;
}

function lineADJ() {
  const card = h("div", { class: "line" });
  const name = h("input", { readOnly: true, placeholder: STR[state.lang].searchPh, "data-picker": "materials" });
  const qty = h("input", { type: "number", step: "any", placeholder: "±", inputmode: "decimal" });
  const grid = h("div", { class: "grid" }, [name, qty]);

  const meta = h("div", { class: "rowitem", style: "justify-content:flex-start" }, [
    h("span", { class: "meta" }, [STR[state.lang].prev]),
    h("span", { class: "badge" }, ["-"]),
  ]);

  const actions = h("div", { class: "actions" }, [
    h("button", { type: "button", class: "btn", style: "flex:0 0 auto", onClick: () => card.remove() }, "×"),
  ]);

  name.addEventListener("click", () => openPicker(name, "materials"));
  name.addEventListener("change", async () => {
    const v = name.value.trim();
    if (!v) return;
    try {
      const res = await apiGet("getCurrentStock", { material: v }, { retries: 1 });
      const n = res && res.ok ? Number(res.stock) : null;
      const mn = res && res.ok ? Number(res.min || 0) : null;
      const bNew = stockBadge(n, mn);
      meta.replaceChild(bNew, meta.querySelector(".badge"));
    } catch (e) {
      console.warn(e);
    }
  });

  card.appendChild(grid);
  card.appendChild(meta);
  card.appendChild(actions);
  return card;
}

function linePUR() {
  const card = h("div", { class: "line" });
  const name = h("input", { readOnly: true, placeholder: STR[state.lang].searchPh, "data-picker": "materials" });
  const qty = h("input", { type: "number", min: "0", step: "any", placeholder: "0", inputmode: "decimal" });
  const grid = h("div", { class: "grid" }, [name, qty]);
  const actions = h("div", { class: "actions" }, [
    h("button", { type: "button", class: "btn", style: "flex:0 0 auto", onClick: () => card.remove() }, "×"),
  ]);
  name.addEventListener("click", () => openPicker(name, "materials"));
  card.appendChild(grid);
  card.appendChild(actions);
  return card;
}

function collectLines(container) {
  const out = [];
  $$(".line", container).forEach((c) => {
    const nameEl = $('input[data-picker="materials"]', c);
    const qtyEl = $('input[type="number"]', c);
    const name = nameEl ? nameEl.value.trim() : "";
    const qty = Number(qtyEl ? qtyEl.value : 0) || 0;
    if (name) out.push({ name, qty, spec: "" }); // spec removed by request; keep field for backend compatibility
  });
  return out;
}

///////////////////////
// 5) TAB RENDERERS  //
///////////////////////

function renderHeader() {
  const S = STR[state.lang];
  const header = h("header", { class: "" }, [
    h("h1", { id: "t_title" }, [S.title]),
    h("div", { class: "spacer" }),
    h("div", { class: "lang" }, [
      h(
        "button",
        {
          id: "lang-th",
          class: state.lang === "th" ? "active" : "",
          onClick: () => {
            state.lang = "th";
            renderApp();
          },
        },
        "ไทย"
      ),
      h(
        "button",
        {
          id: "lang-en",
          class: state.lang === "en" ? "active" : "",
          onClick: () => {
            state.lang = "en";
            renderApp();
          },
        },
        "EN"
      ),
    ]),
  ]);
  return header;
}

function renderTabs() {
  const S = STR[state.lang];
  const tabs = h("div", { class: "tabs glass" }, [
    h(
      "button",
      { id: "tab-dashboard", class: state.tab === "dashboard" ? "active" : "", onClick: () => showTab("dashboard") },
      S.tabs.dash
    ),
    h("button", { id: "tab-out", class: state.tab === "out" ? "active" : "", onClick: () => showTab("out") }, S.tabs.out),
    h("button", { id: "tab-in", class: state.tab === "in" ? "active" : "", onClick: () => showTab("in") }, S.tabs.in),
    h(
      "button",
      { id: "tab-adjust", class: state.tab === "adjust" ? "active" : "", onClick: () => showTab("adjust") },
      S.tabs.adj
    ),
    h(
      "button",
      { id: "tab-purchase", class: state.tab === "purchase" ? "active" : "", onClick: () => showTab("purchase") },
      S.tabs.pur
    ),
  ]);
  return tabs;
}

function renderDashboardPanel() {
  const S = STR[state.lang];
  const wrap = h("section", { id: "panel-dashboard", class: "dash-grid" });

  // Low stock
  const lowCard = h("div", { class: "card glass" }, [
    h("h3", { id: "t_dash_lowstock" }, [S.dashLow]),
    h("div", { class: "list", id: "lowStockList", "data-limit": "5" }, [skeletonRow(3)]),
    toggleBtn("#lowStockList"),
  ]);

  // Top contractors
  const topContract = h("div", { class: "card glass" }, [
    h("h3", { id: "t_dash_topcontractors" }, [S.dashTopContract]),
    h("div", { class: "list", id: "topContractors", "data-limit": "5" }, [skeletonRow(3)]),
    toggleBtn("#topContractors"),
  ]);

  // Top items
  const topItems = h("div", { class: "card glass" }, [
    h("h3", { id: "t_dash_topitems" }, [S.dashTopItems]),
    h("div", { class: "list", id: "topItems", "data-limit": "5" }, [skeletonRow(3)]),
    toggleBtn("#topItems"),
  ]);

  // Recent
  const recent = h("div", { class: "card glass dash-span-2" }, [
    h("h3", { id: "t_dash_recent" }, [S.dashRecent]),
    h("div", { class: "list", id: "recentMoves", "data-limit": "8" }, [skeletonRow(4)]),
    toggleBtn("#recentMoves"),
  ]);

  // Purchasing summary
  const kpi = h("div", { class: "card glass dash-span-2" }, [
    h("h3", { id: "t_pur_summary" }, [S.purTitle]),
    h("div", { class: "kpis" }, [
      h("div", { class: "kpi glass" }, [h("div", { class: "v", id: "kpiReq" }, ["0"]), h("div", {}, ["คำขอ"])]),
      h("div", { class: "kpi glass" }, [h("div", { class: "v", id: "kpiLines" }, ["0"]), h("div", {}, ["รายการ"])]),
      h("div", { class: "kpi glass" }, [h("div", { class: "v", id: "kpiUrgent" }, ["0"]), h("div", {}, ["ด่วน"])]),
    ]),
    h("div", { class: "list", id: "purSummaryDetail", "data-limit": "5" }, [skeletonRow(2)]),
    toggleBtn("#purSummaryDetail"),
  ]);

  // Purchasing history
  const hist = h("div", { class: "card glass dash-span-2" }, [
    h("h3", { id: "t_pur_history" }, [state.lang === "th" ? "ประวัติการขอจัดซื้อ" : "Purchasing History"]),
    h("div", { class: "list", id: "purHistory", "data-limit": "10" }, [skeletonRow(3)]),
    toggleBtn("#purHistory"),
  ]);

  [lowCard, topContract, topItems, recent, kpi, hist].forEach((c) => wrap.appendChild(c));
  // Load data
  loadDashboard();
  return wrap;
}

function toggleBtn(sel) {
  const label = state.lang === "th" ? STR.th.showMore : STR.en.showMore;
  const btn = h("div", { class: "toggle" }, [
    h(
      "button",
      {
        type: "button",
        "data-toggle": sel,
        onClick: (e) => {
          const list = $(sel);
          if (!list) return;
          const expanded = list.dataset.expanded === "true";
          const items = list.children;
          for (let i = 0; i < items.length; i++) {
            items[i].style.display = expanded
              ? i < Number(list.dataset.limit || "5")
                ? ""
                : "none"
              : "";
          }
          list.dataset.expanded = expanded ? "false" : "true";
          e.target.textContent = expanded ? STR[state.lang].showMore : STR[state.lang].showLess;
        },
      },
      label
    ),
  ]);
  return btn;
}

function clampList(listEl) {
  const max = Number(listEl.dataset.limit || "5");
  const items = listEl.children;
  for (let i = 0; i < items.length; i++) items[i].style.display = i < max ? "" : "none";
  listEl.dataset.expanded = "false";
}

async function loadDashboard() {
  const S = STR[state.lang];
  try {
    // Low stock
    const lowBox = $("#lowStockList");
    const low = await apiGet("dash_LowStock", {}, { retries: 1 });
    lowBox.innerHTML = "";
    if (!low || !low.length) {
      lowBox.appendChild(h("div", { class: "rowitem" }, [S.noLow]));
    } else {
      low.forEach((x) => {
        const row = h("div", { class: "rowitem" });
        const left = h("div", {}, [h("div", {}, [h("strong", {}, [x.name])]), h("div", { class: "meta" }, ["Min ", x.min == null ? "-" : String(x.min)])]);
        const right = stockBadge(Number(x.stock), Number(x.min));
        row.appendChild(left);
        row.appendChild(right);
        lowBox.appendChild(row);
      });
    }
    clampList(lowBox);
  } catch (e) {
    console.error(e);
  }

  try {
    // Top contractors
    const box = $("#topContractors");
    const list = await apiGet("dash_TopContractors", {}, { retries: 1 });
    box.innerHTML = "";
    (list || []).forEach((x) => {
      box.appendChild(
        h("div", { class: "rowitem" }, [
          h("div", {}, [h("strong", {}, [x.contractor || "(unknown)"]), h("div", { class: "meta" }, ["Qty ", x.qty || 0])]),
        ])
      );
    });
    clampList(box);
  } catch (e) {
    console.error(e);
  }

  try {
    // Top items
    const box = $("#topItems");
    const list = await apiGet("dash_TopItems", {}, { retries: 1 });
    box.innerHTML = "";
    (list || []).forEach((x) => {
      box.appendChild(
        h("div", { class: "rowitem" }, [
          h("div", {}, [h("strong", {}, [x.name]), h("div", { class: "meta" }, ["Used • ", String(x.qty)])]),
        ])
      );
    });
    clampList(box);
  } catch (e) {
    console.error(e);
  }

  try {
    // Recent
    const box = $("#recentMoves");
    const rows = await apiGet("dash_Recent", {}, { retries: 1 });
    box.innerHTML = "";
    (rows || []).forEach((x) => {
      box.appendChild(
        h("div", { class: "rowitem" }, [
          h("div", {}, [h("strong", {}, [`${x.type} • ${x.item}`]), h("div", { class: "meta" }, [`${x.ts} — ${x.doc} • Qty ${x.qty}`])]),
        ])
      );
    });
    clampList(box);
  } catch (e) {
    console.error(e);
  }

  try {
    // Purchasing summary + history
    const s = await apiGet("pur_Summary", {}, { retries: 1 });
    $("#kpiReq").textContent = (s && s.requests) ? s.requests : 0;
    $("#kpiLines").textContent = (s && s.lines) ? s.lines : 0;
    $("#kpiUrgent").textContent = (s && s.urgent) ? s.urgent : 0;

    const rows = await apiGet("pur_History", {}, { retries: 1 });
    const sum = $("#purSummaryDetail");
    sum.innerHTML = "";
    (rows || []).forEach((x) => {
      sum.appendChild(
        h("div", { class: "rowitem" }, [
          h("div", {}, [
            h("strong", {}, [`${x.docNo} • ${x.project || "-"}`]),
            h("div", { class: "meta" }, [`👷 ${x.contractor || "-"} • 🙋 ${x.requester || "-"}`]),
            h("div", { class: "meta" }, [`🗓 ${x.ts} → 📆 ${x.needBy || "-"}`]),
          ]),
        ])
      );
    });
    clampList(sum);

    const box = $("#purHistory");
    box.innerHTML = "";
    (rows || []).forEach((x) => {
      box.appendChild(
        h("div", { class: "rowitem" }, [
          h("div", {}, [
            h("strong", {}, [`${x.docNo} • ${x.project || "-"}`]),
            h("div", { class: "meta" }, [`${x.ts} • NeedBy ${x.needBy || "-"} • ${x.priority || "-"} • ${x.status || "-"}`]),
            h("div", { class: "meta" }, [`Lines ${x.lines} • Qty ${x.totalQty} • 👷 ${x.contractor || "-"} • 🙋 ${x.requester || "-"}`]),
          ]),
        ])
      );
    });
    clampList(box);

    state.dash.purHistory = rows || [];
  } catch (e) {
    console.error(e);
  }
}

function renderOutPanel() {
  const S = STR[state.lang];
  const wrap = h("section", { id: "panel-out" }, [
    h("div", { class: "card glass" }, [
      h("h3", { id: "t_out_title" }, [S.outTitle]),
      h("div", { class: "row" }, [
        h("div", {}, [h("label", { id: "t_out_date" }, [S.outDate]), h("input", { id: "OutDate", type: "date", style: "min-width:12rem" })]),
        h("div", {}, [h("label", { id: "t_project" }, [S.proj]), h("input", { id: "ProjectInput", "data-picker": "projects", placeholder: S.pick, readOnly: true })]),
      ]),
      h("div", { class: "row" }, [
        h("div", {}, [
          h("label", { id: "t_contractor" }, [S.contractor]),
          h("div", { style: "display:flex;gap:.5rem;align-items:center" }, [
            h("input", { id: "ContractorInput", "data-picker": "contractors", placeholder: S.pickAdd, readOnly: true }),
            h("button", { class: "btn small", id: "addContractorBtn", type: "button", onClick: () => { openPicker($("#ContractorInput"), "contractors"); picker.search && picker.search.focus(); } }, "＋"),
          ]),
        ]),
        h("div", {}, [
          h("label", { id: "t_requester" }, [S.requester]),
          h("div", { style: "display:flex;gap:.5rem;align-items:center" }, [
            h("input", { id: "RequesterInput", "data-picker": "requesters", placeholder: S.pickAdd, readOnly: true }),
            h("button", { class: "btn small", id: "addRequesterBtn", type: "button", onClick: () => { openPicker($("#RequesterInput"), "requesters"); picker.search && picker.search.focus(); } }, "＋"),
          ]),
        ]),
      ]),
      h("div", { class: "row" }, [
        h("div", {}, [h("label", { id: "t_note" }, [S.note]), h("input", { id: "Note", placeholder: state.lang === "th" ? "ถ้ามี" : "Optional" })]),
      ]),
      h("div", { class: "lines", id: "outLines" }),
    ]),
    // Floating toolbar
    h("div", { class: "toolbar", id: "toolbar-out" }, [
      h("button", { class: "btn", id: "addLineBtnOut", type: "button", onClick: () => $("#outLines").appendChild(lineOUT()) }, S.btnAdd),
      h("button", { class: "btn small", id: "resetBtnOut", type: "button", onClick: () => resetOut() }, S.btnReset),
      h("button", { class: "btn primary", id: "submitBtnOut", type: "button", onClick: () => submitOut() }, S.btnSubmit),
    ]),
  ]);

  // defaults
  $("#OutDate", wrap).value = todayStr();
  $("#outLines", wrap).appendChild(lineOUT());

  // header pickers
  $("#ProjectInput", wrap).addEventListener("click", () => openPicker($("#ProjectInput", wrap), "projects"));
  $("#ContractorInput", wrap).addEventListener("click", () => openPicker($("#ContractorInput", wrap), "contractors"));
  $("#RequesterInput", wrap).addEventListener("click", () => openPicker($("#RequesterInput", wrap), "requesters"));
  return wrap;
}

function resetOut() {
  $("#outLines").innerHTML = "";
  $("#outLines").appendChild(lineOUT());
  $("#Note").value = "";
  $("#OutDate").value = todayStr();
}

async function submitOut() {
  const S = STR[state.lang];
  const payload = {
    type: "OUT",
    project: $("#ProjectInput").value.trim(),
    contractor: $("#ContractorInput").value.trim(),
    requester: $("#RequesterInput").value.trim(),
    note: $("#Note").value.trim(),
    date: $("#OutDate").value.trim(),
    lines: collectLines($("#outLines")),
  };
  if (!payload.lines.length) return toast(state.lang === "th" ? "กรุณาเพิ่มรายการ" : "Add at least one line");
  try {
    const res = await apiPost("submitMovementBulk", payload, { retries: 0 });
    if (res && res.ok) {
      toast(`${S.saved} • ${res.docNo || ""}`);
      resetOut();
      if (state.tab === "dashboard") loadDashboard();
    } else {
      toast((res && res.message) || S.error);
    }
  } catch (e) {
    console.error(e);
    toast(S.error);
  }
}

function renderInPanel() {
  const S = STR[state.lang];
  const wrap = h("section", { id: "panel-in" }, [
    h("div", { class: "card glass" }, [
      h("h3", { id: "t_in_title" }, [S.inTitle]),
      h("div", { class: "row" }, [
        h("div", {}, [h("label", { id: "t_date" }, [S.inDate]), h("input", { id: "InDate", type: "date", style: "min-width:12rem" })]),
      ]),
      h("div", { class: "lines", id: "inLines" }),
      h("div", { class: "inline-actions" }, [
        h("button", { class: "btn", id: "addLineBtnIn", type: "button", onClick: () => $("#inLines").appendChild(lineIN()) }, S.btnAdd),
        h("button", { class: "btn", id: "resetBtnIn", type: "button", onClick: () => resetIn() }, S.btnReset),
        h("button", { class: "btn primary", id: "submitBtnIn", type: "button", onClick: () => submitIn() }, S.btnSubmit),
      ]),
    ]),
  ]);
  $("#InDate", wrap).value = todayStr();
  $("#inLines", wrap).appendChild(lineIN());
  return wrap;
}

function resetIn() {
  $("#inLines").innerHTML = "";
  $("#inLines").appendChild(lineIN());
  $("#InDate").value = todayStr();
}
async function submitIn() {
  const S = STR[state.lang];
  const payload = { type: "IN", date: $("#InDate").value.trim(), lines: collectLines($("#inLines")) };
  if (!payload.lines.length) return toast(state.lang === "th" ? "กรุณาเพิ่มรายการ" : "Add at least one line");
  try {
    const res = await apiPost("submitMovementBulk", payload);
    if (res && res.ok) {
      toast(`${S.saved} • ${res.docNo || ""}`);
      resetIn();
      if (state.tab === "dashboard") loadDashboard();
    } else toast((res && res.message) || S.error);
  } catch (e) {
    toast(S.error);
    console.error(e);
  }
}

function renderAdjustPanel() {
  const S = STR[state.lang];
  const wrap = h("section", { id: "panel-adjust" }, [
    h("div", { class: "card glass" }, [
      h("h3", { id: "t_adjust_title" }, [S.adjTitle]),
      h("div", { class: "lines", id: "adjLines" }),
      h("div", { class: "inline-actions" }, [
        h("button", { class: "btn", id: "addLineBtnAdj", type: "button", onClick: () => $("#adjLines").appendChild(lineADJ()) }, S.btnAdd),
        h("button", { class: "btn", id: "resetBtnAdj", type: "button", onClick: () => resetAdj() }, S.btnReset),
        h("button", { class: "btn primary", id: "submitBtnAdj", type: "button", onClick: () => submitAdj() }, S.btnSubmit),
      ]),
    ]),
  ]);
  $("#adjLines", wrap).appendChild(lineADJ());
  return wrap;
}

function resetAdj() {
  $("#adjLines").innerHTML = "";
  $("#adjLines").appendChild(lineADJ());
}
async function submitAdj() {
  const S = STR[state.lang];
  const payload = { type: "ADJUST", lines: collectLines($("#adjLines")) };
  if (!payload.lines.length) return toast(state.lang === "th" ? "กรุณาเพิ่มรายการ" : "Add at least one line");
  try {
    const res = await apiPost("submitMovementBulk", payload);
    if (res && res.ok) {
      toast(`${S.saved} • ${res.docNo || ""}`);
      resetAdj();
      if (state.tab === "dashboard") loadDashboard();
    } else toast((res && res.message) || S.error);
  } catch (e) {
    toast(S.error);
    console.error(e);
  }
}

function renderPurchasePanel() {
  const S = STR[state.lang];
  const wrap = h("section", { id: "panel-purchase" }, [
    h("div", { class: "card glass" }, [
      h("h3", { id: "t_pur_title" }, [S.purTitle]),
      h("div", { class: "row" }, [
        h("div", {}, [h("label", { id: "t_pur_project" }, [S.purProj]), h("input", { id: "PurProject", "data-picker": "projects", placeholder: S.pick, readOnly: true })]),
        h("div", {}, [h("label", { id: "t_pur_needby" }, [S.purNeedBy]), h("input", { type: "date", id: "PurNeedBy", style: "min-width:12rem" })]),
      ]),
      h("div", { class: "row" }, [
        h("div", {}, [h("label", { id: "t_pur_contractor" }, [S.purContractor]), h("input", { id: "PurContractor", "data-picker": "contractors", placeholder: S.pickAdd, readOnly: true })]),
        h("div", {}, [
          h("label", { id: "t_pur_priority" }, [S.purPriority]),
          h("select", { id: "PurPriority" }, [
            h("option", { value: "Normal" }, state.lang === "th" ? "ปกติ" : "Normal"),
            h("option", { value: "Urgent" }, state.lang === "th" ? "ด่วน" : "Urgent"),
            h("option", { value: "Critical" }, state.lang === "th" ? "วิกฤติ" : "Critical"),
          ]),
        ]),
      ]),
      h("div", { class: "lines", id: "purLines" }),
      h("div", { class: "row" }, [
        h("div", {}, [h("label", { id: "t_pur_note" }, [S.purNote]), h("input", { id: "PurNote", placeholder: state.lang === "th" ? "บันทึกเพิ่มเติม (ถ้ามี)" : "Additional notes (optional)" })]),
      ]),
      h("div", { class: "inline-actions" }, [
        h("button", { class: "btn", id: "addLineBtnPur", type: "button", onClick: () => $("#purLines").appendChild(linePUR()) }, S.btnAdd),
        h("button", { class: "btn", id: "resetBtnPur", type: "button", onClick: () => resetPur() }, S.btnReset),
        h("button", { class: "btn primary", id: "submitBtnPur", type: "button", onClick: () => submitPur() }, S.btnSubmit),
      ]),
    ]),
    h("div", { class: "card glass", style: "margin-top:.25rem" }, [
      h("h3", {}, [state.lang === "th" ? "คำขอเดิม" : "Previous Requests"]),
      h("div", { class: "list", id: "purOlderList", "data-limit": "10" }, [skeletonRow(2)]),
      toggleBtn("#purOlderList"),
    ]),
  ]);

  $("#PurNeedBy", wrap).value = todayStr();
  $("#purLines", wrap).appendChild(linePUR());

  $("#PurProject", wrap).addEventListener("click", () => openPicker($("#PurProject", wrap), "projects"));
  $("#PurContractor", wrap).addEventListener("click", () => openPicker($("#PurContractor", wrap), "contractors"));

  loadPurchasingOlder();
  return wrap;
}

function resetPur() {
  $("#purLines").innerHTML = "";
  $("#purLines").appendChild(linePUR());
  $("#PurNote").value = "";
  $("#PurNeedBy").value = todayStr();
  $("#PurContractor").value = "";
}

async function submitPur() {
  const S = STR[state.lang];
  const payload = {
    type: "PURCHASE",
    project: $("#PurProject").value.trim(),
    contractor: $("#PurContractor").value.trim(),
    needBy: $("#PurNeedBy").value.trim(),
    priority: $("#PurPriority").value,
    note: $("#PurNote").value.trim(),
    lines: collectLines($("#purLines")),
  };
  if (!payload.lines.length) return toast(state.lang === "th" ? "กรุณาเพิ่มรายการ" : "Add at least one line");
  try {
    const res = await apiPost("submitPurchaseRequest", payload);
    if (res && res.ok) {
      toast(`${S.requestSent} • ${res.docNo || ""}`);
      resetPur();
      loadDashboard();
    } else toast((res && res.message) || S.error);
  } catch (e) {
    toast(S.error);
    console.error(e);
  }
}

async function loadPurchasingOlder() {
  try {
    const rows = await apiGet("pur_History", {}, { retries: 1 });
    const box = $("#purOlderList");
    box.innerHTML = "";
    (rows || []).forEach((x) => {
      const acc = h("div", { class: "rowitem", style: "flex-direction:column; align-items:stretch" });
      const head = h("div", { style: "display:flex; justify-content:space-between; cursor:pointer" }, [
        h("span", {}, [`${x.docNo} • ${x.project || "-"} • ${x.ts}`]),
        h("span", {}, ["›"]),
      ]);
      const body = h("div", { class: "hidden" }, [
        h("div", { class: "meta" }, [`👷 ${x.contractor || "-"} • 🙋 ${x.requester || "-"}`]),
        h("div", { class: "meta" }, [`NeedBy ${x.needBy || "-"} • สถานะ: `, h("strong", {}, [x.status || "-"]) ]),
        h("div", { style: "display:flex; gap:.5rem; align-items:center; margin:.5rem 0;" }, [
          h("label", { style: "min-width:7rem" }, [state.lang === "th" ? "เปลี่ยนสถานะ" : "Change status"]),
          (() => {
            const sel = h("select", { id: `status-${x.docNo}` }, [
              h("option", { value: "Requested", selected: x.status === "Requested" }, "Requested"),
              h("option", { value: "Approved", selected: x.status === "Approved" }, "Approved"),
              h("option", { value: "Ordered", selected: x.status === "Ordered" }, "Ordered"),
              h("option", { value: "Received", selected: x.status === "Received" }, "Received"),
              h("option", { value: "Cancelled", selected: x.status === "Cancelled" }, "Cancelled"),
            ]);
            const btn = h("button", { class: "btn", type: "button" }, [state.lang === "th" ? "บันทึก" : "Save"]);
            btn.addEventListener("click", async () => {
              try {
                const res = await apiPost("pur_UpdateStatus", { docNo: x.docNo, status: sel.value });
                if (res && res.ok) {
                  toast((state.lang === "th" ? "อัปเดตสถานะแล้ว → " : "Status updated → ") + sel.value);
                  loadDashboard();
                  loadPurchasingOlder();
                } else toast(res && res.message || STR[state.lang].error);
              } catch (e) {
                toast(STR[state.lang].error);
              }
            });
            return h("div", { style: "display:flex; gap:.5rem; align-items:center; width:100%" }, [sel, btn]);
          })(),
        ]),
        h("div", { id: `doc-${x.docNo}` }, [STR[state.lang].loading]),
      ]);

      head.addEventListener("click", async () => {
        const open = !body.classList.contains("hidden");
        if (open) {
          body.classList.add("hidden");
          return;
        }
        const holder = $(`#doc-${cssEscape(x.docNo)}`, body);
        try {
          const lines = await apiGet("pur_DocLines", { docNo: x.docNo }, { retries: 1 });
          const tbl = document.createElement("table");
          tbl.style.width = "100%";
          tbl.style.borderCollapse = "collapse";
          tbl.innerHTML = "<thead><tr><th>รายการ</th><th>จำนวน</th></tr></thead>";
          const tb = document.createElement("tbody");
          (lines || []).forEach((li) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `<td>${escapeHtml(li.item)}</td><td>${escapeHtml(li.qty)}</td>`;
            tb.appendChild(tr);
          });
          tbl.appendChild(tb);
          holder.replaceWith(tbl);
        } catch (e) {
          holder.textContent = STR[state.lang].error;
        }
        body.classList.remove("hidden");
      });

      acc.appendChild(head);
      acc.appendChild(body);
      box.appendChild(acc);
    });
    clampList(box);
  } catch (e) {
    console.error(e);
  }
}

//////////////////////
// 6) APP SHELL     //
//////////////////////

function renderApp() {
  const app = document.getElementById("app");
  app.innerHTML = "";

  // Container (matches your previous layout spacing)
  const container = h("div", { class: "container", style: "width:min(100%, 72rem); margin:0 auto; padding:16px" });

  // Header, Tabs
  container.appendChild(renderHeader());
  container.appendChild(renderTabs());

  // Panels
  let panel = null;
  if (state.tab === "dashboard") panel = renderDashboardPanel();
  if (state.tab === "out") panel = renderOutPanel();
  if (state.tab === "in") panel = renderInPanel();
  if (state.tab === "adjust") panel = renderAdjustPanel();
  if (state.tab === "purchase") panel = renderPurchasePanel();

  container.appendChild(panel);
  app.appendChild(container);

  bindGlobalPickers(container);

  // Mark boot success for previous loader variants (no-op here)
  if (typeof window.__APP_MOUNTED__ === "function") window.__APP_MOUNTED__();
}

function bindGlobalPickers(root) {
  $$('input[data-picker]', root).forEach((inp) => {
    inp.addEventListener("click", () => {
      const key = inp.getAttribute("data-picker");
      openPicker(inp, key);
    });
  });
}

function showTab(tab) {
  state.tab = tab;
  renderApp();
}

function applyLangToStatic() {
  // The app uses dynamic labels; rendering with renderApp after state.lang change is enough
}

//////////////////////
// 7) LOOKUPS LOAD  //
//////////////////////

async function loadLookups() {
  try {
    const [m, p, c, r] = await Promise.all([
      apiGet("listMaterials", {}, { retries: 1 }),
      apiGet("listProjects", {}, { retries: 1 }),
      apiGet("listContractors", {}, { retries: 1 }),
      apiGet("listRequesters", {}, { retries: 1 }),
    ]);
    state.materials = (m || []).map(String);
    state.projects = (p || []).map(String);
    state.contractors = (c || []).map(String);
    state.requesters = (r || []).map(String);
  } catch (e) {
    console.warn("Lookup load failed", e);
    // Render anyway; picker will be empty but not block UI
  }
}

//////////////////////
// 8) HELPERS MISC  //
//////////////////////

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

// Polyfill for CSS.escape usage
function cssEscape(ident) {
  if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(ident);
  return String(ident).replace(/[^a-zA-Z0-9_\-]/g, (c) => "\\" + c);
}

//////////////////////
// 9) BOOT          //
//////////////////////

(async function boot() {
  // initial skeleton exists in index.html. We replace it now.
  await loadLookups();
  renderApp();
  console.log("App mounted ✅");
})();
