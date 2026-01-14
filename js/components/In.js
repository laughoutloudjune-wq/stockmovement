import { ref, computed } from 'vue';
import { apiPost, STR, toast, todayStr } from '../shared.js';
import ItemPicker from './ItemPicker.js';

export default {
  props: ['lang'],
  components: { ItemPicker },
  setup(props) {
    const date = ref(todayStr());
    const lines = ref([{ name: '', qty: '' }]);
    const loading = ref(false);
    
    const S = computed(() => STR[props.lang]);

    const addLine = () => {
      lines.value.push({ name: '', qty: '' });
    };

    const removeLine = (index) => {
      lines.value.splice(index, 1);
    };

    const submit = async () => {
      const validLines = lines.value
        .filter(l => l.name && l.qty)
        .map(l => ({ name: l.name, qty: Number(l.qty) }));

      if (validLines.length === 0) {
        toast(props.lang === 'th' ? 'กรุณาเพิ่มรายการ' : 'Add at least one line');
        return;
      }

      loading.value = true;
      try {
        const payload = { type: 'IN', date: date.value, lines: validLines };
        const res = await apiPost('submitMovementBulk', payload);
        
        if (res && res.ok) {
          toast((props.lang === 'th' ? 'บันทึกแล้ว • เอกสาร ' : 'Saved • Doc ') + (res.docNo || ''));
          lines.value = [{ name: '', qty: '' }];
          date.value = todayStr();
        } else {
          toast(res?.message || 'Error');
        }
      } catch (e) {
        toast('Failed to submit');
      } finally {
        loading.value = false;
      }
    };

    return { S, date, lines, loading, addLine, removeLine, submit };
  },
  template: `
    <div class="space-y-6 pb-20">
      
      <section class="glass rounded-2xl p-5 shadow-sm space-y-4">
        <h3 class="font-bold text-lg text-slate-800">{{ S.inTitle }}</h3>
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">{{ S.inDate }}</label>
          <input type="date" v-model="date" class="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
        </div>
      </section>

      <div class="space-y-3">
        <div v-for="(line, idx) in lines" :key="idx" class="glass rounded-2xl p-4 shadow-sm relative animate-fade-in-up">
          <button @click="removeLine(idx)" class="absolute top-2 right-2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">×</button>

          <div class="grid grid-cols-12 gap-3 mt-2">
            <div class="col-span-8">
              <ItemPicker 
                v-model="line.name" 
                source="MATERIALS" 
                :placeholder="lang === 'th' ? 'ค้นหาวัสดุ...' : 'Search material...'" 
              />
            </div>
            <div class="col-span-4">
              <input 
                type="number" 
                v-model="line.qty" 
                placeholder="0" 
                class="w-full bg-white border border-slate-200 rounded-xl px-3 py-3 text-center text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="flex justify-center">
        <button @click="addLine" class="flex items-center gap-2 px-6 py-3 rounded-full bg-white border border-slate-200 shadow-sm text-slate-600 font-bold hover:bg-slate-50 transition-all">
          <span class="text-xl leading-none text-blue-500">+</span> {{ S.btnAdd }}
        </button>
      </div>

      <div class="fixed bottom-6 left-4 right-4 max-w-4xl mx-auto z-30">
        <button @click="submit" :disabled="loading" class="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold text-lg py-4 rounded-2xl shadow-xl shadow-blue-500/30 flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed">
          <span v-if="loading" class="animate-spin text-2xl">C</span>
          <span v-else>💾 {{ S.btnSubmit }}</span>
        </button>
      </div>
    </div>
  `
};
