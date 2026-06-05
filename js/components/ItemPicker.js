import { ref, computed, nextTick } from 'vue';
import { LOOKUPS, toast, materialStockBadgeClass } from '../shared.js';
import { db } from '../firebase.js';
import { doc, setDoc } from 'firebase/firestore';

export default {
  props: ['modelValue', 'source', 'placeholder', 'items', 'allowAdd'],
  emits: ['update:modelValue', 'change'],
  setup(props, { emit }) {
    const isOpen = ref(false);
    const search = ref('');
    const searchInput = ref(null);
    const saving = ref(false);

    const listKey = computed(() => (props.source || '').toUpperCase());

    const filtered = computed(() => {
      const all = Array.isArray(props.items) ? props.items : (LOOKUPS[listKey.value] || []);
      const q = search.value.toLowerCase().trim();
      if (!q) return all.slice(0, 50);
      const tokens = q.split(/\s+/);
      return all.filter(item => {
        const name = typeof item === 'object' ? item.name : String(item);
        return tokens.every(t => name.toLowerCase().includes(t));
      }).slice(0, 50);
    });

    // True when search text exactly matches an existing entry (case-insensitive)
    const hasExactMatch = computed(() => {
      const q = search.value.trim().toLowerCase();
      if (!q) return true;
      const all = Array.isArray(props.items) ? props.items : (LOOKUPS[listKey.value] || []);
      return all.some(item => {
        const name = typeof item === 'object' ? item.name : String(item);
        return name.toLowerCase() === q;
      });
    });

    // Show the "Add" button when allowAdd, search has text, and no exact match exists
    const showAddButton = computed(() =>
      props.allowAdd && search.value.trim().length > 0 && !hasExactMatch.value
    );

    const open = async () => {
      search.value = '';
      isOpen.value = true;

      await nextTick();
      if (searchInput.value) searchInput.value.focus();
    };

    const select = (val) => {
      const v = typeof val === 'object' ? val.name : val;
      emit('update:modelValue', v);
      emit('change', v);
      isOpen.value = false;
    };

    const clear = () => {
      emit('update:modelValue', '');
      emit('change', '');
    };

    const addNew = async () => {
      const name = search.value.trim();
      if (!name || saving.value) return;
      saving.value = true;
      try {
        const safeId = name.replace(/\//g, '_');
        await setDoc(doc(db, 'materials', safeId), { name, stock: 0, min: 5 }, { merge: true });


        select(name);
        toast(`Added "${name}"`);
      } catch (e) {
        console.error(e);
        toast('Failed to add material');
      } finally {
        saving.value = false;
      }
    };

    return { isOpen, search, filtered, showAddButton, saving, open, select, clear, addNew, searchInput, materialStockBadgeClass };
  },
  template: `
    <div class="relative w-full h-full flex items-center gap-2">
      <input
        type="text"
        :value="modelValue"
        readonly
        @click="open"
        :placeholder="placeholder || 'Select...'"
        class="flex-1 bg-transparent border-none outline-none text-[#1D1B20] text-[16px] cursor-pointer truncate"
        style="padding: 0; margin: 0; box-shadow: none;"
      />
      <button
        v-if="modelValue"
        @click.stop="clear"
        aria-label="Clear selection"
        class="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-[#E7E0EC] text-[#49454F] transition-colors md3-ripple"
      >×</button>

      <teleport to="body">
        <div v-if="isOpen" class="fixed inset-0 z-[100] flex items-end sm:items-start justify-center sm:pt-20 px-0 sm:px-4">

          <div class="absolute inset-0 bg-[#1D1B20]/40 backdrop-blur-sm" @click="isOpen = false"></div>

          <div class="relative w-full sm:max-w-md bg-[#FEF7FF] rounded-t-[28px] sm:rounded-[28px] shadow-md3-elevation-3 flex flex-col max-h-[70vh] sm:max-h-[55vh] animate-fade-in-up overflow-hidden">

            <!-- Search Header -->
            <div class="p-3 border-b border-[#CAC4D0] flex gap-2 bg-[#F3EDF7] z-10 shrink-0">
              <input
                v-model="search"
                ref="searchInput"
                placeholder="Type to search..."
                class="flex-1 bg-[#FFFFFF] border-none rounded-[16px] px-4 py-3 text-[16px] font-medium focus:ring-2 focus:ring-[#6750A4] outline-none transition-colors"
              />
              <button @click="isOpen = false" class="px-4 py-2 text-[#49454F] font-medium hover:bg-[#E8DEF8] rounded-full text-sm transition-colors md3-ripple">
                Cancel
              </button>
            </div>

            <!-- Results List -->
            <div class="flex-1 overflow-y-auto p-2 space-y-0.5 overscroll-contain bg-[#FEF7FF]">
              <div v-if="filtered.length === 0 && !showAddButton" class="p-8 text-center text-[#49454F] text-sm">
                No matches found for "{{ search }}"
              </div>

              <button
                v-for="(item, idx) in filtered"
                :key="idx"
                @click="select(item)"
                class="w-full text-left px-4 py-3 rounded-[12px] hover:bg-[#EADDFF] focus:bg-[#EADDFF] text-[#1D1B20] text-sm font-medium transition-colors truncate flex justify-between items-center md3-ripple"
              >
                <template v-if="typeof item === 'object'">
                  <span>{{ item.name }}</span>
                  <span
                    class="text-[10px] font-bold px-2 py-0.5 rounded-full ml-2 shrink-0"
                    :class="materialStockBadgeClass(item.stock, item.min)"
                  >{{ item.stock }}</span>
                </template>
                <span v-else>{{ item }}</span>
              </button>

              <!-- Add new SKU button -->
              <button
                v-if="showAddButton"
                @click="addNew"
                :disabled="saving"
                class="w-full flex items-center gap-3 px-4 py-3 mt-2 rounded-[12px] border border-[#79747E] bg-[#F7F2FA] hover:bg-[#EADDFF] text-[#6750A4] font-medium text-sm transition-colors disabled:opacity-60 md3-ripple"
              >
                <span class="text-lg leading-none shrink-0">{{ saving ? '…' : '+' }}</span>
                <span class="truncate text-left">
                  {{ saving ? 'Adding…' : 'Add new: "' + search.trim() + '"' }}
                </span>
              </button>
            </div>

          </div>
        </div>
      </teleport>
    </div>
  `
};
