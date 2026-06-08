import { ref, computed } from 'vue';
import { db } from '../firebase.js';
import { collection, doc, runTransaction } from 'firebase/firestore';
import { STR, toast, todayStr, materialStockStyle } from '../shared.js';
import ItemPicker from './ItemPicker.js';
import { useStockForm } from '../useStockForm.js';

export default {
  props: ['lang', 'user'],
  components: { ItemPicker },
  setup(props) {
    const date = ref(todayStr());
    const { lines, addLine, removeLine, onMaterialSelect } = useStockForm(() => ({ name: '', qty: '', stock: null }));
    const loading = ref(false);
    const S = computed(() => STR[props.lang]);

    const submit = async () => {
      const validLines = lines.value
        .filter(l => l.name && l.qty && Number(l.qty) > 0)
        .map(l => ({ name: l.name, qty: Number(l.qty) }));

      if (validLines.length === 0) {
        toast(props.lang === 'th' ? 'กรุณาเพิ่มรายการและจำนวนต้องมากกว่า 0' : 'Add at least one line with qty > 0');
        return;
      }

      loading.value = true;
      try {
        await runTransaction(db, async (transaction) => {
          // READ phase
          const updates = [];
          for (const line of validLines) {
            const safeId = line.name.replace(/\//g, '_');
            const matRef = doc(db, 'materials', safeId);
            const matDoc = await transaction.get(matRef);
            let newStock = line.qty;
            let exists = false;
            if (matDoc.exists()) {
              newStock = Number(matDoc.data().stock || 0) + line.qty;
              exists = true;
            }
            updates.push({ ref: matRef, stock: newStock, exists, name: line.name });
          }
          // WRITE phase
          for (const u of updates) {
            if (u.exists) transaction.update(u.ref, { stock: u.stock });
            else transaction.set(u.ref, { name: u.name, stock: u.stock, min: 5 });
          }
          const docNo = 'IN-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
          const newOrderRef = doc(collection(db, 'orders'));
          transaction.set(newOrderRef, {
            type: 'IN', docNo, date: date.value, project: '',
            requester: props.user?.displayName || props.user?.email || 'Admin',
            items: validLines, timestamp: new Date().toISOString()
          });
        });

        toast(props.lang === 'th' ? 'บันทึกแล้ว' : 'Saved');
        lines.value = [{ name: '', qty: '', stock: null, stockLoading: false }];
        date.value = todayStr();
      } catch (e) {
        console.error(e);
        toast('Failed: ' + e.message);
      } finally {
        loading.value = false;
      }
    };

    return { S, date, lines, loading, addLine, removeLine, submit, onMaterialSelect };
  },
  template: `
    <div class="space-y-4 pb-28">

      <!-- Header card -->
      <section class="md3-card-filled space-y-4">
        <h3 class="text-[16px] font-medium text-[#1D1B20] flex items-center gap-2">
          <span class="material-symbols-outlined icon-sm text-[#6750A4]">download</span>
          {{ S.inTitle }}
        </h3>
        <div class="md3-input-container">
          <input type="date" v-model="date" class="md3-input" placeholder=" " />
          <label class="md3-label">{{ S.inDate }}</label>
        </div>
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
            <div class="col-span-8 min-w-0">
              <div class="md3-input-container md3-picker" :class="{'has-value': !!line.name}">
                <div class="picker-field">
                  <ItemPicker v-model="line.name" source="MATERIALS"
                    :placeholder="lang === 'th' ? 'ค้นหาวัสดุ...' : 'Search material...'"
                    :allow-add="true" @change="onMaterialSelect(line)" class="w-full" />
                </div>
                <label class="md3-label">{{ lang === 'th' ? 'รายการวัสดุ' : 'Material' }}</label>
              </div>
            </div>
            <div class="col-span-4 min-w-0">
              <div class="md3-input-container">
                <input type="number" v-model="line.qty" placeholder=" " class="md3-input text-center font-bold" />
                <label class="md3-label">{{ lang === 'th' ? 'จำนวน' : 'Qty' }}</label>
              </div>
            </div>
          </div>

          <div class="mt-3 flex items-center gap-2">
            <span class="text-[12px] font-medium text-[#49454F] uppercase tracking-wide">
              {{ lang === 'th' ? 'คงเหลือ' : 'Stock' }}
            </span>
            <div v-if="line.stockLoading" class="w-4 h-4 border-2 border-[#CAC4D0] border-t-[#6750A4] rounded-full animate-spin"></div>
            <span v-else-if="line.stock" :class="line.stock.color" class="px-2 py-0.5 rounded-full font-bold text-[12px]">
              {{ line.stock.val }}
            </span>
            <span v-else class="text-[#CAC4D0] text-[12px]">—</span>
          </div>
        </div>
      </div>

      <!-- Add line button -->
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
