import { ref, computed, onMounted } from 'vue';
import { db } from '../firebase.js';
import { collection, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { toast, todayStr } from '../shared.js';
import ItemPicker from './ItemPicker.js';

export default {
  props: ['lang', 'user'],
  components: { ItemPicker },
  setup() {
    const filters = ref({
      start: todayStr().slice(0, 8) + '01',
      end: todayStr(),
      type: 'ALL',
      search: '',
      material: ''
    });
    const results = ref([]);
    const loading = ref(false);
    const expanded = ref(null);

    const isEditOpen = ref(false);
    const editForm = ref({});
    const editingId = ref(null);

    const orderDate = (r) => r.date || (r.timestamp ? String(r.timestamp).slice(0, 10) : '');
    const orderNote = (r) => r.note || r.remark || '-';
    const itemNote = (item) => item.note || item.remark || '-';
    const projectLabel = (r) => [r.project, r.subProject].filter(Boolean).join(' > ') || '-';
    const isMaterialLedger = computed(() => !!filters.value.material);
    const ledgerRows = computed(() => {
      if (!filters.value.material) return [];
      const selected = filters.value.material;
      return results.value
        .flatMap(r => (r.items || [])
          .filter(i => i.name === selected)
          .map(i => ({
            id: `${r.id}-${r.docNo || 'DOC'}-${orderDate(r)}-${i.name || 'ITEM'}`,
            date: orderDate(r),
            docNo: r.docNo || '-',
            type: r.type || '-',
            project: projectLabel(r),
            requester: r.requester || '-',
            qty: i.qty ?? '-',
            itemNote: itemNote(i),
            orderNote: orderNote(r)
          })))
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    });

    const inDateRange = (d) => {
      if (!d) return false;
      return d >= filters.value.start && d <= filters.value.end;
    };

    const generate = async () => {
      loading.value = true;
      results.value = [];
      try {
        const snap = await getDocs(collection(db, 'orders'));
        let data = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        data = data.filter(r => inDateRange(orderDate(r)));

        if (filters.value.type !== 'ALL') {
          data = data.filter(r => r.type === filters.value.type);
        }

        if (filters.value.material) {
          data = data.filter(r => (r.items || []).some(i => i.name === filters.value.material));
        }

        if (filters.value.search) {
          const term = filters.value.search.toLowerCase();
          data = data.filter(r => {
            const projectText = [r.project, r.subProject].filter(Boolean).join(' > ');
            return (
              projectText.toLowerCase().includes(term) ||
              String(r.requester || '').toLowerCase().includes(term) ||
              String(r.docNo || '').toLowerCase().includes(term) ||
              String(r.contractor || '').toLowerCase().includes(term) ||
              String(r.note || r.remark || '').toLowerCase().includes(term) ||
              (r.items || []).some(i =>
                String(i.name || '').toLowerCase().includes(term) ||
                String(i.note || i.remark || '').toLowerCase().includes(term)
              )
            );
          });
        }

        data.sort((a, b) => (b.timestamp || orderDate(b) || '').localeCompare(a.timestamp || orderDate(a) || ''));
        results.value = data;
      } catch (e) {
        console.error(e);
      } finally {
        loading.value = false;
      }
    };

    const exportExcel = () => {
      if (results.value.length === 0) return toast('No data to export');

      let csv = '\uFEFFDate,DocNo,Type,Project,SubProject,Requester,RequesterEmail,Contractor,OrderStatus,NeedBy,Priority,Item,Qty,ItemSupplier,ItemStatus,ItemNote,ItemRemark,OrderNote,OrderRemark,Timestamp\n';

      results.value.forEach(r => {
        const date = orderDate(r);
        const items = Array.isArray(r.items) ? r.items : [];
        if (items.length === 0) {
          csv += [
            date, r.docNo || '', r.type || '', r.project || '', r.subProject || '',
            r.requester || '', r.requesterEmail || '', r.contractor || '', r.status || '',
            r.needBy || '', r.priority || '', '', '', '', '', '', '',
            (r.note || '').replace(/,/g, ' '),
            (r.remark || '').replace(/,/g, ' '),
            r.timestamp || ''
          ].join(',') + '\n';
          return;
        }

        items.forEach(item => {
          csv += [
            date, r.docNo || '', r.type || '', r.project || '', r.subProject || '',
            r.requester || '', r.requesterEmail || '', r.contractor || '', r.status || '',
            r.needBy || '', r.priority || '',
            String(item.name || '').replace(/,/g, ' '),
            item.qty || '',
            String(item.supplier || '').replace(/,/g, ' '),
            String(item.status || '').replace(/,/g, ' '),
            String(item.note || '').replace(/,/g, ' '),
            String(item.remark || '').replace(/,/g, ' '),
            String(r.note || '').replace(/,/g, ' '),
            String(r.remark || '').replace(/,/g, ' '),
            r.timestamp || ''
          ].join(',') + '\n';
        });
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `report_${filters.value.start}_${filters.value.end}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    const remove = async (id) => {
      if (!confirm('Delete this order? Stock counts will NOT be reverted automatically.')) return;
      try {
        await deleteDoc(doc(db, 'orders', id));
        toast('Deleted');
        await generate();
      } catch (e) {
        console.error(e);
        toast('Failed');
      }
    };

    const openEdit = (order) => {
      editingId.value = order.id;
      editForm.value = JSON.parse(JSON.stringify(order));
      if (!editForm.value.note && editForm.value.remark) {
        editForm.value.note = editForm.value.remark;
      }
      if (!editForm.value.items) editForm.value.items = [];
      isEditOpen.value = true;
    };

    const addLine = () => editForm.value.items.push({ name: '', qty: '', supplier: '', status: 'Requested', note: '' });
    const removeLine = (i) => editForm.value.items.splice(i, 1);

    const saveEdit = async () => {
      try {
        await updateDoc(doc(db, 'orders', editingId.value), {
          date: editForm.value.date || todayStr(),
          project: editForm.value.project || '',
          subProject: editForm.value.subProject || '',
          requester: editForm.value.requester || '',
          requesterEmail: editForm.value.requesterEmail || '',
          contractor: editForm.value.contractor || '',
          needBy: editForm.value.needBy || '',
          priority: editForm.value.priority || '',
          status: editForm.value.status || '',
          note: editForm.value.note || '',
          remark: editForm.value.note || '',
          items: (editForm.value.items || []).filter(i => i.name && i.qty)
        });
        toast('Updated');
        isEditOpen.value = false;
        await generate();
      } catch (e) {
        console.error(e);
        toast('Failed to update');
      }
    };

    const toggleExpand = (r) => {
      expanded.value = expanded.value === r.id ? null : r.id;
    };

    onMounted(generate);

    return {
      filters, results, loading, generate, remove, exportExcel,
      openEdit, isEditOpen, editForm, saveEdit, addLine, removeLine,
      expanded, toggleExpand, orderDate, orderNote, itemNote, projectLabel,
      isMaterialLedger, ledgerRows
    };
  },
  template: `
    <div class="space-y-6 pb-24">
      <section class="glass rounded-2xl p-5 shadow-sm space-y-4">
        <h3 class="font-bold text-lg text-slate-800">Report (Orders)</h3>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">From</label>
            <input type="date" v-model="filters.start" class="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">To</label>
            <input type="date" v-model="filters.end" class="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div class="col-span-2">
            <label class="block text-xs font-bold text-slate-500 mb-1">Filter Item/SKU</label>
            <ItemPicker v-model="filters.material" source="MATERIALS" placeholder="All Items (Optional)" />
          </div>

          <div class="col-span-2">
            <input v-model="filters.search" placeholder="Search doc, project, requester, note..." class="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div class="col-span-2 flex gap-2">
            <select v-model="filters.type" class="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none flex-1">
              <option value="ALL">All Types</option>
              <option value="OUT">OUT</option>
              <option value="IN">IN</option>
              <option value="ADJUST">ADJUST</option>
              <option value="PURCHASE">PURCHASE</option>
            </select>
            <button @click="generate" class="bg-blue-500 text-white font-bold px-6 rounded-xl shadow-md active:scale-95 transition-transform">Search</button>
          </div>
        </div>
      </section>

      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <span class="px-3 py-1 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-600 shadow-sm">
            {{ loading ? 'Loading...' : results.length + ' records' }}
          </span>
          <span v-if="filters.type !== 'ALL'" class="px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-xs font-bold text-blue-700">
            Type: {{ filters.type }}
          </span>
        </div>
        <button v-if="results.length > 0" @click="exportExcel" class="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm transition-colors">Export CSV</button>
      </div>

      <div class="space-y-3">
        <div v-if="loading" class="space-y-3 animate-pulse">
          <div v-for="i in 3" :key="'loading-' + i" class="h-40 bg-slate-200 rounded-xl"></div>
        </div>
        <div v-if="results.length === 0 && !loading" class="text-center py-10 text-slate-400">No records found</div>

        <div v-if="isMaterialLedger && results.length > 0" class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div class="px-4 py-3 border-b border-slate-200 bg-slate-100/70 flex items-center justify-between">
            <div class="text-sm font-bold text-slate-700">Material Ledger</div>
            <div class="text-xs text-slate-500">{{ filters.material }}</div>
          </div>
          <div class="overflow-x-auto">
            <div class="min-w-[860px]">
              <div class="grid grid-cols-[100px_110px_80px_minmax(180px,1fr)_120px_80px_170px_170px] gap-3 px-4 py-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-500 border-b border-slate-200 bg-slate-50">
                <span>Date</span>
                <span>Doc No</span>
                <span>Type</span>
                <span>Project</span>
                <span>Requester</span>
                <span class="text-right">Qty</span>
                <span>Item Note</span>
                <span>Order Note</span>
              </div>
              <div v-for="row in ledgerRows" :key="row.id" class="grid grid-cols-[100px_110px_80px_minmax(180px,1fr)_120px_80px_170px_170px] gap-3 px-4 py-2.5 text-xs border-b border-slate-100 last:border-b-0 odd:bg-white even:bg-slate-50/50 items-center">
                <span class="text-slate-600">{{ row.date || '-' }}</span>
                <span class="font-semibold text-slate-700">{{ row.docNo }}</span>
                <span>
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide"
                    :class="{
                      'bg-green-100 text-green-700': row.type==='IN',
                      'bg-red-100 text-red-700': row.type==='OUT',
                      'bg-yellow-100 text-yellow-700': row.type==='ADJUST',
                      'bg-blue-100 text-blue-700': row.type==='PURCHASE'
                    }"
                  >{{ row.type }}</span>
                </span>
                <span class="text-slate-700">{{ row.project }}</span>
                <span class="truncate text-slate-600">{{ row.requester }}</span>
                <span class="text-right font-mono font-bold text-slate-800">{{ row.qty }}</span>
                <span class="truncate text-slate-600">{{ row.itemNote }}</span>
                <span class="truncate text-slate-600">{{ row.orderNote }}</span>
              </div>
              <div v-if="ledgerRows.length === 0" class="px-4 py-5 text-xs text-slate-400">No matching ledger entries</div>
            </div>
          </div>
        </div>

        <template v-else>
        <div v-for="r in results" :key="r.id" class="bg-white p-4 rounded-xl shadow-sm border border-slate-100 relative group transition-all hover:shadow-md">
          <div class="flex justify-between items-start mb-3">
            <div class="cursor-pointer" @click="toggleExpand(r)">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                :class="{
                  'bg-green-100 text-green-700': r.type==='IN',
                  'bg-red-100 text-red-700': r.type==='OUT',
                  'bg-yellow-100 text-yellow-700': r.type==='ADJUST',
                  'bg-blue-100 text-blue-700': r.type==='PURCHASE'
                }"
              >{{ r.type }}</span>
              <span class="text-xs text-slate-500 font-bold ml-2">{{ orderDate(r) }}</span>
              <div class="text-[10px] text-slate-400">{{ r.docNo }}</div>
            </div>
            <div class="flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
              <button @click="openEdit(r)" class="text-blue-500 bg-blue-50 p-1.5 rounded-lg text-xs font-bold">Edit</button>
              <button @click="remove(r.id)" class="text-red-500 bg-red-50 p-1.5 rounded-lg text-xs font-bold">Del</button>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
            <div class="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <div class="text-[10px] uppercase font-extrabold tracking-wide text-slate-400">Project</div>
              <div class="text-sm font-semibold text-slate-700">{{ projectLabel(r) }}</div>
            </div>
            <div class="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <div class="text-[10px] uppercase font-extrabold tracking-wide text-slate-400">Requester</div>
              <div class="text-sm font-semibold text-slate-700 truncate">{{ r.requester || '-' }}</div>
              <div class="text-[11px] text-slate-500 truncate">{{ r.requesterEmail || '-' }}</div>
            </div>
            <div class="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <div class="text-[10px] uppercase font-extrabold tracking-wide text-slate-400">Order Note</div>
              <div class="text-sm text-slate-700 truncate">{{ orderNote(r) }}</div>
            </div>
            <div class="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <div class="text-[10px] uppercase font-extrabold tracking-wide text-slate-400">Status</div>
              <div class="text-sm text-slate-700">{{ r.status || '-' }}</div>
            </div>
          </div>

          <div class="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
            <div class="px-3 py-2 border-b border-slate-200 bg-slate-100/70">
              <div class="grid grid-cols-[minmax(220px,1fr)_90px_130px_1fr] gap-3 text-[11px] font-extrabold uppercase tracking-wide text-slate-500 min-w-[620px]">
                <span>Material</span>
                <span class="text-right">Qty</span>
                <span>Status</span>
                <span>Item Note</span>
              </div>
            </div>
            <div class="overflow-x-auto">
              <div v-for="(item, idx) in (r.items || [])" :key="idx" class="px-3 py-2 border-b border-slate-100 last:border-b-0 odd:bg-white/80">
                <div class="grid grid-cols-[minmax(220px,1fr)_90px_130px_1fr] gap-3 text-xs text-slate-700 min-w-[620px] items-center">
                  <span class="break-words font-semibold">{{ item.name || '-' }}</span>
                  <span class="font-bold font-mono text-right">{{ item.qty || '-' }}</span>
                  <span class="truncate">{{ item.status || '-' }}</span>
                  <span class="truncate">{{ itemNote(item) }}</span>
                </div>
              </div>
              <div v-if="!r.items || r.items.length === 0" class="px-3 py-3 text-xs text-slate-400 italic">No items</div>
            </div>
          </div>

          <div v-if="expanded === r.id" class="mt-3 pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-600">
            <div><b>Order note:</b> {{ orderNote(r) }}</div>
            <div><b>Timestamp:</b> {{ r.timestamp || '-' }}</div>
            <div v-for="(item, idx) in r.items" :key="'note-' + idx" class="bg-slate-50 rounded-lg p-2">
              <b>{{ item.name }}</b> | Qty {{ item.qty }} | Item Status {{ item.status || '-' }} | Item Note {{ itemNote(item) }}
            </div>
          </div>
        </div>
        </template>
      </div>

      <teleport to="body">
        <div v-if="isEditOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" @click="isEditOpen = false"></div>

          <div class="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-5 animate-fade-in-up max-h-[90vh] overflow-y-auto">
            <h3 class="font-bold text-lg mb-4 text-slate-800">Edit Order</h3>

            <div class="space-y-4">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-bold text-slate-500 mb-1">Date</label>
                  <input type="date" v-model="editForm.date" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-500 mb-1">Need By</label>
                  <input type="date" v-model="editForm.needBy" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div><label class="block text-xs font-bold text-slate-500 mb-1">Project</label><ItemPicker v-model="editForm.project" source="PROJECTS" /></div>
              <div><label class="block text-xs font-bold text-slate-500 mb-1">Sub Project</label><input v-model="editForm.subProject" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none" /></div>
              <div><label class="block text-xs font-bold text-slate-500 mb-1">Requester</label><ItemPicker v-model="editForm.requester" source="REQUESTERS" /></div>
              <div><label class="block text-xs font-bold text-slate-500 mb-1">Requester Email</label><input v-model="editForm.requesterEmail" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none" /></div>
              <div><label class="block text-xs font-bold text-slate-500 mb-1">Contractor</label><ItemPicker v-model="editForm.contractor" source="CONTRACTORS" /></div>
              <div class="grid grid-cols-2 gap-3">
                <div><label class="block text-xs font-bold text-slate-500 mb-1">Priority</label><input v-model="editForm.priority" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none" /></div>
                <div><label class="block text-xs font-bold text-slate-500 mb-1">Status</label><input v-model="editForm.status" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none" /></div>
              </div>
              <div><label class="block text-xs font-bold text-slate-500 mb-1">Note</label><input v-model="editForm.note" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none" /></div>

              <div class="space-y-2 pt-2 border-t border-slate-100">
                <label class="block text-xs font-bold text-slate-500">Items</label>
                <div v-for="(line, idx) in editForm.items" :key="idx" class="space-y-2 bg-slate-50 p-2 rounded-lg">
                  <div class="flex gap-2 items-center">
                    <div class="flex-1"><ItemPicker v-model="line.name" source="MATERIALS" /></div>
                    <input type="number" v-model="line.qty" class="w-16 bg-white border border-slate-200 rounded-lg px-2 py-1 text-center font-bold text-sm outline-none" />
                    <button @click="removeLine(idx)" class="text-red-500 font-bold px-2">x</button>
                  </div>
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input v-model="line.supplier" placeholder="Supplier" class="bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm outline-none" />
                    <input v-model="line.status" placeholder="Item status" class="bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm outline-none" />
                    <input v-model="line.note" placeholder="Item note" class="bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm outline-none" />
                  </div>
                </div>
                <button @click="addLine" class="w-full py-3 border border-dashed border-slate-300 rounded-xl text-slate-400 text-sm font-bold hover:bg-slate-50 transition-colors">+ Add Item</button>
              </div>
            </div>

            <div class="flex gap-2 mt-6">
              <button @click="isEditOpen = false" class="flex-1 bg-slate-100 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-200">Cancel</button>
              <button @click="saveEdit" class="flex-1 bg-blue-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-500/30 hover:bg-blue-600">Save Changes</button>
            </div>
          </div>
        </div>
      </teleport>
    </div>
  `
};
