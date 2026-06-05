import { ref, reactive, onMounted, computed, onUnmounted } from 'vue';
import { db } from '../firebase.js';
import { collection, doc, setDoc, deleteDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { toast } from '../shared.js';

export default {
  setup() {
    const activeSection = ref('materials');
    const loading = ref(false);
    const list = ref([]);
    const searchQuery = ref('');

    const isModalOpen = ref(false);
    const editMode = ref(false);
    const form = reactive({ id: '', name: '', min: 0, subProjectsText: '' });

    const CONFIG = {
      materials:   { col: 'materials',   label: 'Materials',   hasMin: true },
      projects:    { col: 'projects',    label: 'Projects',    hasMin: false },
      contractors: { col: 'contractors', label: 'Contractors', hasMin: false },
      requesters:  { col: 'requesters',  label: 'Requesters',  hasMin: false }
    };

    const currentConfig = computed(() => CONFIG[activeSection.value]);

    let unsub = null;

    const loadData = () => {
      if (unsub) unsub();
      if (currentConfig.value.isSpecial) return;

      loading.value = true;
      list.value = [];
      try {
        unsub = onSnapshot(collection(db, currentConfig.value.col), (snap) => {
          list.value = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          loading.value = false;
        });
      } catch (e) {
        console.error(e);
        toast('Error loading data');
        loading.value = false;
      }
    };

    onUnmounted(() => {
      if (unsub) unsub();
    });

    const filteredList = computed(() => {
      if (!searchQuery.value) return list.value;
      const q = searchQuery.value.toLowerCase();
      return list.value.filter(i => String(i.name || '').toLowerCase().includes(q));
    });

    const openAdd = () => {
      editMode.value = false;
      form.id = '';
      form.name = '';
      form.min = 5;
      form.subProjectsText = '';
      isModalOpen.value = true;
    };

    const openEdit = (item) => {
      editMode.value = true;
      form.id = item.id;
      form.name = item.name;
      form.min = Number(item.min || 0);
      form.subProjectsText = Array.isArray(item.subProjects) ? item.subProjects.join('\n') : '';
      isModalOpen.value = true;
    };

    const parseSubProjects = () =>
      form.subProjectsText
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);

    const save = async () => {
      if (!form.name) return toast('Name is required');
      loading.value = true;
      try {
        const colName = currentConfig.value.col;
        if (editMode.value) {
          const ref = doc(db, colName, form.id);
          const data = { name: form.name };
          if (currentConfig.value.hasMin) data.min = Number(form.min);
          if (activeSection.value === 'projects') data.subProjects = parseSubProjects();
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
          if (activeSection.value === 'projects') data.subProjects = parseSubProjects();
          await setDoc(ref, data);
          toast('Added');
        }

        isModalOpen.value = false;

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

      } catch (e) {
        console.error(e);
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
    <div class="space-y-6 pb-24 pt-2">
      <div class="flex justify-between items-center px-1">
        <h3 class="text-xl font-medium text-[#1D1B20]">Settings</h3>
      </div>

      <div class="bg-[#F3EDF7] rounded-full p-1 flex gap-0.5 border border-[#CAC4D0] overflow-x-auto">
        <button
          v-for="(cfg, key) in CONFIG"
          :key="key"
          @click="switchTab(key)"
          :class="activeSection === key ? 'bg-[#EADDFF] text-[#21005D]' : 'text-[#49454F] hover:bg-[#E8DEF8]'"
          class="flex-1 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap rounded-full md3-ripple"
        >
          {{ cfg.label }}
        </button>
      </div>

      <div class="bg-[#FEF7FF] rounded-[24px] shadow-sm border border-[#CAC4D0] overflow-hidden min-h-[50vh] flex flex-col animate-fade-in-up">
        <div class="p-4 border-b border-[#CAC4D0] flex gap-3 bg-[#F3EDF7]">
          <div class="md3-input-container flex-1">
            <input v-model="searchQuery" placeholder=" " class="md3-input bg-white" />
            <label class="md3-label">Search...</label>
          </div>
          <button @click="openAdd" class="bg-[#6750A4] hover:bg-[#6750A4]/90 text-white rounded-full px-5 h-[56px] font-medium text-sm transition-colors shadow-md3-elevation-1 flex items-center md3-ripple">+ New</button>
        </div>

        <div class="flex-1 overflow-y-auto max-h-[60vh]">
          <div v-if="loading" class="p-8 text-center text-[#49454F] text-sm">Loading...</div>
          <div v-else-if="filteredList.length === 0" class="p-8 text-center text-[#49454F] text-sm">No items found</div>

          <div v-else class="divide-y divide-[#CAC4D0]">
            <div v-for="item in filteredList" :key="item.id" class="p-4 flex justify-between items-center hover:bg-[#F3EDF7] transition-colors group">
              <div class="min-w-0 flex-1">
                <div class="text-sm font-medium text-[#1D1B20]">{{ item.name }}</div>
                <div v-if="activeSection === 'materials'" class="text-xs text-[#49454F] mt-0.5">
                  Min: <span class="font-mono text-[#1D1B20]">{{ item.min }}</span> · Stock: <span class="font-mono text-[#1D1B20]">{{ item.stock }}</span>
                </div>
                <div v-if="activeSection === 'projects'" class="text-xs text-[#49454F] mt-0.5">
                  Sub Projects: <span class="font-mono text-[#1D1B20]">{{ (item.subProjects || []).length }}</span>
                </div>
              </div>
              <div class="flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                <button @click="openEdit(item)" class="text-[#21005D] bg-[#EADDFF] rounded-full px-4 py-2 text-xs font-medium hover:bg-[#E8DEF8] transition-colors md3-ripple">Edit</button>
                <button @click="remove(item.id)" class="text-[#B3261E] bg-[#F9DEDC] rounded-full px-4 py-2 text-xs font-medium hover:bg-[#F2B8B5] transition-colors md3-ripple">Delete</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <teleport to="body">
        <div v-if="isModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-[#1D1B20]/40 backdrop-blur-sm" @click="isModalOpen = false"></div>
          <div class="relative w-full max-w-sm bg-[#FEF7FF] rounded-[28px] shadow-md3-elevation-3 p-6 animate-fade-in-up">
            <h3 class="text-2xl font-normal text-[#1D1B20] mb-6">{{ editMode ? 'Edit' : 'Add' }} {{ currentConfig.label }}</h3>
            <div class="space-y-4">
              <div>
                <div class="md3-input-container">
                  <input v-model="form.name" placeholder=" " class="md3-input" :disabled="editMode && activeSection === 'materials'" />
                  <label class="md3-label">Name</label>
                </div>
                <p v-if="editMode && activeSection === 'materials'" class="text-[10px] text-[#B3261E] mt-1.5 ml-4">Material names cannot be changed.</p>
              </div>

              <div v-if="activeSection === 'materials'">
                <div class="md3-input-container">
                  <input type="number" v-model="form.min" placeholder=" " class="md3-input" />
                  <label class="md3-label">Min Stock Alert</label>
                </div>
              </div>

              <div v-if="activeSection === 'projects'">
                <div class="md3-input-container h-auto">
                  <textarea v-model="form.subProjectsText" rows="5" placeholder=" " class="md3-input py-3 resize-y"></textarea>
                  <label class="md3-label">Sub Projects (1 per line)</label>
                </div>
              </div>
            </div>

            <div class="flex justify-end gap-2 mt-8">
              <button @click="isModalOpen = false" class="text-[#6750A4] font-medium px-4 py-2.5 rounded-full hover:bg-[#6750A4]/10 transition-colors md3-ripple">Cancel</button>
              <button @click="save" :disabled="loading" class="bg-[#6750A4] text-white font-medium px-6 py-2.5 rounded-full shadow-sm hover:bg-[#6750A4]/90 active:scale-[0.98] transition-all disabled:opacity-50 md3-ripple">{{ loading ? 'Saving...' : 'Save' }}</button>
            </div>
          </div>
        </div>
      </teleport>
    </div>
  `
};
