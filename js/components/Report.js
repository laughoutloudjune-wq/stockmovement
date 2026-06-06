import { ref, computed } from 'vue';
import { db } from '../firebase.js';
import { collection, getDocs, deleteDoc, doc, updateDoc, query, where } from 'firebase/firestore';
import { toast, todayStr, STR } from '../shared.js';
import ItemPicker from './ItemPicker.js';

// MD3 chip class mapping for transaction types
const typeChipClass = (type) => {
  const t = (type || '').toUpperCase();
  if (t === 'IN')       return 'md3-chip md3-chip-in';
  if (t === 'OUT')      return 'md3-chip md3-chip-out';
  if (t === 'ADJUST')   return 'md3-chip md3-chip-adjust';
  if (t === 'PURCHASE') return 'md3-chip md3-chip-purchase';
  return 'md3-chip md3-chip-neutral';
};

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
    const orderNote = (r) => r.note || r.remark || '—';
    const itemNote = (item) => item.note || item.remark || '—';
    const projectLabel = (r) => [r.project, r.subProject].filter(Boolean).join(' › ') || '—';

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
            docNo: r.docNo || '—',
            type: r.type || '—',
            project: projectLabel(r),
            contractor: r.contractor || '—',
            requester: r.requester || '—',
            qty: i.qty ?? '—',
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
            const pt = [r.project, r.subProject].filter(Boolean).join(' › ');
            return (
              pt.toLowerCase().includes(term) ||
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
      } catch (e) { console.error(e); }
      finally { loading.value = false; }
    };

    const exportExcel = () => {
      if (results.value.length === 0) return toast('No data to export');
      let csv = '\uFEFFDate,DocNo,Type,Project,SubProject,Requester,RequesterEmail,Contractor,OrderStatus,NeedBy,Priority,Item,Qty,PrevStock,NewStock,ItemSupplier,ItemStatus,ItemNote,ItemRemark,OrderNote,OrderRemark,Timestamp\n';

      results.value.forEach(r => {
        const date = orderDate(r);
        const items = Array.isArray(r.items) ? r.items : [];
        if (items.length === 0) {
          csv += [date, r.docNo || '', r.type || '', r.project || '', r.subProject || '',
            r.requester || '', r.requesterEmail || '', r.contractor || '', r.status || '',
            r.needBy || '', r.priority || '', '', '', '', '', '', '', '',
            (r.note || '').replace(/,/g, ' '),
            (r.remark || '').replace(/,/g, ' '),
            r.timestamp || ''].join(',') + '\n';
          return;
        }
        items.forEach(item => {
          csv += [date, r.docNo || '', r.type || '', r.project || '', r.subProject || '',
            r.requester || '', r.requesterEmail || '', r.contractor || '', r.status || '',
            r.needBy || '', r.priority || '',
            String(item.name || '').replace(/,/g, ' '),
            item.qty || '',
            item.prevStock != null ? item.prevStock : '',
            item.newStock != null ? item.newStock : '',
            String(item.supplier || '').replace(/,/g, ' '),
            String(item.status || '').replace(/,/g, ' '),
            String(item.note || '').replace(/,/g, ' '),
            String(item.remark || '').replace(/,/g, ' '),
            String(r.note || '').replace(/,/g, ' '),
            String(r.remark || '').replace(/,/g, ' '),
            r.timestamp || ''].join(',') + '\n';
        });
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.setAttribute('href', URL.createObjectURL(blob));
      link.setAttribute('download', `report_${filters.value.start}_${filters.value.end}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    const remove = async (id) => {
      if (!confirm('Delete this order? Stock counts will NOT be reverted automatically.')) return;
      try { await deleteDoc(doc(db, 'orders', id)); toast('Deleted'); await generate(); }
      catch (e) { console.error(e); toast('Failed'); }
    };

    const openEdit = (order) => {
      editingId.value = order.id;
      editForm.value = JSON.parse(JSON.stringify(order));
      if (!editForm.value.note && editForm.value.remark) editForm.value.note = editForm.value.remark;
      if (!editForm.value.items) editForm.value.items = [];
      isEditOpen.value = true;
    };

    const addLine = () => editForm.value.items.push({ name: '', qty: '', supplier: '', status: 'Requested', note: '' });
    const removeLine = (i) => editForm.value.items.splice(i, 1);

    const saveEdit = async () => {
      try {
        await updateDoc(doc(db, 'orders', editingId.value), {
          date: editForm.value.date || todayStr(),
          project: editForm.value.project || '', subProject: editForm.value.subProject || '',
          requester: editForm.value.requester || '', requesterEmail: editForm.value.requesterEmail || '',
          contractor: editForm.value.contractor || '', needBy: editForm.value.needBy || '',
          priority: editForm.value.priority || '', status: editForm.value.status || '',
          note: editForm.value.note || '', remark: editForm.value.note || '',
          items: (editForm.value.items || [])
            .filter(i => i.name && i.qty !== '' && i.qty != null)
            .map(i => {
              const row = { name: i.name, qty: Number(i.qty), supplier: i.supplier || '', status: i.status || '', note: i.note || '', remark: i.remark || i.note || '' };
              if (i.prevStock != null && i.prevStock !== '') row.prevStock = Number(i.prevStock);
              if (i.newStock != null && i.newStock !== '') row.newStock = Number(i.newStock);
              return row;
            })
        });
        toast('Updated');
        isEditOpen.value = false;
        await generate();
      } catch (e) { console.error(e); toast('Failed to update'); }
    };

    const toggleExpand = (r) => { expanded.value = expanded.value === r.id ? null : r.id; };

    return {
      filters, results, loading, generate, remove, exportExcel,
      openEdit, isEditOpen, editForm, saveEdit, addLine, removeLine,
      expanded, toggleExpand, orderDate, orderNote, itemNote, projectLabel,
      isMaterialLedger, ledgerRows, S, typeChipClass
    };
  },
  template: `
    <div class="space-y-4 pb-28 md:pb-8 pt-2">

      <!-- Filter Card -->
      <section class="md3-card-filled space-y-4">
        <h3 class="text-[16px] font-medium text-[#1D1B20] flex items-center gap-2">
          <span class="material-symbols-outlined icon-sm text-[#6750A4]">bar_chart</span>
          {{ S.tabs?.report || 'Report' }}
        </h3>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="md3-input-container">
            <input type="date" v-model="filters.start" class="md3-input" placeholder=" " />
            <label class="md3-label">From</label>
          </div>
          <div class="md3-input-container">
            <input type="date" v-model="filters.end" class="md3-input" placeholder=" " />
            <label class="md3-label">To</label>
          </div>

          <div class="md:col-span-2 md3-input-container md3-picker" :class="{'has-value': !!filters.material}">
            <ItemPicker v-model="filters.material" source="MATERIALS" placeholder="All Items (Optional)"
              class="md3-input" :class="{'has-val': !!filters.material}" />
            <label class="md3-label">Filter Item / SKU</label>
          </div>

          <div class="md:col-span-2 md3-input-container">
            <input v-model="filters.search" class="md3-input" placeholder=" " />
            <label class="md3-label flex items-center gap-1">
              <span class="material-symbols-outlined" style="font-size:16px">search</span>
              Search doc, project, contractor…
            </label>
          </div>

          <div class="md3-input-container">
            <select v-model="filters.type" class="md3-input">
              <option value="ALL">All Types</option>
              <option value="OUT">OUT</option>
              <option value="IN">IN</option>
              <option value="ADJUST">ADJUST</option>
              <option value="PURCHASE">PURCHASE</option>
            </select>
            <label class="md3-label">Type</label>
          </div>

          <div class="flex items-end">
            <button @click="generate" class="md3-btn-filled md3-ripple w-full flex items-center justify-center gap-2 h-14">
              <span class="material-symbols-outlined icon-sm">search</span>
              {{ S.reportGen || 'Search' }}
            </button>
          </div>
        </div>
      </section>

      <!-- Status bar -->
      <div class="flex items-center justify-between gap-2">
        <div class="flex flex-wrap items-center gap-2">
          <span class="md3-chip bg-[#E8DEF8] text-[#1D192B]">
            <span class="material-symbols-outlined" style="font-size:14px">receipt_long</span>
            {{ loading ? 'Loading…' : results.length + ' records' }}
          </span>
          <span v-if="filters.type !== 'ALL'" :class="typeChipClass(filters.type)">
            {{ filters.type }}
          </span>
          <span v-if="filters.material" class="md3-chip bg-[#F3EDF7] text-[#1D1B20]">
            <span class="material-symbols-outlined" style="font-size:14px">inventory_2</span>
            {{ filters.material }}
          </span>
        </div>
        <button v-if="results.length > 0" @click="exportExcel"
          class="md3-btn-tonal md3-ripple flex items-center gap-1 h-8 px-3 text-[13px]">
          <span class="material-symbols-outlined" style="font-size:18px">download</span>
          Export CSV
        </button>
      </div>

      <!-- Results area -->
      <div class="space-y-3">
        <!-- Loading skeleton -->
        <div v-if="loading" class="space-y-3 animate-pulse">
          <div v-for="i in 3" :key="'sk-rpt-'+i" class="h-40 bg-[#E6E0E9] rounded-[16px]"></div>
        </div>

        <!-- Empty state -->
        <div v-if="results.length === 0 && !loading"
          class="text-center py-14 text-[#49454F] text-[14px] bg-[#F7F2FA] rounded-[16px] border border-dashed border-[#CAC4D0] flex flex-col items-center gap-2">
          <span class="material-symbols-outlined text-[#CAC4D0]" style="font-size:48px">bar_chart</span>
          Set filters and press Search
        </div>

        <!-- ── Material Ledger View ── -->
        <div v-if="isMaterialLedger && results.length > 0"
          class="md3-card-outlined p-0 overflow-hidden">
          <div class="px-5 py-4 bg-[#F3EDF7] border-b border-[#CAC4D0] flex items-center justify-between">
            <div class="text-[14px] font-medium text-[#1D1B20] flex items-center gap-2">
              <span class="material-symbols-outlined icon-sm text-[#6750A4]">menu_book</span>
              Material Ledger
            </div>
            <span class="md3-chip bg-[#E8DEF8] text-[#1D192B]" style="font-size:12px">{{ filters.material }}</span>
          </div>

          <div class="overflow-x-auto">
            <div class="min-w-[960px]">
              <!-- Ledger header -->
              <div class="grid grid-cols-[100px_110px_90px_minmax(140px,1fr)_minmax(110px,1fr)_110px_80px_140px_140px]
                gap-3 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#49454F]
                border-b border-[#E6E0E9] bg-[#ECE6F0]">
                <span>Date</span><span>Doc No</span><span>Type</span>
                <span>Project</span><span>Contractor</span><span>Requester</span>
                <span class="text-right">Qty</span><span>Item Note</span><span>Order Note</span>
              </div>

              <div v-for="row in ledgerRows" :key="row.id"
                class="grid grid-cols-[100px_110px_90px_minmax(140px,1fr)_minmax(110px,1fr)_110px_80px_140px_140px]
                gap-3 px-5 py-3 text-[13px] border-b border-[#F3EDF7] last:border-b-0
                hover:bg-[#F3EDF7] transition-colors items-center">
                <span class="text-[#49454F] font-medium">{{ row.date || '—' }}</span>
                <span class="font-medium text-[#1D1B20]">{{ row.docNo }}</span>
                <span><span :class="typeChipClass(row.type)">{{ row.type }}</span></span>
                <span class="text-[#1D1B20] truncate">{{ row.project }}</span>
                <span class="text-[#49454F] truncate" :title="row.contractor">{{ row.contractor }}</span>
                <span class="text-[#49454F] truncate">{{ row.requester }}</span>
                <span class="text-right">
                  <template v-if="row.showAdjust">
                    <div class="text-[10px] text-[#49454F]">{{ S.adjSys }}→{{ S.adjPhysical }}</div>
                    <div class="font-mono font-bold text-[#1D1B20]">{{ row.prevStock }}→{{ row.newStock }}</div>
                    <div class="text-[11px] font-bold" :class="Number(row.qty) < 0 ? 'text-[#B3261E]' : Number(row.qty) > 0 ? 'text-[#1B5E20]' : 'text-[#49454F]'">
                      Δ {{ Number(row.qty) > 0 ? '+' : '' }}{{ row.qty }}
                    </div>
                  </template>
                  <span v-else class="font-mono font-bold text-[#1D1B20]">{{ row.qty }}</span>
                </span>
                <span class="text-[#49454F] truncate">{{ row.itemNote }}</span>
                <span class="text-[#49454F] truncate">{{ row.orderNote }}</span>
              </div>

              <div v-if="ledgerRows.length === 0" class="px-5 py-10 text-center text-[14px] text-[#49454F]">
                No matching ledger entries
              </div>
            </div>
          </div>
        </div>

        <!-- ── Order Cards View ── -->
        <template v-else>
          <div v-for="r in results" :key="r.id"
            class="md3-card-outlined p-0 overflow-hidden hover:shadow-md3-elevation-1 transition-shadow group">

            <!-- Card header -->
            <div class="px-4 py-3 bg-[#F7F2FA] border-b border-[#E6E0E9] flex justify-between items-center cursor-pointer hover:bg-[#F0EBF6] transition-colors"
              @click="toggleExpand(r)">
              <div class="flex items-center gap-3 min-w-0">
                <span :class="typeChipClass(r.type)">{{ r.type }}</span>
                <span class="text-[14px] font-medium text-[#1D1B20]">{{ orderDate(r) }}</span>
                <span class="text-[12px] text-[#49454F] bg-[#E6E0E9] px-2 py-0.5 rounded-md font-mono">{{ r.docNo }}</span>
              </div>
              <div class="flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button @click.stop="openEdit(r)"
                  class="md3-btn-tonal md3-ripple h-8 px-3 text-[13px] flex items-center gap-1">
                  <span class="material-symbols-outlined" style="font-size:16px">edit</span>
                </button>
                <button @click.stop="remove(r.id)"
                  class="md3-btn-text-error md3-ripple h-8 px-3 text-[13px] flex items-center gap-1">
                  <span class="material-symbols-outlined" style="font-size:16px">delete</span>
                </button>
              </div>
            </div>

            <!-- Info grid -->
            <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div class="bg-[#F3EDF7] rounded-[12px] px-4 py-3">
                <div class="text-[11px] uppercase font-semibold tracking-wider text-[#49454F] mb-1">Project</div>
                <div class="text-[14px] font-medium text-[#1D1B20]">{{ projectLabel(r) }}</div>
              </div>
              <div class="bg-[#F3EDF7] rounded-[12px] px-4 py-3">
                <div class="text-[11px] uppercase font-semibold tracking-wider text-[#49454F] mb-1">Contractor / Requester</div>
                <div class="text-[14px] font-medium text-[#1D1B20] truncate">{{ r.contractor || r.requester || '—' }}</div>
              </div>
              <div v-if="r.note || r.remark" class="bg-[#F3EDF7] rounded-[12px] px-4 py-3 md:col-span-2">
                <div class="text-[11px] uppercase font-semibold tracking-wider text-[#49454F] mb-1">Note</div>
                <div class="text-[14px] text-[#1D1B20]">{{ orderNote(r) }}</div>
              </div>
            </div>

            <!-- Line items table -->
            <div class="px-4 pb-4">
              <div class="bg-[#FEF7FF] border border-[#E6E0E9] rounded-[12px] overflow-hidden">
                <div class="px-4 py-2.5 bg-[#ECE6F0] border-b border-[#E6E0E9]">
                  <div class="grid grid-cols-[minmax(180px,1fr)_minmax(80px,1fr)_80px_1fr] gap-3 text-[11px] font-semibold uppercase tracking-wider text-[#49454F] min-w-[520px]">
                    <span>Material</span>
                    <span class="text-right">{{ r.type === 'ADJUST' ? (S.adjSys + '→' + S.adjPhysical + '/Δ') : 'Qty' }}</span>
                    <span>Status</span>
                    <span>Note</span>
                  </div>
                </div>
                <div class="overflow-x-auto">
                  <div v-for="(item, idx) in (r.items || [])" :key="idx"
                    class="px-4 py-2.5 border-b border-[#F3EDF7] last:border-b-0 hover:bg-[#F7F2FA] transition-colors">
                    <div class="grid grid-cols-[minmax(180px,1fr)_minmax(80px,1fr)_80px_1fr] gap-3 text-[13px] text-[#1D1B20] min-w-[520px] items-center">
                      <span class="font-medium break-words">{{ item.name || '—' }}</span>
                      <span class="font-bold font-mono text-right">
                        <template v-if="r.type === 'ADJUST' && item.prevStock != null && item.newStock != null">
                          <span class="block text-[11px] font-medium text-[#49454F]">{{ item.prevStock }} → {{ item.newStock }}</span>
                          <span class="text-[12px] font-bold" :class="Number(item.qty) < 0 ? 'text-[#B3261E]' : Number(item.qty) > 0 ? 'text-[#1B5E20]' : 'text-[#49454F]'">
                            Δ {{ Number(item.qty) > 0 ? '+' : '' }}{{ item.qty }}
                          </span>
                        </template>
                        <template v-else>{{ item.qty || '—' }}</template>
                      </span>
                      <span class="text-[#49454F] text-[12px]">{{ item.status || '—' }}</span>
                      <span class="text-[#49454F] text-[12px] truncate">{{ itemNote(item) }}</span>
                    </div>
                  </div>
                  <div v-if="!r.items || r.items.length === 0"
                    class="px-4 py-6 text-center text-[13px] text-[#79747E]">No items</div>
                </div>
              </div>
            </div>

          </div>
        </template>
      </div>

      <!-- Edit Dialog -->
      <teleport to="body">
        <div v-if="isEditOpen" class="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div class="md3-scrim animate-fade-in" @click="isEditOpen = false"></div>
          <div class="relative w-full max-w-2xl md3-dialog-surface flex flex-col max-h-[90vh] animate-scale-in overflow-hidden">

            <!-- Dialog header -->
            <div class="px-6 pt-6 pb-4 shrink-0 flex items-center justify-between">
              <h3 class="text-[22px] font-normal text-[#1D1B20]">Edit Order</h3>
              <button @click="isEditOpen = false" class="md3-icon-btn md3-ripple text-[#49454F]">
                <span class="material-symbols-outlined icon-sm">close</span>
              </button>
            </div>

            <!-- Dialog content -->
            <div class="px-6 pb-4 overflow-y-auto space-y-4 flex-1">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="md3-input-container"><input type="date" v-model="editForm.date" class="md3-input" placeholder=" " /><label class="md3-label">Date</label></div>
                <div class="md3-input-container"><input type="date" v-model="editForm.needBy" class="md3-input" placeholder=" " /><label class="md3-label">Need By</label></div>
                <div class="md3-input-container md3-picker" :class="{'has-value': !!editForm.project}">
                  <ItemPicker v-model="editForm.project" source="PROJECTS" class="md3-input" :class="{'has-val': !!editForm.project}" />
                  <label class="md3-label">Project</label>
                </div>
                <div class="md3-input-container"><input v-model="editForm.subProject" class="md3-input" placeholder=" " /><label class="md3-label">Sub Project</label></div>
                <div class="md3-input-container md3-picker" :class="{'has-value': !!editForm.requester}">
                  <ItemPicker v-model="editForm.requester" source="REQUESTERS" class="md3-input" :class="{'has-val': !!editForm.requester}" />
                  <label class="md3-label">Requester</label>
                </div>
                <div class="md3-input-container md3-picker" :class="{'has-value': !!editForm.contractor}">
                  <ItemPicker v-model="editForm.contractor" source="CONTRACTORS" class="md3-input" :class="{'has-val': !!editForm.contractor}" />
                  <label class="md3-label">Contractor</label>
                </div>
                <div class="md3-input-container"><input v-model="editForm.priority" class="md3-input" placeholder=" " /><label class="md3-label">Priority</label></div>
                <div class="md3-input-container"><input v-model="editForm.status" class="md3-input" placeholder=" " /><label class="md3-label">Status</label></div>
                <div class="md:col-span-2 md3-input-container"><input v-model="editForm.note" class="md3-input" placeholder=" " /><label class="md3-label">Note</label></div>
              </div>

              <div class="pt-2 border-t border-[#E6E0E9]">
                <h4 class="text-[14px] font-medium text-[#1D1B20] mb-3">Line Items</h4>
                <div class="space-y-3">
                  <div v-for="(line, idx) in editForm.items" :key="idx"
                    class="bg-[#ECE6F0] rounded-[12px] p-4 relative">
                    <button @click="removeLine(idx)" class="absolute top-2 right-2 md3-icon-btn md3-ripple w-8 h-8 text-[#49454F]">
                      <span class="material-symbols-outlined" style="font-size:18px">close</span>
                    </button>
                    <div class="flex gap-3 mb-3">
                      <div class="md3-input-container md3-picker flex-1" :class="{'has-value': !!line.name}">
                        <ItemPicker v-model="line.name" source="MATERIALS" class="md3-input" :class="{'has-val': !!line.name}" />
                        <label class="md3-label">Material</label>
                      </div>
                      <div class="md3-input-container w-24">
                        <input type="number" v-model="line.qty" class="md3-input text-center font-bold" placeholder=" " />
                        <label class="md3-label">Qty</label>
                      </div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div class="md3-input-container"><input v-model="line.supplier" class="md3-input" placeholder=" " /><label class="md3-label">Supplier</label></div>
                      <div class="md3-input-container"><input v-model="line.status" class="md3-input" placeholder=" " /><label class="md3-label">Item Status</label></div>
                      <div class="md3-input-container"><input v-model="line.note" class="md3-input" placeholder=" " /><label class="md3-label">Item Note</label></div>
                    </div>
                  </div>
                  <button @click="addLine"
                    class="w-full py-4 border-2 border-dashed border-[#CAC4D0] rounded-[12px] text-[#6750A4] text-[14px] font-medium hover:bg-[#F3EDF7] transition-colors md3-ripple flex items-center justify-center gap-2">
                    <span class="material-symbols-outlined icon-sm">add</span>
                    Add Item
                  </button>
                </div>
              </div>
            </div>

            <!-- Dialog actions -->
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
