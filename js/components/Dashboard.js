import { ref, onMounted, computed } from 'vue';
import { apiGet, STR } from '../shared.js';

export default {
  props: ['lang'],
  setup(props) {
    const lowStock = ref([]);
    const topItems = ref([]);
    const loading = ref(true);
    const S = computed(() => STR[props.lang]);

    onMounted(async () => {
      try {
        // Parallel fetch for speed
        const [lowRes, topRes] = await Promise.all([
          apiGet('dash_LowStock', {}, { cacheTtlMs: 60_000 }),
          apiGet('dash_TopItems', {}, { cacheTtlMs: 60_000 })
        ]);
        lowStock.value = Array.isArray(lowRes) ? lowRes : [];
        topItems.value = Array.isArray(topRes) ? topRes : [];
      } catch (e) {
        console.error(e);
      } finally {
        loading.value = false;
      }
    });

    return { lowStock, topItems, loading, S };
  },
  template: `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      
      <section class="glass rounded-2xl p-5 shadow-sm">
        <h3 class="font-bold text-lg mb-4 text-slate-800 flex items-center gap-2">
          <span class="text-red-500">🔴</span> {{ S.dashLow }}
        </h3>

        <div v-if="loading" class="space-y-3 animate-pulse">
          <div v-for="i in 3" class="h-10 bg-slate-200/50 rounded-lg"></div>
        </div>

        <div v-else class="space-y-2">
          <div v-if="lowStock.length === 0" class="text-center py-6 text-slate-400 text-sm">
            {{ S.noLow }}
          </div>
          <div v-for="item in lowStock" :key="item.name" 
               class="flex justify-between items-center bg-white/80 p-3 rounded-xl border border-slate-100 shadow-sm">
            <div class="truncate pr-2">
              <div class="font-bold text-slate-700 text-sm truncate">{{ item.name }}</div>
              <div class="text-xs text-slate-400">Min: {{ item.min }}</div>
            </div>
            <span class="px-2.5 py-1 bg-red-100 text-red-600 font-extrabold rounded-lg text-sm shrink-0">
              {{ item.stock }}
            </span>
          </div>
        </div>
      </section>

      <section class="glass rounded-2xl p-5 shadow-sm">
        <h3 class="font-bold text-lg mb-4 text-slate-800 flex items-center gap-2">
          <span class="text-yellow-500">🏆</span> {{ S.dashTopItems }}
        </h3>

        <div v-if="loading" class="space-y-3 animate-pulse">
          <div v-for="i in 3" class="h-10 bg-slate-200/50 rounded-lg"></div>
        </div>

        <div v-else class="space-y-2">
          <div v-for="item in topItems" :key="item.name" 
               class="flex justify-between items-center bg-white/80 p-3 rounded-xl border border-slate-100 shadow-sm">
            <div class="font-bold text-slate-700 text-sm truncate">{{ item.name }}</div>
            <div class="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
              {{ item.qty }}
            </div>
          </div>
        </div>
      </section>
    </div>
  `
};
