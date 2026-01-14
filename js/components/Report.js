import { ref, computed, onMounted } from 'vue';
import { db } from '../firebase.js';
import { collection, query, where, getDocs, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { toast, todayStr } from '../shared.js';
import ItemPicker from './ItemPicker.js';

export default {
  props: ['lang', 'user'],
  components: { ItemPicker },
  setup(props) {
    const filters = ref({ start: todayStr().slice(0, 8) + '01', end: todayStr(), type: 'ALL', search: '' });
    const results = ref([]);
    const loading = ref(false);

    // Edit Modal
    const isEditOpen = ref(false);
    const editForm = ref({});
    const editingId = ref(null);

    // --- Fetch Orders (Grouped) ---
    const generate = async () => {
      loading.value = true;
      results.value = [];
      try {
        const ref = collection(db, 'orders');
        // Simple Query (Client-side filtering for search/type to avoid index hell)
        const q = query(ref, where('date', '>=', filters.value.start), where('date', '<=', filters.value.end), orderBy('date', 'desc'));
        
        const snap = await getDocs(q);
        let data = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Filter Type
        if (filters.value.type !== 'ALL') {
            data = data.filter(r => r.type === filters.value.type);
        }
        // Filter Search (Check items array or project/requester)
        if (filters.value.search) {
            const term = filters.value.search.toLowerCase();
            data = data.filter(r => 
                (r.project || '').toLowerCase().includes(term) || 
                (r.requester || '').toLowerCase().includes(term) ||
                (r.docNo || '').toLowerCase().includes(term) ||
                (r.items || []).some(i => i.name.toLowerCase().includes(term))
            );
        }
        results.value = data;
      } catch (e) {
        console.error(e);
        if(e.code === 'failed-precondition') alert("Missing Index. Check Console.");
      } finally { loading.value = false; }
    };

    // --- Actions ---
    const remove = async (id) => {
        if(!confirm('Delete this Order? Stock counts will NOT be reverted automatically.')) return;
        try {
            await deleteDoc(doc(db, 'orders', id));
            toast('Deleted');
            generate();
        } catch(e) { toast('Failed'); }
    };

    const openEdit = (order) => {
        editingId.value = order.id;
        // Deep copy to avoid modifying list directly
        editForm.value = JSON.parse(JSON.stringify(order));
        if (!editForm.value.items) editForm.value.items = [];
        isEditOpen.value = true;
    };

    const addLine = () => editForm.value.items.push({ name: '', qty: '' });
    const removeLine = (i) => editForm.value.items.splice(i, 1);

    const saveEdit = async () => {
        try {
            await updateDoc(doc(db, 'orders', editingId.value), {
                date: editForm.value.date,
                project: editForm.value.project || '',
                contractor: editForm.value.contractor || '',
                requester: editForm.value.requester || '',
                note: editForm.value.note || '',
                items: editForm.value.items.filter(i => i.name && i.qty)
            });
            toast('Updated');
            isEditOpen.value = false;
            generate();
        } catch(e) { toast('Failed to update'); }
    };

    onMounted(generate);

    return { 
        filters, results, loading, generate, remove, 
        openEdit, isEditOpen, editForm, saveEdit, addLine, removeLine
    };
  },
  template: `
    <div class="space-y-6 pb-24">
      
      <section class="glass rounded-2xl p-5 shadow-sm space-y-4">
        <h3 class="font-bold text-lg text-slate-800">📊 Report (Orders)</h3>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="label">From</label><input type="date" v-model="filters.start" class="input" /></div>
          <div><label class="label">To</label><input type="date" v-model="filters.end" class="input" /></div>
          <div class="col-span-2"><input v-model="filters.search" placeholder="Search..." class="input" /></div>
          <div class="col-span-2 flex gap-2">
              <select v-model="filters.type" class="input flex-1"><option value="ALL">All</option><option value="OUT">OUT</option><option value="IN">IN</option></select>
              <button @click="generate" class="bg-blue-500 text-white font-bold px-6 rounded-xl shadow-md">Search</button>
          </div>
        </div>
      </section>

      <div class="space-y-3">
        <div v-if="results.length === 0 && !loading" class="text-center py-10 text-slate-400">No records found</div>

        <div v-for="r in results" :key="r.id" class="bg-white p-4 rounded-xl shadow-sm border border-slate-100 relative group">
           
           <div class="flex justify-between items-start mb-2">
              <div>
                 <span class="badge" :class="r.type==='IN'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'">{{ r.type }}</span>
                 <span class="text-xs text-slate-500 font-bold ml-2">{{ r.date }}</span>
                 <div class="text-[10px] text-slate-400">{{ r.docNo }}</div>
              </div>
              <div class="flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button @click="openEdit(r)" class="text-blue-500 bg-blue-50 p-1.5 rounded-lg text-xs font-bold">Edit</button>
                  <button @click="remove(r.id)" class="text-red-500 bg-red-50 p-1.5 rounded-lg text-xs font-bold">Del</button>
              </div>
           </div>

           <div class="text-sm font-bold text-slate-700">{{ r.project }}</div>
           <div class="text-xs text-slate-500 mb-2">By: {{ r.requester }} <span v-if="r.contractor">• To: {{ r.contractor }}</span></div>

           <div class="bg-slate-50 rounded-lg p-2 space-y-1">
             <div v-for="(item, idx) in r.items" :key="idx" class="flex justify-between text-xs text-slate-600">
               <span>• {{ item.name }}</span>
               <span class="font-bold font-mono">{{ item.qty }}</span>
             </div>
           </div>

        </div>
      </div>

      <teleport to="body">
        <div v-if="isEditOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" @click="isEditOpen = false"></div>
          
          <div class="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-5 animate-fade-in-up max-h-[90vh] overflow-y-auto">
            <h3 class="font-bold text-lg mb-4">Edit Order</h3>
            
            <div class="space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <div><label class="label">Date</label><input type="date" v-model="editForm.date" class="input" /></div>
                <div><label class="label">Project</label><ItemPicker v-model="editForm.project" source="PROJECTS" /></div>
              </div>
              <div><label class="label">Requester</label><ItemPicker v-model="editForm.requester" source="REQUESTERS" /></div>
              <div><label class="label">Contractor</label><ItemPicker v-model="editForm.contractor" source="CONTRACTORS" /></div>
              
              <div class="space-y-2 pt-2">
                 <div v-for="(line, idx) in editForm.items" :key="idx" class="flex gap-2 items-center bg-slate-50 p-2 rounded-lg">
                    <div class="flex-1"><ItemPicker v-model="line.name" source="MATERIALS" /></div>
                    <input type="number" v-model="line.qty" class="w-16 input text-center font-bold" />
                    <button @click="removeLine(idx)" class="text-red-500 font-bold px-2">×</button>
                 </div>
                 <button @click="addLine" class="w-full py-2 border border-dashed border-slate-300 rounded-lg text-slate-400 text-sm font-bold">+ Add Item</button>
              </div>
            </div>

            <div class="flex gap-2 mt-6">
              <button @click="isEditOpen = false" class="flex-1 bg-slate-100 font-bold py-3 rounded-xl">Cancel</button>
              <button @click="saveEdit" class="flex-1 bg-blue-500 text-white font-bold py-3 rounded-xl shadow-lg">Save Changes</button>
            </div>
          </div>
        </div>
      </teleport>

    </div>
  `,
  // Helper CSS classes for clean template
  styles: `
    .label { display: block; font-size: 0.75rem; font-weight: 700; color: #64748b; margin-bottom: 0.25rem; }
    .input { width: 100%; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; outline: none; }
    .input:focus { ring: 2px solid #3b82f6; }
    .badge { padding: 0.125rem 0.5rem; border-radius: 0.25rem; font-size: 0.65rem; font-weight: 800; text-transform: uppercase; }
  `
};
