import { ref, computed, onMounted } from 'vue';
import { db } from '../firebase.js';
import { collection, addDoc, query, where, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { STR, LOOKUPS, toast, todayStr } from '../shared.js';

const daysFromNow = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
};
import ItemPicker from './ItemPicker.js';

const ITEM_STATUS = ['Requested', 'Quoted', 'Ordered', 'Received', 'Cancelled'];

export default {
  props: ['lang', 'user'],
  components: { ItemPicker },
  setup(props) {
    const form = ref({
      project: '',
      subProject: '',
      contractor: '',
      needBy: daysFromNow(7),
      priority: 'Normal',
      note: ''
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

    const onProjectChange = () => {
      form.value.subProject = '';
    };

    const addLine = () => lines.value.push({ name: '', qty: '', status: 'Requested' });
    const removeLine = (i) => lines.value.splice(i, 1);

    const normalizeItem = (i) => ({
      name: i.name,
      qty: Number(i.qty),
      status: i.status || 'Requested'
    });

    const submit = async () => {
      const validLines = lines.value
        .filter(l => l.name && l.qty && Number(l.qty) > 0)
        .map(normalizeItem);
      if (!validLines.length) return toast(props.lang === 'th' ? 'กรุณาเพิ่มรายการและจำนวนต้องมากกว่า 0' : 'Add at least one line with qty > 0');

      loading.value = true;
      try {
        const docNo = 'PUR-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
        await addDoc(collection(db, 'orders'), {
          type: 'PURCHASE',
          docNo,
          status: 'Requested',
          project: form.value.project,
          subProject: form.value.subProject || '',
          contractor: form.value.contractor,
          needBy: form.value.needBy,
          priority: form.value.priority,
          note: form.value.note,
          remark: form.value.note,
          requester: props.user.displayName || props.user.email,
          requesterEmail: props.user.email,
          requesterPhoto: props.user.photoURL,
          items: validLines,
          timestamp: new Date().toISOString(),
          date: todayStr()
        });

        toast((props.lang === 'th' ? 'ส่งคำขอแล้ว ' : 'Request sent ') + docNo);
        lines.value = [{ name: '', qty: '', status: 'Requested' }];
        form.value.note = '';
        form.value.project = '';
        form.value.subProject = '';
        form.value.contractor = '';
        await loadHistory();
      } catch (e) {
        console.error(e);
        toast('Failed');
      } finally {
        loading.value = false;
      }
    };

    let unsubHistory = null;
    const loadHistory = () => {
      historyLoading.value = true;
      try {
        const q = query(collection(db, 'orders'), where('type', '==', 'PURCHASE'));
        unsubHistory = onSnapshot(q, (snap) => {
          const rawList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          rawList.sort((a, b) => (b.timestamp || b.date || '').localeCompare(a.timestamp || a.date || ''));
          history.value = rawList;
          historyLoading.value = false;
        });
      } catch (e) {
        console.error(e);
        historyLoading.value = false;
      }
    };

    const removeOrder = async (id) => {
      if (!confirm('Are you sure you want to delete this order?')) return;
      try {
        await deleteDoc(doc(db, 'orders', id));
        toast('Deleted');
      } catch (e) {
        console.error(e);
        toast('Failed to delete');
      }
    };

    const openEdit = (item) => {
      editingId.value = item.id;
      editForm.value = JSON.parse(JSON.stringify(item));
      if (!editForm.value.note && editForm.value.remark) {
        editForm.value.note = editForm.value.remark;
      }
      if (!editForm.value.items) editForm.value.items = [];
      isEditOpen.value = true;
    };

    const addEditLine = () => editForm.value.items.push({ name: '', qty: '', status: 'Requested' });
    const removeEditLine = (i) => editForm.value.items.splice(i, 1);

    const saveEdit = async () => {
      try {
        await updateDoc(doc(db, 'orders', editingId.value), {
          date: editForm.value.date || todayStr(),
          project: editForm.value.project || '',
          subProject: editForm.value.subProject || '',
          contractor: editForm.value.contractor || '',
          needBy: editForm.value.needBy || '',
          priority: editForm.value.priority || 'Normal',
          status: editForm.value.status || 'Requested',
          note: editForm.value.note || '',
          remark: editForm.value.note || '',
          items: (editForm.value.items || []).filter(i => i.name && i.qty).map(normalizeItem)
        });
        toast('Updated');
        isEditOpen.value = false;
      } catch (e) {
        console.error(e);
        toast('Failed to update');
      }
    };

    const toggleExpand = (h) => {
      expandedDoc.value = expandedDoc.value === h.id ? null : h.id;
    };

    const updateStatus = async (item, newStatus) => {
      try {
        await updateDoc(doc(db, 'orders', item.id), { status: newStatus });
        item.status = newStatus;
        toast('Status Updated');
      } catch (e) {
        console.error(e);
        toast('Failed');
      }
    };

    const updateItemStatus = async (order, index, newStatus) => {
      try {
        const items = JSON.parse(JSON.stringify(order.items || []));
        if (!items[index]) return;
        items[index].status = newStatus;
        await updateDoc(doc(db, 'orders', order.id), { items });
        order.items[index].status = newStatus;
        toast('Item status updated');
      } catch (e) {
        console.error(e);
        toast('Failed');
      }
    };

    const statusColor = (s) => {
      s = (s || '').toLowerCase();
      if (s.includes('receive') || s.includes('approve')) return 'bg-green-100 text-green-700';
      if (s.includes('cancel') || s.includes('reject')) return 'bg-red-100 text-red-700';
      if (s.includes('order') || s.includes('quote')) return 'bg-blue-100 text-blue-700';
      if (s.includes('wait') || s.includes('request')) return 'bg-yellow-100 text-yellow-700';
      return 'bg-slate-100 text-slate-600';
    };

    const filteredHistory = computed(() => {
      if (historyStatusFilter.value === 'ALL') return history.value;
      return history.value.filter(h => (h.status || '').toLowerCase() === historyStatusFilter.value.toLowerCase());
    });

    onMounted(loadHistory);

    return {
      S, form, lines, loading, history, filteredHistory, historyLoading, expandedDoc,
      historyStatusFilter,
      subProjects, onProjectChange, addLine, removeLine, submit, toggleExpand,
      updateStatus, updateItemStatus, statusColor, removeOrder, openEdit,
      isEditOpen, editForm, saveEdit, addEditLine, removeEditLine, ITEM_STATUS, LOOKUPS
    };
  },
  template: `
    <div class="space-y-6 pb-28">
      <section class="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-4">
        <h3 class="text-base font-semibold text-slate-800">{{ S.tabs.pur }}</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">


          <div class="md3-input-container md3-picker">
            <ItemPicker v-model="form.project" source="PROJECTS" :placeholder="S.pick" @change="onProjectChange" class="md3-input" :class="{'has-val': !!form.project}" />
            <label class="md3-label !bg-white">{{ S.purProj }}</label>
          </div>

          <div class="md3-input-container md3-picker">
            <ItemPicker v-model="form.subProject" :items="subProjects" :placeholder="subProjects.length ? S.pick : '-'" class="md3-input" :class="{'has-val': !!form.subProject}" />
            <label class="md3-label !bg-white">{{ S.subProj }}</label>
          </div>

          <div class="md3-input-container md3-picker">
            <ItemPicker v-model="form.contractor" source="CONTRACTORS" :placeholder="S.pick" class="md3-input" :class="{'has-val': !!form.contractor}" />
            <label class="md3-label !bg-white">{{ S.purContractor }}</label>
          </div>

          <div class="md3-input-container">
            <select v-model="form.priority" class="md3-input">
              <option value="Normal">Normal</option>
              <option value="Urgent">Urgent</option>
              <option value="Critical">Critical</option>
            </select>
            <label class="md3-label !bg-white">{{ S.purPriority }}</label>
          </div>

          <div class="md:col-span-2 md3-input-container">
            <input v-model="form.note" class="md3-input" placeholder=" " />
            <label class="md3-label !bg-white">{{ S.purNote }}</label>
          </div>
        </div>
      </section>

      <!-- Line Items -->
      <div class="space-y-3">
        <div v-for="(line, idx) in lines" :key="idx" class="bg-[#F3EDF7] rounded-[12px] p-4 relative animate-fade-in-up">
          <button @click="removeLine(idx)" class="absolute top-2 right-2 w-10 h-10 flex items-center justify-center rounded-full text-[#49454F] hover:bg-[#E8DEF8] transition-colors md3-ripple">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>

          <div class="grid grid-cols-12 gap-3 mt-4">
            <div class="col-span-8 min-w-0">
              <div class="md3-input-container">
                <ItemPicker v-model="line.name" source="MATERIALS" :placeholder="S.pick" class="md3-input" />
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
          
          <div class="mt-4">
            <div class="md3-input-container">
              <input type="text" v-model="line.note" class="md3-input" placeholder=" " />
              <label class="md3-label !bg-[#F3EDF7]">{{ S.purNote || 'Note' }}</label>
            </div>
          </div>
        </div>
      </div>

      <div class="flex justify-center mt-6">
        <button @click="addLine" class="flex items-center gap-2 px-6 py-2.5 rounded-full border border-[#79747E] text-[#6750A4] font-medium hover:bg-[#6750A4]/10 transition-colors md3-ripple">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          {{ S.btnAdd }}
        </button>
      </div>

      <section class="mt-10 pt-6 border-t border-slate-100">
        <div class="flex items-center justify-between mb-6 px-1 gap-3 flex-wrap">
          <h3 class="text-lg font-semibold text-slate-800">{{ S.purOlder }}</h3>
          <div class="md3-input-container w-40 shrink-0">
            <select v-model="historyStatusFilter" class="md3-input font-medium">
              <option value="ALL">All Status</option>
              <option value="Requested">Requested</option>
              <option value="Approved">Approved</option>
              <option value="Ordered">Ordered</option>
              <option value="Received">Received</option>
              <option value="Cancelled">Cancelled</option>
            </select>
            <label class="md3-label !bg-[#FEF7FF]">Filter</label>
          </div>
        </div>
        <div v-if="historyLoading" class="space-y-4 animate-pulse"><div v-for="i in 3" class="h-24 bg-slate-100 rounded-2xl"></div></div>
        <div v-else-if="filteredHistory.length === 0" class="text-center py-16 text-slate-400 font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">No requests found</div>

        <div v-else class="space-y-4">
          <div v-for="h in filteredHistory" :key="h.id" class="bg-white rounded-[24px] shadow-sm border border-[#CAC4D0] overflow-hidden hover:shadow-md transition-shadow group">
            <div class="p-5 flex flex-col sm:flex-row justify-between items-start gap-4 hover:bg-slate-50/50 transition-colors cursor-pointer" @click="toggleExpand(h)">
              <div class="min-w-0 flex-1 w-full">
                <div class="flex items-center gap-2 mb-2">
                  <span class="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap" :class="statusColor(h.status)">{{ h.status }}</span>
                  <span class="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-md">{{ h.date }}</span>
                </div>
                <div class="font-bold text-slate-800 text-base truncate">{{ h.docNo }}</div>
                <div class="text-sm font-semibold text-slate-600 truncate mt-1">{{ [h.project, h.subProject].filter(Boolean).join(' > ') || '-' }}</div>
              </div>
              <div class="flex sm:flex-col items-center sm:items-end gap-2 w-full sm:w-auto shrink-0 justify-between">
                <div class="text-right flex flex-col items-start sm:items-end text-xs font-medium text-slate-500">
                  <div>Need: <span class="font-semibold text-slate-700">{{ h.needBy || '-' }}</span></div>
                  <div>Priority: <span class="font-semibold text-slate-700">{{ h.priority || '-' }}</span></div>
                </div>
                <div class="flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button @click.stop="openEdit(h)" class="px-4 py-1.5 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold hover:bg-blue-100 transition-colors md3-ripple">Edit</button>
                  <button @click.stop="removeOrder(h.id)" class="px-4 py-1.5 bg-red-50 text-red-700 rounded-full text-xs font-semibold hover:bg-red-100 transition-colors md3-ripple">Delete</button>
                </div>
              </div>
            </div>

            <div v-if="expandedDoc === h.id" class="bg-[#F3EDF7] border-t border-[#CAC4D0] p-5 animate-fade-in-up space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div class="bg-white rounded-xl px-4 py-3 shadow-sm border border-slate-100">
                  <div class="text-[10px] uppercase font-bold tracking-wide text-slate-500 mb-1">Requester</div>
                  <div class="text-sm font-semibold text-slate-800">{{ h.requester || '-' }} <span class="text-xs font-normal text-slate-500">({{ h.requesterEmail || '-' }})</span></div>
                </div>
                <div class="bg-white rounded-xl px-4 py-3 shadow-sm border border-slate-100">
                  <div class="text-[10px] uppercase font-bold tracking-wide text-slate-500 mb-1">Contractor</div>
                  <div class="text-sm font-semibold text-slate-800">{{ h.contractor || '-' }}</div>
                </div>
                <div class="bg-white rounded-xl px-4 py-3 shadow-sm border border-slate-100 md:col-span-2">
                  <div class="text-[10px] uppercase font-bold tracking-wide text-slate-500 mb-1">Order Note</div>
                  <div class="text-sm text-slate-700">{{ h.note || h.remark || '-' }}</div>
                </div>
                <div class="bg-white rounded-xl px-4 py-3 shadow-sm border border-slate-100 md:col-span-2 flex items-center gap-3">
                  <div class="text-[10px] uppercase font-bold tracking-wide text-slate-500 w-24 shrink-0">Order Status</div>
                  <div class="md3-input-container flex-1">
                    <select :value="h.status" @change="updateStatus(h, $event.target.value)" class="md3-input font-bold text-slate-800">
                      <option value="Requested">Requested</option>
                      <option value="Approved">Approved</option>
                      <option value="Ordered">Ordered</option>
                      <option value="Received">Received</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                    <label class="md3-label !bg-white">Update Status</label>
                  </div>
                </div>
              </div>

              <div class="bg-white rounded-[16px] border border-slate-200 overflow-hidden shadow-sm mt-2">
                <div class="px-4 py-3 border-b border-slate-100 bg-slate-50">
                  <div class="grid grid-cols-[minmax(180px,1fr)_80px_140px] gap-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 min-w-[400px]">
                    <span>Material</span>
                    <span class="text-right">Qty</span>
                    <span>Item Status</span>
                  </div>
                </div>
                <div class="overflow-x-auto">
                  <div v-for="(li, idx) in h.items" :key="idx" class="px-4 py-3 border-b border-slate-50 last:border-b-0">
                    <div class="grid grid-cols-[minmax(180px,1fr)_80px_140px] gap-3 text-sm text-slate-800 min-w-[400px] items-center">
                      <span class="font-semibold break-words">{{ li.name }}</span>
                      <span class="font-bold font-mono text-right text-base">{{ li.qty }}</span>
                      <div>
                        <div class="md3-input-container">
                          <select :value="li.status || 'Requested'" @change="updateItemStatus(h, idx, $event.target.value)" class="md3-input py-2 text-xs font-semibold">
                            <option v-for="st in ITEM_STATUS" :key="st" :value="st">{{ st }}</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>



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

      <teleport to="body">
        <div v-if="isEditOpen" class="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-[#1D1B20]/40 backdrop-blur-sm" @click="isEditOpen = false"></div>
          <div class="relative w-full max-w-2xl bg-[#FEF7FF] rounded-[28px] shadow-md3-elevation-3 flex flex-col max-h-[90vh] animate-fade-in-up overflow-hidden">
            <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white z-10 shrink-0">
              <h3 class="font-semibold text-lg text-slate-800">Edit Purchase Order</h3>
              <button @click="isEditOpen = false" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 md3-ripple">×</button>
            </div>
            
            <div class="p-6 overflow-y-auto space-y-5 bg-[#FEF7FF]">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="md3-input-container">
                  <input type="date" v-model="editForm.date" class="md3-input" placeholder=" " />
                  <label class="md3-label !bg-[#FEF7FF]">Date</label>
                </div>
                <div class="md3-input-container">
                  <input type="date" v-model="editForm.needBy" class="md3-input" placeholder=" " />
                  <label class="md3-label !bg-[#FEF7FF]">Need By</label>
                </div>
                
                <div class="md3-input-container md3-picker">
                  <ItemPicker v-model="editForm.project" source="PROJECTS" class="md3-input" :class="{'has-val': !!editForm.project}" />
                  <label class="md3-label !bg-[#FEF7FF]">Project</label>
                </div>
                <div class="md3-input-container md3-picker">
                  <ItemPicker v-model="editForm.subProject" :items="LOOKUPS.PROJECT_META[editForm.project] || []" class="md3-input" :class="{'has-val': !!editForm.subProject}" />
                  <label class="md3-label !bg-[#FEF7FF]">Sub Project</label>
                </div>

                <div class="md3-input-container md3-picker">
                  <ItemPicker v-model="editForm.contractor" source="CONTRACTORS" class="md3-input" :class="{'has-val': !!editForm.contractor}" />
                  <label class="md3-label !bg-[#FEF7FF]">Contractor</label>
                </div>

                <div class="md3-input-container">
                  <select v-model="editForm.priority" class="md3-input">
                    <option>Normal</option><option>Urgent</option><option>Critical</option>
                  </select>
                  <label class="md3-label !bg-[#FEF7FF]">Priority</label>
                </div>
                <div class="md3-input-container">
                  <select v-model="editForm.status" class="md3-input">
                    <option>Requested</option><option>Approved</option><option>Ordered</option><option>Received</option><option>Cancelled</option>
                  </select>
                  <label class="md3-label !bg-[#FEF7FF]">Status</label>
                </div>

                <div class="md:col-span-2 md3-input-container">
                  <input v-model="editForm.note" class="md3-input" placeholder=" " />
                  <label class="md3-label !bg-[#FEF7FF]">Note</label>
                </div>
              </div>

              <div class="pt-4 border-t border-slate-200">
                <h4 class="text-sm font-bold text-slate-800 mb-3">Line Items</h4>
                <div class="space-y-3">
                  <div v-for="(line, idx) in editForm.items" :key="idx" class="bg-white border border-slate-200 rounded-2xl p-4 relative group">
                    <button @click="removeEditLine(idx)" class="absolute -top-2 -right-2 w-6 h-6 flex items-center justify-center bg-red-100 text-red-600 rounded-full text-xs font-bold shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                    <div class="flex gap-3 mb-3">
                      <div class="md3-input-container md3-picker flex-1">
                        <ItemPicker v-model="line.name" source="MATERIALS" class="md3-input" :class="{'has-val': !!line.name}" />
                        <label class="md3-label !bg-white">Material</label>
                      </div>
                      <div class="md3-input-container w-24">
                        <input type="number" v-model="line.qty" class="md3-input text-center font-bold" placeholder=" " />
                        <label class="md3-label !bg-white">Qty</label>
                      </div>
                    </div>
                    <div>
                      <select v-model="line.status" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:border-[#6750A4] focus:ring-1 focus:ring-[#6750A4] outline-none transition-colors">
                        <option v-for="st in ITEM_STATUS" :key="st">{{ st }}</option>
                      </select>
                    </div>
                  </div>
                  <button @click="addEditLine" class="w-full py-3.5 border-2 border-dashed border-slate-200 rounded-2xl text-blue-600 text-sm font-bold hover:bg-blue-50 transition-colors md3-ripple">+ Add Item</button>
                </div>
              </div>
            </div>

            <div class="p-4 bg-white border-t border-slate-100 flex gap-3 z-10 shrink-0">
              <button @click="isEditOpen = false" class="flex-1 py-3.5 rounded-full text-slate-600 font-semibold hover:bg-slate-50 transition-colors md3-ripple">Cancel</button>
              <button @click="saveEdit" class="flex-1 bg-blue-500 text-white font-semibold py-3.5 rounded-full shadow-md active:scale-95 transition-transform md3-ripple">Save Changes</button>
            </div>
          </div>
        </div>
      </teleport>
    </div>
  `
};

