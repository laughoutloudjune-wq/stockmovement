import { ref, computed } from 'vue';
import { db } from '../firebase.js';
import { collection, getDocs, deleteDoc, doc, updateDoc, query, where } from 'firebase/firestore';
import { toast, todayStr, STR } from '../shared.js';
import ItemPicker from './ItemPicker.js';

export default {
  props: ['lang', 'user'],
  components: { ItemPicker },
  setup(props) {
    const S = computed(() => STR[props.lang]);

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
            contractor: r.contractor || '-',
            requester: r.requester || '-',
            qty: i.qty ?? '-',
            showAdjust: r.type === 'ADJUST' && i.prevStock != null && i.newStock != null,
            prevStock: i.prevStock,
            newStock: i.newStock,
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
        let q = query(collection(db, 'orders'), 
          where('date', '>=', filters.value.start), 
          where('date', '<=', filters.value.end)
        );
        if (filters.value.type !== 'ALL') {
          q = query(q, where('type', '==', filters.value.type));
        }
        
        const snap = await getDocs(q);
        let data = snap.docs.map(d => ({ id: d.id, ...d.data() }));

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

      let csv = '\uFEFFDate,DocNo,Type,Project,SubProject,Requester,RequesterEmail,Contractor,OrderStatus,NeedBy,Priority,Item,Qty,PrevStock,NewStock,ItemSupplier,ItemStatus,ItemNote,ItemRemark,OrderNote,OrderRemark,Timestamp\n';

      results.value.forEach(r => {
        const date = orderDate(r);
        const items = Array.isArray(r.items) ? r.items : [];
        if (items.length === 0) {
          csv += [
            date, r.docNo || '', r.type || '', r.project || '', r.subProject || '',
            r.requester || '', r.requesterEmail || '', r.contractor || '', r.status || '',
            r.needBy || '', r.priority || '', '', '', '', '', '', '', '',
            (r.note || '').replace(/,/g, ' '),
            (r.remark || '').replace(/,/g, ' '),
            r.timestamp || ''
          ].join(',') + '\n';
          return;
        }

        items.forEach(item => {
          const prevS = item.prevStock != null ? item.prevStock : '';
          const newS = item.newStock != null ? item.newStock : '';
          csv += [
            date, r.docNo || '', r.type || '', r.project || '', r.subProject || '',
            r.requester || '', r.requesterEmail || '', r.contractor || '', r.status || '',
            r.needBy || '', r.priority || '',
            String(item.name || '').replace(/,/g, ' '),
            item.qty || '',
            prevS,
            newS,
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
          items: (editForm.value.items || [])
            .filter(i => i.name && i.qty !== '' && i.qty != null)
            .map(i => {
              const row = {
                name: i.name,
                qty: Number(i.qty),
                supplier: i.supplier || '',
                status: i.status || '',
                note: i.note || '',
                remark: i.remark || i.note || ''
              };
              if (i.prevStock != null && i.prevStock !== '') row.prevStock = Number(i.prevStock);
              if (i.newStock != null && i.newStock !== '') row.newStock = Number(i.newStock);
              return row;
            })
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

    return {
      filters, results, loading, generate, remove, exportExcel,
      openEdit, isEditOpen, editForm, saveEdit, addLine, removeLine,
      expanded, toggleExpand, orderDate, orderNote, itemNote, projectLabel,
      isMaterialLedger, ledgerRows, S
    };
  },
  template: `
    <div class="space-y-6 pb-28 md:pb-8 pt-4">
      <!-- Filter Section -->
      <section class="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-5">
        <h3 class="font-semibold text-lg text-slate-800">{{ S.tabs?.report || 'Report (Orders)' }}</h3>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="md3-input-container">
            <input type="date" v-model="filters.start" class="md3-input" placeholder=" " />
            <label class="md3-label !bg-white">From</label>
          </div>
          <div class="md3-input-container">
            <input type="date" v-model="filters.end" class="md3-input" placeholder=" " />
            <label class="md3-label !bg-white">To</label>
          </div>

          <div class="md:col-span-2 md3-input-container md3-picker">
            <ItemPicker v-model="filters.material" source="MATERIALS" placeholder="All Items (Optional)" class="md3-input" :class="{'has-val': !!filters.material}" />
            <label class="md3-label !bg-white">Filter Item/SKU</label>
          </div>

          <div class="md:col-span-2 md3-input-container">
            <input v-model="filters.search" class="md3-input" placeholder=" " />
            <label class="md3-label !bg-white">Search doc, project, contractor...</label>
          </div>

          <div class="md:col-span-2 flex gap-3 flex-col sm:flex-row">
            <div class="md3-input-container flex-1">
              <select v-model="filters.type" class="md3-input">
                <option value="ALL">All Types</option>
                <option value="OUT">OUT</option>
                <option value="IN">IN</option>
                <option value="ADJUST">ADJUST</option>
                <option value="PURCHASE">PURCHASE</option>
              </select>
              <label class="md3-label !bg-white">Type</label>
            </div>
            <button @click="generate" class="bg-blue-500 text-white font-semibold px-8 py-3.5 rounded-full shadow-md active:scale-95 transition-transform shrink-0 md3-ripple">Search</button>
          </div>
        </div>
      </section>

      <!-- Status Bar -->
      <div class="flex items-center justify-between gap-2 px-2">
        <div class="flex flex-wrap items-center gap-2">
          <span class="px-4 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-600 shadow-sm">
            {{ loading ? 'Loading...' : results.length + ' records' }}
          </span>
          <span v-if="filters.type !== 'ALL'" class="px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-xs font-semibold text-blue-700">
            {{ filters.type }}
          </span>
        </div>
        <button v-if="results.length > 0" @click="exportExcel" class="flex items-center gap-2 bg-green-50 text-green-700 hover:bg-green-100 text-xs font-semibold px-4 py-2 rounded-full transition-colors md3-ripple">
          Export CSV
        </button>
      </div>

      <!-- Results Area -->
      <div class="space-y-4">
        <div v-if="loading" class="space-y-4 animate-pulse">
          <div v-for="i in 3" :key="'loading-' + i" class="h-40 bg-slate-100 rounded-2xl"></div>
        </div>
        <div v-if="results.length === 0 && !loading" class="text-center py-16 text-slate-400 font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          No records found
        </div>

        <!-- Ledger View -->
        <div v-if="isMaterialLedger && results.length > 0" class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <div class="text-sm font-bold text-slate-800">Material Ledger</div>
            <div class="text-xs font-medium text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200">{{ filters.material }}</div>
          </div>
          <div class="overflow-x-auto">
            <div class="min-w-[980px]">
              <div class="grid grid-cols-[100px_110px_80px_minmax(160px,1fr)_minmax(120px,1fr)_120px_80px_150px_150px] gap-3 px-5 py-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-100 bg-slate-50">
                <span>Date</span>
                <span>Doc No</span>
                <span>Type</span>
                <span>Project</span>
                <span>Contractor</span>
                <span>Requester</span>
                <span class="text-right">Qty</span>
                <span>Item Note</span>
                <span>Order Note</span>
              </div>
              <div v-for="row in ledgerRows" :key="row.id" class="grid grid-cols-[100px_110px_80px_minmax(160px,1fr)_minmax(120px,1fr)_120px_80px_150px_150px] gap-3 px-5 py-3.5 text-xs border-b border-slate-50 last:border-b-0 hover:bg-slate-50 transition-colors items-center">
                <span class="text-slate-600 font-medium">{{ row.date || '-' }}</span>
                <span class="font-bold text-slate-800">{{ row.docNo }}</span>
                <span>
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
                    :class="{
                      'bg-green-100 text-green-700': row.type==='IN',
                      'bg-red-100 text-red-700': row.type==='OUT',
                      'bg-yellow-100 text-yellow-700': row.type==='ADJUST',
                      'bg-blue-100 text-blue-700': row.type==='PURCHASE'
                    }"
                  >{{ row.type }}</span>
                </span>
                <span class="text-slate-700">{{ row.project }}</span>
                <span class="truncate text-slate-600" :title="row.contractor">{{ row.contractor }}</span>
                <span class="truncate text-slate-600">{{ row.requester }}</span>
                <span class="text-right">
                  <template v-if="row.showAdjust">
                    <div class="text-[9px] font-medium text-slate-400 uppercase leading-tight">{{ S.adjSys }}→{{ S.adjPhysical }}</div>
                    <div class="font-mono font-bold text-slate-800">{{ row.prevStock }} → {{ row.newStock }}</div>
                    <div class="text-[10px] font-bold" :class="Number(row.qty) < 0 ? 'text-red-500' : Number(row.qty) > 0 ? 'text-emerald-500' : 'text-slate-400'">Δ {{ Number(row.qty) > 0 ? '+' : '' }}{{ row.qty }}</div>
                  </template>
                  <span v-else class="font-mono font-bold text-slate-800 text-sm">{{ row.qty }}</span>
                </span>
                <span class="truncate text-slate-500">{{ row.itemNote }}</span>
                <span class="truncate text-slate-500">{{ row.orderNote }}</span>
              </div>
              <div v-if="ledgerRows.length === 0" class="px-5 py-8 text-center text-sm font-medium text-slate-400">No matching ledger entries</div>
            </div>
          </div>
        </div>

        <!-- Order View -->
        <template v-else>
          <div v-for="r in results" :key="r.id" class="bg-white rounded-2xl shadow-sm border border-slate-100 relative group transition-shadow hover:shadow-md overflow-hidden">
            <!-- Header -->
            <div class="px-5 py-3 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center cursor-pointer" @click="toggleExpand(r)">
              <div class="flex items-center gap-3">
                <span class="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                  :class="{
                    'bg-green-100 text-green-700': r.type==='IN',
                    'bg-red-100 text-red-700': r.type==='OUT',
                    'bg-yellow-100 text-yellow-700': r.type==='ADJUST',
                    'bg-blue-100 text-blue-700': r.type==='PURCHASE'
                  }"
                >{{ r.type }}</span>
                <span class="text-sm text-slate-800 font-bold">{{ orderDate(r) }}</span>
                <span class="text-[11px] text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-md">{{ r.docNo }}</span>
              </div>
              <div class="flex gap-1.5 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                <button @click.stop="openEdit(r)" class="text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-blue-100 transition-colors md3-ripple">Edit</button>
                <button @click.stop="remove(r.id)" class="text-red-600 bg-red-50 px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-red-100 transition-colors md3-ripple">Delete</button>
              </div>
            </div>

            <!-- Content Grid -->
            <div class="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div class="bg-[#F3EDF7] rounded-xl px-4 py-3">
                <div class="text-[10px] uppercase font-bold tracking-wide text-slate-500 mb-1">Project</div>
                <div class="text-sm font-semibold text-slate-800">{{ projectLabel(r) }}</div>
              </div>
              <div class="bg-[#F3EDF7] rounded-xl px-4 py-3">
                <div class="text-[10px] uppercase font-bold tracking-wide text-slate-500 mb-1">Contractor / Requester</div>
                <div class="text-sm font-semibold text-slate-800 truncate">{{ r.contractor || r.requester || '—' }}</div>
              </div>
              <div v-if="r.note || r.remark" class="bg-[#F3EDF7] rounded-xl px-4 py-3 md:col-span-2">
                <div class="text-[10px] uppercase font-bold tracking-wide text-slate-500 mb-1">Order Note</div>
                <div class="text-sm text-slate-700">{{ orderNote(r) }}</div>
              </div>
            </div>

            <!-- Line Items Table -->
            <div class="px-5 pb-5">
              <div class="border border-slate-100 rounded-xl overflow-hidden">
                <div class="px-4 py-2 bg-slate-50 border-b border-slate-100">
                  <div class="grid grid-cols-[minmax(200px,1fr)_minmax(100px,1fr)_90px_1fr] gap-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 min-w-[600px]">
                    <span>Material</span>
                    <span class="text-right">{{ r.type === 'ADJUST' ? (S.adjSys + ' → ' + S.adjPhysical + ' / Δ') : 'Qty' }}</span>
                    <span>Status</span>
                    <span>Item Note</span>
                  </div>
                </div>
                <div class="overflow-x-auto">
                  <div v-for="(item, idx) in (r.items || [])" :key="idx" class="px-4 py-2.5 border-b border-slate-50 last:border-b-0 hover:bg-slate-50/50">
                    <div class="grid grid-cols-[minmax(200px,1fr)_minmax(100px,1fr)_90px_1fr] gap-3 text-xs text-slate-800 min-w-[600px] items-center">
                      <span class="break-words font-semibold">{{ item.name || '-' }}</span>
                      <span class="font-bold font-mono text-right">
                        <template v-if="r.type === 'ADJUST' && item.prevStock != null && item.newStock != null">
                          <span class="block text-[10px] font-medium text-slate-400">{{ item.prevStock }} → {{ item.newStock }}</span>
                          <span class="text-[11px]" :class="Number(item.qty) < 0 ? 'text-red-500' : Number(item.qty) > 0 ? 'text-emerald-500' : 'text-slate-400'">Δ {{ Number(item.qty) > 0 ? '+' : '' }}{{ item.qty }}</span>
                        </template>
                        <template v-else><span class="text-sm">{{ item.qty || '-' }}</span></template>
                      </span>
                      <span class="truncate text-slate-500">{{ item.status || '-' }}</span>
                      <span class="truncate text-slate-500">{{ itemNote(item) }}</span>
                    </div>
                  </div>
                  <div v-if="!r.items || r.items.length === 0" class="px-4 py-4 text-xs text-slate-400 italic text-center">No items</div>
                </div>
              </div>
            </div>

          </div>
        </template>
      </div>

      <!-- Edit Modal -->
      <teleport to="body">
        <div v-if="isEditOpen" class="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-[#1D1B20]/40 backdrop-blur-sm" @click="isEditOpen = false"></div>

          <div class="relative w-full max-w-2xl bg-[#FEF7FF] rounded-[28px] shadow-md3-elevation-3 flex flex-col max-h-[90vh] animate-fade-in-up overflow-hidden">
            <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white z-10 shrink-0">
              <h3 class="font-semibold text-lg text-slate-800">Edit Order</h3>
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
                <div class="md3-input-container">
                  <input v-model="editForm.subProject" class="md3-input" placeholder=" " />
                  <label class="md3-label !bg-[#FEF7FF]">Sub Project</label>
                </div>

                <div class="md3-input-container md3-picker">
                  <ItemPicker v-model="editForm.requester" source="REQUESTERS" class="md3-input" :class="{'has-val': !!editForm.requester}" />
                  <label class="md3-label !bg-[#FEF7FF]">Requester</label>
                </div>
                <div class="md3-input-container md3-picker">
                  <ItemPicker v-model="editForm.contractor" source="CONTRACTORS" class="md3-input" :class="{'has-val': !!editForm.contractor}" />
                  <label class="md3-label !bg-[#FEF7FF]">Contractor</label>
                </div>

                <div class="md3-input-container">
                  <input v-model="editForm.priority" class="md3-input" placeholder=" " />
                  <label class="md3-label !bg-[#FEF7FF]">Priority</label>
                </div>
                <div class="md3-input-container">
                  <input v-model="editForm.status" class="md3-input" placeholder=" " />
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
                    <button @click="removeLine(idx)" class="absolute -top-2 -right-2 w-6 h-6 flex items-center justify-center bg-red-100 text-red-600 rounded-full text-xs font-bold shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">×</button>
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
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div class="md3-input-container"><input v-model="line.supplier" class="md3-input" placeholder=" "/><label class="md3-label !bg-white">Supplier</label></div>
                      <div class="md3-input-container"><input v-model="line.status" class="md3-input" placeholder=" "/><label class="md3-label !bg-white">Item Status</label></div>
                      <div class="md3-input-container"><input v-model="line.note" class="md3-input" placeholder=" "/><label class="md3-label !bg-white">Item Note</label></div>
                    </div>
                  </div>
                  <button @click="addLine" class="w-full py-3.5 border-2 border-dashed border-slate-200 rounded-2xl text-blue-600 text-sm font-bold hover:bg-blue-50 transition-colors md3-ripple">+ Add Item</button>
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
