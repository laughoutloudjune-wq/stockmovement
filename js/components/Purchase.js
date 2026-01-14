import { ref, computed, onMounted } from 'vue';
import { apiPost, apiGet, STR, toast, todayStr } from '../shared.js';
import ItemPicker from './ItemPicker.js';

export default {
  props: ['lang'],
  components: { ItemPicker },
  setup(props) {
    const form = ref({ project: '', contractor: '', needBy: todayStr(), priority: 'Normal', note: '' });
    const lines = ref([{ name: '', qty: '' }]);
    const history = ref([]);
    const loading = ref(false);
    const historyLoading = ref(true);
    const S = computed(() => STR[props.lang]);

    const addLine = () => lines.value.push({ name: '', qty: '' });
    const removeLine = (i) => lines.value.splice(i, 1);

    // Fetch History
    const loadHistory = async () => {
      historyLoading.value = true;
      try {
        const res = await apiGet('pur_History', null, { cacheTtlMs: 20000 });
        history.value = Array.isArray(res) ? res : [];
      } catch { history.value = []; } 
      finally { historyLoading.value = false; }
    };

    const submit = async () => {
      const validLines = lines.value.filter(l => l.name && l.qty).map(l => ({ name: l.name, qty: Number(l.qty) }));
      if (!validLines.length) return toast(props.lang==='th'?'กรุณาเพิ่มรายการ':'Add line');

      loading.value = true;
      try {
        const res = await apiPost('submitPurchaseRequest', { type: 'PURCHASE', ...form.value, lines: validLines });
        if (res?.ok) {
          toast((props.lang==='th'?'ส่งคำขอแล้ว ':'Request sent ') + (res.docNo||''));
          lines.value = [{ name: '', qty: '' }]; form.value.note = '';
          loadHistory(); // Refresh history
        } else toast(res?.message || 'Error');
      } catch { toast('Failed to submit'); } 
      finally { loading.value = false; }
    };

    onMounted(loadHistory);

    return { S, form, lines, history, loading, historyLoading, addLine, removeLine, submit };
  },
  template: `
    <div class="space-y-6 pb-24">
      <section class="glass rounded-2xl p-5 shadow-sm space-y-4">
        <h3 class="font-bold text-lg text-slate-800">{{ S.tabs.pur }}</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label class="text-xs font-bold text-slate-500 block mb-1">{{ S.purProj }}</label><ItemPicker v-model="form.project" source="PROJECTS" :placeholder="S.pick" /></div>
          <div><label class="text-xs font-bold text-slate-500 block mb-1">{{ S.purNeedBy }}</label><input type="date" v-model="form.needBy" class="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none shadow-sm" /></div>
          <div><label class="text-xs font-bold text-slate-500 block mb-1">{{ S.purContractor }}</label><ItemPicker v-model="form.contractor" source="CONTRACTORS" :placeholder="S.pick" /></div>
          <div>
            <label class="text-xs font-bold text-slate-500 block mb-1">{{ S.purPriority }}</label>
            <select v-model="form.priority" class="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none shadow-sm">
              <option value="Normal">Normal / ปกติ</option><option value="Urgent">Urgent / ด่วน</option><option value="Critical">Critical / วิกฤติ</option>
            </select>
          </div>
          <div class="md:col-span-2"><label class="text-xs font-bold text-slate-500 block mb-1">{{ S.purNote }}</label><input v-model="form.note" class="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none shadow-sm" /></div>
        </div>
      </section>

      <div class="space-y-3">
        <div v-for="(line, idx) in lines" :key="idx" class="glass rounded-2xl p-4 shadow-sm relative">
          <button @click="removeLine(idx)" class="absolute top-2 right-2 text-slate-400 hover:text-red-500 text-xl font-bold">×</button>
          <div class="grid grid-cols-12 gap-3 mt-2">
            <div class="col-span-8"><ItemPicker v-model="line.name" source="MATERIALS" :placeholder="S.pick" /></div>
            <div class="col-span-4"><input type="number" v-model="line.qty" placeholder="Qty" class="w-full bg-white border border-slate-200 rounded-xl px-3 py-3 text-center font-bold outline-none shadow-sm" /></div>
          </div>
        </div>
      </div>
      
      <div class="flex justify-center"><button @click="addLine" class="px-6 py-3 rounded-full bg-white border border-slate-200 shadow-sm text-slate-600 font-bold hover:bg-slate-50">+ {{ S.btnAdd }}</button></div>

      <section class="mt-8">
        <h3 class="font-bold text-lg text-slate-800 mb-4 px-2">{{ S.purOlder || 'History' }}</h3>
        <div v-if="historyLoading" class="space-y-3 animate-pulse"><div v-for="i in 3" class="h-16 bg-slate-200 rounded-xl"></div></div>
        <div v-else class="space-y-3">
          <div v-for="h in history" :key="h.docNo" class="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
            <div class="flex justify-between items-start mb-2">
              <div><div class="font-bold text-slate-800">{{ h.docNo }}</div><div class="text-xs text-slate-500">{{ h.project }} • {{ h.ts }}</div></div>
              <span class="px-2 py-1 rounded-lg text-xs font-bold" :class="{'bg-green-100 text-green-700':h.status==='Approved','bg-yellow-100 text-yellow-700':h.status==='Requested'}">{{ h.status }}</span>
            </div>
            <div class="text-xs text-slate-600 flex gap-4"><span>Lines: {{ h.lines }}</span><span>Qty: {{ h.totalQty }}</span></div>
          </div>
        </div>
      </section>

      <div class="fixed bottom-6 left-4 right-4 max-w-4xl mx-auto z-30">
        <button @click="submit" :disabled="loading" class="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold text-lg py-4 rounded-2xl shadow-xl shadow-blue-500/30 flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed">
          <span v-if="loading" class="animate-spin text-2xl">C</span><span v-else>💾 {{ S.btnSubmit }}</span>
        </button>
      </div>
    </div>
  `
};
