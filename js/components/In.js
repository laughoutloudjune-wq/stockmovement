import { ref, computed } from 'vue';
import { db } from '../firebase.js';
import { collection, doc, runTransaction } from 'firebase/firestore';
import { STR, toast, todayStr } from '../shared.js';
import ItemPicker from './ItemPicker.js';

export default {
  props: ['lang', 'user'],
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
        await runTransaction(db, async (transaction) => {
           // 1. Prepare updates for Materials
           for (const line of validLines) {
              const safeId = line.name.replace(/\//g, '_');
              const matRef = doc(db, 'materials', safeId);
              const matDoc = await transaction.get(matRef);
              
              let newStock = line.qty;
              if (matDoc.exists()) {
                 const current = Number(matDoc.data().stock || 0);
                 newStock = current + line.qty;
                 transaction.update(matRef, { stock: newStock });
              } else {
                 // Create new if not exists
                 transaction.set(matRef, { name: line.name, stock: newStock, min: 5 });
              }
           }

           // 2. Create Order History
           const docNo = 'IN-' + Date.now().toString().slice(-6);
           const newOrderRef = doc(collection(db, 'orders'));
           transaction.set(newOrderRef, {
              type: 'IN',
              docNo: docNo,
              date: date.value,
              project: '', // Optional for IN
              requester: props.user?.displayName || props.user?.email || 'Admin',
              items: validLines,
              timestamp: new Date().toISOString()
           });
        });

        toast((props.lang === 'th' ? 'บันทึกแล้ว' : 'Saved'));
        lines.value = [{ name: '', qty: '' }];
        date.value = todayStr();

      } catch (e) {
        console.error(e);
        toast('Failed to submit: ' + e.message);
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
}
