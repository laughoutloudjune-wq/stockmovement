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
      unsub = onSnapshot(query(collection(db, 'orders'), where('type', '==', 'OUT')), (snap) => {
        const rows = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.timestamp || b.date || '').localeCompare(a.timestamp || a.date || ''))
          .map(r => ({
            doc: r.docNo || r.id,
            ts: r.timestamp || `${r.date || ''} 00:00:00`,
            project: [r.project, r.subProject].filter(Boolean).join(' > '),
            contractor: r.contractor || '-',
            requester: r.requester || '-',
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
      }, (error) => {
        console.error(error);
        toast('Failed to load history');
        loading.value = false;
      });
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

    onUnmounted(() => {
      if (unsub) unsub();
    });

    return { list, filteredList, loading, search, load };
  },
  template: `
    <div class="space-y-4 pb-12 pt-2">
      <div class="flex justify-between items-center px-1 gap-3">
        <h3 class="text-base font-semibold text-slate-800 shrink-0">📜 History (OUT)</h3>
        <button @click="load" class="bg-blue-100 text-blue-700 rounded-full px-4 py-1.5 text-xs font-semibold hover:bg-blue-200 transition-colors active:scale-[0.98] shrink-0">Refresh</button>
      </div>

      <input
        v-model="search"
        placeholder="Search doc, project, contractor, requester..."
        class="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
      />

      <div v-if="loading" class="space-y-4 animate-pulse">
        <div v-for="i in 3" class="h-24 bg-slate-100 rounded-2xl"></div>
      </div>

      <div v-else-if="filteredList.length === 0" class="text-center py-10 text-slate-400 text-sm">
        {{ search ? 'No results for "' + search + '"' : 'No OUT history found' }}
      </div>

      <div v-else class="space-y-6">
        <div v-for="g in filteredList" :key="g.date">
          <div class="flex justify-center mb-3">
            <span class="bg-slate-200/80 backdrop-blur text-slate-600 text-xs font-semibold px-3 py-1 rounded-full shadow-sm">{{ g.date }}</span>
          </div>
          <div class="space-y-3">
            <div v-for="item in g.items" :key="item.doc" class="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow-md transition-shadow group">
              <div class="flex justify-between mb-2.5">
                <span class="font-semibold text-slate-800 text-sm">OUT #{{ item.doc }}</span>
                <span class="text-xs text-slate-500">{{ (item.ts.split('T')[1] || item.ts.split(' ')[1] || '').slice(0, 5) }}</span>
              </div>
              <div class="flex flex-wrap gap-1.5">
                <span class="px-2.5 py-1 bg-slate-50 rounded-full text-xs text-slate-600 border border-slate-100"><b>Proj:</b> {{ item.project || '-' }}</span>
                <span class="px-2.5 py-1 bg-slate-50 rounded-full text-xs text-slate-600 border border-slate-100"><b>To:</b> {{ item.contractor }}</span>
                <span class="px-2.5 py-1 bg-slate-50 rounded-full text-xs text-slate-600 border border-slate-100"><b>By:</b> {{ item.requester }}</span>
              </div>
              <div class="flex justify-between items-end mt-3 pt-3 border-t border-slate-50">
                <span v-if="item.note" class="text-xs text-slate-500 italic truncate mr-2">{{ item.note }}</span>
                <span v-else class="flex-1"></span>
                <span class="text-xs font-semibold text-blue-600 shrink-0 bg-blue-50 px-2 py-0.5 rounded-full">{{ item.itemCount }} item{{ item.itemCount !== 1 ? 's' : '' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
};
