import { ref, computed, onMounted } from 'vue';
import { supabase } from '../supabase.js';
import { fetchMaterials, docNo } from '../data.js';
import { toast, toastError } from '../toast.js';

export default {
  props: ['requester'],
  setup(props) {
    const materials = ref([]);
    const counted = ref({}); // materialId -> value (string)
    const search = ref('');
    const saving = ref(false);

    onMounted(async () => { materials.value = await fetchMaterials(); });

    const filtered = computed(() => {
      const q = search.value.trim().toLowerCase();
      if (!q) return materials.value;
      return materials.value.filter(m => m.name.toLowerCase().includes(q));
    });

    const diff = (m) => {
      const c = counted.value[m.id];
      if (c === undefined || c === '' || c === null) return null;
      return Number(c) - Number(m.stock || 0);
    };

    const countedList = computed(() => materials.value.filter(m => counted.value[m.id] !== undefined && counted.value[m.id] !== ''));
    const changedList = computed(() => countedList.value.filter(m => diff(m) !== 0));
    const netDiff = computed(() => changedList.value.reduce((s, m) => s + diff(m), 0));

    const save = async () => {
      if (changedList.value.length === 0) return;
      saving.value = true;
      try {
        const no = docNo('ADJ');
        for (const m of changedList.value) {
          const newStock = Number(counted.value[m.id]);
          const d = newStock - Number(m.stock || 0);
          const { error: updErr } = await supabase.from('materials').update({ stock: newStock }).eq('id', m.id);
          if (updErr) throw updErr;
          const { error: insErr } = await supabase.from('movements').insert({
            type: 'ADJUST', doc_no: no, date: new Date().toISOString().slice(0, 10), timestamp: new Date().toISOString(),
            material_id: m.id, material_name: m.name, qty: d, prev_stock: m.stock, new_stock: newStock,
            requester: props.requester?.name || null, status: 'บันทึกแล้ว'
          });
          if (insErr) throw insErr;
        }
        toast('บันทึกการปรับปรุงแล้ว');
        materials.value = await fetchMaterials();
        counted.value = {};
      } catch (e) {
        toastError(e, 'บันทึกไม่สำเร็จ');
      } finally { saving.value = false; }
    };

    return { materials, filtered, counted, search, diff, countedList, changedList, netDiff, saving, save };
  },
  template: `
  <div class="flex flex-col gap-5 animate-fade">
    <div class="topbar">
      <div>
        <h1 class="page-title">ปรับสต๊อก (นับสต็อก)</h1>
        <p class="text-sm text-secondary">กรอกยอดนับจริง ระบบคำนวณผลต่างให้อัตโนมัติ</p>
      </div>
      <div class="flex gap-3 items-center">
        <div class="search-field desktop-only"><span class="icon icon-sm text-tertiary">search</span><input v-model="search" placeholder="ค้นหาวัสดุ..." /></div>
        <button class="btn btn-primary" :disabled="changedList.length===0 || saving" @click="save">
          <span v-if="saving" class="icon animate-spin icon-sm">refresh</span>บันทึกการปรับปรุง
        </button>
      </div>
    </div>
    <div class="search-field mobile-only w-full"><span class="icon icon-sm text-tertiary">search</span><input v-model="search" placeholder="ค้นหาวัสดุ..." /></div>

    <div class="grid-3">
      <div class="glass-card">
        <div class="text-xs text-secondary mb-1">รายการที่นับ</div>
        <div class="kpi-number" style="font-size:26px;">{{ countedList.length }} / {{ materials.length }}</div>
      </div>
      <div class="glass-card">
        <div class="text-xs text-secondary mb-1">มีผลต่าง</div>
        <div class="kpi-number text-warning" style="font-size:26px;">{{ changedList.length }} รายการ</div>
      </div>
      <div class="glass-card">
        <div class="text-xs text-secondary mb-1">ขาด/เกินสุทธิ</div>
        <div class="kpi-number" :class="netDiff < 0 ? 'text-danger' : 'text-success'" style="font-size:26px;">{{ netDiff > 0 ? '+' : '' }}{{ netDiff }} หน่วย</div>
      </div>
    </div>

    <!-- Desktop table -->
    <div class="glass-card desktop-only">
      <div class="table-wrapper">
        <table>
          <thead><tr><th>วัสดุ</th><th>คงเหลือในระบบ</th><th>นับจริง</th><th>ผลต่าง</th></tr></thead>
          <tbody>
            <tr v-for="m in filtered" :key="m.id" :class="diff(m) > 0 ? 'row-tint-success' : (diff(m) < 0 ? 'row-tint-danger' : '')">
              <td>{{ m.name }}</td>
              <td>{{ m.stock }}</td>
              <td><input class="input-field" style="max-width:110px;height:38px;padding:6px 10px;" type="number" v-model="counted[m.id]" placeholder="—" /></td>
              <td>
                <span v-if="diff(m)===null" class="text-tertiary">—</span>
                <span v-else :class="diff(m) > 0 ? 'text-success' : (diff(m) < 0 ? 'text-danger' : 'text-secondary')" class="font-semibold">{{ diff(m) > 0 ? '+' : '' }}{{ diff(m) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Mobile cards -->
    <div class="mobile-only flex flex-col gap-3">
      <div v-for="m in filtered" :key="m.id" class="glass-panel" style="padding:14px;">
        <div class="flex justify-between items-start mb-2">
          <div class="font-semibold text-primary">{{ m.name }}</div>
          <span v-if="diff(m)!==null" class="pill" :class="diff(m) > 0 ? 'pill-success' : (diff(m) < 0 ? 'pill-danger' : 'pill-neutral')">{{ diff(m) > 0 ? '+' : '' }}{{ diff(m) }}</span>
        </div>
        <div class="flex items-center justify-between text-sm text-secondary">
          <span>ในระบบ: {{ m.stock }}</span>
          <span>→</span>
          <input class="input-field" style="max-width:110px;height:40px;" type="number" v-model="counted[m.id]" placeholder="นับจริง" />
        </div>
      </div>
    </div>
  </div>
  `
};
