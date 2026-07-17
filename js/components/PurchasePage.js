import { ref, computed, onMounted, watch } from 'vue';
import { supabase } from '../supabase.js';
import { fetchProjects, fetchContractors, fetchRequesters, docNo } from '../data.js';
import { toast, toastError } from '../toast.js';
import ItemPickerModal from './ItemPickerModal.js';
import QuickAddSelect from './QuickAddSelect.js';

const STEPS = ['ร่าง', 'รออนุมัติ', 'อนุมัติแล้ว', 'สั่งซื้อแล้ว', 'รับของครบ'];
const STEP_LABELS = { 'ร่าง': 'ร่าง / สร้างคำขอ', 'รออนุมัติ': 'รออนุมัติ', 'อนุมัติแล้ว': 'อนุมัติแล้ว', 'สั่งซื้อแล้ว': 'สั่งซื้อแล้ว', 'รับของครบ': 'รับของครบ' };
const STATUS_OPTIONS = [...STEPS, 'ปฏิเสธ'];

export default {
  props: ['requester'],
  components: { ItemPickerModal, QuickAddSelect },
  setup(props) {
    const projects = ref([]);
    const contractors = ref([]);
    const requesters = ref([]);
    const requests = ref([]);

    const projectId = ref('');
    const subProject = ref('');
    const contractorId = ref('');
    const requesterId = ref('');
    const urgency = ref('ปกติ');
    const note = ref('');
    const lines = ref([]);
    const pickerOpen = ref(false);
    const submitting = ref(false);
    const previewDocNo = ref(docNo('PR'));

    const load = async () => {
      [projects.value, contractors.value, requesters.value] = await Promise.all([fetchProjects(), fetchContractors(), fetchRequesters()]);
      if (props.requester) requesterId.value = props.requester.id;
      const { data } = await supabase.from('purchase_requests').select('*, purchase_request_items(*)').order('created_at', { ascending: false }).limit(20);
      requests.value = data || [];
    };
    onMounted(load);

    const onProjectCreated = (p) => projects.value.push(p);
    const onContractorCreated = (c) => contractors.value.push(c);

    const excludeIds = computed(() => lines.value.map(l => l.material.id));
    const addLines = (materials) => materials.forEach(m => lines.value.push({ material: m, qty: 1 }));
    const removeLine = (i) => lines.value.splice(i, 1);

    const projectName = computed(() => projects.value.find(p => p.id === projectId.value)?.name || '');
    const contractorName = computed(() => contractors.value.find(c => c.id === contractorId.value)?.name || '');
    const requesterName = computed(() => requesters.value.find(r => r.id === requesterId.value)?.name || '');
    const subProjectOptions = computed(() => projects.value.find(p => p.id === projectId.value)?.sub_projects || []);
    watch(projectId, () => { subProject.value = ''; });

    const submit = async () => {
      if (lines.value.length === 0) return;
      submitting.value = true;
      try {
        const { data: pr, error } = await supabase.from('purchase_requests').insert({
          doc_no: previewDocNo.value, project_id: projectId.value || null, sub_project: subProject.value || null,
          contractor_id: contractorId.value || null,
          requester_id: requesterId.value || null, urgency: urgency.value, note: note.value || null, status: 'รออนุมัติ'
        }).select().single();
        if (error) throw error;
        for (const l of lines.value) {
          const { error: itemErr } = await supabase.from('purchase_request_items').insert({
            purchase_request_id: pr.id, material_id: l.material.id, material_name: l.material.name, qty: l.qty
          });
          if (itemErr) throw itemErr;
        }
        toast('ส่งใบขอซื้อแล้ว');
        lines.value = []; note.value = ''; urgency.value = 'ปกติ'; subProject.value = '';
        previewDocNo.value = docNo('PR');
        await load();
      } catch (e) {
        toastError(e, 'ส่งใบขอซื้อไม่สำเร็จ');
      } finally { submitting.value = false; }
    };

    const pendingQueue = computed(() => requests.value.filter(r => r.status === 'รออนุมัติ'));

    const decide = async (pr, approve) => {
      const { error } = await supabase.from('purchase_requests').update({ status: approve ? 'อนุมัติแล้ว' : 'ปฏิเสธ', updated_at: new Date().toISOString() }).eq('id', pr.id);
      if (error) return toastError(error, 'บันทึกไม่สำเร็จ');
      toast(approve ? 'อนุมัติแล้ว' : 'ปฏิเสธแล้ว');
      await load();
    };

    const receiveOne = async (item, pr, qty) => {
      const { data: mat, error: readErr } = await supabase.from('materials').select('stock,name').eq('id', item.material_id).single();
      if (readErr) throw readErr;
      const newStock = Number(mat.stock || 0) + Number(qty);
      const { error: updErr } = await supabase.from('materials').update({ stock: newStock }).eq('id', item.material_id);
      if (updErr) throw updErr;
      const { error: insErr } = await supabase.from('movements').insert({
        type: 'IN', doc_no: pr.doc_no, date: new Date().toISOString().slice(0, 10), timestamp: new Date().toISOString(),
        material_id: item.material_id, material_name: mat.name, qty, prev_stock: mat.stock, new_stock: newStock,
        project: lookupName(projects.value, pr.project_id), sub_project: pr.sub_project || null,
        contractor: lookupName(contractors.value, pr.contractor_id), requester: lookupName(requesters.value, pr.requester_id),
        status: 'บันทึกแล้ว'
      });
      if (insErr) throw insErr;
    };

    const canReceive = (pr) => ['อนุมัติแล้ว', 'สั่งซื้อแล้ว'].includes(pr.status);

    const receiveQty = ref({});
    const qtyOf = (item) => receiveQty.value[item.id] ?? item.qty;
    const setQty = (item, val) => { receiveQty.value[item.id] = val; };

    const receiveItem = async (pr, item) => {
      if (item.received || !item.material_id) return;
      const qty = Number(qtyOf(item));
      if (!qty || qty <= 0) return toastError(new Error('invalid qty'), 'กรุณาระบุจำนวนที่ถูกต้อง');
      try {
        await receiveOne(item, pr, qty);
        const { error } = await supabase.from('purchase_request_items').update({ received: true }).eq('id', item.id);
        if (error) throw error;
        toast(`รับ ${item.material_name} แล้ว`);
        const allReceived = pr.purchase_request_items.every(it => it.id === item.id || it.received || !it.material_id);
        if (allReceived && pr.status !== 'รับของครบ') {
          const { error: statusErr } = await supabase.from('purchase_requests').update({ status: 'รับของครบ', updated_at: new Date().toISOString() }).eq('id', pr.id);
          if (statusErr) throw statusErr;
        }
        await load();
      } catch (e) {
        toastError(e, 'รับของไม่สำเร็จ');
      }
    };

    const changeStatus = async (pr, newStatus) => {
      if (!newStatus || newStatus === pr.status) return;
      try {
        if (newStatus === 'รับของครบ' && pr.status !== 'รับของครบ') {
          let skipped = 0;
          for (const item of pr.purchase_request_items) {
            if (item.received) continue;
            if (!item.material_id) { skipped++; continue; } // material was deleted since this PR was created
            await receiveOne(item, pr, item.qty);
          }
          if (skipped > 0) toast(`ข้าม ${skipped} รายการที่วัสดุถูกลบไปแล้ว`, 'error');
          const { error: itemsErr } = await supabase.from('purchase_request_items').update({ received: true }).eq('purchase_request_id', pr.id);
          if (itemsErr) throw itemsErr;
        }
        const { error } = await supabase.from('purchase_requests').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', pr.id);
        if (error) throw error;
        toast('อัปเดตสถานะแล้ว');
        await load();
      } catch (e) {
        toastError(e, 'อัปเดตไม่สำเร็จ');
      }
    };

    const urgencyPill = (u) => u === 'ด่วนมาก' ? 'pill-danger' : (u === 'ด่วน' ? 'pill-warning' : 'pill-neutral');
    const statusPill = (s) => ({ 'รออนุมัติ': 'pill-warning', 'อนุมัติแล้ว': 'pill-accent', 'สั่งซื้อแล้ว': 'pill-purple', 'รับของครบ': 'pill-success', 'ปฏิเสธ': 'pill-danger' }[s] || 'pill-neutral');

    const expandedRequests = ref({});
    const toggleRequest = (id) => { expandedRequests.value[id] = !expandedRequests.value[id]; };
    const nameOf = (list, id) => list.find(x => x.id === id)?.name || '—';
    const lookupName = (list, id) => list.find(x => x.id === id)?.name || null;

    return { projects, contractors, requesters, requests, projectId, subProject, subProjectOptions, contractorId, requesterId, urgency, note,
             lines, pickerOpen, submitting, previewDocNo, excludeIds, addLines, removeLine, submit,
             pendingQueue, decide, changeStatus, canReceive, receiveItem, qtyOf, setQty, urgencyPill, statusPill, STEPS, STEP_LABELS, STATUS_OPTIONS,
             onProjectCreated, onContractorCreated, expandedRequests, toggleRequest, nameOf };
  },
  template: `
  <div class="flex flex-col gap-5 animate-fade">
    <div class="flex items-center justify-between flex-wrap gap-2">
      <div>
        <h1 class="page-title">สร้างใบขอซื้อ</h1>
        <p class="text-sm text-secondary">คำขอซื้อจะถูกส่งให้ผู้อนุมัติตรวจสอบก่อนสั่งซื้อ</p>
      </div>
      <span class="pill pill-neutral mono">เลขที่ {{ previewDocNo }}</span>
    </div>

    <div class="split-1-6">
      <div class="flex flex-col gap-5">
        <div class="glass-card">
          <div class="grid gap-4" style="grid-template-columns: repeat(auto-fit, minmax(180px,1fr));">
            <div class="input-group">
              <label class="input-label">ผู้ขอซื้อ</label>
              <select v-model="requesterId" class="input-field"><option value="">เลือก</option><option v-for="r in requesters" :key="r.id" :value="r.id">{{ r.name }}</option></select>
            </div>
            <div class="input-group">
              <label class="input-label">โครงการ</label>
              <QuickAddSelect v-model="projectId" :options="projects" placeholder="เลือก" new-label="โครงการ" table="projects" @created="onProjectCreated" />
            </div>
            <div class="input-group" v-if="subProjectOptions.length">
              <label class="input-label">โครงการย่อย</label>
              <select v-model="subProject" class="input-field">
                <option value="">เลือกโครงการย่อย</option>
                <option v-for="s in subProjectOptions" :key="s" :value="s">{{ s }}</option>
              </select>
            </div>
            <div class="input-group">
              <label class="input-label">ผู้รับเหมา</label>
              <QuickAddSelect v-model="contractorId" :options="contractors" placeholder="เลือก" new-label="ผู้รับเหมา" table="contractors" @created="onContractorCreated" />
            </div>
            <div class="input-group">
              <label class="input-label">ความเร่งด่วน</label>
              <div class="segmented">
                <button class="segmented-btn" :class="{active: urgency==='ปกติ'}" @click="urgency='ปกติ'">ปกติ</button>
                <button class="segmented-btn" :class="{active: urgency==='ด่วน'}" @click="urgency='ด่วน'">ด่วน</button>
                <button class="segmented-btn danger" :class="{active: urgency==='ด่วนมาก'}" @click="urgency='ด่วนมาก'">ด่วนมาก</button>
              </div>
            </div>
          </div>
          <div class="input-group mt-4">
            <label class="input-label">หมายเหตุ</label>
            <textarea v-model="note" class="input-field" rows="2" placeholder="หมายเหตุ..."></textarea>
          </div>
        </div>

        <div class="glass-card">
          <div class="flex items-center justify-between mb-3">
            <h3 class="card-title">วัสดุที่ต้องการซื้อ</h3>
            <button class="btn btn-surface" @click="pickerOpen=true"><span class="icon icon-sm">add</span>เพิ่ม</button>
          </div>
          <div v-if="lines.length===0" class="text-center text-secondary text-sm p-6">ยังไม่มีรายการ</div>
          <div v-else class="flex flex-col gap-2">
            <div v-for="(l,i) in lines" :key="l.material.id" class="flex items-center justify-between gap-3" style="padding:10px 0;border-bottom:1px solid var(--divider);">
              <div class="flex-1 min-w-0">
                <div class="font-medium text-primary truncate">{{ l.material.name }}</div>
                <div class="text-xs" :class="l.material.stock <= l.material.min ? 'text-danger' : 'text-secondary'">คงเหลือ {{ l.material.stock }}<span v-if="l.material.stock<=l.material.min"> · ใกล้หมด</span></div>
              </div>
              <input type="number" class="input-field" style="max-width:100px;height:40px;" v-model="l.qty" />
              <button class="btn-icon text-danger" @click="removeLine(i)"><span class="icon icon-sm">delete</span></button>
            </div>
          </div>
        </div>

        <button class="btn btn-primary w-full" style="height:52px;" :disabled="lines.length===0 || submitting" @click="submit">
          <span v-if="submitting" class="icon animate-spin icon-sm">refresh</span>ส่งใบขอซื้อ →
        </button>
      </div>

      <div class="flex flex-col gap-5">
        <div class="glass-card desktop-only">
          <h3 class="card-title mb-4">ขั้นตอนสถานะใบขอซื้อ</h3>
          <div class="stepper">
            <div v-for="(s,i) in STEPS" :key="s" class="stepper-step" :class="i===0 ? 'current' : ''">
              <div>
                <div class="stepper-dot"><span v-if="i===0" class="icon" style="font-size:13px;">check</span></div>
                <div v-if="i<STEPS.length-1" class="stepper-line"></div>
              </div>
              <div>
                <div class="stepper-label">{{ STEP_LABELS[s] }}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="glass-card mobile-only">
          <h3 class="card-title mb-3">ขั้นตอนสถานะ</h3>
          <div class="stepper-h">
            <template v-for="(s,i) in STEPS" :key="s">
              <div class="stepper-h-dot" :class="i===0 ? 'current' : ''"></div>
              <div v-if="i<STEPS.length-1" class="stepper-h-line"></div>
            </template>
          </div>
          <div class="text-xs text-secondary mt-2">{{ STEP_LABELS[STEPS[0]] }}</div>
        </div>

        <div class="glass-card">
          <div class="flex items-center gap-2 mb-3">
            <h3 class="card-title">รออนุมัติของคุณ</h3>
            <span class="pill pill-danger">{{ pendingQueue.length }}</span>
          </div>
          <div v-if="pendingQueue.length===0" class="text-sm text-secondary">ไม่มีรายการรออนุมัติ</div>
          <div v-for="pr in pendingQueue" :key="pr.id" class="glass-panel mb-2" style="padding:12px;">
            <div class="flex justify-between items-start mb-1">
              <span class="mono text-sm font-semibold">{{ pr.doc_no }}</span>
              <span class="pill" :class="urgencyPill(pr.urgency)">{{ pr.urgency }}</span>
            </div>
            <div class="text-xs text-secondary mb-3">{{ pr.purchase_request_items.length }} รายการ</div>
            <div class="flex gap-2">
              <button class="btn btn-success" style="flex:1;height:36px;" @click="decide(pr, true)">อนุมัติ</button>
              <button class="btn btn-danger-solid" style="flex:1;height:36px;" @click="decide(pr, false)">ปฏิเสธ</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="glass-card" style="padding:0; overflow:hidden;">
      <h3 class="card-title p-4" style="padding-bottom:0;">ประวัติใบขอซื้อ</h3>
      <div class="flex flex-col">
        <div v-for="pr in requests" :key="pr.id" style="border-top:1px solid var(--divider);">
          <div class="p-4 cursor-pointer select-none" @click="toggleRequest(pr.id)">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div class="flex items-center gap-3">
                <span class="mono text-sm font-semibold text-accent">{{ pr.doc_no }}</span>
                <span class="pill" :class="statusPill(pr.status)">{{ pr.status }}</span>
                <span class="pill" :class="urgencyPill(pr.urgency)">{{ pr.urgency }}</span>
              </div>
              <div class="flex items-center gap-2">
                <select class="input-field" style="height:36px; width:auto; padding:0 10px;" :value="pr.status" @click.stop @change="changeStatus(pr, $event.target.value)">
                  <option v-for="s in STATUS_OPTIONS" :key="s" :value="s">{{ s }}</option>
                </select>
                <span class="icon icon-sm text-tertiary" style="transition: transform .2s;" :style="expandedRequests[pr.id] ? 'transform:rotate(180deg);' : ''">expand_more</span>
              </div>
            </div>
            <div class="text-xs text-secondary mt-1">{{ pr.purchase_request_items.length }} รายการ</div>
          </div>

          <div v-if="expandedRequests[pr.id]" class="animate-fade" style="border-top:1px solid var(--divider); background:var(--field);">
            <div class="p-4 grid gap-3" style="grid-template-columns: repeat(auto-fit, minmax(140px,1fr));">
              <div>
                <div class="text-xs text-tertiary mb-1">ผู้ขอซื้อ</div>
                <div class="text-sm font-medium text-primary">{{ nameOf(requesters, pr.requester_id) }}</div>
              </div>
              <div>
                <div class="text-xs text-tertiary mb-1">โครงการ</div>
                <div class="text-sm font-medium text-primary">{{ nameOf(projects, pr.project_id) }}</div>
              </div>
              <div v-if="pr.sub_project">
                <div class="text-xs text-tertiary mb-1">โครงการย่อย</div>
                <div class="text-sm font-medium text-primary">{{ pr.sub_project }}</div>
              </div>
              <div>
                <div class="text-xs text-tertiary mb-1">ผู้รับเหมา</div>
                <div class="text-sm font-medium text-primary">{{ nameOf(contractors, pr.contractor_id) }}</div>
              </div>
            </div>
            <div v-if="pr.note" class="px-4 pb-3 text-xs text-secondary">หมายเหตุ: {{ pr.note }}</div>
            <div class="px-4 pb-4 flex flex-col gap-4">
              <div v-if="pr.purchase_request_items.some(i => !i.received)">
                <div class="text-xs text-tertiary mb-2">รอรับของ</div>
                <div class="flex flex-col gap-2">
                  <div v-for="item in pr.purchase_request_items.filter(i => !i.received)" :key="item.id" class="flex items-center justify-between gap-3" style="padding:8px 12px; background:var(--panel); border-radius:12px;">
                    <div class="min-w-0">
                      <span class="text-sm text-primary">{{ item.material_name }}</span>
                      <div class="text-xs text-tertiary">สั่ง {{ item.qty }}</div>
                    </div>
                    <div class="flex items-center gap-2">
                      <template v-if="canReceive(pr) && item.material_id">
                        <input type="number" min="0" step="any" class="input-field" style="width:70px;height:32px;padding:0 8px;" :value="qtyOf(item)" @click.stop @input="setQty(item, $event.target.value)" />
                        <button class="btn btn-surface" style="height:32px; padding:0 10px;" @click.stop="receiveItem(pr, item)">
                          <span class="icon icon-sm">inventory</span>รับของ
                        </button>
                      </template>
                      <template v-else>
                        <span class="font-bold text-sm text-primary">{{ item.qty }}</span>
                        <span v-if="!item.material_id" class="text-xs text-danger">วัสดุถูกลบ</span>
                      </template>
                    </div>
                  </div>
                </div>
              </div>
              <div v-if="pr.purchase_request_items.some(i => i.received)">
                <div class="text-xs text-tertiary mb-2">รับของแล้ว</div>
                <div class="flex flex-col gap-2">
                  <div v-for="item in pr.purchase_request_items.filter(i => i.received)" :key="item.id" class="flex items-center justify-between" style="padding:8px 12px; background:var(--panel); border-radius:12px; opacity:.7;">
                    <span class="text-sm text-primary">{{ item.material_name }}</span>
                    <div class="flex items-center gap-2">
                      <span class="font-bold text-sm text-primary">{{ item.qty }}</span>
                      <span class="icon icon-sm text-success">check_circle</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="requests.length===0" class="text-center text-secondary text-sm p-4">ยังไม่มีใบขอซื้อ</div>
      </div>
    </div>

    <ItemPickerModal v-if="pickerOpen" :exclude-ids="excludeIds" confirm-label="เพิ่มเข้าใบขอซื้อ" @close="pickerOpen=false" @confirm="addLines" />
  </div>
  `
};
