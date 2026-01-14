import { ref, computed } from 'vue';
import { apiPost, apiGet, STR, toast, todayStr } from '../shared.js';
import ItemPicker from './ItemPicker.js';

export default {
  props: ['lang'],
  components: { ItemPicker },
  setup(props) {
    const form = ref({ date: todayStr(), project: '', contractor: '', requester: '', note: '' });
    const lines = ref([{ name: '', qty: '', note: '', stock: null, stockLoading: false }]);
    const loading = ref(false);
    const S = computed(() => STR[props.lang]);

    const addLine = () => lines.value.push({ name: '', qty: '', note: '', stock: null, stockLoading: false });
    const removeLine = (index) => lines.value.splice(index, 1);

    const onMaterialSelect = async (line) => {
      if (!line.name) return;
      line.stockLoading = true;
      try {
        const res = await apiGet('getCurrentStock', { material: line.name });
        if (res && res.ok) {
          const s = Number(res.stock);
          const m = Number(res.min || 0);
          let color = 'bg-green-100 text-green-700';
          if (s <= 0 || s <= m) color = 'bg-red-100 text-red-700';
          else if (s <= 2 * m) color = 'bg-yellow-100 text-yellow-700';
          line.stock = { val: s, color };
        }
      } catch (e) { console.error(e); } 
      finally { line.stockLoading = false; }
    };

    const submit = async () => {
      const validLines = lines.value.filter(l => l.name && l.qty).map(l => ({ name: l.name, qty: Number(l.qty), note: l.note }));
      if (validLines.length === 0) {
        toast(props.lang === 'th' ? 'กรุณาเพิ่มรายการ' : 'Add at least one line');
        return;
      }
      loading.value = true;
      try {
        const payload = { type: 'OUT', ...form.value, lines: validLines };
        const res = await apiPost('submitMovementBulk', payload);
        if (res && res.ok) {
          toast((props.lang === 'th' ? 'บันทึกแล้ว • เอกสาร ' : 'Saved • Doc ') + (res.docNo || ''));
          lines.value = [{ name: '', qty: '', note: '', stock: null }];
          form.value.note = ''; form.value.project = ''; form.value.contractor = ''; form.value.requester = '';
        } else toast(res?.message || 'Error');
      } catch (e) { toast('Failed to submit'); } 
      finally { loading.value = false; }
    };

    return { S, form, lines, loading, addLine, removeLine, onMaterialSelect, submit };
  },
  template: `
    <div class="space-y-6 pb-24">
      <section class="glass rounded-2xl p-5 shadow-sm space-y-4">
        <div class="flex justify-between items-center">
          <h3 class="font-bold text-lg text-slate-800">{{ S.outTitle }}</h3>
          <button @click="$emit('switch-tab', 'out_history')" class="text-xs font-bold text-blue-500 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">
            📜 History
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label class="block text-xs font-bold text-slate-500 mb-1">{{ S.outDate }}</label><input type="date" v-model="form.date" class="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none shadow-sm" /></div>
          <div><label class="block text-xs font-bold text-slate-500 mb-1">{{ S.proj }}</label><ItemPicker v-model="form.project" source="PROJECTS" :placeholder="S.pick" /></div>
          <div><label class="block text-xs font-bold text-slate-500 mb-1">{{ S.contractor }}</label><ItemPicker v-model="form.contractor" source="CONTRACTORS" :placeholder="S.pickAdd" /></div>
          <div><label class="block text-xs font-bold text-slate-500 mb-1">{{ S.requester }}</label><ItemPicker v-model="form.requester" source="REQUESTERS" :placeholder="S.pickAdd" /></div>
          <div class="md:col-span-2"><label class="block text-xs font-bold text-slate-500 mb-1">{{ S.note }}</label><input v-model="form.note" :placeholder="lang==='th'?'หมายเหตุ (ถ้ามี)':'Note (Optional)'" class="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none shadow-sm" /></div>
        </div>
      </section>

      <div class="space-y-4">
        <div v-for="(line, idx) in lines" :key="idx" class="glass rounded-2xl p-4 shadow-sm relative animate-fade-in-up">
          <button @click="removeLine(idx)" class="absolute top-2 right-2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">×</button>

          <div class="space-y-3 pt-2">
            <div class="grid grid-cols-12 gap-3">
              <div class="col-span-8">
                <ItemPicker v-model="line.name" source="MATERIALS" :placeholder="lang==='th'?'ระบุวัสดุ...':'Select material...'" @change="onMaterialSelect(line)" />
              </div>
              <div class="col-span-4">
                <input type="number" v-model="line.qty" placeholder="0" class="w-full bg-white border border-slate-200 rounded-xl px-3 py-3 text-center font-bold text-slate-800 outline-none shadow-sm" />
              </div>
            </div>

            <div class="flex items-center justify-between gap-3">
               <input v-model="line.note" :placeholder="lang==='th'?'หมายเหตุรายตัว...':'Line note...'" class="flex-1 bg-transparent border-b border-slate-200 text-sm py-1 outline-none text-slate-600" />
               <div class="flex items-center gap-2 shrink-0 h-8">
                  <span class="text-xs text-slate-400 font-bold uppercase">{{ lang==='th'?'คงเหลือ':'Stock' }}</span>
                  <div v-if="line.stockLoading" class="animate-spin w-4 h-4 border-2 border-slate-300 border-t-blue-500 rounded-full"></div>
                  <div v-else-if="line.stock" :class="line.stock.color" class="px-2 py-0.5 rounded-lg text-xs font-extrabold shadow-sm">{{ line.stock.val }}</div>
                  <div v-else class="text-slate-300 text-xl font-bold">-</div>
               </div>
            </div>
          </div>
        </div>
      </div>

      <div class="flex justify-center"><button @click="addLine" class="flex items-center gap-2 px-6 py-3 rounded-full bg-white border border-slate-200 shadow-sm text-slate-600 font-bold hover:bg-slate-50 transition-all"><span class="text-xl leading-none text-blue-500">+</span> {{ S.btnAdd }}</button></div>

      <div class="fixed bottom-6 left-4 right-4 max-w-4xl mx-auto z-30">
        <button @click="submit" :disabled="loading" class="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold text-lg py-4 rounded-2xl shadow-xl shadow-blue-500/30 flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed">
          <span v-if="loading" class="animate-spin text-2xl">C</span><span v-else>💾 {{ S.btnSubmit }}</span>
        </button>
      </div>
    </div>
  `
};
