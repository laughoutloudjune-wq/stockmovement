import { ref, computed } from 'vue';
import { apiPost, STR, todayStr, toast } from '../shared.js';
import ItemPicker from './ItemPicker.js';

export default {
  props: ['lang'],
  components: { ItemPicker },
  setup(props) {
    const filters = ref({ start: todayStr().slice(0,8)+'01', end: todayStr(), material: '', project: '', type: '' });
    const results = ref([]);
    const loading = ref(false);
    const S = computed(() => STR[props.lang]);

    const generate = async () => {
      loading.value = true;
      results.value = [];
      try {
        const res = await apiPost('getMovementReport', filters.value);
        if (res?.ok && Array.isArray(res.data)) {
          results.value = res.data;
          if (!results.value.length) toast(props.lang==='th'?'ไม่พบข้อมูล':'No data');
        } else toast('Error loading report');
      } catch { toast('Failed to load'); } 
      finally { loading.value = false; }
    };

    return { S, filters, results, loading, generate };
  },
  template: `
    <div class="space-y-6 pb-20">
      <section class="glass rounded-2xl p-5 shadow-sm space-y-4">
        <h3 class="font-bold text-lg text-slate-800">{{ S.tabs.report }}</h3>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="text-xs font-bold text-slate-500 block mb-1">Start</label><input type="date" v-model="filters.start" class="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none shadow-sm" /></div>
          <div><label class="text-xs font-bold text-slate-500 block mb-1">End</label><input type="date" v-model="filters.end" class="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none shadow-sm" /></div>
          <div class="col-span-2"><label class="text-xs font-bold text-slate-500 block mb-1">Material</label><ItemPicker v-model="filters.material" source="MATERIALS" placeholder="All Materials" /></div>
          <div><label class="text-xs font-bold text-slate-500 block mb-1">Type</label><select v-model="filters.type" class="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none shadow-sm"><option value="">All</option><option value="IN">IN</option><option value="OUT">OUT</option><option value="ADJUST">ADJUST</option></select></div>
          <div><label class="text-xs font-bold text-slate-500 block mb-1">Project</label><ItemPicker v-model="filters.project" source="PROJECTS" placeholder="All Projects" /></div>
        </div>
        <button @click="generate" :disabled="loading" class="w-full bg-blue-500 text-white font-bold py-3 rounded-xl shadow-md active:scale-95 transition-transform flex justify-center">
          <span v-if="loading" class="animate-spin text-xl">C</span><span v-else>Generate Report</span>
        </button>
      </section>

      <div v-if="results.length" class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <table class="w-full text-sm text-left">
          <thead class="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
            <tr><th class="p-3">Date</th><th class="p-3">Type</th><th class="p-3">Detail</th><th class="p-3 text-right">Qty</th></tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="(r, i) in results" :key="i" class="hover:bg-slate-50">
              <td class="p-3 whitespace-nowrap text-xs text-slate-500 align-top">{{ r.date }}</td>
              <td class="p-3 align-top"><span class="px-2 py-0.5 rounded text-[10px] font-bold" :class="{'bg-green-100 text-green-700':r.type==='IN','bg-red-100 text-red-700':r.type==='OUT','bg-yellow-100 text-yellow-700':r.type==='ADJUST'}">{{ r.type }}</span></td>
              <td class="p-3 align-top"><div class="font-bold text-slate-700">{{ r.item }}</div><div class="text-xs text-slate-400">{{ r.project }} • {{ r.by }}</div></td>
              <td class="p-3 text-right font-bold text-slate-700 align-top">{{ r.qty }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `
};
