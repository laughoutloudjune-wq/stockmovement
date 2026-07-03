import { ref, computed, onMounted } from 'vue';
import { supabase } from '../supabase.js';
import { fetchMaterials } from '../data.js';

const todayStr = () => new Date().toISOString().slice(0, 10);
const thaiDate = (d) => new Date(d).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

export default {
  setup() {
    const loading = ref(true);
    const materials = ref([]);
    const todayCount = ref(0);
    const pendingPOs = ref(0);
    const openPOs = ref(0);
    const recent = ref([]);
    const chartDays = ref([]); // [{date, in, out}]

    const lowStock = computed(() => materials.value
      .filter(m => Number(m.stock || 0) <= Number(m.min || 0))
      .sort((a, b) => (a.stock / (a.min || 1)) - (b.stock / (b.min || 1)))
      .slice(0, 4));

    const load = async () => {
      loading.value = true;
      materials.value = await fetchMaterials();

      const today = todayStr();
      const { count: tCount } = await supabase.from('movements').select('id', { count: 'exact', head: true }).eq('type', 'OUT').eq('date', today);
      todayCount.value = tCount || 0;

      const { count: pCount } = await supabase.from('purchase_requests').select('id', { count: 'exact', head: true }).eq('status', 'รออนุมัติ');
      pendingPOs.value = pCount || 0;
      const { count: oCount } = await supabase.from('purchase_requests').select('id', { count: 'exact', head: true }).in('status', ['อนุมัติแล้ว', 'สั่งซื้อแล้ว']);
      openPOs.value = oCount || 0;

      const { data: recentRows } = await supabase.from('movements').select('*').eq('type', 'OUT').order('timestamp', { ascending: false }).limit(4);
      recent.value = recentRows || [];

      const since = new Date(); since.setDate(since.getDate() - 6);
      const sinceStr = since.toISOString().slice(0, 10);
      const { data: rangeRows } = await supabase.from('movements').select('date,type,qty').gte('date', sinceStr).lte('date', today);
      const byDate = {};
      for (let i = 0; i < 7; i++) {
        const d = new Date(since); d.setDate(d.getDate() + i);
        const key = d.toISOString().slice(0, 10);
        byDate[key] = { date: key, in: 0, out: 0 };
      }
      (rangeRows || []).forEach(r => {
        if (!byDate[r.date]) return;
        if (r.type === 'IN') byDate[r.date].in += Number(r.qty || 0);
        if (r.type === 'OUT') byDate[r.date].out += Number(r.qty || 0);
      });
      chartDays.value = Object.values(byDate);

      loading.value = false;
    };

    onMounted(load);

    // simple SVG area chart geometry
    const chartPath = (key) => {
      const days = chartDays.value;
      if (!days.length) return { line: '', area: '' };
      const max = Math.max(1, ...days.map(d => Math.max(d.in, d.out)));
      const w = 600, h = 140, stepX = w / (days.length - 1 || 1);
      const pts = days.map((d, i) => [i * stepX, h - (d[key] / max) * (h - 10) - 5]);
      const line = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
      const area = line + ` L${w},${h} L0,${h} Z`;
      return { line, area };
    };

    return { loading, materials, todayCount, pendingPOs, openPOs, lowStock, recent, chartDays, chartPath, thaiDate, todayStr };
  },
  template: `
  <div class="flex flex-col gap-5 animate-fade">
    <div class="topbar">
      <div>
        <h1 class="page-title">แดชบอร์ด</h1>
        <p class="text-sm text-secondary">{{ thaiDate(todayStr()) }} · ภาพรวมคลังวัสดุ</p>
      </div>
      <div class="search-field desktop-only">
        <span class="icon icon-sm text-tertiary">search</span>
        <input placeholder="ค้นหาวัสดุ, ใบเบิก..." />
      </div>
    </div>

    <div v-if="loading" class="text-center text-secondary p-6">กำลังโหลด...</div>

    <template v-else>
      <!-- KPI grid -->
      <div class="grid gap-4" style="grid-template-columns: repeat(auto-fit, minmax(220px,1fr));">
        <div class="glass-card kpi-card">
          <div class="kpi-row-top">
            <div class="kpi-icon-chip" style="background:var(--accent-dim);color:var(--accent);"><span class="icon icon-sm">inventory_2</span></div>
          </div>
          <div class="kpi-number">{{ todayCount }}</div>
          <div class="kpi-caption">รายการเบิกวันนี้</div>
        </div>
        <div class="glass-card kpi-card">
          <div class="kpi-row-top">
            <div class="kpi-icon-chip" style="background:var(--warning-dim);color:var(--warning-text);"><span class="icon icon-sm">schedule</span></div>
            <span class="pill pill-accent">ดูทั้งหมด →</span>
          </div>
          <div class="kpi-number">{{ pendingPOs }}</div>
          <div class="kpi-caption">จัดซื้อรออนุมัติ</div>
        </div>
        <div class="glass-card kpi-card">
          <div class="kpi-row-top">
            <div class="kpi-icon-chip" style="background:var(--danger-dim);color:var(--danger-text);"><span class="icon icon-sm">warning</span></div>
            <span v-if="lowStock.length" class="pill pill-danger">ต้องสั่งซื้อ</span>
          </div>
          <div class="kpi-number">{{ materials.filter(m => Number(m.stock||0) <= Number(m.min||0)).length }}</div>
          <div class="kpi-caption">วัสดุใกล้หมด</div>
        </div>
        <div class="glass-card kpi-card">
          <div class="kpi-row-top">
            <div class="kpi-icon-chip" style="background:var(--purple-dim);color:var(--purple);"><span class="icon icon-sm">local_shipping</span></div>
          </div>
          <div class="kpi-number">{{ openPOs }}</div>
          <div class="kpi-caption">ใบสั่งซื้อค้างส่ง</div>
        </div>
      </div>

      <!-- Chart + low stock -->
      <div class="split-1-55">
        <div class="glass-card">
          <div class="flex items-center justify-between mb-4">
            <h3 class="card-title">ความเคลื่อนไหวสต๊อก</h3>
            <div class="flex gap-3 text-xs text-secondary">
              <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--accent);margin-right:4px;"></span>รับเข้า</span>
              <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--success);margin-right:4px;"></span>เบิกออก</span>
            </div>
          </div>
          <svg viewBox="0 0 600 140" style="width:100%; height:160px;">
            <path :d="chartPath('in').area" fill="var(--accent)" opacity="0.12"></path>
            <path :d="chartPath('in').line" fill="none" stroke="var(--accent)" stroke-width="2.5"></path>
            <path :d="chartPath('out').area" fill="var(--success)" opacity="0.12"></path>
            <path :d="chartPath('out').line" fill="none" stroke="var(--success)" stroke-width="2.5"></path>
          </svg>
          <div class="flex justify-between text-xs text-tertiary mt-2">
            <span v-for="d in chartDays" :key="d.date">{{ new Date(d.date).getDate() }}</span>
          </div>
        </div>

        <div class="glass-card">
          <h3 class="card-title mb-4">วัสดุใกล้หมด</h3>
          <div v-if="lowStock.length===0" class="text-sm text-secondary">ไม่มีรายการใกล้หมด</div>
          <div v-for="m in lowStock" :key="m.id" class="mb-3">
            <div class="flex justify-between text-sm mb-1">
              <span class="text-primary font-medium truncate">{{ m.name }}</span>
              <span class="text-danger font-semibold">{{ m.stock }} / {{ m.min }}</span>
            </div>
            <div class="progress-track"><div class="progress-fill bg-danger" :style="{width: Math.min(100, (m.stock/(m.min||1))*100) + '%'}"></div></div>
          </div>
        </div>
      </div>

      <!-- Recent requests -->
      <div class="glass-card">
        <div class="flex items-center justify-between mb-3">
          <h3 class="card-title">รายการเบิกล่าสุด</h3>
        </div>
        <div class="table-wrapper">
          <table>
            <thead><tr><th>เลขที่ใบเบิก</th><th>วัสดุ</th><th>โครงการ</th><th>จำนวน</th><th>สถานะ</th></tr></thead>
            <tbody>
              <tr v-for="r in recent" :key="r.id">
                <td class="mono">{{ r.doc_no }}</td>
                <td>{{ r.material_name }}</td>
                <td>{{ r.project || '—' }}</td>
                <td>{{ r.qty }}</td>
                <td><span class="pill" :class="r.status==='จ่ายแล้ว' ? 'pill-success' : 'pill-accent'">{{ r.status }}</span></td>
              </tr>
              <tr v-if="recent.length===0"><td colspan="5" class="text-center text-secondary">ยังไม่มีรายการ</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
  `
};
