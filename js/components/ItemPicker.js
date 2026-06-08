import { ref, computed, nextTick, onUnmounted } from 'vue';
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

    const hasExactMatch = computed(() => {
      const q = search.value.trim().toLowerCase();
      if (!q) return true;
      const all = Array.isArray(props.items) ? props.items : (LOOKUPS[listKey.value] || []);
      return all.some(item => {
        const name = typeof item === 'object' ? item.name : String(item);
        return name.toLowerCase() === q;
      });
    });

    const showAddButton = computed(() =>
      props.allowAdd && search.value.trim().length > 0 && !hasExactMatch.value
    );

    const open = async () => {
      search.value = '';
      isOpen.value = true;
      await nextTick();
      setTimeout(() => {
        if (searchInput.value) {
          searchInput.value.focus();
          const len = searchInput.value.value.length;
          searchInput.value.setSelectionRange(len, len);
        }
        // Start pinning AFTER focus so the keyboard resize has fired
        startVpListener();
      }, 150);
    };

    const select = (val) => {
      const v = typeof val === 'object' ? val.name : val;
      emit('update:modelValue', v);
      emit('change', v);
      isOpen.value = false;
      stopVpListener();
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
      } finally { saving.value = false; }
    };

    // ── visualViewport pinning ──────────────────────────────────────
    // On mobile the soft keyboard resizes the visual viewport but NOT
    // window.innerHeight / 100dvh on many browsers. We listen to
    // visualViewport and pin the sheet to the bottom of the visible area.
    const sheetStyle = ref({});

    const updateSheetPosition = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      // For position:fixed elements, coordinates are relative to the VIEWPORT,
      // not the document — so we must NOT include vv.pageTop (scroll offset).
      // The only thing that matters is how much the keyboard is eating into the
      // bottom of the viewport:
      //   keyboard height = full window height − visible-area height − browser-chrome offset
      const keyboardHeight = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      sheetStyle.value = {
        position: 'fixed',
        left: '0',
        right: '0',
        bottom: `${keyboardHeight}px`,
      };
    };

    let vpCleanup = null;
    const startVpListener = () => {
      if (!window.visualViewport) return;
      // Only listen to 'resize' — keyboard open/close fires this.
      // Do NOT listen to 'scroll': page scroll is irrelevant for fixed elements
      // and was causing the sheet to drift off-screen when scrolling.
      window.visualViewport.addEventListener('resize', updateSheetPosition);
      updateSheetPosition();
      vpCleanup = () => {
        window.visualViewport.removeEventListener('resize', updateSheetPosition);
      };
    };
    const stopVpListener = () => { if (vpCleanup) { vpCleanup(); vpCleanup = null; } };

    onUnmounted(stopVpListener);
    // ────────────────────────────────────────────────────────────────

    return { isOpen, search, filtered, showAddButton, saving,
             sheetStyle, open, select, clear, addNew, searchInput,
             materialStockBadgeClass, startVpListener, stopVpListener };
  },
  template: `
    <div class="relative w-full h-full flex items-center gap-2">
      <!-- Trigger input -->
      <input
        type="text"
        :value="modelValue"
        readonly
        @click="open"
        :placeholder="placeholder || 'Select…'"
        class="flex-1 bg-transparent border-none outline-none text-[#1D1B20] text-[16px] cursor-pointer truncate"
        style="padding: 0; margin: 0; box-shadow: none;"
      />
      <!-- Clear button -->
      <button
        v-if="modelValue"
        @click.stop="clear"
        aria-label="Clear selection"
        class="md3-icon-btn w-7 h-7 shrink-0 text-[#49454F] md3-ripple">
        <span class="material-symbols-outlined" style="font-size:18px">close</span>
      </button>

      <teleport to="body">
        <div v-if="isOpen"
          class="picker-overlay fixed inset-0 z-[100]"
          @click.self="isOpen = false; stopVpListener()">

          <!-- Scrim -->
          <div class="md3-scrim animate-fade-in absolute inset-0" @click="isOpen = false; stopVpListener()"></div>

          <!--
            Sheet is pinned to the BOTTOM of the visual viewport via
            sheetStyle (set by the visualViewport JS listener).
            max-height is capped so it never taller than ~60% of the
            visible area. The list has a min-height so it stays visible
            even when only 1-2 results are shown.
          -->
          <div class="picker-sheet relative w-full sm:max-w-md sm:left-1/2 sm:-translate-x-1/2 md3-bottom-sheet sm:rounded-[28px] flex flex-col overflow-hidden"
            :style="sheetStyle">

            <!-- Search header -->
            <div class="flex items-center gap-3 px-4 py-3 bg-[#F3EDF7] border-b border-[#CAC4D0] shrink-0">
              <!-- Handle pill -->
              <div class="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-[#CAC4D0] rounded-full sm:hidden"></div>

              <span class="material-symbols-outlined text-[#6750A4] shrink-0">search</span>
              <input
                v-model="search"
                ref="searchInput"
                placeholder="Type to search…"
                autocomplete="off"
                autocorrect="off"
                autocapitalize="off"
                spellcheck="false"
                class="flex-1 bg-transparent border-none outline-none text-[16px] font-medium text-[#1D1B20] placeholder:text-[#79747E]"
              />
              <button @click="isOpen = false; stopVpListener()"
                class="md3-btn-text md3-ripple h-9 px-3 text-[14px] shrink-0">
                Cancel
              </button>
            </div>

            <!-- Results list -->
            <div class="picker-list overflow-y-auto overscroll-contain bg-[#F7F2FA]">

              <div v-if="filtered.length === 0 && !showAddButton"
                class="p-10 text-center text-[#49454F] text-[14px] flex flex-col items-center gap-2">
                <span class="material-symbols-outlined text-[#CAC4D0]" style="font-size:36px">search_off</span>
                No matches for "{{ search }}"
              </div>

              <!-- Item rows -->
              <button
                v-for="(item, idx) in filtered"
                :key="idx"
                @click="select(item)"
                class="w-full text-left px-4 py-4 flex justify-between items-center gap-3 hover:bg-[#EADDFF] focus:bg-[#EADDFF] transition-colors md3-ripple border-b border-[#ECE6F0] last:border-b-0"
              >
                <template v-if="typeof item === 'object'">
                  <span class="text-[14px] font-medium text-[#1D1B20] flex-1 truncate">{{ item.name }}</span>
                  <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full shrink-0"
                    :class="materialStockBadgeClass(item.stock, item.min)">
                    {{ item.stock }}
                  </span>
                </template>
                <span v-else class="text-[14px] font-medium text-[#1D1B20] flex-1 truncate">{{ item }}</span>
              </button>

              <!-- Add new material -->
              <button
                v-if="showAddButton"
                @click="addNew"
                :disabled="saving"
                class="w-full flex items-center gap-3 px-4 py-4 bg-[#ECE6F0] hover:bg-[#EADDFF] transition-colors text-[#6750A4] font-medium text-[14px] md3-ripple disabled:opacity-60 border-t border-[#CAC4D0]">
                <span class="material-symbols-outlined icon-sm">add_circle</span>
                <span class="truncate">{{ saving ? 'Adding…' : 'Add new: "' + search.trim() + '"' }}</span>
              </button>
            </div>

          </div>
        </div>
      </teleport>
    </div>
  `
};
