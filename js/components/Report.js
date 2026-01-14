import { ref, computed, onMounted } from 'vue';
import { db } from '../firebase.js';
import { collection, query, where, getDocs, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { toast, todayStr } from '../shared.js';
import ItemPicker from './ItemPicker.js';

export default {
  props: ['lang', 'user'],
  components: { ItemPicker },
  setup(props) {
    const filters = ref({ 
        start: todayStr().slice(0, 8) + '01', // First day of month
        end: todayStr(), 
        type: 'ALL',
        search: '' 
    });
    
    const results = ref([]);
    const loading = ref(false);

    // Edit Modal State
    const isEditOpen = ref(false);
    const editForm = ref({});
    const editingId = ref(null);

    // --- 1. Fetch Data ---
    const generate = async () => {
      loading.value = true;
      results.value = [];
      try {
        // Query Firestore "movements"
        // Note: Firestore doesn't support multiple range filters on different fields easily without indexes.
        // We will fetch by Date, then filter by Type/Search in memory (efficient for <2000 records).
        
        const ref = collection(db, 'movements');
        const q = query(ref, 
            where('date', '>=', filters.value.start), 
            where('date', '<=', filters.value.end),
            orderBy('date', 'desc')
        );

        const snap = await getDocs(q);
        let data = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Memory Filter
        if (filters.value.type !== 'ALL') {
            data = data.filter(r => r.type === filters.value.type);
        }
        if (filters.value.search) {
            const term = filters.value.search.toLowerCase();
            data = data.filter(r => 
                (r.item || '').toLowerCase().includes(term) || 
                (r.project || '').toLowerCase().includes(term) ||
                (r.by || '').toLowerCase().includes(term)
            );
        }

        results.value = data;
        if (results.value.length === 0) toast('No records found');

      } catch (e) {
        console.error(e);
        // Fallback for "Missing Index" error - just fetch last 100 if date sort fails
        if(e.code === 'failed-precondition') {
            alert("First run requires an Index. Open Console (F12) and click the link from Firebase.");
        } else {
            toast('Error loading report');
        }
      } finally { 
        loading.value = false; 
      }
    };

    // --- 2. Delete Action ---
    const remove = async (id) => {
        if(!confirm('Delete this record? \n\n⚠️ Note: This removes the history log but does NOT automatically change the current stock count. Please check the "Adjust" tab if you need to fix stock.')) return;
        
        try {
            await deleteDoc(doc(db, 'movements', id));
            toast('Deleted');
            generate(); // Refresh
        } catch(e) {
            toast('Failed to delete');
        }
    };

    // --- 3. Edit Action ---
    const openEdit = (item) => {
        editingId.value = item.id;
        editForm.value = { ...item }; // Copy data
        isEditOpen.value = true;
    };

    const saveEdit = async () => {
        if(!editForm.value.item || !editForm.value.qty) return;
        
        try {
            await updateDoc(doc(db, 'movements', editingId.value), {
                date: editForm.value.date,
                item: editForm.value.item,
                qty: Number(editForm.value.qty),
                project: editForm.value.project || '',
                by: editForm.value.by || '',
                note: editForm.value.note || ''
            });
            
            toast('Updated');
            isEditOpen.value = false;
            generate(); // Refresh
        } catch(e) {
            toast('Failed to update');
        }
    };

    onMounted(generate); // Auto-load on open

    return { 
        filters, results, loading, generate, 
        remove, openEdit, isEditOpen, editForm, saveEdit
    };
  },
  template: `
    <div class="space-y-6 pb-24">
      
      <section class="glass rounded-2xl p-5 shadow-sm space-y-4">
        <h3 class="font-bold text-lg text-slate-800 flex items-center gap-2">
            📊 Report <span class="text-xs font-normal text-slate-500">(History)</span>
        </h3>
        
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-[10px] font-bold text-slate-400 uppercase">From</label>
            <input type="date" v-model="filters.start" class="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
             <label class="text-[10px] font-bold text-slate-400 uppercase">To</label>
             <input type="date" v-model="filters.end" class="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          
          <div class="col-span-2">
            <input v-model="filters.search" placeholder="Search item, project, or person..." class="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          
          <div class="col-span-2 flex gap-2">
              <select v-model="filters.type" class="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none">
                <option value="ALL">All Types</option>
                <option value="IN">IN</option>
                <option value="OUT">OUT</option>
                <option value="ADJUST">ADJUST</option>
              </select>
              
              <button @click="generate" :disabled="loading" class="flex-1 bg-blue-500 text-white font-bold py-2 rounded-xl shadow-md active:scale-95 transition-transform flex justify-center items-center">
                <span v-if="loading" class="animate-spin text-lg mr-2">C</span> Search
              </button>
          </div>
        </div>
      </section>

      <div class="space-y-3">
        <div v-if="results.length === 0 && !loading" class="text-center py-10 text-slate-400">No records found</div>

        <div v-for="r in results" :key="r.id" class="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col gap-2 relative group">
           
           <div class="absolute top-3 right-3 flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
              <button @click="openEdit(r)" class="text-blue-500 bg-blue-50 p-1.5 rounded-lg text-xs font-bold">Edit</button>
              <button @click="remove(r.id)" class="text-red-500 bg-red-50 p-1.5 rounded-lg text-xs font-bold">Del</button>
           </div>

           <div class="flex justify-between items-start pr-16">
              <div>
                 <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider" 
                    :class="{'bg-green-100 text-green-700':r.type==='IN','bg-red-100 text-red-700':r.type==='OUT','bg-yellow-100 text-yellow-700':r.type==='ADJUST'}">
                    {{ r.type }}
                 </span>
                 <span class="text-xs text-slate-400 ml-2">{{ r.date }}</span>
              </div>
           </div>
           
           <div class="flex justify-between items-center">
              <div>
                <div class="font-bold text-slate-800 text-sm">{{ r.item }}</div>
                <div class="text-xs text-slate-500 mt-0.5">
                   <span v-if="r.project">Proj: {{ r.project }} • </span>
                   <span v-if="r.by">By: {{ r.by }}</span>
                </div>
              </div>
              <div class="text-lg font-black text-slate-700">
                {{ r.qty }}
              </div>
           </div>
        </div>
      </div>

      <teleport to="body">
        <div v-if="isEditOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" @click="isEditOpen = false"></div>
          
          <div class="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-5 animate-fade-in-up">
            <h3 class="font-bold text-lg mb-4 text-slate-800">Edit Record</h3>
            
            <div class="space-y-3">
              <div><label class="label">Date</label><input type="date" v-model="editForm.date" class="input" /></div>
              <div><label class="label">Item</label><input v-model="editForm.item" class="input bg-slate-100 text-slate-500" readonly /></div>
              <div><label class="label">Qty</label><input type="number" v-model="editForm.qty" class="input font-bold" /></div>
              <div><label class="label">Project</label><ItemPicker v-model="editForm.project" source="PROJECTS" /></div>
              <div><label class="label">By</label><ItemPicker v-model="editForm.by" source="REQUESTERS" /></div>
            </div>

            <div class="flex gap-2 mt-6">
              <button @click="isEditOpen = false" class="flex-1 bg-slate-100 font-bold py-3 rounded-xl">Cancel</button>
              <button @click="saveEdit" class="flex-1 bg-blue-500 text-white font-bold py-3 rounded-xl shadow-lg">Save</button>
            </div>
          </div>
        </div>
      </teleport>

    </div>
  `
};
