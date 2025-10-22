// tabs/out.js (wired)
import { $, $$, STR, preloadLookups, bindPickerInputs,
         outSearch, outUpdate, toast, esc, openModal } from '../js/shared.js';

const PER_PAGE = 20;
const el = (html) => { const t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstElementChild; };
const fmtDate = (v) => v || '';

export default async function mountOut({ root, lang }){
  const S = STR[lang].out;
  await preloadLookups();

  root.innerHTML = '';
  root.appendChild(el(`
    <section class="glass" style="padding:1rem">
      <h2 style="margin:0 0 .5rem 0">${S.title}</h2>
      <div class="filters" style="display:grid; gap:.5rem; grid-template-columns: repeat(6, minmax(0,1fr)); align-items:end">
        <div><label>${S.project}</label><input id="fProject" data-src="projects" placeholder="${S.project}" /></div>
        <div><label>${S.contractor}</label><input id="fContractor" data-src="contractors" placeholder="${S.contractor}" /></div>
        <div><label>${S.requester}</label><input id="fRequester" data-src="requesters" placeholder="${S.requester}" /></div>
        <div><label>${S.material}</label><input id="fMaterial" data-src="materials" placeholder="${S.material}" /></div>
        <div><label>${S.from}</label><input type="date" id="fFrom" /></div>
        <div><label>${S.to}</label><input type="date" id="fTo" /></div>
        <div style="grid-column: span 6; display:flex; gap:.5rem; justify-content:flex-end">
          <button id="btnSearch" class="btn primary">${S.search}</button>
          <button id="btnReset" class="btn">${S.reset}</button>
        </div>
      </div>
    </section>
    <section class="glass" style="padding:.5rem 0; margin-top:.75rem">
      <div style="display:flex; align-items:center; padding:.5rem 1rem; gap:.5rem; border-bottom:1px solid rgba(0,0,0,.06)">
        <strong>${S.result}</strong>
        <span id="resultCount" class="chip">0</span>
        <div style="margin-left:auto; display:flex; gap:.5rem; align-items:center">
          <input id="quickSearch" placeholder="${S.material} / ${S.doc}" style="min-width:220px" />
        </div>
      </div>
      <div style="overflow:auto">
        <table class="tbl" id="outTbl">
          <thead>
            <tr>
              <th>${S.date}</th>
              <th>${S.doc}</th>
              <th>${S.project}</th>
              <th>${S.contractor}</th>
              <th>${S.requester}</th>
              <th>${S.material}</th>
              <th style="text-align:right">${S.qty}</th>
              <th>${S.unit}</th>
              <th>${S.location}</th>
              <th>${S.note}</th>
              <th>${S.actions}</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
      <div id="pager" style="display:flex; gap:.5rem; justify-content:flex-end; padding:.5rem 1rem">
        <button id="prevPg" class="btn" disabled>‹</button>
        <span id="pgInfo" class="meta"></span>
        <button id="nextPg" class="btn" disabled>›</button>
      </div>
    </section>
  `));

  bindPickerInputs(root, lang);

  const els = {
    fProject: $('#fProject', root),
    fContractor: $('#fContractor', root),
    fRequester: $('#fRequester', root),
    fMaterial: $('#fMaterial', root),
    fFrom: $('#fFrom', root),
    fTo: $('#fTo', root),
    btnSearch: $('#btnSearch', root),
    btnReset: $('#btnReset', root),
    quickSearch: $('#quickSearch', root),
    tbody: $('#outTbl tbody', root),
    resultCount: $('#resultCount', root),
    prevPg: $('#prevPg', root),
    nextPg: $('#nextPg', root),
    pgInfo: $('#pgInfo', root),
  };

  const state = { rows:[], total:0, page:1, per:PER_PAGE, filters:{} };

  function readFilters(){
    state.filters = {
      project: els.fProject.value.trim() || null,
      contractor: els.fContractor.value.trim() || null,
      requester: els.fRequester.value.trim() || null,
      material: els.fMaterial.value.trim() || null,
      from: els.fFrom.value || null,
      to: els.fTo.value || null,
      q: els.quickSearch.value.trim().toLowerCase() || null,
    };
  }

  async function doSearch(){
    readFilters();
    const res = await outSearch(state.filters, state.page, state.per);
    state.rows = res.rows || [];
    state.total = res.total || state.rows.length;
    state.page = 1; // reset to first page on new search
    renderTable();
  }

  function renderTable(){
    const start = (state.page-1)*state.per;
    const pageRows = state.rows.slice(start, start+state.per);
    els.tbody.innerHTML = pageRows.map(r => `
      <tr data-id="${esc(r.id)}">
        <td>${fmtDate(r.date)}</td>
        <td>${esc(r.docNo)}</td>
        <td>${esc(r.project)}</td>
        <td>${esc(r.contractor)}</td>
        <td>${esc(r.requester)}</td>
        <td>${esc(r.material)}</td>
        <td style="text-align:right">${r.qty ?? ''}</td>
        <td>${esc(r.unit || '')}</td>
        <td>${esc(r.location || '')}</td>
        <td>${esc(r.note || '')}</td>
        <td><button class="btn small" data-edit="${esc(r.id)}">${STR[lang].out.edit}</button></td>
      </tr>
    `).join('');
    $$('.btn.small[data-edit]', root).forEach(b => b.addEventListener('click', onEdit));

    const pages = Math.max(1, Math.ceil((state.total||0)/state.per));
    els.prevPg.disabled = state.page<=1;
    els.nextPg.disabled = state.page>=pages;
    els.pgInfo.textContent = `${state.page} / ${pages}`;
    els.resultCount.textContent = String(state.total || 0);
    if (!state.total){
      els.tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; opacity:.6; padding:.8rem">${STR[lang].out.noData}</td></tr>`;
    }
  }

  async function onEdit(e){
    const id = e.currentTarget.getAttribute('data-edit');
    const row = state.rows.find(r => String(r.id) === String(id));
    if (!row) return;
    const S = STR[lang].out;

    const modal = openModal(`
      <div class="modal-hd"><strong>${S.edit}: ${esc(row.docNo)}</strong></div>
      <div class="modal-bd">
        <div class="grid2">
          <label>${S.date}<input type="date" id="mDate" value="${esc(row.date||'')}"/></label>
          <label>${S.doc}<input id="mDoc" value="${esc(row.docNo||'')}"/></label>
          <label>${S.project}<input id="mProject" data-src="projects" value="${esc(row.project||'')}"/></label>
          <label>${S.contractor}<input id="mContractor" data-src="contractors" value="${esc(row.contractor||'')}"/></label>
          <label>${S.requester}<input id="mRequester" data-src="requesters" value="${esc(row.requester||'')}"/></label>
          <label>${S.material}<input id="mMaterial" data-src="materials" value="${esc(row.material||'')}"/></label>
          <label>${S.qty}<input id="mQty" type="number" step="1" min="0" value="${esc(row.qty ?? '')}"/></label>
          <label>${S.unit}<input id="mUnit" value="${esc(row.unit||'')}"/></label>
          <label>${S.location}<input id="mLoc" value="${esc(row.location||'')}"/></label>
          <label>${S.note}<input id="mNote" value="${esc(row.note||'')}"/></label>
        </div>
      </div>
      <div class="modal-ft">
        <button class="btn" data-cancel>${S.cancel}</button>
        <button class="btn primary" data-save>${S.save}</button>
      </div>
    `, {
      onOpen: (ov, close) => {
        bindPickerInputs(ov, lang);
        ov.querySelector('[data-cancel]').addEventListener('click', close);
        ov.querySelector('[data-save]').addEventListener('click', async () => {
          const patch = {
            id: row.id,
            date: ov.querySelector('#mDate').value || null,
            docNo: ov.querySelector('#mDoc').value.trim() || null,
            project: ov.querySelector('#mProject').value.trim() || null,
            contractor: ov.querySelector('#mContractor').value.trim() || null,
            requester: ov.querySelector('#mRequester').value.trim() || null,
            material: ov.querySelector('#mMaterial').value.trim() || null,
            qty: Number(ov.querySelector('#mQty').value || 0),
            unit: ov.querySelector('#mUnit').value.trim() || null,
            location: ov.querySelector('#mLoc').value.trim() || null,
            note: ov.querySelector('#mNote').value.trim() || null,
          };
          if (!patch.date || !patch.docNo || !patch.material){ toast(STR[lang].out.invalid); return; }
          try{
            const ok = await outUpdate(patch);
            if (!ok) throw new Error('update failed');
            toast(STR[lang].out.edited);
            // re-run search to get fresh view
            await doSearch();
            close();
          }catch(err){
            console.error('[out.update] error', err);
            toast('Update failed');
          }
        });
      }
    });
  }

  // events
  els.btnSearch.addEventListener('click', doSearch);
  els.btnReset.addEventListener('click', async () => {
    els.fProject.value = els.fContractor.value = els.fRequester.value = els.fMaterial.value = '';
    els.fFrom.value = els.fTo.value = ''; els.quickSearch.value='';
    await doSearch();
  });
  els.quickSearch.addEventListener('input', doSearch);
  els.prevPg.addEventListener('click', () => { if (state.page>1){ state.page--; renderTable(); } });
  els.nextPg.addEventListener('click', () => {
    const pages = Math.max(1, Math.ceil((state.total||0)/state.per));
    if (state.page<pages){ state.page++; renderTable(); }
  });

  // initial search
  await doSearch();
}
