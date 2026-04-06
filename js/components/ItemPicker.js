import { ref, computed, nextTick } from 'vue';
import { LOOKUPS, toast } from '../shared.js';
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
        await setDoc(doc(db, 'materials', safeId), { name, stock: 0, min: 5 });

        // Optimistically update LOOKUPS so the new item appears immediately
        const newItem = { name, stock: 0, min: 5 };
        const idx = LOOKUPS.MATERIALS.findIndex(m => m.name === name);
        if (idx === -1) {
          LOOKUPS.MATERIALS.push(newItem);
          LOOKUPS.MATERIALS.sort((a, b) => a.name.localeCompare(b.name));
        }

        select(name);
        toast(`Added "${name}"`);
      } catch (e) {
        console.error(e);
        toast('Failed to add material');
      } finally {
        saving.value = false;
      }
    };

    return { isOpen, search, filtered, showAddButton, saving, open, select, clear, addNew, searchInput };
  },
  template: `
    <div class="relative">
      <input
        type="text"
        :value="modelValue"
        readonly
        @click="open"
        :placeholder="placeholder || 'Select...'"
        class="w-full bg-white border border-slate-200 text-slate-800 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer truncate"
        :class="modelValue ? 'pr-8' : ''"
      />
      <button
        v-if="modelValue"
        @click.stop="clear"
        class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 font-bold text-base leading-none transition-colors"
        title="Clear"
      >×</button>

      <teleport to="body">
        <div v-if="isOpen" class="fixed inset-0 z-[100] flex items-start justify-center pt-20 px-4">

          <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" @click="isOpen = false"></div>

          <div class="relative w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col max-h-[55vh] animate-fade-in-up overflow-hidden ring-1 ring-black/5">

            <div class="p-3 border-b border-slate-100 flex gap-2 bg-white z-10 shrink-0">
              <input
                v-model="search"
                ref="searchInput"
                placeholder="Type to search..."
                class="flex-1 bg-slate-100 border-none rounded-xl px-4 py-3 text-base font-bold focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <button @click="isOpen = false" class="px-4 py-2 text-slate-500 font-bold hover:bg-slate-50 rounded-xl text-sm transition-colors">
                Cancel
              </button>
            </div>

            <div class="flex-1 overflow-y-auto p-2 space-y-1 overscroll-contain">
              <div v-if="filtered.length === 0 && !showAddButton" class="p-8 text-center text-slate-400 text-sm italic">
                No matches found for "{{ search }}"
              </div>

              <button
                v-for="(item, idx) in filtered"
                :key="idx"
                @click="select(item)"
                class="w-full text-left px-4 py-3 rounded-xl hover:bg-blue-50 active:bg-blue-100 text-slate-700 text-sm font-bold transition-colors border border-transparent hover:border-blue-100 truncate flex justify-between items-center"
              >
                <template v-if="typeof item === 'object'">
                  <span>{{ item.name }}</span>
                  <span
                    class="text-[10px] font-mono px-2 py-0.5 rounded ml-2 shrink-0"
                    :class="item.stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'"
                  >{{ item.stock }}</span>
                </template>
                <span v-else>{{ item }}</span>
              </button>

              <!-- Add new SKU button -->
              <button
                v-if="showAddButton"
                @click="addNew"
                :disabled="saving"
                class="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-blue-300 bg-blue-50/60 hover:bg-blue-100 text-blue-600 font-bold text-sm transition-colors disabled:opacity-60"
              >
                <span class="text-lg leading-none shrink-0">{{ saving ? '…' : '+' }}</span>
                <span class="truncate text-left">
                  {{ saving ? 'Adding…' : 'Add new SKU: "' + search.trim() + '"' }}
                </span>
                <span class="ml-auto text-[10px] font-normal text-blue-400 shrink-0">stock 0 · min 5</span>
              </button>
            </div>

          </div>
        </div>
      </teleport>
    </div>
  `
};
