import { ref, computed } from 'vue';
import { db } from '../firebase.js';
import { collection, doc, runTransaction } from 'firebase/firestore';
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
    const goToHistory = () => window.dispatchEvent(new CustomEvent('switch-tab', { detail: 'out_history' }));

    const submit = async () => {
      const validLines = lines.value
        .filter(l => l.name && l.qty && Number(l.qty) > 0)
        .map(l => ({ name: l.name, qty: Number(l.qty), note: l.note || '' }));

      if (validLines.length === 0)
        return toast(props.lang === 'th' ? 'กรุณาเพิ่มรายการและจำนวนต้องมากกว่า 0' : 'Add at least one line with qty > 0');

      loading.value = true;
      try {
        await runTransaction(db, async (transaction) => {
          // READ
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
          // WRITE
          updates.forEach(u => transaction.update(u.ref, { stock: u.newStock }));
          const docNo = 'OUT-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
          const newOrderRef = doc(collection(db, 'orders'));
          transaction.set(newOrderRef, {
            type: 'OUT', docNo,
            date: form.value.date, project: form.value.project,
            subProject: form.value.subProject || '', contractor: form.value.contractor,
            note: form.value.note,
            requester: props.user.displayName || props.user.email,
            requesterEmail: props.user.email, requesterPhoto: props.user.photoURL,
            items: validLines, timestamp: new Date().toISOString()
          });
        });

        toast(props.lang === 'th' ? 'บันทึกแล้ว' : 'Saved');
        lines.value = [{ name: '', qty: '', note: '', stock: null, stockLoading: false }];
        form.value.note = ''; form.value.project = ''; form.value.subProject = ''; form.value.contractor = '';
      } catch (e) {
        console.error(e);
        toast('Failed: ' + e.message);
      } finally { loading.value = false; }
    };

    return { S, form, lines, loading, subProjects, onProjectChange, addLine, removeLine, onMaterialSelect, submit, goToHistory };
  },
  template: `
    <div class="space-y-4 pb-28">

      <!-- Header card -->
      <section class="md3-card-filled space-y-4">
        <div class="flex justify-between items-center">
          <h3 class="text-[16px] font-medium text-[#1D1B20] flex items-center gap-2">
            <span class="material-symbols-outlined icon-sm text-[#6750A4]">upload</span>
            {{ S.outTitle }}
          </h3>
          <button @click="goToHistory" class="md3-btn-tonal md3-ripple flex items-center gap-1 h-8 px-3 text-[13px]">
            <span class="material-symbols-outlined icon-xs">history</span>
            {{ S.history }}
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <!-- Date -->
          <div class="md3-input-container">
            <input type="date" v-model="form.date" class="md3-input" placeholder=" " />
            <label class="md3-label">{{ S.outDate }}</label>
          </div>

          <!-- Project -->
          <div class="md3-input-container md3-picker">
            <div class="md3-input min-h-[56px] flex items-center" @click="$refs.projPicker.open()">
              <ItemPicker ref="projPicker" v-model="form.project" source="PROJECTS" placeholder=" "
                @change="onProjectChange" />
            </div>
            <label class="md3-label" :class="form.project ? 'text-[12px] -translate-y-[10px]' : ''">{{ S.proj }}</label>
          </div>

          <!-- Sub-Project (always in DOM, shown/hidden via v-show) -->
          <div class="md3-input-container md3-picker sm:col-span-1" v-show="subProjects.length > 0">
            <div class="md3-input min-h-[56px] flex items-center" @click="$refs.subProjPicker.open()">
              <ItemPicker ref="subProjPicker" v-model="form.subProject" :items="subProjects" placeholder=" " />
            </div>
            <label class="md3-label" :class="form.subProject ? 'text-[12px] -translate-y-[10px]' : ''">{{ S.subProj }}</label>
          </div>

          <!-- Contractor -->
          <div class="md3-input-container md3-picker" :class="subProjects.length > 0 ? '' : 'sm:col-span-1'">
            <div class="md3-input min-h-[56px] flex items-center" @click="$refs.contractorPicker.open()">
              <ItemPicker ref="contractorPicker" v-model="form.contractor" source="CONTRACTORS" :placeholder="S.pick" />
            </div>
            <label class="md3-label" :class="form.contractor ? 'text-[12px] -translate-y-[10px]' : ''">{{ S.contractor }}</label>
          </div>

          <!-- Note -->
          <div class="md3-input-container sm:col-span-2">
            <input type="text" v-model="form.note" placeholder=" " class="md3-input" />
            <label class="md3-label">{{ S.note }}</label>
          </div>

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

          <div class="space-y-3 pt-2">
            <div class="grid grid-cols-12 gap-3">
              <div class="col-span-8 min-w-0">
                <div class="md3-input-container md3-picker" :class="{'has-value': !!line.name}">
                  <ItemPicker v-model="line.name" source="MATERIALS"
                    :placeholder="lang==='th'?'ระบุวัสดุ...':'Select material...'"
                    :allow-add="true" @change="onMaterialSelect(line)"
                    class="md3-input" :class="{'has-val': !!line.name}" />
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

            <div class="flex items-center justify-between gap-3">
              <div class="md3-input-container flex-1">
                <input type="text" v-model="line.note" placeholder=" " class="md3-input" />
                <label class="md3-label">{{ S.lineNote }}</label>
              </div>
              <div class="flex items-center gap-2 text-[12px] shrink-0 min-w-[80px] justify-end">
                <span class="font-medium text-[#49454F]">{{ lang === 'th' ? 'คงเหลือ' : 'Stock' }}</span>
                <div v-if="line.stockLoading" class="w-4 h-4 border-2 border-[#CAC4D0] border-t-[#6750A4] rounded-full animate-spin"></div>
                <span v-else-if="line.stock" :class="line.stock.color" class="px-2 py-0.5 rounded-full font-bold text-[12px]">
                  {{ line.stock.val }}
                </span>
                <span v-else class="text-[#CAC4D0]">—</span>
              </div>
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
