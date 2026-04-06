import { ref, computed, onMounted } from 'vue';
import { db } from '../firebase.js';
import { toast } from '../shared.js';
import { collection, getDocs, query, where } from 'firebase/firestore';

export default {
  props: ['lang'],
  setup(props) {
    const list = ref([]);
    const loading = ref(true);
    const search = ref('');

    const load = async () => {
      loading.value = true;
      try {
        const snap = await getDocs(query(collection(db, 'orders'), where('type', '==', 'OUT')));
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
      } catch { toast('Failed to load history'); }
      finally { loading.value = false; }
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

    return { list, filteredList, loading, search, load };
  },
  template: `
    <div class="space-y-4 pb-20">
      <div class="flex justify-between items-center px-1 gap-3">
        <h3 class="font-bold text-lg text-slate-800 shrink-0">📜 History (OUT)</h3>
        <button @click="load" class="text-blue-500 font-bold text-sm bg-blue-50 px-3 py-1 rounded-lg shrink-0">Refresh</button>
      </div>

      <input
        v-model="search"
        placeholder="Search doc, project, contractor, requester..."
        class="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
      />

      <div v-if="loading" class="space-y-4 animate-pulse">
        <div v-for="i in 3" class="h-24 bg-slate-200 rounded-2xl"></div>
      </div>

      <div v-else-if="filteredList.length === 0" class="text-center py-10 text-slate-400 text-sm">
        {{ search ? 'No results for "' + search + '"' : 'No OUT history found' }}
      </div>

      <div v-else class="space-y-6">
        <div v-for="g in filteredList" :key="g.date">
          <div class="flex justify-center mb-3">
            <span class="bg-slate-200/80 backdrop-blur text-slate-600 text-xs font-bold px-3 py-1 rounded-full shadow-sm">{{ g.date }}</span>
          </div>
          <div class="space-y-3">
            <div v-for="item in g.items" :key="item.doc" class="glass rounded-xl p-4 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div class="flex justify-between mb-2">
                <span class="font-bold text-slate-800 text-sm">OUT #{{ item.doc }}</span>
                <span class="text-xs text-slate-400">{{ (item.ts.split('T')[1] || item.ts.split(' ')[1] || '').slice(0, 5) }}</span>
              </div>
              <div class="flex flex-wrap gap-2">
                <span class="px-2 py-1 bg-white border border-slate-100 rounded-md text-xs text-slate-600"><b>Proj:</b> {{ item.project || '-' }}</span>
                <span class="px-2 py-1 bg-white border border-slate-100 rounded-md text-xs text-slate-600"><b>To:</b> {{ item.contractor }}</span>
                <span class="px-2 py-1 bg-white border border-slate-100 rounded-md text-xs text-slate-600"><b>By:</b> {{ item.requester }}</span>
              </div>
              <div class="flex justify-between items-end mt-2">
                <span v-if="item.note" class="text-xs text-slate-400 italic truncate mr-2">{{ item.note }}</span>
                <span v-else class="flex-1"></span>
                <span class="text-xs font-bold text-blue-500 shrink-0">{{ item.itemCount }} item{{ item.itemCount !== 1 ? 's' : '' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
};
