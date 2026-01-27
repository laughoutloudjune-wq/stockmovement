import { ref, computed } from 'vue';
import { db } from '../firebase.js';
import { collection, doc, runTransaction, getDoc } from 'firebase/firestore';
import { STR, toast } from '../shared.js';
import ItemPicker from './ItemPicker.js';

export default {
  props: ['lang', 'user'],
  components: { ItemPicker },
  setup(props) {
    const lines = ref([{ name: '', qty: '', stock: null, stockLoading: false }]);
    const loading = ref(false);
    const S = computed(() => STR[props.lang]);

    const addLine = () => lines.value.push({ name: '', qty: '', stock: null });
    const removeLine = (i) => lines.value.splice(i, 1);

    // FIX: Get Stock from Firestore directly
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
          let color = 'bg-green-100 text-green-700';
          if (s <= 0 || s <= m) color = 'bg-red-100 text-red-700';
          else if (s <= 2 * m) color = 'bg-yellow-100 text-yellow-700';
          line.stock = { val: s, color };
        } else {
          line.stock = { val: 0, color: 'bg-gray-100 text-slate-400' };
        }
      } catch (e) { console.error(e); } 
      finally { line.stockLoading = false; }
    };

    // FIX: Submit via Firestore Transaction
    const submit = async () => {
      const validLines = lines.value.filter(l => l.name && l.qty != null && l.qty !== '').map(l => ({ name: l.name, qty: Number(l.qty) }));
      if (validLines.length === 0) return toast(props.lang==='th'?'กรุณาเพิ่มรายการ':'Add at least one line');

      loading.value = true;
      try {
        await runTransaction(db, async (transaction) => {
            // 1. Update Materials
            for (const line of validLines) {
                const safeId = line.name.replace(/\//g, '_');
                const matRef = doc(db, 'materials', safeId);
                const matDoc = await transaction.get(matRef);
                
                let newStock = line.qty; // For Adjust, we might want "Add/Remove" (delta). Assuming input is delta (+/-).
                // If existing, add delta to current
                if (matDoc.exists()) {
                    newStock = Number(matDoc.data().stock || 0) + line.qty;
                    transaction.update(matRef, { stock: newStock });
                } else {
                    // Initialize if not exists
                    transaction.set(matRef, { name: line.name, stock: newStock, min: 5 });
                }
            }

            // 2. Log History
            const docNo = 'ADJ-' + Date.now().toString().slice(-6);
            const newOrderRef = doc(collection(db, 'orders'));
            transaction.set(newOrderRef, {
                type: 'ADJUST',
                docNo: docNo,
                date: new Date().toISOString().split('T')[0],
                requester: props.user?.displayName || 'Admin',
                items: validLines,
                timestamp: new Date().toISOString()
            });
        });

        toast(props.lang==='th'?'บันทึกแล้ว':'Saved');
        lines.value = [{ name: '', qty: '', stock: null }];
      } catch (e) { 
        console.error(e);
        toast('Failed to submit: ' + e.message); 
      } 
      finally { loading.value = false; }
    };

    return { S, lines, loading, addLine, removeLine, onMaterialSelect, submit };
  },
  template: `
    <div class="space-y-6 pb-24">
      <section class="glass rounded-2xl p-5 shadow-sm"><h3 class="font-bold text-lg text-slate-800">{{ S.tabs.adj }}</h3></section>

      <div class="space-y-3">
        <div v-for="(line, idx) in lines" :key="idx" class="glass rounded-2xl p-4 shadow-sm relative animate-fade-in-up">
          <button @click="removeLine(idx)" class="absolute top-2 right-2 text-slate-400 hover:text-red-500 text-xl font-bold">×</button>
          
          <div class="grid grid-cols-12 gap-3 mt-2">
            <div class="col-span-8">
              <ItemPicker v-model="line.name" source="MATERIALS" :placeholder="S.pick" @change="onMaterialSelect(line)" />
            </div>
            <div class="col-span-4">
              <input type="number" v-model="line.qty" placeholder="±Qty" class="w-full bg-white border border-slate-200 rounded-xl px-3 py-3 text-center font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" />
            </div>
          </div>

          <div class="mt-3 flex items-center gap-2 text-xs">
            <span class="text-slate-500 font-bold">Current:</span>
            <div v-if="line.stockLoading" class="animate-spin w-3 h-3 border-2 border-slate-300 border-t-blue-500 rounded-full"></div>
            <span v-else-if="line.stock" :class="line.stock.color" class="px-2 py-0.5 rounded-md font-extrabold">{{ line.stock.val }}</span>
            <span v-else class="text-slate-300">-</span>
          </div>
        </div>
      </div>

      <div class="flex justify-center">
        <button @click="addLine" class="flex items-center gap-2 px-6 py-3 rounded-full bg-white border border-slate-200 shadow-sm text-slate-600 font-bold hover:bg-slate-50 transition-all"><span class="text-xl leading-none text-blue-500">+</span> {{ S.btnAdd }}</button>
      </div>

      <div class="fixed bottom-6 left-4 right-4 max-w-4xl mx-auto z-30">
        <button @click="submit" :disabled="loading" class="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold text-lg py-4 rounded-2xl shadow-xl shadow-blue-500/30 flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed">
          <span v-if="loading" class="animate-spin text-2xl">C</span><span v-else>💾 {{ S.btnSubmit }}</span>
        </button>
      </div>
    </div>
  `
};
}
