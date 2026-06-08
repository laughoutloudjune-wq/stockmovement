import { ref, computed } from 'vue';
import { db } from '../firebase.js';
import { collection, doc, runTransaction } from 'firebase/firestore';
import { STR, toast, materialStockStyle } from '../shared.js';
import ItemPicker from './ItemPicker.js';
import { useStockForm } from '../useStockForm.js';

export default {
  props: ['lang', 'user'],
  components: { ItemPicker },
  setup(props) {
    const { lines, addLine, removeLine, onMaterialSelect } = useStockForm(() => ({ name: '', physical: '', sysStock: null }));
    const loading = ref(false);
    const S = computed(() => STR[props.lang]);
    const date = ref(new Date().toISOString().split('T')[0]);

    const getDiff = (line) => {
      if (line.sysStock == null || line.physical === '' || line.physical === null) return null;
      const counted = Number(line.physical);
      if (Number.isNaN(counted)) return null;
      return counted - Number(line.sysStock.val);
    };

    const submit = async () => {
      const validLines = lines.value.filter(
        l => l.name && l.physical !== '' && l.physical !== null && !Number.isNaN(Number(l.physical)) && Number(l.physical) >= 0
      );
      if (validLines.length === 0)
        return toast(props.lang === 'th' ? 'กรุณาเลือกวัสดุและใส่จำนวนนับจริง (≥ 0)' : 'Pick a material and enter a valid physical count (≥ 0)');

      loading.value = true;
      try {
        await runTransaction(db, async (transaction) => {
          // Phase 1: ALL reads first (Firestore requires reads before writes)
          const reads = await Promise.all(validLines.map(line => {
            const safeId = line.name.replace(/\//g, '_');
            const matRef = doc(db, 'materials', safeId);
            return transaction.get(matRef).then(matDoc => ({ line, matRef, matDoc }));
          }));

          // Phase 2: Process results and perform ALL writes
          const orderItems = [];
          for (const { line, matRef, matDoc } of reads) {
            if (!matDoc.exists()) throw new Error(props.lang === 'th' ? `ไม่มีวัสดุ: ${line.name}` : `Unknown material: ${line.name}`);
            const prev = Number(matDoc.data().stock || 0);
            const counted = Math.round(Number(line.physical));
            if (counted < 0) throw new Error('Physical count cannot be negative');
            const delta = counted - prev;
            transaction.update(matRef, { stock: counted });
            orderItems.push({ name: line.name, qty: delta, prevStock: prev, newStock: counted });
          }

          const docNo = 'ADJ-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
          const newOrderRef = doc(collection(db, 'orders'));
          transaction.set(newOrderRef, {
            type: 'ADJUST', docNo,
            date: date.value,
            requester: props.user?.displayName || props.user?.email || 'Admin',
            items: orderItems, timestamp: new Date().toISOString()
          });
        });

        toast(props.lang === 'th' ? 'บันทึกแล้ว' : 'Saved');
        lines.value = [{ name: '', physical: '', sysStock: null, stockLoading: false }];
      } catch (e) {
        console.error(e);
        toast('Failed: ' + e.message);
      } finally { loading.value = false; }
    };

    return { S, lines, loading, addLine, removeLine, onMaterialSelect, submit, date, getDiff };
  },
  template: `
    <div class="space-y-4 pb-28">

      <!-- Header card -->
      <section class="md3-card-filled space-y-4">
        <h3 class="text-[16px] font-medium text-[#1D1B20] flex items-center gap-2">
          <span class="material-symbols-outlined icon-sm text-[#6750A4]">tune</span>
          {{ lang === 'th' ? 'ปรับปรุงสต็อก' : 'Stock Adjustment' }}
        </h3>
        <p class="text-[13px] text-[#49454F] leading-relaxed -mt-2">{{ S.adjHint }}</p>
      </section>

      <!-- Line items -->
      <div class="space-y-3">
        <div v-for="(line, idx) in lines" :key="idx"
          class="bg-[#F3EDF7] rounded-[16px] p-4 relative animate-fade-in-up">

          <button @click="removeLine(idx)" aria-label="Remove"
            class="absolute top-2 right-2 md3-icon-btn md3-ripple text-[#49454F]">
            <span class="material-symbols-outlined icon-sm">close</span>
          </button>

          <div class="grid grid-cols-12 gap-3 mt-2">
            <div class="col-span-12 sm:col-span-7">
              <div class="md3-input-container md3-picker" :class="{'has-value': !!line.name}">
                <div class="picker-field">
                  <ItemPicker v-model="line.name" source="MATERIALS" :placeholder="S.pick"
                    :allow-add="true" @change="onMaterialSelect(line)"
                    class="w-full" />
                </div>
                <label class="md3-label">{{ lang === 'th' ? 'รายการวัสดุ' : 'Material' }}</label>
              </div>
            </div>
            <div class="col-span-12 sm:col-span-5">
              <div class="md3-input-container">
                <input type="number" v-model="line.physical" placeholder=" " class="md3-input text-center font-bold" />
                <label class="md3-label">{{ S.adjPhysical }}</label>
              </div>
            </div>
          </div>

          <!-- Sys vs Physical comparison -->
          <div class="mt-3 flex items-stretch gap-0 bg-[#ECE6F0] rounded-xl overflow-hidden border border-[#CAC4D0]">
            <div class="flex-1 px-4 py-2.5">
              <div class="text-[10px] text-[#49454F] uppercase tracking-wider font-semibold mb-1">{{ S.adjSys }}</div>
              <div v-if="line.stockLoading" class="w-4 h-4 border-2 border-[#CAC4D0] border-t-[#6750A4] rounded-full animate-spin"></div>
              <span v-else-if="line.sysStock" :class="line.sysStock.color" class="px-2 py-0.5 rounded-full font-bold text-[13px]">
                {{ line.sysStock.val }}
              </span>
              <span v-else class="text-[#CAC4D0] font-bold text-[13px]">—</span>
            </div>
            <div class="w-px bg-[#CAC4D0]"></div>
            <div class="flex-1 px-4 py-2.5">
              <div class="text-[10px] text-[#49454F] uppercase tracking-wider font-semibold mb-1">Δ Diff</div>
              <template v-if="getDiff(line) !== null">
                <span v-if="getDiff(line) > 0"  class="font-bold text-[13px] text-[#6750A4]">+{{ getDiff(line) }}</span>
                <span v-else-if="getDiff(line) < 0" class="font-bold text-[13px] text-[#B3261E]">{{ getDiff(line) }}</span>
                <span v-else class="font-bold text-[13px] text-[#49454F]">0</span>
              </template>
              <span v-else class="text-[#CAC4D0] font-bold text-[13px]">—</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Add line -->
      <div class="flex justify-center mt-4">
        <button @click="addLine" class="md3-btn-outlined md3-ripple flex items-center gap-2">
          <span class="material-symbols-outlined icon-sm">add</span>
          {{ S.btnAdd }}
        </button>
      </div>

      <!-- Extended FAB -->
      <div class="fixed bottom-28 right-4 z-30">
        <button @click="submit" :disabled="loading" class="md3-fab-extended md3-ripple">
          <div v-if="loading" class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          <template v-else>
            <span class="material-symbols-outlined">save</span>
            <span>{{ S.btnSubmit }}</span>
          </template>
        </button>
      </div>
    </div>
  `
};
