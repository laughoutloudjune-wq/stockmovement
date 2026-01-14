import { ref, onMounted } from 'vue';
import { apiPost, toast } from '../shared.js';

export default {
  props: ['lang'],
  setup(props) {
    const list = ref([]);
    const loading = ref(true);
    const search = ref('');

    const load = async () => {
      loading.value = true;
      try {
        const res = await apiPost('out_SearchHistory', { limit: 50 }); // Fetch last 50
        // Group by Date
        const groups = {};
        (res.rows || []).forEach(r => {
          const d = (r.ts||'').split(' ')[0];
          if(!groups[d]) groups[d] = [];
          groups[d].push(r);
        });
        // Sort descending
        list.value = Object.keys(groups).sort((a,b) => b.localeCompare(a)).map(d => ({ date: d, items: groups[d] }));
      } catch { toast('Failed to load history'); } 
      finally { loading.value = false; }
    };

    onMounted(load);

    return { list, loading, search, load };
  },
  template: `
    <div class="space-y-6 pb-20">
      <div class="flex justify-between items-center px-1">
        <h3 class="font-bold text-lg text-slate-800">📜 History (OUT)</h3>
        <button @click="load" class="text-blue-500 font-bold text-sm bg-blue-50 px-3 py-1 rounded-lg">Refresh</button>
      </div>

      <div v-if="loading" class="space-y-4 animate-pulse">
        <div v-for="i in 3" class="h-24 bg-slate-200 rounded-2xl"></div>
      </div>

      <div v-else class="space-y-6">
        <div v-for="g in list" :key="g.date">
          <div class="flex justify-center mb-3">
             <span class="bg-slate-200/80 backdrop-blur text-slate-600 text-xs font-bold px-3 py-1 rounded-full shadow-sm">{{ g.date }}</span>
          </div>
          <div class="space-y-3">
            <div v-for="item in g.items" :key="item.doc" class="glass rounded-xl p-4 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
               <div class="flex justify-between mb-2">
                 <span class="font-bold text-slate-800 text-sm">OUT #{{ item.doc }}</span>
                 <span class="text-xs text-slate-400">{{ item.ts.split(' ')[1] }}</span>
               </div>
               <div class="flex flex-wrap gap-2">
                 <span class="px-2 py-1 bg-white border border-slate-100 rounded-md text-xs text-slate-600"><b>Proj:</b> {{ item.project }}</span>
                 <span class="px-2 py-1 bg-white border border-slate-100 rounded-md text-xs text-slate-600"><b>To:</b> {{ item.contractor }}</span>
                 <span class="px-2 py-1 bg-white border border-slate-100 rounded-md text-xs text-slate-600"><b>By:</b> {{ item.requester }}</span>
               </div>
               <div class="mt-2 text-right text-xs font-bold text-blue-500">{{ item.itemCount }} Items</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
};
