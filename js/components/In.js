import { ref, computed } from 'vue';
import { db } from '../firebase.js';
import { collection, doc, runTransaction, getDoc } from 'firebase/firestore';
import { STR, toast, todayStr, materialStockStyle } from '../shared.js';
import ItemPicker from './ItemPicker.js';

export default {
  props: ['lang', 'user'],
  components: { ItemPicker },
  setup(props) {
    const date = ref(todayStr());
    const lines = ref([{ name: '', qty: '', stock: null, stockLoading: false }]);
    const loading = ref(false);
    
    const S = computed(() => STR[props.lang]);

    const addLine = () => {
      lines.value.push({ name: '', qty: '', stock: null, stockLoading: false });
    };

    const removeLine = (index) => {
      lines.value.splice(index, 1);
    };

    const onMaterialSelect = async (line) => {
      if (!line.name) return;
      line.stockLoading = true;
      try {
        const safeId = line.name.replace(/\//g, '_');
        const snap = await getDoc(doc(db, 'materials', safeId));
        if (snap.exists()) {
          const data = snap.data();
          const s = Number(data.stock || 0);
          const m = Number(data.min || 0);
          line.stock = materialStockStyle(s, m);
        } else {
          line.stock = { val: props.lang === 'th' ? 'ใหม่' : 'New', color: 'bg-blue-100 text-blue-600' };
        }
      } catch (e) { console.error(e); }
      finally { line.stockLoading = false; }
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
           // --- STEP 1: READ PHASE ---
           // All reads must happen before any writes
           const updates = [];
           for (const line of validLines) {
              const safeId = line.name.replace(/\//g, '_');
              const matRef = doc(db, 'materials', safeId);
              const matDoc = await transaction.get(matRef);
              
              let newStock = line.qty;
              let exists = false;

              if (matDoc.exists()) {
                 const current = Number(matDoc.data().stock || 0);
                 newStock = current + line.qty;
                 exists = true;
              }
              updates.push({ ref: matRef, stock: newStock, exists, name: line.name });
           }

           // --- STEP 2: WRITE PHASE ---
           for (const u of updates) {
              if (u.exists) {
                 transaction.update(u.ref, { stock: u.stock });
              } else {
                 transaction.set(u.ref, { name: u.name, stock: u.stock, min: 5 });
              }
           }

           // Log History (Write)
           const docNo = 'IN-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
           const newOrderRef = doc(collection(db, 'orders'));
           transaction.set(newOrderRef, {
              type: 'IN',
              docNo: docNo,
              date: date.value,
              project: '', 
              requester: props.user?.displayName || props.user?.email || 'Admin',
              items: validLines,
              timestamp: new Date().toISOString()
           });
        });

        toast((props.lang === 'th' ? 'บันทึกแล้ว' : 'Saved'));
        lines.value = [{ name: '', qty: '', stock: null, stockLoading: false }];
        date.value = todayStr();


      } catch (e) {
        console.error(e);
        toast('Failed to submit: ' + e.message);
      } finally {
        loading.value = false;
      }
    };

    return { S, date, lines, loading, addLine, removeLine, submit, onMaterialSelect };
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
              <ItemPicker v-model="line.name" source="MATERIALS" :placeholder="lang === 'th' ? 'ค้นหาวัสดุ...' : 'Search material...'" :allow-add="true" @change="onMaterialSelect(line)" />
            </div>
            <div class="col-span-4">
              <input type="number" v-model="line.qty" placeholder="0" class="w-full bg-white border border-slate-200 rounded-xl px-3 py-3 text-center text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
            </div>
          </div>
          <div class="mt-2 flex items-center gap-2 text-xs">
            <span class="text-slate-400 font-bold uppercase">{{ lang === 'th' ? 'คงเหลือ' : 'Stock' }}</span>
            <div v-if="line.stockLoading" class="animate-spin w-3 h-3 border-2 border-slate-300 border-t-blue-500 rounded-full"></div>
            <span v-else-if="line.stock" :class="line.stock.color" class="px-2 py-0.5 rounded-md font-extrabold">{{ line.stock.val }}</span>
            <span v-else class="text-slate-300">—</span>
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
          <div v-if="loading" class="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
          <span v-else>💾 {{ S.btnSubmit }}</span>
        </button>
      </div>
    </div>
  `
};
