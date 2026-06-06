import { ref, computed, onMounted, onUnmounted } from 'vue';
import { db } from '../firebase.js';
import { toast } from '../shared.js';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

export default {
  props: ['lang'],
  setup(props) {
    const list = ref([]);
    const loading = ref(true);
    const search = ref('');
    let unsub = null;

    const load = () => {
      loading.value = true;
      unsub = onSnapshot(
        query(collection(db, 'orders'), where('type', '==', 'OUT')),
        (snap) => {
          const rows = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (b.timestamp || b.date || '').localeCompare(a.timestamp || a.date || ''))
            .map(r => ({
              doc: r.docNo || r.id,
              ts: r.timestamp || `${r.date || ''} 00:00:00`,
              project: [r.project, r.subProject].filter(Boolean).join(' › '),
              contractor: r.contractor || '—',
              requester: r.requester || '—',
              note: r.note || r.remark || '',
              itemCount: Array.isArray(r.items) ? r.items.length : 0
            }));

          const groups = {};
          rows.forEach(r => {
            const d = (r.ts || '').split('T')[0] || (r.ts || '').split(' ')[0];
            if (!groups[d]) groups[d] = [];
            groups[d].push(r);
          });
          list.value = Object.keys(groups).sort((a, b) => b.localeCompare(a)).map(d => ({ date: d, items: groups[d] }));
          loading.value = false;
        },
        (error) => { console.error(error); toast('Failed to load history'); loading.value = false; }
      );
    };

    const filteredList = computed(() => {
      if (!search.value.trim()) return list.value;
      const q = search.value.toLowerCase();
      return list.value
        .map(g => ({
          date: g.date,
          items: g.items.filter(r =>
            r.doc.toLowerCase().includes(q) ||
            r.project.toLowerCase().includes(q) ||
            r.contractor.toLowerCase().includes(q) ||
            r.requester.toLowerCase().includes(q) ||
            r.note.toLowerCase().includes(q)
          )
        }))
        .filter(g => g.items.length > 0);
    });

    onMounted(load);
    onUnmounted(() => { if (unsub) unsub(); });

    return { list, filteredList, loading, search, load };
  },
  template: `
    <div class="space-y-4 pb-12 pt-2">

      <!-- Search bar -->
      <div class="md3-input-container">
        <input v-model="search" class="md3-input" placeholder=" " />
        <label class="md3-label flex items-center gap-1">
          <span class="material-symbols-outlined icon-xs">search</span>
          Search doc, project, contractor…
        </label>
      </div>

      <!-- Loading skeleton -->
      <div v-if="loading" class="space-y-4 animate-pulse">
        <div v-for="i in 3" :key="'sk-hist-'+i" class="h-24 bg-[#E6E0E9] rounded-[16px]"></div>
      </div>

      <!-- Empty state -->
      <div v-else-if="filteredList.length === 0"
        class="text-center py-14 text-[#49454F] text-[14px] bg-[#F7F2FA] rounded-[16px] border border-dashed border-[#CAC4D0] flex flex-col items-center gap-2">
        <span class="material-symbols-outlined text-[#CAC4D0]" style="font-size:40px">history</span>
        {{ search ? 'No results for "' + search + '"' : 'No OUT history found' }}
      </div>

      <!-- Grouped results -->
      <div v-else class="space-y-6">
        <div v-for="g in filteredList" :key="g.date">
          <!-- Date separator pill -->
          <div class="flex justify-center mb-3">
            <span class="bg-[#E8DEF8] text-[#1D192B] text-[12px] font-medium px-4 py-1 rounded-full">
              {{ g.date }}
            </span>
          </div>

          <div class="space-y-3">
            <div v-for="item in g.items" :key="item.doc"
              class="md3-card-outlined hover:shadow-md3-elevation-1 transition-shadow">
              <div class="flex justify-between items-start mb-3">
                <div>
                  <div class="text-[15px] font-medium text-[#1D1B20]">OUT #{{ item.doc }}</div>
                  <div class="text-[12px] text-[#49454F] mt-0.5">
                    {{ (item.ts.split('T')[1] || item.ts.split(' ')[1] || '').slice(0, 5) }}
                  </div>
                </div>
                <!-- Item count chip -->
                <span class="md3-chip bg-[#E8DEF8] text-[#1D192B]">
                  <span class="material-symbols-outlined" style="font-size:14px">category</span>
                  {{ item.itemCount }} item{{ item.itemCount !== 1 ? 's' : '' }}
                </span>
              </div>

              <!-- Info chips row -->
              <div class="flex flex-wrap gap-1.5 mt-2">
                <span class="md3-chip bg-[#F3EDF7] text-[#1D1B20]" style="height:28px;padding:0 10px;font-size:12px">
                  <span class="material-symbols-outlined" style="font-size:14px">business</span>
                  {{ item.project || '—' }}
                </span>
                <span class="md3-chip bg-[#F3EDF7] text-[#1D1B20]" style="height:28px;padding:0 10px;font-size:12px">
                  <span class="material-symbols-outlined" style="font-size:14px">engineering</span>
                  {{ item.contractor }}
                </span>
                <span class="md3-chip bg-[#F3EDF7] text-[#1D1B20]" style="height:28px;padding:0 10px;font-size:12px">
                  <span class="material-symbols-outlined" style="font-size:14px">person</span>
                  {{ item.requester }}
                </span>
              </div>

              <div v-if="item.note" class="mt-3 pt-3 border-t border-[#E6E0E9] text-[12px] text-[#49454F] italic">
                {{ item.note }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
};
