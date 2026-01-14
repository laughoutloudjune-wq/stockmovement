import { ref, reactive, onMounted, computed } from 'vue';
import { db } from '../firebase.js';
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { toast, preloadLookups } from '../shared.js';
import Migrate from './Migrate.js'; // <--- Import the Migration Tool

export default {
  components: { Migrate }, // <--- Register it
  setup() {
    const activeSection = ref('materials'); 
    const loading = ref(false);
    const list = ref([]);
    const searchQuery = ref('');

    // Modal State
    const isModalOpen = ref(false);
    const editMode = ref(false);
    const form = reactive({ id: '', name: '', min: 0 });

    // Configuration for each section
    const CONFIG = {
      materials:   { col: 'materials',   label: 'Materials',   hasMin: true },
      projects:    { col: 'projects',    label: 'Projects',    hasMin: false },
      contractors: { col: 'contractors', label: 'Contractors', hasMin: false },
      requesters:  { col: 'requesters',  label: 'Requesters',  hasMin: false },
      // Special "Database" tab for migration
      migration:   { col: null,          label: 'Database',    isSpecial: true } 
    };

    const currentConfig = computed(() => CONFIG[activeSection.value]);

    // Fetch Data
    const loadData = async () => {
      // Don't load list for Migration tab
      if (currentConfig.value.isSpecial) return; 

      loading.value = true;
      list.value = [];
      try {
        const colRef = collection(db, currentConfig.value.col);
        const snap = await getDocs(colRef);
        list.value = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) {
        console.error(e);
        toast('Error loading data');
      } finally {
        loading.value = false;
      }
    };

    // Filter
    const filteredList = computed(() => {
      if (!searchQuery.value) return list.value;
      const q = searchQuery.value.toLowerCase();
      return list.value.filter(i => i.name.toLowerCase().includes(q));
    });

    // Actions
    const openAdd = () => {
      editMode.value = false;
      form.id = ''; form.name = ''; form.min = 5;
      isModalOpen.value = true;
    };

    const openEdit = (item) => {
      editMode.value = true;
      form.id = item.id;
      form.name = item.name;
      form.min = item.min || 0;
      isModalOpen.value = true;
    };

    const save = async () => {
      if (!form.name) return toast('Name is required');
      loading.value = true;
      try {
        const colName = currentConfig.value.col;
        if (editMode.value) {
          const ref = doc(db, colName, form.id);
          const data = { name: form.name };
          if (currentConfig.value.hasMin) data.min = Number(form.min);
          await updateDoc(ref, data);
          toast('Updated');
        } else {
          const safeId = form.name.replace(/\//g, '_');
          const ref = doc(db, colName, safeId);
          const data = { name: form.name };
          if (currentConfig.value.hasMin) {
            data.min = Number(form.min);
            data.stock = 0;
          }
          await setDoc(ref, data);
          toast('Added');
        }
        isModalOpen.value = false;
        await loadData();
        await preloadLookups(true); 
      } catch (e) {
        console.error(e);
        toast('Failed to save');
      } finally {
        loading.value = false;
      }
    };

    const remove = async (id) => {
      if (!confirm('Are you sure? This cannot be undone.')) return;
      loading.value = true;
      try {
        await deleteDoc(doc(db, currentConfig.value.col, id));
        toast('Deleted');
        await loadData();
        await preloadLookups(true);
      } catch (e) {
        toast('Failed to delete');
      } finally {
        loading.value = false;
      }
    };

    const switchTab = (tab) => {
      activeSection.value = tab;
      searchQuery.value = '';
      loadData();
    };

    onMounted(loadData);

    return { 
      activeSection, list, filteredList, loading, searchQuery, 
      isModalOpen, editMode, form, currentConfig, CONFIG,
      switchTab, openAdd, openEdit, save, remove 
    };
  },
  template: `
    <div class="space-y-6 pb-24">
      
      <div class="flex justify-between items-center px-1">
        <h3 class="font-bold text-lg text-slate-800">⚙️ Settings</h3>
      </div>

      <div class="glass p-1 rounded-xl flex overflow-x-auto no-scrollbar gap-1">
        <button v-for="(cfg, key) in CONFIG" 
          :key="key"
          @click="switchTab(key)"
          :class="activeSection === key ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-white/50'"
          class="flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap"
        >
          {{ cfg.label }}
        </button>
      </div>

      <div v-if="activeSection === 'migration'" class="animate-fade-in-up">
        <Migrate />
      </div>

      <div v-else class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden min-h-[50vh] flex flex-col animate-fade-in-up">
        
        <div class="p-3 border-b border-slate-100 flex gap-2">
          <input v-model="searchQuery" placeholder="Search..." class="flex-1 bg-slate-50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          <button @click="openAdd" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors shadow-sm">
            + New
          </button>
        </div>

        <div class="flex-1 overflow-y-auto max-h-[60vh]">
          <div v-if="loading" class="p-8 text-center text-slate-400">Loading...</div>
          <div v-else-if="filteredList.length === 0" class="p-8 text-center text-slate-400">No items found</div>
          
          <div v-else class="divide-y divide-slate-50">
            <div v-for="item in filteredList" :key="item.id" class="p-3 flex justify-between items-center hover:bg-slate-50 transition-colors group">
              <div>
                <div class="font-bold text-slate-700 text-sm">{{ item.name }}</div>
                <div v-if="activeSection === 'materials'" class="text-xs text-slate-400">
                  Min: <span class="font-mono text-slate-600">{{ item.min }}</span> • Stock: <span class="font-mono text-slate-600">{{ item.stock }}</span>
                </div>
              </div>
              <div class="flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                <button @click="openEdit(item)" class="text-blue-500 bg-blue-50 px-3 py-1.5 rounded-lg text-xs font-bold">Edit</button>
                <button @click="remove(item.id)" class="text-red-500 bg-red-50 px-3 py-1.5 rounded-lg text-xs font-bold">Delete</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <teleport to="body">
        <div v-if="isModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" @click="isModalOpen = false"></div>
          <div class="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-5 animate-fade-in-up">
            <h3 class="font-bold text-lg mb-4">{{ editMode ? 'Edit' : 'Add' }} {{ currentConfig.label }}</h3>
            <div class="space-y-3">
              <div>
                <label class="block text-xs font-bold text-slate-500 mb-1">Name</label>
                <input v-model="form.name" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" :disabled="editMode && activeSection === 'materials'" />
                <p v-if="editMode && activeSection === 'materials'" class="text-[10px] text-orange-500 mt-1">Material names cannot be changed.</p>
              </div>
              <div v-if="activeSection === 'materials'">
                <label class="block text-xs font-bold text-slate-500 mb-1">Min Stock Alert</label>
                <input type="number" v-model="form.min" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div class="flex gap-2 mt-6">
              <button @click="isModalOpen = false" class="flex-1 bg-slate-100 text-slate-600 font-bold py-2.5 rounded-xl hover:bg-slate-200">Cancel</button>
              <button @click="save" :disabled="loading" class="flex-1 bg-blue-500 text-white font-bold py-2.5 rounded-xl shadow-lg shadow-blue-500/30 hover:bg-blue-600">{{ loading ? 'Saving...' : 'Save' }}</button>
            </div>
          </div>
        </div>
      </teleport>

    </div>
  `
};
