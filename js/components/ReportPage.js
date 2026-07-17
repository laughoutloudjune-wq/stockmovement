import { ref, computed, onMounted } from 'vue';
import { supabase } from '../supabase.js';
import { fetchProjects, fetchContractors } from '../data.js';
import ItemPickerModal from './ItemPickerModal.js';

const todayStr = () => new Date().toISOString().slice(0, 10);
const monthStart = () => todayStr().slice(0, 8) + '01';

export default {
  components: { ItemPickerModal },
  setup() {
    const projects = ref([]);
    const contractors = ref([]);
    const start = ref(monthStart());
    const end = ref(todayStr());
    const projectFilter = ref('');
    const contractorFilter = ref('');
    const material = ref(null);
    const pickerOpen = ref(false);
    const loading = ref(false);
    const ledgerRows = ref([]); // {date, docNo, type, description, in, out, balance, isOpening, isClosing}
    const recentRows = ref([]);

    onMounted(async () => {
      [projects.value, contractors.value] = await Promise.all([fetchProjects(), fetchContractors()]);
      await loadRecent();
    });

    const signedQty = (m) => (m.type === 'OUT' ? -Number(m.qty || 0) : Number(m.qty || 0));

    const description = (m) => {
      if (m.type === 'OUT') return 'เบิก · ' + (m.project || '—');
      if (m.type === 'IN') return 'รับเข้าจากจัดซื้อ' + (m.contractor ? ' · ' + m.contractor : '');
      if (m.type === 'ADJUST') return 'ปรับสต็อก' + (m.note ? ' · ' + m.note : '');
      return m.type;
    };

    const loadRecent = async () => {
      loading.value = true;
      try {
        let q = supabase.from('movements').select('*').gte('date', start.value).lte('date', end.value).order('timestamp', { ascending: false }).limit(100);
        const { data } = await q;
        let rows = data || [];
        if (projectFilter.value) {
          const p = projects.value.find(p => p.id === projectFilter.value);
          if (p) rows = rows.filter(r => r.project === p.name);
        }
        if (contractorFilter.value) {
          const c = contractors.value.find(c => c.id === contractorFilter.value);
          if (c) rows = rows.filter(r => r.contractor === c.name);
        }
        recentRows.value = rows;
        expandedDocs.value = {};
      } finally { loading.value = false; }
    };

    // Group every line item that shares a doc_no into one "invoice" card —
    // a single request/purchase/adjustment can cover several materials.
    const expandedDocs = ref({});
    const toggleDoc = (key) => { expandedDocs.value[key] = !expandedDocs.value[key]; };
    const groupedRecent = computed(() => {
      const map = new Map();
      for (const r of recentRows.value) {
        const key = r.doc_no || r.id;
        if (!map.has(key)) {
          map.set(key, {
            key, doc_no: r.doc_no, type: r.type, date: r.date, timestamp: r.timestamp,
            project: r.project, sub_project: r.sub_project, contractor: r.contractor,
            requester: r.requester, note: r.note, items: []
          });
        }
        map.get(key).items.push({ material_name: r.material_name, qty: r.qty });
      }
      return Array.from(map.values()).sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
    });

    const search = async () => {
      if (!material.value) return;
      loading.value = true;
      try {
        const { data: mat } = await supabase.from('materials').select('stock').eq('id', material.value.id).single();
        const { data: all } = await supabase.from('movements').select('*').eq('material_id', material.value.id).order('timestamp', { ascending: true });
        const rows = all || [];
        const totalDelta = rows.reduce((s, m) => s + signedQty(m), 0);
        let running = Number(mat.stock || 0) - totalDelta; // balance before the very first movement

        const withBalance = rows.map(m => {
          running += signedQty(m);
          return { ...m, balance: running };
        });

        const inRange = withBalance.filter(m => {
          if (m.date < start.value || m.date > end.value) return false;
          if (projectFilter.value) {
            const p = projects.value.find(p => p.id === projectFilter.value);
            if (p && m.project !== p.name) return false;
          }
          if (contractorFilter.value) {
            const c = contractors.value.find(c => c.id === contractorFilter.value);
            if (c && m.contractor !== c.name) return false;
          }
          return true;
        });

        const openingBalance = inRange.length ? inRange[0].balance - signedQty(inRange[0]) : Number(mat.stock || 0);
        const closingBalance = inRange.length ? inRange[inRange.length - 1].balance : openingBalance;

        const result = [{ isOpening: true, date: start.value, balance: openingBalance }];
        inRange.forEach(m => result.push({
          date: m.date, docNo: m.doc_no, type: m.type, description: description(m),
          in: m.type !== 'OUT' && signedQty(m) > 0 ? signedQty(m) : 0,
          out: m.type === 'OUT' ? Math.abs(signedQty(m)) : (signedQty(m) < 0 ? Math.abs(signedQty(m)) : 0),
          balance: m.balance,
          requester: m.requester || null,
          contractor: m.contractor || null,
          project: [m.project, m.sub_project].filter(Boolean).join(' › ') || null
        }));
        result.push({ isClosing: true, date: end.value, balance: closingBalance });
        ledgerRows.value = result;
      } finally { loading.value = false; }
    };

    const dataRows = computed(() => ledgerRows.value.filter(r => !r.isOpening && !r.isClosing));
    const totalIn = computed(() => dataRows.value.reduce((s, r) => s + (r.type === 'IN' ? r.in : 0), 0));
    const totalOut = computed(() => dataRows.value.reduce((s, r) => s + r.out, 0));
    const totalAdj = computed(() => dataRows.value.reduce((s, r) => s + (r.type === 'ADJUST' ? (r.in - r.out) : 0), 0));
    const opening = computed(() => ledgerRows.value.find(r => r.isOpening)?.balance ?? 0);
    const closing = computed(() => ledgerRows.value.find(r => r.isClosing)?.balance ?? 0);

    const selectMaterial = (m) => { material.value = m; search(); };
    const clearMaterial = () => { material.value = null; ledgerRows.value = []; loadRecent(); };
    const runSearch = () => { material.value ? search() : loadRecent(); };

    const exportExcel = () => {
      if (material.value) {
        if (!ledgerRows.value.length) return;
        let csv = '﻿วันที่,เอกสาร,รายการ,ผู้ทำรายการ,โครงการ,ผู้รับเหมา,รับเข้า,จ่ายออก,คงเหลือ\n';
        ledgerRows.value.forEach(r => {
          const label = r.isOpening ? 'ยอดยกมา (Opening Balance)' : (r.isClosing ? 'คงเหลือปลายงวด (Closing)' : r.description);
          csv += [r.date, r.docNo || '', label, r.requester || '', r.project || '', r.contractor || '', r.in || '', r.out || '', r.balance].join(',') + '\n';
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `report_${material.value.name}_${start.value}_${end.value}.csv`;
        link.click();
      } else {
        if (!recentRows.value.length) return;
        let csv = '﻿วันที่,เอกสาร,ประเภท,วัสดุ,โครงการ,จำนวน\n';
        recentRows.value.forEach(r => {
          csv += [r.date, r.doc_no || '', r.type, r.material_name || '', r.project || '', r.qty].join(',') + '\n';
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `report_movements_${start.value}_${end.value}.csv`;
        link.click();
      }
    };

    const typePill = (t) => ({ IN: 'pill-success', OUT: 'pill-danger', ADJUST: 'pill-warning' }[t] || 'pill-neutral');

    return { projects, contractors, start, end, projectFilter, contractorFilter, material, pickerOpen,
             loading, ledgerRows, recentRows, groupedRecent, expandedDocs, toggleDoc, search, selectMaterial, clearMaterial, runSearch,
             totalIn, totalOut, totalAdj, opening, closing, exportExcel, typePill };
  },
  template: `
  <div class="flex flex-col gap-5 animate-fade">
    <div class="flex items-center justify-between flex-wrap gap-2">
      <div>
        <h1 class="page-title">รายงานความเคลื่อนไหววัสดุ</h1>
        <p class="text-sm text-secondary">บัญชีคุมสต๊อก (Stock Ledger) แบบรายวัสดุ</p>
      </div>
      <button class="btn btn-surface" :disabled="material ? ledgerRows.length===0 : recentRows.length===0" @click="exportExcel"><span class="icon icon-sm">download</span>ส่งออก Excel</button>
    </div>

    <div class="glass-card">
      <div class="grid gap-3" style="grid-template-columns: repeat(auto-fit, minmax(160px,1fr));">
        <div class="input-group" style="grid-column: span 2; min-width: 320px;">
          <label class="input-label">ช่วงเวลา</label>
          <div class="flex gap-2">
            <input type="date" v-model="start" class="input-field" style="min-width:0;" />
            <input type="date" v-model="end" class="input-field" style="min-width:0;" />
          </div>
        </div>
        <div class="input-group">
          <label class="input-label">วัสดุ</label>
          <div class="input-field flex items-center justify-between" style="cursor:pointer;" @click="pickerOpen=true">
            <span :class="material ? 'text-primary' : 'text-tertiary'" class="truncate">{{ material ? material.name : 'ทุกวัสดุ (ล่าสุด)' }}</span>
            <span v-if="material" class="icon icon-sm text-tertiary" style="flex-shrink:0;" @click.stop="clearMaterial">close</span>
            <span v-else class="icon icon-sm text-tertiary" style="flex-shrink:0;">search</span>
          </div>
        </div>
        <div class="input-group">
          <label class="input-label">โครงการ</label>
          <select v-model="projectFilter" class="input-field"><option value="">ทุกโครงการ</option><option v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }}</option></select>
        </div>
        <div class="input-group">
          <label class="input-label">ผู้รับเหมา</label>
          <select v-model="contractorFilter" class="input-field"><option value="">ทั้งหมด</option><option v-for="c in contractors" :key="c.id" :value="c.id">{{ c.name }}</option></select>
        </div>
        <div class="input-group" style="justify-content:flex-end;">
          <button class="btn btn-primary" :disabled="loading" @click="runSearch">
            <span v-if="loading" class="icon animate-spin icon-sm">refresh</span>ค้นหา
          </button>
        </div>
      </div>
    </div>

    <!-- Per-material ledger -->
    <template v-if="material">
      <template v-if="ledgerRows.length">
        <div class="grid-5">
          <div class="glass-card"><div class="text-xs text-secondary mb-1">ยอดยกมา</div><div class="font-bold text-lg">{{ opening }}</div></div>
          <div class="glass-card"><div class="text-xs text-secondary mb-1">รับเข้า</div><div class="font-bold text-lg text-success">+{{ totalIn }}</div></div>
          <div class="glass-card"><div class="text-xs text-secondary mb-1">เบิกออก</div><div class="font-bold text-lg text-danger">-{{ totalOut }}</div></div>
          <div class="glass-card"><div class="text-xs text-secondary mb-1">ปรับปรุง</div><div class="font-bold text-lg text-warning">{{ totalAdj>0?'+':'' }}{{ totalAdj }}</div></div>
          <div class="glass-card"><div class="text-xs text-secondary mb-1">คงเหลือปลายงวด</div><div class="font-bold text-lg text-accent">{{ closing }}</div></div>
        </div>

        <div class="glass-card desktop-only">
          <div class="table-wrapper">
            <table>
              <thead><tr><th>วันที่</th><th>เอกสาร</th><th>รายการ</th><th>ผู้ทำรายการ</th><th>โครงการ</th><th>ผู้รับเหมา</th><th>รับเข้า</th><th>จ่ายออก</th><th>คงเหลือ</th></tr></thead>
              <tbody>
                <tr v-for="(r,i) in ledgerRows" :key="i" :class="r.isClosing ? 'row-closing' : ''">
                  <td>{{ r.date }}</td>
                  <td class="mono text-accent">{{ r.docNo || '—' }}</td>
                  <td>{{ r.isOpening ? 'ยอดยกมา (Opening Balance)' : (r.isClosing ? 'คงเหลือปลายงวด (Closing)' : r.description) }}</td>
                  <td>{{ r.requester || '—' }}</td>
                  <td>{{ r.project || '—' }}</td>
                  <td>{{ r.contractor || '—' }}</td>
                  <td class="text-success">{{ r.in ? '+'+r.in : '' }}</td>
                  <td class="text-danger">{{ r.out ? '-'+r.out : '' }}</td>
                  <td class="font-bold">{{ r.balance }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="mobile-only flex flex-col gap-2">
          <div v-for="(r,i) in ledgerRows" :key="i" class="glass-panel" style="padding:12px;">
            <div class="flex justify-between text-sm">
              <span class="mono text-accent">{{ r.docNo || (r.isOpening ? 'เปิดยอด' : 'ปิดยอด') }}</span>
              <span class="text-tertiary">{{ r.date }}</span>
            </div>
            <div class="text-sm text-primary mt-1">{{ r.isOpening ? 'ยอดยกมา' : (r.isClosing ? 'คงเหลือปลายงวด' : r.description) }}</div>
            <div v-if="r.requester || r.project || r.contractor" class="text-xs text-secondary mt-1">
              <span v-if="r.requester">{{ r.requester }}</span>
              <span v-if="r.project"> · {{ r.project }}</span>
              <span v-if="r.contractor"> · {{ r.contractor }}</span>
            </div>
            <div class="flex justify-between items-center mt-1">
              <span :class="r.in ? 'text-success' : (r.out ? 'text-danger' : 'text-tertiary')">{{ r.in ? '+'+r.in : (r.out ? '-'+r.out : '—') }}</span>
              <span class="font-bold">คงเหลือ {{ r.balance }}</span>
            </div>
          </div>
        </div>
      </template>
      <div v-else class="text-center text-secondary text-sm p-8">ไม่มีข้อมูลในช่วงเวลาที่เลือก</div>
    </template>

    <!-- Default: latest movement history (all materials), grouped into one card per document -->
    <template v-else>
      <div class="flex flex-col gap-3">
        <div v-for="g in groupedRecent" :key="g.key" class="glass-card" style="padding:0; overflow:hidden;">
          <div class="p-4 cursor-pointer select-none" @click="toggleDoc(g.key)">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div class="flex items-center gap-3">
                <span class="mono text-sm font-semibold text-accent">{{ g.doc_no || '—' }}</span>
                <span class="pill" :class="typePill(g.type)">{{ g.type }}</span>
              </div>
              <span class="text-xs text-tertiary">{{ g.date }}</span>
            </div>
            <div class="flex items-center justify-between mt-2 gap-3">
              <div class="text-sm text-secondary truncate">
                <span class="text-primary font-medium">{{ g.items[0].material_name }}</span>
                <span v-if="g.items.length>1"> + อีก {{ g.items.length-1 }} รายการ</span>
              </div>
              <span class="icon icon-sm text-tertiary" style="flex-shrink:0; transition: transform .2s;" :style="expandedDocs[g.key] ? 'transform:rotate(180deg);' : ''">expand_more</span>
            </div>
          </div>

          <div v-if="expandedDocs[g.key]" class="animate-fade" style="border-top:1px solid var(--divider); background:var(--field);">
            <div class="p-4 grid gap-3" style="grid-template-columns: repeat(auto-fit, minmax(140px,1fr));">
              <div>
                <div class="text-xs text-tertiary mb-1">ผู้ขอ/ผู้ทำรายการ</div>
                <div class="text-sm font-medium text-primary">{{ g.requester || '—' }}</div>
              </div>
              <div>
                <div class="text-xs text-tertiary mb-1">โครงการ</div>
                <div class="text-sm font-medium text-primary">{{ [g.project, g.sub_project].filter(Boolean).join(' › ') || '—' }}</div>
              </div>
              <div>
                <div class="text-xs text-tertiary mb-1">ผู้รับเหมา</div>
                <div class="text-sm font-medium text-primary">{{ g.contractor || '—' }}</div>
              </div>
            </div>
            <div v-if="g.note" class="px-4 pb-3 text-xs text-secondary">หมายเหตุ: {{ g.note }}</div>
            <div class="px-4 pb-4 flex flex-col gap-2">
              <div v-for="(item,idx) in g.items" :key="idx" class="flex items-center justify-between" style="padding:8px 12px; background:var(--panel); border-radius:12px;">
                <span class="text-sm text-primary">{{ item.material_name }}</span>
                <span :class="g.type==='OUT' ? 'text-danger' : (g.type==='IN' ? 'text-success' : (item.qty > 0 ? 'text-success' : (item.qty < 0 ? 'text-danger' : 'text-secondary')))" class="font-bold text-sm">{{ g.type==='OUT' ? '-'+item.qty : (g.type==='IN' ? '+'+item.qty : (item.qty > 0 ? '+'+item.qty : item.qty)) }}</span>
              </div>
            </div>
          </div>
        </div>
        <div v-if="groupedRecent.length===0" class="text-center text-secondary text-sm p-8">ไม่มีรายการในช่วงเวลาที่เลือก</div>
      </div>
    </template>

    <ItemPickerModal v-if="pickerOpen" :multiple="false" @close="pickerOpen=false" @select="selectMaterial" />
  </div>
  `
};
