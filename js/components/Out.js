import { ref, computed } from 'vue';
import { db } from '../firebase.js';
import { collection, doc, runTransaction, getDoc } from 'firebase/firestore'; 
import { STR, LOOKUPS, toast, todayStr, materialStockStyle } from '../shared.js';
import ItemPicker from './ItemPicker.js';
import { useStockForm } from '../useStockForm.js';

export default {
  props: ['lang', 'user'],
  components: { ItemPicker },
  setup(props) {
    const form = ref({ date: todayStr(), project: '', subProject: '', contractor: '', note: '' });
    const { lines, addLine, removeLine, onMaterialSelect } = useStockForm(() => ({ name: '', qty: '', note: '', stock: null }));
    const loading = ref(false);
    const S = computed(() => STR[props.lang]);

    const subProjects = computed(() => LOOKUPS.PROJECT_META[form.value.project] || []);
    const onProjectChange = () => { form.value.subProject = ''; };
    const goToReport = () => window.dispatchEvent(new CustomEvent('switch-tab', { detail: 'report' }));

    const submit = async () => {
      const validLines = lines.value.filter(l => l.name && l.qty && Number(l.qty) > 0).map(l => ({ 
        name: l.name, qty: Number(l.qty), note: l.note || '' 
      }));

      if (validLines.length === 0) return toast(props.lang === 'th' ? 'กรุณาเพิ่มรายการและจำนวนต้องมากกว่า 0' : 'Add at least one line with qty > 0');
      
      loading.value = true;
      try {
        await runTransaction(db, async (transaction) => {
          // STEP 1: READ
          const updates = [];
          for (const line of validLines) {
             const safeId = line.name.replace(/\//g, '_');
             const matRef = doc(db, 'materials', safeId);
             const matDoc = await transaction.get(matRef);
             
             if (!matDoc.exists()) throw new Error(`Material not found: ${line.name}`);
             
             const currentStock = Number(matDoc.data().stock || 0);
             const newStock = currentStock - line.qty;
             if (newStock < 0) throw new Error(
               `Insufficient stock for "${line.name}": available ${currentStock}, requested ${line.qty}`
             );
             updates.push({ ref: matRef, newStock });
          }

          // STEP 2: WRITE
          updates.forEach(u => transaction.update(u.ref, { stock: u.newStock }));

          const newOrderRef = doc(collection(db, 'orders'));
          const docNo = 'OUT-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
          
          transaction.set(newOrderRef, {
            type: 'OUT',
            docNo: docNo,
            date: form.value.date,
            project: form.value.project,
            subProject: form.value.subProject || '',
            contractor: form.value.contractor,
            note: form.value.note,
            requester: props.user.displayName || props.user.email,
            requesterEmail: props.user.email,
            requesterPhoto: props.user.photoURL,
            items: validLines,
            timestamp: new Date().toISOString()
          });
        });

        toast((props.lang === 'th' ? 'บันทึกแล้ว' : 'Saved'));
        lines.value = [{ name: '', qty: '', note: '', stock: null, stockLoading: false }];
        form.value.note = ''; form.value.project = ''; form.value.subProject = ''; form.value.contractor = '';


      } catch (e) {
        console.error(e);
        toast('Failed: ' + e.message);
      } finally { loading.value = false; }
    };

    return { S, form, lines, loading, subProjects, onProjectChange, addLine, removeLine, onMaterialSelect, submit, goToReport };
  },
  template: `
    <div class="space-y-6 pb-28">
      <section class="bg-[#F3EDF7] rounded-[12px] p-4 space-y-4 shadow-sm">
        <div class="flex justify-between items-center">
          <h3 class="text-base font-medium text-[#1D1B20]">{{ S.outTitle }}</h3>
          <button @click="goToReport" class="bg-[#EADDFF] text-[#21005D] rounded-full px-4 py-1.5 text-sm font-medium transition-colors md3-ripple">{{ S.history }}</button>
        </div>
        
        <div class="grid grid-cols-12 gap-4">
          <div class="col-span-6 md:col-span-4">
            <div class="md3-input-container">
              <input type="date" v-model="form.date" class="md3-input" placeholder=" " />
              <label class="md3-label !bg-[#F3EDF7]">{{ S.outDate }}</label>
            </div>
          </div>
          <div class="col-span-6 md:col-span-4">
            <div class="md3-input-container md3-picker">
              <ItemPicker v-model="form.project" source="PROJECTS" placeholder=" " @change="onProjectChange" class="md3-input" :class="{'has-val': !!form.project}" />
              <label class="md3-label !bg-[#F3EDF7]">{{ S.proj }}</label>
            </div>
          </div>
          <div class="col-span-12 md:col-span-4">
            <div class="md3-input-container md3-picker">
              <ItemPicker v-model="form.contractor" source="CONTRACTORS" :placeholder="S.pick" class="md3-input" :class="{'has-val': !!form.contractor}" />
              <label class="md3-label !bg-[#F3EDF7]">{{ S.contractor || 'Contractor' }}</label>
            </div>
          </div>
        </div>
      </section>

      <div class="space-y-3">
        <div v-for="(line, idx) in lines" :key="idx" class="bg-[#F3EDF7] rounded-[12px] p-4 relative animate-fade-in-up">
          <button @click="removeLine(idx)" aria-label="Remove" class="absolute top-2 right-2 w-10 h-10 flex items-center justify-center rounded-full text-[#49454F] hover:bg-[#E8DEF8] transition-colors md3-ripple">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
          <div class="space-y-3 pt-2">
            <div class="grid grid-cols-12 gap-4 mt-2">
              <div class="col-span-8 min-w-0">
                <div class="md3-input-container md3-picker">
                  <ItemPicker v-model="line.name" source="MATERIALS" :placeholder="lang==='th'?'ระบุวัสดุ...':'Select material...'" :allow-add="true" @change="onMaterialSelect(line)" class="md3-input" :class="{'has-val': !!line.name}" />
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
            <div class="flex items-center justify-between gap-3 pt-2">
              <div class="md3-input-container flex-1">
                <input type="text" v-model="line.note" placeholder=" " class="md3-input" />
                <label class="md3-label !bg-[#F3EDF7]">{{ S.lineNote }}</label>
              </div>
              <div class="flex items-center gap-2 text-xs flex-shrink-0 min-w-[80px] justify-end">
                <span class="text-xs font-medium text-[#49454F]">{{ lang === 'th' ? 'คงเหลือ' : 'Stock' }}</span>
                <div v-if="line.stockLoading" class="animate-spin w-3 h-3 border-2 border-[#CAC4D0] border-t-[#6750A4] rounded-full"></div>
                <span v-else-if="line.stock" :class="line.stock.color" class="px-2 py-0.5 rounded-[4px] font-bold text-xs">{{ line.stock.val }}</span>
                <span v-else class="text-[#CAC4D0]">—</span>
              </div>
            </div>
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
