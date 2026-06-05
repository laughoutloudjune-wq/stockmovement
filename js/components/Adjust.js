import { ref, computed } from 'vue';
import { db } from '../firebase.js';
import { collection, doc, runTransaction, getDoc } from 'firebase/firestore';
import { STR, toast, materialStockStyle } from '../shared.js';
import ItemPicker from './ItemPicker.js';

export default {
  props: ['lang', 'user'],
  components: { ItemPicker },
  setup(props) {
    const lines = ref([
      { name: '', physical: '', sysStock: null, stockLoading: false }
    ]);
    const loading = ref(false);
    const S = computed(() => STR[props.lang]);

    const addLine = () =>
      lines.value.push({ name: '', physical: '', sysStock: null, stockLoading: false });
    const removeLine = (i) => lines.value.splice(i, 1);

    const lineDeltaPreview = (line) => {
      if (line.sysStock == null || line.physical === '' || line.physical === null) return null;
      const counted = Number(line.physical);
      if (Number.isNaN(counted)) return null;
      const prev = Number(line.sysStock.val);
      return counted - prev;
    };

    const onMaterialSelect = async (line) => {
      if (!line.name) return;
      line.stockLoading = true;
      line.physical = '';
      line.sysStock = null;
      try {
        const safeId = line.name.replace(/\//g, '_');
        const snap = await getDoc(doc(db, 'materials', safeId));
        if (snap.exists()) {
          const data = snap.data();
          const s = Number(data.stock || 0);
          const m = Number(data.min || 0);
          line.sysStock = materialStockStyle(s, m);
        } else {
          line.sysStock = null;
          toast(props.lang === 'th' ? 'ไม่พบรหัสนี้ในระบบ' : 'Material not found — add it from Stock In or Settings first');
        }
      } catch (e) {
        console.error(e);
      } finally {
        line.stockLoading = false;
      }
    };

    const submit = async () => {
      const validLines = lines.value.filter(
        (l) => l.name && l.physical !== '' && l.physical !== null && !Number.isNaN(Number(l.physical))
      );
      if (validLines.length === 0) {
        return toast(
          props.lang === 'th' ? 'กรุณาเลือกวัสดุและใส่จำนวนนับจริง' : 'Pick a material and enter the physical count'
        );
      }

      loading.value = true;
      try {
        await runTransaction(db, async (transaction) => {
          const orderItems = [];
          for (const line of validLines) {
            const safeId = line.name.replace(/\//g, '_');
            const matRef = doc(db, 'materials', safeId);
            const matDoc = await transaction.get(matRef);
            if (!matDoc.exists()) {
              throw new Error(
                props.lang === 'th' ? `ไม่มีวัสดุ: ${line.name}` : `Unknown material: ${line.name}`
              );
            }

            const prev = Number(matDoc.data().stock || 0);
            const counted = Math.round(Number(line.physical));
            if (counted < 0) {
              throw new Error(props.lang === 'th' ? 'จำนวนนับต้องไม่ติดลบ' : 'Physical count cannot be negative');
            }

            const delta = counted - prev;
            transaction.update(matRef, { stock: counted });
            orderItems.push({
              name: line.name,
              qty: delta,
              prevStock: prev,
              newStock: counted
            });
          }

          const docNo = 'ADJ-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
          const newOrderRef = doc(collection(db, 'orders'));
          transaction.set(newOrderRef, {
            type: 'ADJUST',
            docNo,
            date: new Date().toISOString().split('T')[0],
            requester: props.user?.displayName || props.user?.email || 'Admin',
            items: orderItems,
            timestamp: new Date().toISOString()
          });
        });

        toast(props.lang === 'th' ? 'บันทึกแล้ว' : 'Saved');
        lines.value = [{ name: '', physical: '', sysStock: null, stockLoading: false }];

      } catch (e) {
        console.error(e);
        toast('Failed to submit: ' + e.message);
      } finally {
        loading.value = false;
      }
    };

    return { S, lines, loading, addLine, removeLine, onMaterialSelect, submit, lineDeltaPreview };
  },
  template: `
    <div class="space-y-6 pb-24">
      <section class="glass rounded-2xl p-5 shadow-sm">
        <h3 class="font-bold text-lg text-slate-800">{{ S.tabs.adj }}</h3>
        <p class="text-xs text-slate-500 mt-1 leading-relaxed">{{ S.adjHint }}</p>
      </section>
      <div class="space-y-3">
        <div v-for="(line, idx) in lines" :key="idx" class="glass rounded-2xl p-4 shadow-sm relative animate-fade-in-up">
          <button @click="removeLine(idx)" class="absolute top-2 right-2 text-slate-400 hover:text-red-500 text-xl font-bold">×</button>
          <div class="grid grid-cols-12 gap-3 mt-2">
            <div class="col-span-12 sm:col-span-7">
              <ItemPicker v-model="line.name" source="MATERIALS" :placeholder="S.pick" :allow-add="true" @change="onMaterialSelect(line)" />
            </div>
            <div class="col-span-12 sm:col-span-5">
              <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">{{ S.adjPhysical }}</label>
              <input type="number" min="0" step="1" v-model="line.physical" :placeholder="lang==='th' ? 'จำนวนที่นับได้' : 'Counted qty'" class="w-full bg-white border border-slate-200 rounded-xl px-3 py-3 text-center font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" />
            </div>
          </div>
          <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            <div class="flex items-center gap-2">
              <span class="text-slate-500 font-bold">{{ S.adjSys }}</span>
              <div v-if="line.stockLoading" class="animate-spin w-3 h-3 border-2 border-slate-300 border-t-blue-500 rounded-full"></div>
              <span v-else-if="line.sysStock" :class="line.sysStock.color" class="px-2 py-0.5 rounded-md font-extrabold">{{ line.sysStock.val }}</span>
              <span v-else class="text-slate-300">—</span>
            </div>
            <div v-if="lineDeltaPreview(line) !== null" class="text-slate-600 font-bold">
              Δ <span :class="lineDeltaPreview(line) < 0 ? 'text-red-600' : lineDeltaPreview(line) > 0 ? 'text-emerald-600' : 'text-slate-500'">{{ lineDeltaPreview(line) > 0 ? '+' : '' }}{{ lineDeltaPreview(line) }}</span>
              <span class="text-slate-400 font-normal mx-1">→</span>
              <span class="font-mono">{{ line.physical }}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="flex justify-center">
        <button @click="addLine" class="flex items-center gap-2 px-6 py-3 rounded-full bg-white border border-slate-200 shadow-sm text-slate-600 font-bold hover:bg-slate-50 transition-all"><span class="text-xl leading-none text-blue-500">+</span> {{ S.btnAdd }}</button>
      </div>
      <div class="fixed bottom-6 left-4 right-4 max-w-4xl mx-auto z-30">
        <button @click="submit" :disabled="loading" class="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold text-lg py-4 rounded-2xl shadow-xl shadow-blue-500/30 flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed">
          <div v-if="loading" class="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div><span v-else>💾 {{ S.btnSubmit }}</span>
        </button>
      </div>
    </div>
  `
};
