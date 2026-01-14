import { ref, computed } from 'vue';
import { LOOKUPS } from '../shared.js';

export default {
  props: ['modelValue', 'source', 'placeholder'],
  emits: ['update:modelValue', 'change'],
  setup(props, { emit }) {
    const isOpen = ref(false);
    const search = ref('');
    const searchInput = ref(null);
    
    const listKey = computed(() => (props.source || '').toUpperCase());
    
    const filtered = computed(() => {
      const all = LOOKUPS[listKey.value] || [];
      const q = search.value.toLowerCase();
      if (!q) return all.slice(0, 50);
      return all.filter(x => String(x).toLowerCase().includes(q)).slice(0, 50);
    });

    const open = () => {
      search.value = '';
      isOpen.value = true;
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
      <input type="text" :value="modelValue" readonly @click="open" :placeholder="placeholder || 'Select...'" class="w-full bg-white border border-slate-200 text-slate-800 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer" />

      <teleport to="body">
        <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" @click="isOpen = false"></div>
          
          <div class="relative w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col max-h-[70vh] animate-fade-in-up">
            <div class="p-3 border-b border-slate-100 flex gap-2">
              <input v-model="search" ref="searchInput" placeholder="Search..." class="flex-1 bg-slate-50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" autofocus />
              <button @click="isOpen = false" class="px-4 py-2 text-slate-500 font-bold hover:bg-slate-50 rounded-xl text-sm">Close</button>
            </div>

            <div class="flex-1 overflow-y-auto p-2 space-y-1">
              <div v-if="filtered.length === 0" class="p-4 text-center text-slate-400 text-sm">No results</div>
              <button v-for="item in filtered" :key="item" @click="select(item)" class="w-full text-left px-4 py-3 rounded-xl hover:bg-blue-50 text-slate-700 text-sm font-medium transition-colors border border-transparent hover:border-blue-100">{{ item }}</button>
            </div>
          </div>
        </div>
      </teleport>
    </div>
  `
};
