import { ref, computed } from 'vue';
import { db } from '../firebase.js';
import { collection, doc, runTransaction, getDoc } from 'firebase/firestore';
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

    const lineDeltaPreview = (line) => {
      if (line.sysStock == null || line.physical === '' || line.physical === null) return null;
      const counted = Number(line.physical);
      if (Number.isNaN(counted)) return null;
      const prev = Number(line.sysStock.val);
      return counted - prev;
    };

    const submit = async () => {
      const validLines = lines.value.filter(
        (l) => l.name && l.physical !== '' && l.physical !== null && !Number.isNaN(Number(l.physical)) && Number(l.physical) >= 0
      );
      if (validLines.length === 0) {
        return toast(
          props.lang === 'th' ? 'กรุณาเลือกวัสดุและใส่จำนวนนับจริง (≥ 0)' : 'Pick a material and enter a valid physical count (≥ 0)'
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

    const date = ref(new Date().toISOString().split('T')[0]);
    const getDiff = (line) => {
      if (line.sysStock == null || line.physical === '' || line.physical === null) return 0;
      const counted = Number(line.physical);
      if (Number.isNaN(counted)) return 0;
      return counted - Number(line.sysStock.val);
    };

    return { S, lines, loading, addLine, removeLine, onMaterialSelect, submit, date, getDiff };
  },
  template: `
    <div class="space-y-6 pb-28">
      <section class="bg-[#F3EDF7] rounded-[12px] p-4 space-y-4 shadow-sm">
        <div class="flex justify-between items-center">
          <h3 class="text-base font-medium text-[#1D1B20]">{{ S.adjTitle }}</h3>
        </div>
        <div class="md3-input-container">
          <input type="date" v-model="date" class="md3-input" placeholder=" " />
          <label class="md3-label !bg-[#F3EDF7]">{{ S.adjDate }}</label>
        </div>
      </section>

      <div class="space-y-3">
        <div v-for="(line, idx) in lines" :key="idx" class="bg-[#F3EDF7] rounded-[12px] p-4 relative animate-fade-in-up">
          <button @click="removeLine(idx)" aria-label="Remove" class="absolute top-2 right-2 w-10 h-10 flex items-center justify-center rounded-full text-[#49454F] hover:bg-[#E8DEF8] transition-colors md3-ripple">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
          <div class="grid grid-cols-12 gap-4 mt-4">
            <div class="col-span-12 sm:col-span-7">
              <div class="md3-input-container">
                <ItemPicker v-model="line.name" source="MATERIALS" :placeholder="S.pick" :allow-add="true" @change="onMaterialSelect(line)" class="md3-input" />
                <label class="md3-label !bg-[#F3EDF7]">{{ lang === 'th' ? 'รายการวัสดุ' : 'Material' }}</label>
              </div>
            </div>
            <div class="col-span-12 sm:col-span-5">
              <div class="md3-input-container">
                <input type="number" v-model="line.physical" placeholder=" " class="md3-input text-center font-bold" />
                <label class="md3-label !bg-[#F3EDF7]">{{ S.adjPhysical }}</label>
              </div>
            </div>
          </div>
          <div class="mt-3 flex items-center gap-4 text-xs bg-[#FEF7FF] p-3 rounded-[8px] border border-[#CAC4D0]">
            <div class="flex-1">
              <span class="block text-[10px] text-[#49454F] uppercase tracking-wider mb-1">{{ S.adjSystem }}</span>
              <div v-if="line.stockLoading" class="animate-spin w-3 h-3 border-2 border-[#CAC4D0] border-t-[#6750A4] rounded-full"></div>
              <span v-else-if="line.sysStock" :class="line.sysStock.color" class="px-2 py-0.5 rounded-[4px] font-bold text-xs">{{ line.sysStock.val }}</span>
              <span v-else class="text-[#CAC4D0] font-bold">—</span>
            </div>
            <div class="flex-1 border-l border-[#CAC4D0] pl-4">
              <span class="block text-[10px] text-[#49454F] uppercase tracking-wider mb-1">{{ S.adjDiff }}</span>
              <span v-if="getDiff(line) > 0" class="text-[#6750A4] font-bold">+{{ getDiff(line) }}</span>
              <span v-else-if="getDiff(line) < 0" class="text-[#B3261E] font-bold">{{ getDiff(line) }}</span>
              <span v-else class="text-[#49454F] font-bold">0</span>
            </div>
          </div>
          <p class="text-[11px] text-[#49454F] mt-2 leading-relaxed opacity-80">{{ S.adjHint }}</p>
        </div>
      </div>

      <div class="flex justify-center mt-6">
        <button @click="addLine" class="flex items-center gap-2 px-6 py-2 rounded-full border border-[#79747E] text-[#6750A4] font-medium hover:bg-[#6750A4]/10 transition-colors md3-ripple">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          {{ S.btnAdd }}
        </button>
      </div>
      
      <!-- Extended FAB for Save -->
      <div class="fixed bottom-28 right-4 md:bottom-28 z-30">
        <button @click="submit" :disabled="loading" class="bg-[#EADDFF] text-[#21005D] h-[56px] px-4 min-w-[80px] rounded-[16px] shadow-lg flex items-center justify-center gap-2 hover:bg-[#E8DEF8] transition-colors md3-ripple disabled:opacity-50">
          <div v-if="loading" class="animate-spin w-5 h-5 border-2 border-[#21005D] border-t-transparent rounded-full"></div>
          <template v-else>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
            <span class="font-medium pr-2">{{ S.btnSubmit }}</span>
          </template>
        </button>
      </div>
    </div>
  `
};
