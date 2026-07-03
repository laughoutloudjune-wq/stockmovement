import { ref, computed, onMounted } from 'vue';
import { supabase } from '../supabase.js';
import { fetchProjects, fetchContractors, fetchRequesters, docNo } from '../data.js';
import ItemPickerModal from './ItemPickerModal.js';
import QuickAddSelect from './QuickAddSelect.js';

export default {
  props: ['requester'],
  components: { ItemPickerModal, QuickAddSelect },
  setup(props) {
    const projects = ref([]);
    const contractors = ref([]);
    const requesters = ref([]);
    const projectId = ref('');
    const contractorId = ref('');
    const requesterId = ref('');
    const note = ref('');
    const lines = ref([]); // {material, qty}
    const pickerOpen = ref(false);
    const submitting = ref(false);

    onMounted(async () => {
      [projects.value, contractors.value, requesters.value] = await Promise.all([
        fetchProjects(), fetchContractors(), fetchRequesters()
      ]);
      if (props.requester) requesterId.value = props.requester.id;
    });

    const onProjectCreated = (p) => projects.value.push(p);
    const onContractorCreated = (c) => contractors.value.push(c);

    const excludeIds = computed(() => lines.value.map(l => l.material.id));
    const addLines = (materials) => {
      materials.forEach(m => lines.value.push({ material: m, qty: 1 }));
    };
    const removeLine = (i) => lines.value.splice(i, 1);
    const inc = (l) => { l.qty++; };
    const dec = (l) => { if (l.qty > 1) l.qty--; };

    const projectName = computed(() => projects.value.find(p => p.id === projectId.value)?.name || '');
    const contractorName = computed(() => contractors.value.find(c => c.id === contractorId.value)?.name || '');
    const requesterName = computed(() => requesters.value.find(r => r.id === requesterId.value)?.name || '');

    const submit = async () => {
      if (lines.value.length === 0) return;
      submitting.value = true;
      try {
        const no = docNo('REQ');
        for (const l of lines.value) {
          const { data: mat } = await supabase.from('materials').select('stock').eq('id', l.material.id).single();
          const newStock = Number(mat.stock || 0) - Number(l.qty);
          await supabase.from('materials').update({ stock: newStock }).eq('id', l.material.id);
          await supabase.from('movements').insert({
            type: 'OUT', doc_no: no, date: new Date().toISOString().slice(0, 10), timestamp: new Date().toISOString(),
            material_id: l.material.id, material_name: l.material.name, qty: l.qty,
            prev_stock: mat.stock, new_stock: newStock,
            project: projectName.value || null, contractor: contractorName.value || null,
            requester: requesterName.value || null, note: note.value || null, status: 'บันทึกแล้ว'
          });
        }
        lines.value = []; note.value = '';
      } finally { submitting.value = false; }
    };

    return { projects, contractors, requesters, projectId, contractorId, requesterId, note,
             lines, pickerOpen, submitting, excludeIds, addLines, removeLine, inc, dec, submit,
             onProjectCreated, onContractorCreated };
  },
  template: `
  <div class="flex flex-col gap-5 animate-fade">
    <div>
      <h1 class="page-title">สร้างใบเบิก</h1>
      <p class="text-sm mt-1" style="color:var(--success-text);"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--success);margin-right:6px;"></span>บันทึกทันที ไม่ต้องรออนุมัติ</p>
    </div>

    <div class="glass-card">
      <div class="grid gap-4" style="grid-template-columns: repeat(auto-fit, minmax(200px,1fr));">
        <div class="input-group">
          <label class="input-label">ผู้ขอเบิก</label>
          <select v-model="requesterId" class="input-field">
            <option value="">เลือกผู้ขอเบิก</option>
            <option v-for="r in requesters" :key="r.id" :value="r.id">{{ r.name }}</option>
          </select>
        </div>
        <div class="input-group">
          <label class="input-label">โครงการ</label>
          <QuickAddSelect v-model="projectId" :options="projects" placeholder="เลือกโครงการ" new-label="โครงการ" table="projects" @created="onProjectCreated" />
        </div>
        <div class="input-group">
          <label class="input-label">ผู้รับเหมา</label>
          <QuickAddSelect v-model="contractorId" :options="contractors" placeholder="เลือกผู้รับเหมา" new-label="ผู้รับเหมา" table="contractors" @created="onContractorCreated" />
        </div>
      </div>
    </div>

    <div class="glass-card">
      <div class="flex items-center justify-between mb-3">
        <h3 class="card-title">รายการวัสดุ</h3>
        <button class="btn btn-surface" @click="pickerOpen=true"><span class="icon icon-sm">add</span>เพิ่มวัสดุ</button>
      </div>

      <div v-if="lines.length===0" class="text-center text-secondary text-sm p-6">ยังไม่มีรายการ</div>

      <!-- Desktop table -->
      <div v-else class="table-wrapper desktop-only">
        <table>
          <thead><tr><th>วัสดุ</th><th>คงเหลือในระบบ</th><th>จำนวนที่เบิก</th><th></th></tr></thead>
          <tbody>
            <tr v-for="(l,i) in lines" :key="l.material.id">
              <td>{{ l.material.name }}</td>
              <td>{{ l.material.stock }}</td>
              <td>
                <div class="flex items-center gap-2">
                  <button class="btn-icon" @click="dec(l)"><span class="icon icon-sm">remove</span></button>
                  <span class="font-semibold" style="min-width:24px;text-align:center;">{{ l.qty }}</span>
                  <button class="btn-icon" @click="inc(l)"><span class="icon icon-sm">add</span></button>
                </div>
              </td>
              <td><button class="btn-icon text-danger" @click="removeLine(i)"><span class="icon icon-sm">delete</span></button></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile cards -->
      <div class="mobile-only flex flex-col gap-3">
        <div v-for="(l,i) in lines" :key="l.material.id" class="glass-panel" style="padding:14px;">
          <div class="flex justify-between items-start mb-2">
            <div class="font-semibold text-primary">{{ l.material.name }}</div>
            <button class="btn-icon text-danger" @click="removeLine(i)"><span class="icon icon-sm">delete</span></button>
          </div>
          <div class="text-xs text-secondary mb-2">คงเหลือในระบบ: {{ l.material.stock }}</div>
          <div class="flex items-center gap-3">
            <button class="btn-icon" style="background:var(--field);" @click="dec(l)"><span class="icon icon-sm">remove</span></button>
            <span class="font-bold text-lg">{{ l.qty }}</span>
            <button class="btn-icon" style="background:var(--accent);color:#fff;" @click="inc(l)"><span class="icon icon-sm">add</span></button>
          </div>
        </div>
      </div>
    </div>

    <div class="input-group">
      <label class="input-label">หมายเหตุ</label>
      <textarea v-model="note" class="input-field" rows="2" placeholder="หมายเหตุเพิ่มเติม..."></textarea>
    </div>

    <button class="btn btn-primary w-full" style="height:52px;" :disabled="lines.length===0 || submitting" @click="submit">
      <span v-if="submitting" class="icon animate-spin icon-sm">refresh</span>
      บันทึกใบเบิก ({{ lines.length }} รายการ)
    </button>

    <ItemPickerModal v-if="pickerOpen" :exclude-ids="excludeIds" confirm-label="เพิ่มเข้าใบเบิก" @close="pickerOpen=false" @confirm="addLines" />
  </div>
  `
};
