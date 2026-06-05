import { ref, onMounted, onUnmounted, computed } from 'vue';
import { db } from '../firebase.js';
import { STR, LOOKUPS } from '../shared.js';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

export default {
  props: ['lang'],
  setup(props) {
    const topItems = ref([]);
    const loading = ref(true);
    const S = computed(() => STR[props.lang]);

    const lowStock = computed(() => {
      return LOOKUPS.MATERIALS
        .filter(x => Number(x.stock || 0) <= Number(x.min || 0))
        .sort((a, b) => Number(a.stock || 0) - Number(b.stock || 0))
        .slice(0, 10)
        .map(x => ({
          name: x.name,
          stock: Number(x.stock || 0),
          min: Number(x.min || 0)
        }));
    });

    let unsubOrders = null;

    onMounted(() => {
      loading.value = true;
      const cutoff = (() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
      })();

      unsubOrders = onSnapshot(query(collection(db, 'orders'), where('type', '==', 'OUT'), where('date', '>=', cutoff)), (outSnap) => {
        const usage = {};
        outSnap.docs
          .forEach(d => {
            const data = d.data();
            (data.items || []).forEach(i => {
              const key = i.name;
              usage[key] = (usage[key] || 0) + Number(i.qty || 0);
            });
          });
        topItems.value = Object.entries(usage)
          .map(([name, qty]) => ({ name, qty }))
          .sort((a, b) => b.qty - a.qty)
          .slice(0, 10);
        loading.value = false;
      }, (e) => {
        console.error(e);
        loading.value = false;
      });
    });

    onUnmounted(() => {
      if (unsubOrders) unsubOrders();
    });

    return { lowStock, topItems, loading, S };
  },
  template: `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pb-28 pt-2">
      <!-- Low Stock Section -->
      <section class="bg-[#FEF7FF] rounded-[24px] p-4 shadow-sm border border-[#CAC4D0]">
        <h3 class="text-base font-medium text-[#1D1B20] mb-4 flex items-center gap-2">
          <span class="text-[#B3261E]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </span>
          {{ S.dashLow }}
        </h3>

        <div v-if="loading" class="space-y-3 animate-pulse">
          <div v-for="i in 3" class="h-12 bg-[#E7E0EC] rounded-[12px]"></div>
        </div>

        <div v-else class="space-y-2">
          <div v-if="lowStock.length === 0" class="text-center py-6 text-sm text-[#49454F]">
            {{ S.noLow || 'No low stock items' }}
          </div>
          <div v-for="item in lowStock" :key="item.name" class="flex justify-between items-center bg-[#F9DEDC] p-3 rounded-[12px] transition-all">
            <div class="truncate pr-2">
              <div class="text-sm font-medium text-[#410E0B] truncate">{{ item.name }}</div>
              <div class="text-[11px] text-[#8C1D18] mt-0.5">Min: {{ item.min }}</div>
            </div>
            <span class="px-3 py-1 bg-[#B3261E] text-white font-bold rounded-full text-xs shrink-0 shadow-sm">
              {{ item.stock }}
            </span>
          </div>
        </div>
      </section>

      <!-- Top Items Section -->
      <section class="bg-[#FEF7FF] rounded-[24px] p-4 shadow-sm border border-[#CAC4D0]">
        <h3 class="text-base font-medium text-[#1D1B20] mb-4 flex items-center gap-2">
          <span class="text-[#6750A4]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
          </span>
          {{ S.dashTopItems }}
          <span class="text-xs font-normal text-[#49454F] ml-1">(30 days)</span>
        </h3>

        <div v-if="loading" class="space-y-3 animate-pulse">
          <div v-for="i in 3" class="h-12 bg-[#E7E0EC] rounded-[12px]"></div>
        </div>

        <div v-else class="space-y-2">
          <div v-for="item in topItems" :key="item.name" class="flex justify-between items-center bg-[#F3EDF7] p-3 rounded-[12px] transition-all">
            <div class="text-sm font-medium text-[#1D1B20] truncate">{{ item.name }}</div>
            <div class="text-xs font-mono font-bold text-[#21005D] bg-[#EADDFF] px-3 py-1 rounded-full shadow-sm">
              {{ item.qty }}
            </div>
          </div>
        </div>
      </section>
    </div>
  `
};
