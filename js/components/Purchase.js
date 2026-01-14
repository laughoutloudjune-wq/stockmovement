import { ref, computed, onMounted } from 'vue';
import { apiPost, apiGet, STR, toast, todayStr } from '../shared.js';
import ItemPicker from './ItemPicker.js';

export default {
  props: ['lang', 'user'], // We accept 'user' prop now
  components: { ItemPicker },
  setup(props) {
    const form = ref({ project: '', contractor: '', needBy: todayStr(), priority: 'Normal', note: '' });
    const lines = ref([{ name: '', qty: '' }]);
    
    // History State
    const history = ref([]);
    const historyLoading = ref(true);
    const expandedDoc = ref(null);
    const expandedLines = ref([]);
    const detailsLoading = ref(false);
    const loading = ref(false);

    const S = computed(() => STR[props.lang]);

    const addLine = () => lines.value.push({ name: '', qty: '' });
    const removeLine = (i) => lines.value.splice(i, 1);

    const submit = async () => {
      const validLines = lines.value.filter(l => l.name && l.qty).map(l => ({ name: l.name, qty: Number(l.qty) }));
      if (!validLines.length) return toast(props.lang==='th'?'กรุณาเพิ่มรายการ':'Add line');

      loading.value = true;
      try {
        const payload = { 
          type: 'PURCHASE', 
          ...form.value, 
          lines: validLines,
          // 🔒 AUTO-FILL REQUESTER FROM GOOGLE LOGIN
          requester: props.user.displayName || props.user.email,
          requesterEmail: props.user.email,
          requesterPhoto: props.user.photoURL
        };

        const res = await apiPost('submitPurchaseRequest', payload);
        if (res?.ok) {
          toast((props.lang==='th'?'ส่งคำขอแล้ว ':'Request sent ') + (res.docNo||''));
          lines.value = [{ name: '', qty: '' }]; 
          form.value.note = '';
          loadHistory(); 
        } else toast(res?.message || 'Error');
      } catch { toast('Failed to submit'); } 
      finally { loading.value = false; }
    };

    // --- History Logic (Same as before) ---
    const loadHistory = async () => {
      historyLoading.value = true;
      try {
        const res = await apiGet('pur_History', null, { cacheTtlMs: 20000 });
        history.value = Array.isArray(res) ? res : [];
      } catch { history.value = []; } 
      finally { historyLoading.value = false; }
    };

    const toggleExpand = async (doc) => {
      if (expandedDoc.value === doc.docNo) { expandedDoc.value = null; return; }
      expandedDoc.value = doc.docNo;
      expandedLines.value = [];
      detailsLoading.value = true;
      try {
        const res = await apiGet('pur_DocLines', { payload: { docNo: doc.docNo } });
        expandedLines.value = Array.isArray(res) ? res : [];
      } catch { toast('Failed to load details'); } 
      finally { detailsLoading.value = false; }
    };

    const updateStatus = async (doc, newStatus) => {
      // ... (Same status logic as before) ...
    };

    const statusColor = (s) => {
      s = (s || '').toLowerCase();
      if (s.includes('approve')) return 'bg-green-100 text-green-700';
      if (s.includes('cancel') || s.includes('reject')) return 'bg-red-100 text-red-700';
      if (s.includes('wait') || s.includes('request')) return 'bg-yellow-100 text-yellow-700';
      return 'bg-slate-100 text-slate-600';
    };

    onMounted(loadHistory);

    return { 
      S, form, lines, loading, 
      history, historyLoading, expandedDoc, expandedLines, detailsLoading,
      addLine, removeLine, submit, toggleExpand, updateStatus, statusColor 
    };
  },
  template: `
    <div class="space-y-6 pb-28">
      
      <section class="glass rounded-2xl p-5 shadow-sm space-y-4">
        <h3 class="font-bold text-lg text-slate-800">{{ S.tabs.pur }}</h3>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          <div class="min-w-0">
            <label class="text-xs font-bold text-slate-500 block mb-1">Requester</label>
            <div class="flex items-center gap-2 bg-blue-50/50 border border-blue-100 rounded-xl px-3 py-2.5">
              <img :src="user.photoURL" class="w-6 h-6 rounded-full border border-white shadow-sm" />
              <div class="flex flex-col">
                <span class="text-sm font-bold text-slate-700 leading-tight">{{ user.displayName }}</span>
                <span class="text-[10px] text-slate-400 leading-tight">{{ user.email }}</span>
              </div>
            </div>
          </div>

          <div class="min-w-0">
            <label class="text-xs font-bold text-slate-500 block mb-1">{{ S.purNeedBy }}</label>
            <input type="date" v-model="form.needBy" class="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none shadow-sm focus:ring-2 focus:ring-blue-500" />
          </div>
          
          <div class="min-w-0">
            <label class="text-xs font-bold text-slate-500 block mb-1">{{ S.purProj }}</label>
            <ItemPicker v-model="form.project" source="PROJECTS" :placeholder="S.pick" />
          </div>

          <div class="min-w-0">
            <label class="text-xs font-bold text-slate-500 block mb-1">{{ S.purContractor }}</label>
            <ItemPicker v-model="form.contractor" source="CONTRACTORS" :placeholder="S.pick" />
          </div>
          
          <div class="min-w-0">
             <label class="text-xs font-bold text-slate-500 block mb-1">{{ S.purPriority }}</label>
             <select v-model="form.priority" class="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none shadow-sm focus:ring-2 focus:ring-blue-500">
               <option value="Normal">Normal</option><option value="Urgent">Urgent</option><option value="Critical">Critical</option>
             </select>
          </div>
          <div class="md:col-span-2 min-w-0">
             <label class="text-xs font-bold text-slate-500 block mb-1">{{ S.purNote }}</label>
             <input v-model="form.note" class="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none shadow-sm focus:ring-2 focus:ring-blue-500" />
          </div>

        </div>
      </section>

      <div class="space-y-3">
        <div v-for="(line, idx) in lines" :key="idx" class="glass rounded-2xl p-4 shadow-sm relative animate-fade-in-up">
          <button @click="removeLine(idx)" class="absolute top-2 right-2 text-slate-400 hover:text-red-500 text-xl font-bold p-2">×</button>
          <div class="grid grid-cols-12 gap-3 mt-2">
            <div class="col-span-8 min-w-0"><ItemPicker v-model="line.name" source="MATERIALS" :placeholder="S.pick" /></div>
            <div class="col-span-4 min-w-0"><input type="number" v-model="line.qty" placeholder="Qty" class="w-full bg-white border border-slate-200 rounded-xl px-3 py-3 text-center font-bold outline-none shadow-sm focus:ring-2 focus:ring-blue-500" /></div>
          </div>
        </div>
      </div>
      
      <div class="flex justify-center">
        <button @click="addLine" class="px-6 py-3 rounded-full bg-white border border-slate-200 shadow-sm text-slate-600 font-bold hover:bg-slate-50 transition-all active:scale-95">+ {{ S.btnAdd }}</button>
      </div>

      <section class="mt-8 border-t border-slate-200/50 pt-6">
        <h3 class="font-bold text-lg text-slate-800 mb-4 px-2">{{ S.purOlder || 'History' }}</h3>
        <div v-if="historyLoading" class="space-y-3 animate-pulse"><div v-for="i in 3" class="h-20 bg-slate-200 rounded-xl"></div></div>
        <div v-else class="space-y-4">
          <div v-for="h in history" :key="h.docNo" class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
             <div @click="toggleExpand(h)" class="p-4 cursor-pointer hover:bg-slate-50 transition-colors">
               <div class="flex justify-between items-start mb-2 gap-2">
                 <div class="min-w-0 flex-1">
                   <div class="font-bold text-slate-800 text-sm truncate">{{ h.docNo }} • {{ h.project || '-' }}</div>
                   <div class="text-xs text-slate-500 mt-1 truncate">{{ h.ts }} • Need: {{ h.needBy }}</div>
                 </div>
                 <span class="px-2 py-1 rounded-lg text-[10px] uppercase font-extrabold tracking-wide whitespace-nowrap" :class="statusColor(h.status)">{{ h.status }}</span>
               </div>
             </div>
             <div v-if="expandedDoc === h.docNo" class="bg-slate-50 border-t border-slate-100 p-4">
                <table class="w-full text-sm">
                  <tbody class="divide-y divide-slate-100">
                    <tr v-for="li in expandedLines" :key="li.item">
                      <td class="py-2 pl-2 text-slate-700 break-words pr-2">{{ li.item }}</td>
                      <td class="py-2 text-right pr-2 font-mono font-bold">{{ li.qty }}</td>
                    </tr>
                  </tbody>
                </table>
             </div>
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
