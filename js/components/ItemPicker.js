import { ref, computed, nextTick } from 'vue';
import { LOOKUPS } from '../shared.js';

export default {
  props: ['modelValue', 'source', 'placeholder'],
  emits: ['update:modelValue', 'change'],
  setup(props, { emit }) {
    const isOpen = ref(false);
    const search = ref('');
    const searchInput = ref(null);
    
    const listKey = computed(() => (props.source || '').toUpperCase());
    
    // 1. IMPROVED SEARCH LOGIC (Token-based)
    const filtered = computed(() => {
      const all = LOOKUPS[listKey.value] || [];
      const q = search.value.toLowerCase().trim();
      
      if (!q) return all.slice(0, 50);

      // Split "pvc pipe" into ["pvc", "pipe"]
      const tokens = q.split(/\s+/);

      return all.filter(item => {
        const s = String(item).toLowerCase();
        // Check if item contains ALL tokens (in any order)
        return tokens.every(t => s.includes(t));
      }).slice(0, 50);
    });

    const open = async () => {
      search.value = '';
      isOpen.value = true;
      
      // 2. FORCE KEYBOARD OPEN
      await nextTick();
      if (searchInput.value) {
        searchInput.value.focus();
      }
    };

    const select = (val) => {
      emit('update:modelValue', val);
      emit('change', val);
      isOpen.value = false;
    };

    return { isOpen, search, filtered, open, select, searchInput };
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
      />

      <teleport to="body">
        <div v-if="isOpen" class="fixed inset-0 z-[100] flex items-start justify-center pt-20 px-4">
          
          <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" @click="isOpen = false"></div>
          
          <div class="relative w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col max-h-[50vh] animate-fade-in-up overflow-hidden ring-1 ring-black/5">
            
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
              <div v-if="filtered.length === 0" class="p-8 text-center text-slate-400 text-sm italic">
                No matches found for "{{ search }}"
              </div>
              
              <button 
                v-for="item in filtered" 
                :key="item" 
                @click="select(item)" 
                class="w-full text-left px-4 py-3 rounded-xl hover:bg-blue-50 active:bg-blue-100 text-slate-700 text-sm font-bold transition-colors border border-transparent hover:border-blue-100 truncate"
              >
                {{ item }}
              </button>
            </div>

          </div>
        </div>
      </teleport>
    </div>
  `
};
