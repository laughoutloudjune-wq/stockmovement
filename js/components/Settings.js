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
      materials:   { col: 'materials',   label: 'Materials',   icon: 'inventory_2', hasMin: true },
      projects:    { col: 'projects',    label: 'Projects',    icon: 'business',    hasMin: false },
      contractors: { col: 'contractors', label: 'Contractors', icon: 'engineering', hasMin: false },
      requesters:  { col: 'requesters',  label: 'Requesters',  icon: 'group',       hasMin: false }
    };

    const currentConfig = computed(() => CONFIG[activeSection.value]);

    let unsub = null;
    const loadData = () => {
      if (unsub) unsub();
      loading.value = true;
      list.value = [];
      try {
        unsub = onSnapshot(collection(db, currentConfig.value.col), (snap) => {
          list.value = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          loading.value = false;
        });
      } catch (e) { console.error(e); toast('Error loading data'); loading.value = false; }
    };

    onUnmounted(() => { if (unsub) unsub(); });

    const filteredList = computed(() => {
      if (!searchQuery.value) return list.value;
      const q = searchQuery.value.toLowerCase();
      return list.value.filter(i => String(i.name || '').toLowerCase().includes(q));
    });

    const openAdd = () => {
      editMode.value = false;
      form.id = ''; form.name = ''; form.min = 5; form.subProjectsText = '';
      isModalOpen.value = true;
    };

    const openEdit = (item) => {
      editMode.value = true;
      form.id = item.id; form.name = item.name; form.min = Number(item.min || 0);
      form.subProjectsText = Array.isArray(item.subProjects) ? item.subProjects.join('\n') : '';
      isModalOpen.value = true;
    };

    const parseSubProjects = () =>
      form.subProjectsText.split('\n').map(s => s.trim()).filter(Boolean);

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
          if (currentConfig.value.hasMin) { data.min = Number(form.min); data.stock = 0; }
          if (activeSection.value === 'projects') data.subProjects = parseSubProjects();
          await setDoc(ref, data);
          toast('Added');
        }
        isModalOpen.value = false;
      } catch (e) { console.error(e); toast('Failed to save'); }
      finally { loading.value = false; }
    };

    const remove = async (id) => {
      if (!confirm('Are you sure? This cannot be undone.')) return;
      loading.value = true;
      try { await deleteDoc(doc(db, currentConfig.value.col, id)); toast('Deleted'); }
      catch (e) { console.error(e); toast('Failed to delete'); }
      finally { loading.value = false; }
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
    <div class="space-y-4 pb-24 pt-2">

      <div class="flex justify-between items-center">
        <h2 class="text-[20px] font-normal text-[#1D1B20] flex items-center gap-2">
          <span class="material-symbols-outlined text-[#6750A4]">settings</span>
          Settings
        </h2>
      </div>

      <!-- MD3 Segmented Button -->
      <div class="md3-segmented overflow-x-auto">
        <button
          v-for="(cfg, key) in CONFIG"
          :key="key"
          @click="switchTab(key)"
          :class="activeSection === key ? 'active' : ''"
          class="md3-segmented-btn md3-ripple flex items-center gap-1.5">
          <span class="material-symbols-outlined" :class="activeSection === key ? 'icon-filled-sm' : 'icon-sm'" style="font-size:18px">{{ cfg.icon }}</span>
          {{ cfg.label }}
        </button>
      </div>

      <!-- List card -->
      <div class="bg-[#FEF7FF] rounded-[16px] border border-[#CAC4D0] overflow-hidden">
        <!-- Toolbar -->
        <div class="p-3 flex gap-3 bg-[#F3EDF7] border-b border-[#CAC4D0]">
          <div class="md3-input-container flex-1">
            <input v-model="searchQuery" placeholder=" " class="md3-input" />
            <label class="md3-label flex items-center gap-1">
              <span class="material-symbols-outlined" style="font-size:16px">search</span>
              Search…
            </label>
          </div>
          <button @click="openAdd"
            class="md3-btn-filled md3-ripple flex items-center gap-1 shrink-0">
            <span class="material-symbols-outlined icon-sm">add</span>
            New
          </button>
        </div>

        <!-- List -->
        <div class="overflow-y-auto" style="max-height:60vh">
          <div v-if="loading" class="p-8 text-center text-[#49454F] text-[14px]">
            <div class="w-6 h-6 border-2 border-[#E8DEF8] border-t-[#6750A4] rounded-full animate-spin mx-auto mb-2"></div>
            Loading…
          </div>
          <div v-else-if="filteredList.length === 0"
            class="p-10 text-center text-[#49454F] text-[14px] flex flex-col items-center gap-2">
            <span class="material-symbols-outlined text-[#CAC4D0]" style="font-size:36px">search_off</span>
            No items found
          </div>

          <div v-else class="divide-y divide-[#E6E0E9]">
            <div v-for="item in filteredList" :key="item.id"
              class="md3-list-item group hover:bg-[#F3EDF7] transition-colors px-4">
              <div class="flex-1 min-w-0">
                <div class="text-[14px] font-medium text-[#1D1B20]">{{ item.name }}</div>
                <div v-if="activeSection === 'materials'" class="text-[12px] text-[#49454F] mt-0.5">
                  Min: <span class="font-mono font-medium text-[#1D1B20]">{{ item.min }}</span>
                  · Stock: <span class="font-mono font-medium text-[#1D1B20]">{{ item.stock }}</span>
                </div>
                <div v-if="activeSection === 'projects'" class="text-[12px] text-[#49454F] mt-0.5">
                  Sub Projects: <span class="font-mono font-medium text-[#1D1B20]">{{ (item.subProjects || []).length }}</span>
                </div>
              </div>
              <div class="flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                <button @click="openEdit(item)"
                  class="md3-btn-tonal md3-ripple flex items-center gap-1 h-8 px-3 text-[13px]">
                  <span class="material-symbols-outlined" style="font-size:16px">edit</span>
                  Edit
                </button>
                <button @click="remove(item.id)"
                  class="md3-btn-text-error md3-ripple flex items-center gap-1 h-8 px-3 text-[13px]">
                  <span class="material-symbols-outlined" style="font-size:16px">delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Add/Edit Dialog -->
      <teleport to="body">
        <div v-if="isModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="md3-scrim animate-fade-in" @click="isModalOpen = false"></div>
          <div class="relative w-full max-w-sm md3-dialog-surface animate-scale-in overflow-hidden">
            <!-- Header -->
            <div class="px-6 pt-6 pb-2">
              <h3 class="text-[22px] font-normal text-[#1D1B20]">
                {{ editMode ? 'Edit' : 'Add' }} {{ currentConfig.label }}
              </h3>
            </div>

            <!-- Content -->
            <div class="px-6 py-4 space-y-4">
              <div>
                <div class="md3-input-container">
                  <input v-model="form.name" placeholder=" " class="md3-input"
                    :disabled="editMode && activeSection === 'materials'" />
                  <label class="md3-label">Name</label>
                </div>
                <p v-if="editMode && activeSection === 'materials'"
                  class="text-[11px] text-[#B3261E] mt-1 ml-1">Material names cannot be changed.</p>
              </div>

              <div v-if="activeSection === 'materials'" class="md3-input-container">
                <input type="number" v-model="form.min" placeholder=" " class="md3-input" />
                <label class="md3-label">Min Stock Alert</label>
              </div>

              <div v-if="activeSection === 'projects'" class="md3-input-container">
                <textarea v-model="form.subProjectsText" rows="5" placeholder=" " class="md3-input py-3 resize-y"></textarea>
                <label class="md3-label">Sub Projects (1 per line)</label>
              </div>
            </div>

            <!-- Actions -->
            <div class="px-6 pb-6 flex justify-end gap-2">
              <button @click="isModalOpen = false" class="md3-btn-text md3-ripple">Cancel</button>
              <button @click="save" :disabled="loading"
                class="md3-btn-filled md3-ripple flex items-center gap-1">
                <div v-if="loading" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>{{ loading ? 'Saving…' : 'Save' }}</span>
              </button>
            </div>
          </div>
        </div>
      </teleport>
    </div>
  `
};
