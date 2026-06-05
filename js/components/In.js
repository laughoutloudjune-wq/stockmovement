import { ref, computed } from 'vue';
import { db } from '../firebase.js';
import { collection, doc, runTransaction, getDoc } from 'firebase/firestore';
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
    <div class="space-y-4 pb-28">
      <section class="bg-[#F3EDF7] rounded-[12px] p-4 space-y-4">
        <div class="flex justify-between items-center">
          <h3 class="text-base font-medium text-[#1D1B20]">{{ S.inTitle }}</h3>
        </div>
        <div class="md3-input-container">
          <input type="date" v-model="date" class="md3-input" placeholder=" " />
          <label class="md3-label !bg-[#F3EDF7]">{{ S.inDate }}</label>
        </div>
      </section>

      <div class="space-y-3">
        <div v-for="(line, idx) in lines" :key="idx" class="bg-[#F3EDF7] rounded-[12px] p-4 relative animate-fade-in-up">
          <button @click="removeLine(idx)" aria-label="Remove" class="absolute top-2 right-2 w-10 h-10 flex items-center justify-center rounded-full text-[#49454F] hover:bg-[#E8DEF8] transition-colors md3-ripple">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
          <div class="grid grid-cols-12 gap-3 mt-4">
            <div class="col-span-8 min-w-0">
              <div class="md3-input-container md3-picker">
                <ItemPicker v-model="line.name" source="MATERIALS" :placeholder="lang === 'th' ? 'ค้นหาวัสดุ...' : 'Search material...'" :allow-add="true" @change="onMaterialSelect(line)" class="md3-input" :class="{'has-val': !!line.name}" />
                <label class="md3-label !bg-[#F3EDF7]">{{ lang === 'th' ? 'รายการวัสดุ' : 'Material' }}</label>
              </div>
            </div>
            <div class="col-span-4 min-w-0">
              <div class="md3-input-container">
                <input type="number" v-model="line.qty" placeholder=" " class="md3-input text-center font-bold" />
                <label class="md3-label !bg-[#F3EDF7]">{{ lang === 'th' ? 'จำนวน' : 'Qty' }}</label>
              </div>
            </div>
          </div>
          <div class="mt-3 flex items-center gap-2 text-xs">
            <span class="text-xs font-medium text-[#49454F] uppercase">{{ lang === 'th' ? 'คงเหลือ' : 'Stock' }}</span>
            <div v-if="line.stockLoading" class="animate-spin w-3 h-3 border-2 border-[#CAC4D0] border-t-[#6750A4] rounded-full"></div>
            <span v-else-if="line.stock" :class="line.stock.color" class="px-2 py-0.5 rounded-[4px] font-bold text-xs">{{ line.stock.val }}</span>
            <span v-else class="text-[#CAC4D0]">—</span>
          </div>
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
        <button @click="submit" :disabled="loading" class="bg-[#EADDFF] text-[#21005D] h-[56px] px-4 min-w-[80px] rounded-[16px] shadow-md3-elevation-3 flex items-center justify-center gap-2 hover:bg-[#E8DEF8] transition-colors md3-ripple disabled:opacity-50">
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
