import { ref, computed, onMounted } from 'vue';
import { db } from '../firebase.js';
import { collection, addDoc, query, where, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { STR, LOOKUPS, toast, todayStr } from '../shared.js';
import ItemPicker from './ItemPicker.js';

const daysFromNow = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
};

const ITEM_STATUS = ['Requested', 'Quoted', 'Ordered', 'Received', 'Cancelled'];

// Returns { chipClass, icon } per status
const statusMeta = (s) => {
  s = (s || '').toLowerCase();
  if (s.includes('receive'))  return { cls: 'md3-chip-received',  icon: 'check_circle',  label: s };
  if (s.includes('approve'))  return { cls: 'md3-chip-approved',  icon: 'thumb_up',      label: s };
  if (s.includes('cancel'))   return { cls: 'md3-chip-cancelled', icon: 'cancel',        label: s };
  if (s.includes('reject'))   return { cls: 'md3-chip-cancelled', icon: 'cancel',        label: s };
  if (s.includes('order'))    return { cls: 'md3-chip-ordered',   icon: 'local_shipping',label: s };
  if (s.includes('quote'))    return { cls: 'md3-chip-quoted',    icon: 'request_quote', label: s };
  if (s.includes('request'))  return { cls: 'md3-chip-requested', icon: 'schedule',      label: s };
  return { cls: 'md3-chip-neutral', icon: 'help_outline', label: s };
};

const priorityMeta = (p) => {
  p = (p || '').toLowerCase();
  if (p === 'critical') return { cls: 'bg-[#F9DEDC] text-[#B3261E]', icon: 'priority_high' };
  if (p === 'urgent')   return { cls: 'bg-[#FFD8E4] text-[#7D5260]', icon: 'arrow_upward' };
  return { cls: 'bg-[#E6E0E9] text-[#49454F]', icon: 'remove' };
};

export default {
  props: ['lang', 'user'],
  components: { ItemPicker },
  setup(props) {
    const form = ref({
      project: '', subProject: '', contractor: '',
      needBy: daysFromNow(7), priority: 'Normal', note: ''
    });
    const lines = ref([{ name: '', qty: '', status: 'Requested' }]);
    const loading = ref(false);
    const history = ref([]);
    const historyLoading = ref(true);
    const expandedDoc = ref(null);
    const historyStatusFilter = ref('ALL');
    const isEditOpen = ref(false);
    const editForm = ref({});
    const editingId = ref(null);

    const S = computed(() => STR[props.lang]);
    const subProjects = computed(() => LOOKUPS.PROJECT_META[form.value.project] || []);
    const onProjectChange = () => { form.value.subProject = ''; };

    const addLine = () => lines.value.push({ name: '', qty: '', status: 'Requested' });
    const removeLine = (i) => lines.value.splice(i, 1);
    const normalizeItem = (i) => ({ name: i.name, qty: Number(i.qty), status: i.status || 'Requested' });

    const submit = async () => {
      const validLines = lines.value.filter(l => l.name && l.qty && Number(l.qty) > 0).map(normalizeItem);
      if (!validLines.length) return toast(props.lang === 'th' ? 'กรุณาเพิ่มรายการและจำนวนต้องมากกว่า 0' : 'Add at least one line with qty > 0');

      loading.value = true;
      try {
        const docNo = 'PUR-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
        await addDoc(collection(db, 'orders'), {
          type: 'PURCHASE', docNo, status: 'Requested',
          project: form.value.project, subProject: form.value.subProject || '',
          contractor: form.value.contractor, needBy: form.value.needBy,
          priority: form.value.priority, note: form.value.note, remark: form.value.note,
          requester: props.user.displayName || props.user.email,
          requesterEmail: props.user.email, requesterPhoto: props.user.photoURL,
          items: validLines, timestamp: new Date().toISOString(), date: todayStr()
        });

        toast((props.lang === 'th' ? 'ส่งคำขอแล้ว ' : 'Request sent ') + docNo);
        lines.value = [{ name: '', qty: '', status: 'Requested' }];
        form.value.note = ''; form.value.project = ''; form.value.subProject = ''; form.value.contractor = '';
      } catch (e) { console.error(e); toast('Failed'); }
      finally { loading.value = false; }
    };

    let unsubHistory = null;
    const loadHistory = () => {
      historyLoading.value = true;
      const q = query(collection(db, 'orders'), where('type', '==', 'PURCHASE'));
      unsubHistory = onSnapshot(q, (snap) => {
        const raw = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        raw.sort((a, b) => (b.timestamp || b.date || '').localeCompare(a.timestamp || a.date || ''));
        history.value = raw;
        historyLoading.value = false;
      }, (e) => { console.error(e); historyLoading.value = false; });
    };

    const removeOrder = async (id) => {
      if (!confirm('Delete this order?')) return;
      try { await deleteDoc(doc(db, 'orders', id)); toast('Deleted'); }
      catch (e) { console.error(e); toast('Failed to delete'); }
    };

    const openEdit = (item) => {
      editingId.value = item.id;
      editForm.value = JSON.parse(JSON.stringify(item));
      if (!editForm.value.note && editForm.value.remark) editForm.value.note = editForm.value.remark;
      if (!editForm.value.items) editForm.value.items = [];
      isEditOpen.value = true;
    };

    const addEditLine = () => editForm.value.items.push({ name: '', qty: '', status: 'Requested' });
    const removeEditLine = (i) => editForm.value.items.splice(i, 1);

    const saveEdit = async () => {
      try {
        await updateDoc(doc(db, 'orders', editingId.value), {
          date: editForm.value.date || todayStr(),
          project: editForm.value.project || '', subProject: editForm.value.subProject || '',
          contractor: editForm.value.contractor || '', needBy: editForm.value.needBy || '',
          priority: editForm.value.priority || 'Normal', status: editForm.value.status || 'Requested',
          note: editForm.value.note || '', remark: editForm.value.note || '',
          items: (editForm.value.items || []).filter(i => i.name && i.qty).map(normalizeItem)
        });
        toast('Updated'); isEditOpen.value = false;
      } catch (e) { console.error(e); toast('Failed to update'); }
    };

    const toggleExpand = (h) => { expandedDoc.value = expandedDoc.value === h.id ? null : h.id; };

    const updateStatus = async (item, newStatus) => {
      try { await updateDoc(doc(db, 'orders', item.id), { status: newStatus }); item.status = newStatus; toast('Status Updated'); }
      catch (e) { console.error(e); toast('Failed'); }
    };

    const updateItemStatus = async (order, index, newStatus) => {
      try {
        const items = JSON.parse(JSON.stringify(order.items || []));
        if (!items[index]) return;
        items[index].status = newStatus;
        await updateDoc(doc(db, 'orders', order.id), { items });
        order.items[index].status = newStatus;
        toast('Item status updated');
      } catch (e) { console.error(e); toast('Failed'); }
    };

    const filteredHistory = computed(() => {
      if (historyStatusFilter.value === 'ALL') return history.value;
      return history.value.filter(h => (h.status || '').toLowerCase() === historyStatusFilter.value.toLowerCase());
    });

    onMounted(loadHistory);

    return {
      S, form, lines, loading, history, filteredHistory, historyLoading, expandedDoc,
      historyStatusFilter, subProjects, onProjectChange, addLine, removeLine, submit,
      toggleExpand, updateStatus, updateItemStatus, statusMeta, priorityMeta,
      removeOrder, openEdit, isEditOpen, editForm, saveEdit, addEditLine, removeEditLine,
      ITEM_STATUS, LOOKUPS
    };
  },
  template: `
    <div class="space-y-4 pb-28">

      <!-- ── New Request Form ── -->
      <section class="md3-card-filled space-y-4">
        <h3 class="text-[16px] font-medium text-[#1D1B20] flex items-center gap-2">
          <span class="material-symbols-outlined icon-sm text-[#6750A4]">shopping_cart</span>
          {{ S.tabs.pur }}
        </h3>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <!-- Project -->
          <div class="md3-input-container md3-picker">
            <div class="md3-input min-h-[56px] flex items-center" @click="$refs.purProjPicker.open()">
              <ItemPicker ref="purProjPicker" v-model="form.project" source="PROJECTS" placeholder=" " @change="onProjectChange" />
            </div>
            <label class="md3-label" :class="form.project ? 'text-[12px] -translate-y-[10px]' : ''">{{ S.purProj }}</label>
          </div>

          <!-- Sub Project -->
          <div class="md3-input-container md3-picker" v-show="subProjects.length > 0">
            <div class="md3-input min-h-[56px] flex items-center" @click="$refs.purSubProjPicker.open()">
              <ItemPicker ref="purSubProjPicker" v-model="form.subProject" :items="subProjects" placeholder=" " />
            </div>
            <label class="md3-label" :class="form.subProject ? 'text-[12px] -translate-y-[10px]' : ''">{{ S.subProj }}</label>
          </div>

          <!-- Contractor -->
          <div class="md3-input-container md3-picker">
            <div class="md3-input min-h-[56px] flex items-center" @click="$refs.purContractorPicker.open()">
              <ItemPicker ref="purContractorPicker" v-model="form.contractor" source="CONTRACTORS" :placeholder="S.pick" />
            </div>
            <label class="md3-label" :class="form.contractor ? 'text-[12px] -translate-y-[10px]' : ''">{{ S.purContractor }}</label>
          </div>

          <!-- Priority -->
          <div class="md3-input-container">
            <select v-model="form.priority" class="md3-input">
              <option value="Normal">Normal</option>
              <option value="Urgent">Urgent</option>
              <option value="Critical">Critical</option>
            </select>
            <label class="md3-label">{{ S.purPriority }}</label>
          </div>

          <!-- Need By -->
          <div class="md3-input-container">
            <input type="date" v-model="form.needBy" class="md3-input" placeholder=" " />
            <label class="md3-label">{{ S.purNeedBy }}</label>
          </div>

          <!-- Note -->
          <div class="md3-input-container sm:col-span-2">
            <input v-model="form.note" class="md3-input" placeholder=" " />
            <label class="md3-label">{{ S.purNote }}</label>
          </div>
        </div>
      </section>

      <!-- ── Line Items ── -->
      <div class="space-y-3">
        <div v-for="(line, idx) in lines" :key="idx"
          class="bg-[#F3EDF7] rounded-[16px] p-4 relative animate-fade-in-up">
          <button @click="removeLine(idx)" class="absolute top-2 right-2 md3-icon-btn md3-ripple text-[#49454F]">
            <span class="material-symbols-outlined icon-sm">close</span>
          </button>
          <div class="grid grid-cols-12 gap-3 mt-2">
            <div class="col-span-8 min-w-0">
              <div class="md3-input-container md3-picker">
                <div class="md3-input min-h-[56px] flex items-center" @click="line._picker && line._picker.open()">
                  <ItemPicker v-model="line.name" source="MATERIALS" :placeholder="S.pick"
                    class="w-full" />
                </div>
                <label class="md3-label" :class="line.name ? 'text-[12px] -translate-y-[10px]' : ''">{{ lang === 'th' ? 'รายการวัสดุ' : 'Material' }}</label>
              </div>
            </div>
            <div class="col-span-4 min-w-0">
              <div class="md3-input-container">
                <input type="number" v-model="line.qty" placeholder=" " class="md3-input text-center font-bold" />
                <label class="md3-label">{{ lang === 'th' ? 'จำนวน' : 'Qty' }}</label>
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

      <!-- ── Purchase History ── -->
      <section class="mt-6 pt-6 border-t border-[#E6E0E9]">
        <div class="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h3 class="text-[18px] font-medium text-[#1D1B20]">{{ S.purOlder }}</h3>
          <!-- Filter chips row -->
          <div class="flex gap-1.5 flex-wrap">
            <button v-for="opt in ['ALL','Requested','Approved','Ordered','Received','Cancelled']" :key="opt"
              @click="historyStatusFilter = opt"
              :class="historyStatusFilter === opt
                ? 'bg-[#E8DEF8] text-[#1D192B] border-[#6750A4]'
                : 'bg-transparent text-[#49454F] border-[#CAC4D0] hover:bg-[#F3EDF7]'"
              class="md3-ripple px-3 py-1 rounded-full border text-[12px] font-medium transition-colors">
              {{ opt === 'ALL' ? 'All' : opt }}
            </button>
          </div>
        </div>

        <!-- Skeleton -->
        <div v-if="historyLoading" class="space-y-3 animate-pulse">
          <div v-for="i in 3" :key="'sk-pur-'+i" class="h-24 bg-[#E6E0E9] rounded-[16px]"></div>
        </div>

        <!-- Empty -->
        <div v-else-if="filteredHistory.length === 0"
          class="text-center py-14 bg-[#F7F2FA] rounded-[16px] border border-dashed border-[#CAC4D0] flex flex-col items-center gap-2">
          <span class="material-symbols-outlined text-[#CAC4D0]" style="font-size:40px">receipt_long</span>
          <p class="text-[14px] text-[#49454F]">No requests found</p>
        </div>

        <!-- History cards -->
        <div v-else class="space-y-3">
          <div v-for="h in filteredHistory" :key="h.id"
            class="bg-[#FEF7FF] border border-[#CAC4D0] rounded-[20px] overflow-hidden transition-shadow hover:shadow-md3-elevation-1 group">

            <!-- ── Card Header (always visible, tap to expand) ── -->
            <div class="p-4 cursor-pointer select-none" @click="toggleExpand(h)">
              <div class="flex items-start justify-between gap-3">

                <!-- Left: status + doc info -->
                <div class="min-w-0 flex-1">
                  <!-- Status chip + priority badge -->
                  <div class="flex items-center gap-2 flex-wrap mb-2">
                    <span class="md3-chip" :class="statusMeta(h.status).cls" style="height:26px;font-size:12px;padding:0 10px;gap:4px">
                      <span class="material-symbols-outlined" style="font-size:14px">{{ statusMeta(h.status).icon }}</span>
                      {{ h.status || '—' }}
                    </span>
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                      :class="priorityMeta(h.priority).cls">
                      <span class="material-symbols-outlined" style="font-size:13px">{{ priorityMeta(h.priority).icon }}</span>
                      {{ h.priority || 'Normal' }}
                    </span>
                  </div>

                  <!-- Doc No + Project -->
                  <div class="text-[14px] font-semibold text-[#1D1B20] font-mono truncate">{{ h.docNo }}</div>
                  <div v-if="h.project" class="text-[13px] text-[#49454F] mt-0.5 truncate flex items-center gap-1">
                    <span class="material-symbols-outlined" style="font-size:14px">business</span>
                    {{ [h.project, h.subProject].filter(Boolean).join(' › ') }}
                  </div>
                </div>

                <!-- Right: metadata + actions -->
                <div class="shrink-0 flex flex-col items-end gap-2">
                  <!-- Need By -->
                  <div class="text-right">
                    <div class="text-[10px] uppercase tracking-wider text-[#79747E] font-semibold">Need By</div>
                    <div class="text-[13px] font-medium text-[#1D1B20]">{{ h.needBy || '—' }}</div>
                  </div>
                  <!-- Items count chip -->
                  <span class="md3-chip bg-[#ECE6F0] text-[#49454F]" style="height:24px;font-size:11px;padding:0 8px;gap:3px">
                    <span class="material-symbols-outlined" style="font-size:13px">inventory_2</span>
                    {{ (h.items || []).length }} items
                  </span>
                </div>
              </div>

              <!-- Item name preview (collapsed summary) -->
              <div v-if="expandedDoc !== h.id && (h.items||[]).length > 0"
                class="mt-2 flex flex-wrap gap-1">
                <span v-for="it in (h.items||[]).slice(0,3)" :key="it.name"
                  class="text-[11px] bg-[#F3EDF7] text-[#49454F] px-2 py-0.5 rounded-full border border-[#E6E0E9]">
                  {{ it.name }} × {{ it.qty }}
                </span>
                <span v-if="(h.items||[]).length > 3"
                  class="text-[11px] text-[#79747E] px-2 py-0.5">
                  +{{ (h.items||[]).length - 3 }} more
                </span>
              </div>

              <!-- Expand chevron -->
              <div class="flex items-center justify-between mt-3">
                <div class="flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button @click.stop="openEdit(h)"
                    class="md3-btn-tonal md3-ripple h-7 px-3 text-[12px] flex items-center gap-1">
                    <span class="material-symbols-outlined" style="font-size:15px">edit</span>Edit
                  </button>
                  <button @click.stop="removeOrder(h.id)"
                    class="md3-btn-text-error md3-ripple h-7 px-2 text-[12px] flex items-center gap-1">
                    <span class="material-symbols-outlined" style="font-size:15px">delete</span>
                  </button>
                </div>
                <span class="material-symbols-outlined text-[#79747E] transition-transform"
                  :style="expandedDoc === h.id ? 'transform:rotate(180deg)' : ''">
                  expand_more
                </span>
              </div>
            </div>

            <!-- ── Expanded Detail ── -->
            <div v-if="expandedDoc === h.id" class="border-t border-[#E6E0E9] animate-fade-in-up">

              <!-- Meta row -->
              <div class="px-4 py-3 bg-[#F3EDF7] grid grid-cols-2 gap-3 text-[13px]">
                <div>
                  <div class="text-[10px] uppercase tracking-wider text-[#79747E] font-semibold mb-1">Requester</div>
                  <div class="font-medium text-[#1D1B20]">{{ h.requester || '—' }}</div>
                  <div class="text-[11px] text-[#49454F]">{{ h.requesterEmail || '' }}</div>
                </div>
                <div>
                  <div class="text-[10px] uppercase tracking-wider text-[#79747E] font-semibold mb-1">Contractor</div>
                  <div class="font-medium text-[#1D1B20]">{{ h.contractor || '—' }}</div>
                </div>
                <div v-if="h.note || h.remark" class="col-span-2">
                  <div class="text-[10px] uppercase tracking-wider text-[#79747E] font-semibold mb-1">Note</div>
                  <div class="text-[#1D1B20]">{{ h.note || h.remark }}</div>
                </div>
              </div>

              <!-- Status updater -->
              <div class="px-4 py-3 bg-[#F7F2FA] flex items-center gap-3 border-t border-[#E6E0E9]">
                <span class="material-symbols-outlined icon-sm text-[#49454F] shrink-0">sync</span>
                <span class="text-[12px] font-medium text-[#49454F] shrink-0">Update Status</span>
                <div class="md3-input-container flex-1">
                  <select :value="h.status" @change="updateStatus(h, $event.target.value)"
                    class="md3-input py-2 text-[13px] font-medium">
                    <option>Requested</option><option>Approved</option>
                    <option>Ordered</option><option>Received</option><option>Cancelled</option>
                  </select>
                </div>
              </div>

              <!-- Items table -->
              <div class="overflow-x-auto">
                <table class="w-full min-w-[360px]">
                  <thead>
                    <tr class="bg-[#ECE6F0] border-t border-[#E6E0E9]">
                      <th class="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[#49454F]">Material</th>
                      <th class="text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[#49454F]">Qty</th>
                      <th class="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[#49454F]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(li, idx) in h.items" :key="idx"
                      class="border-t border-[#F3EDF7] hover:bg-[#F7F2FA] transition-colors">
                      <td class="px-4 py-3 text-[14px] font-medium text-[#1D1B20]">{{ li.name }}</td>
                      <td class="px-4 py-3 text-right font-bold font-mono text-[15px] text-[#1D1B20]">{{ li.qty }}</td>
                      <td class="px-4 py-2">
                        <select :value="li.status || 'Requested'"
                          @change="updateItemStatus(h, idx, $event.target.value)"
                          class="w-full bg-[#ECE6F0] border border-[#CAC4D0] rounded-[8px] px-2 py-1.5 text-[12px] font-medium text-[#1D1B20] outline-none focus:border-[#6750A4]">
                          <option v-for="st in ITEM_STATUS" :key="st">{{ st }}</option>
                        </select>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      </section>

      <!-- Extended FAB -->
      <div class="fixed bottom-28 right-4 z-30">
        <button @click="submit" :disabled="loading" class="md3-fab-extended md3-ripple">
          <div v-if="loading" class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          <template v-else>
            <span class="material-symbols-outlined">send</span>
            <span>{{ S.btnSubmit }}</span>
          </template>
        </button>
      </div>

      <!-- ── Edit Dialog ── -->
      <teleport to="body">
        <div v-if="isEditOpen" class="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div class="md3-scrim animate-fade-in" @click="isEditOpen = false"></div>
          <div class="relative w-full max-w-2xl md3-dialog-surface flex flex-col max-h-[90vh] animate-scale-in overflow-hidden">

            <div class="px-6 pt-6 pb-4 shrink-0 flex items-center justify-between">
              <h3 class="text-[22px] font-normal text-[#1D1B20]">Edit Purchase Order</h3>
              <button @click="isEditOpen = false" class="md3-icon-btn md3-ripple text-[#49454F]">
                <span class="material-symbols-outlined icon-sm">close</span>
              </button>
            </div>

            <div class="px-6 pb-4 overflow-y-auto space-y-4 flex-1">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="md3-input-container"><input type="date" v-model="editForm.date" class="md3-input" placeholder=" " /><label class="md3-label">Date</label></div>
                <div class="md3-input-container"><input type="date" v-model="editForm.needBy" class="md3-input" placeholder=" " /><label class="md3-label">Need By</label></div>
                <div class="md3-input-container md3-picker">
                  <div class="md3-input min-h-[56px] flex items-center" @click="$refs.editProjPicker.open()">
                    <ItemPicker ref="editProjPicker" v-model="editForm.project" source="PROJECTS" />
                  </div>
                  <label class="md3-label" :class="editForm.project ? 'text-[12px] -translate-y-[10px]' : ''">Project</label>
                </div>
                <div class="md3-input-container md3-picker">
                  <div class="md3-input min-h-[56px] flex items-center" @click="$refs.editSubProjPicker.open()">
                    <ItemPicker ref="editSubProjPicker" v-model="editForm.subProject" :items="LOOKUPS.PROJECT_META[editForm.project] || []" />
                  </div>
                  <label class="md3-label" :class="editForm.subProject ? 'text-[12px] -translate-y-[10px]' : ''">Sub Project</label>
                </div>
                <div class="md3-input-container md3-picker">
                  <div class="md3-input min-h-[56px] flex items-center" @click="$refs.editContractorPicker.open()">
                    <ItemPicker ref="editContractorPicker" v-model="editForm.contractor" source="CONTRACTORS" />
                  </div>
                  <label class="md3-label" :class="editForm.contractor ? 'text-[12px] -translate-y-[10px]' : ''">Contractor</label>
                </div>
                <div class="md3-input-container">
                  <select v-model="editForm.priority" class="md3-input">
                    <option>Normal</option><option>Urgent</option><option>Critical</option>
                  </select>
                  <label class="md3-label">Priority</label>
                </div>
                <div class="md3-input-container">
                  <select v-model="editForm.status" class="md3-input">
                    <option>Requested</option><option>Approved</option><option>Ordered</option><option>Received</option><option>Cancelled</option>
                  </select>
                  <label class="md3-label">Status</label>
                </div>
                <div class="md:col-span-2 md3-input-container"><input v-model="editForm.note" class="md3-input" placeholder=" " /><label class="md3-label">Note</label></div>
              </div>

              <div class="pt-2 border-t border-[#E6E0E9]">
                <h4 class="text-[14px] font-medium text-[#1D1B20] mb-3">Line Items</h4>
                <div class="space-y-3">
                  <div v-for="(line, idx) in editForm.items" :key="idx" class="bg-[#ECE6F0] rounded-[12px] p-4 relative">
                    <button @click="removeEditLine(idx)" class="absolute top-2 right-2 md3-icon-btn md3-ripple w-8 h-8 text-[#49454F]">
                      <span class="material-symbols-outlined" style="font-size:18px">close</span>
                    </button>
                    <div class="flex gap-3 mb-3">
                      <div class="md3-input-container md3-picker flex-1">
                        <div class="md3-input min-h-[56px] flex items-center" @click="$refs['editLinePicker_'+idx] && $refs['editLinePicker_'+idx].open()">
                          <ItemPicker v-model="line.name" source="MATERIALS" />
                        </div>
                        <label class="md3-label" :class="line.name ? 'text-[12px] -translate-y-[10px]' : ''">Material</label>
                      </div>
                      <div class="md3-input-container w-24">
                        <input type="number" v-model="line.qty" class="md3-input text-center font-bold" placeholder=" " />
                        <label class="md3-label">Qty</label>
                      </div>
                    </div>
                    <div class="md3-input-container">
                      <select v-model="line.status" class="md3-input text-[13px]">
                        <option v-for="st in ITEM_STATUS" :key="st">{{ st }}</option>
                      </select>
                      <label class="md3-label">Item Status</label>
                    </div>
                  </div>
                  <button @click="addEditLine"
                    class="w-full py-4 border-2 border-dashed border-[#CAC4D0] rounded-[12px] text-[#6750A4] text-[14px] font-medium hover:bg-[#F3EDF7] transition-colors md3-ripple flex items-center justify-center gap-2">
                    <span class="material-symbols-outlined icon-sm">add</span>Add Item
                  </button>
                </div>
              </div>
            </div>

            <div class="px-6 pb-6 pt-4 flex justify-end gap-2 border-t border-[#E6E0E9] shrink-0">
              <button @click="isEditOpen = false" class="md3-btn-text md3-ripple">Cancel</button>
              <button @click="saveEdit" class="md3-btn-filled md3-ripple">Save Changes</button>
            </div>
          </div>
        </div>
      </teleport>
    </div>
  `
};
