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

      unsubOrders = onSnapshot(
        query(collection(db, 'orders'), where('type', '==', 'OUT'), where('date', '>=', cutoff)),
        (outSnap) => {
          const usage = {};
          outSnap.docs.forEach(d => {
            (d.data().items || []).forEach(i => {
              usage[i.name] = (usage[i.name] || 0) + Number(i.qty || 0);
            });
          });
          topItems.value = Object.entries(usage)
            .map(([name, qty]) => ({ name, qty }))
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 10);
          loading.value = false;
        },
        (e) => { console.error(e); loading.value = false; }
      );
    });

    onUnmounted(() => { if (unsubOrders) unsubOrders(); });

    return { lowStock, topItems, loading, S };
  },
  template: `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pb-28 pt-2">

      <!-- Low Stock Card -->
      <section class="md3-card-outlined">
        <h3 class="text-[16px] font-medium text-[#1D1B20] mb-4 flex items-center gap-2">
          <span class="material-symbols-outlined icon-sm text-[#B3261E]">warning</span>
          {{ S.dashLow }}
        </h3>

        <!-- Skeleton -->
        <div v-if="loading" class="space-y-3 animate-pulse">
          <div v-for="i in 3" :key="'sk-low-'+i" class="h-14 bg-[#E6E0E9] rounded-xl"></div>
        </div>

        <div v-else class="space-y-2">
          <div v-if="lowStock.length === 0" class="text-center py-8 text-sm text-[#49454F] flex flex-col items-center gap-2">
            <span class="material-symbols-outlined text-[#CAC4D0]" style="font-size:40px">inventory</span>
            {{ S.noLow }}
          </div>
          <div v-for="item in lowStock" :key="item.name"
            class="flex justify-between items-center bg-[#F9DEDC] px-4 py-3 rounded-xl">
            <div class="min-w-0 flex-1 pr-3">
              <div class="text-[14px] font-medium text-[#410E0B] truncate">{{ item.name }}</div>
              <div class="text-[12px] text-[#B3261E] mt-0.5">Min: {{ item.min }}</div>
            </div>
            <span class="px-3 py-1 bg-[#B3261E] text-white font-bold rounded-full text-[13px] shrink-0">
              {{ item.stock }}
            </span>
          </div>
        </div>
      </section>

      <!-- Top Items Card -->
      <section class="md3-card-outlined">
        <h3 class="text-[16px] font-medium text-[#1D1B20] mb-4 flex items-center gap-2">
          <span class="material-symbols-outlined icon-sm text-[#6750A4]">star</span>
          {{ S.dashTopItems }}
          <span class="text-[12px] font-normal text-[#49454F]">(30d)</span>
        </h3>

        <!-- Skeleton -->
        <div v-if="loading" class="space-y-3 animate-pulse">
          <div v-for="i in 3" :key="'sk-top-'+i" class="h-14 bg-[#E6E0E9] rounded-xl"></div>
        </div>

        <div v-else class="space-y-2">
          <div v-if="topItems.length === 0" class="text-center py-8 text-sm text-[#49454F] flex flex-col items-center gap-2">
            <span class="material-symbols-outlined text-[#CAC4D0]" style="font-size:40px">bar_chart</span>
            No data yet
          </div>
          <div v-for="(item, idx) in topItems" :key="item.name"
            class="flex justify-between items-center bg-[#F3EDF7] px-4 py-3 rounded-xl">
            <div class="flex items-center gap-3 min-w-0">
              <span class="text-[11px] font-bold text-[#6750A4] w-5 text-center shrink-0">{{ idx + 1 }}</span>
              <span class="text-[14px] font-medium text-[#1D1B20] truncate">{{ item.name }}</span>
            </div>
            <span class="px-3 py-1 bg-[#EADDFF] text-[#21005D] font-bold rounded-full text-[13px] font-mono shrink-0">
              {{ item.qty }}
            </span>
          </div>
        </div>
      </section>

    </div>
  `
};
