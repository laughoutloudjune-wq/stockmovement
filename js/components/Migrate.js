import { ref } from 'vue';
import { apiGet, apiPost, toast } from '../shared.js';
import { db } from '../firebase.js';
import { writeBatch, doc, collection } from 'firebase/firestore';

export default {
  setup() {
    const logs = ref([]);
    const loading = ref(false);

    const log = (msg) => logs.value.push(msg);

    // --- 1. Migrate Materials ---
    const runMigration = async () => {
      loading.value = true;
      logs.value = [];
      try {
        log("🚀 Starting Material Migration...");
        const materials = await apiGet('listMaterials');
        if (!materials || !Array.isArray(materials)) throw new Error("No materials found.");
        
        const batch = writeBatch(db);
        let count = 0;
        materials.forEach(name => {
          if (!name) return;
          const safeId = name.replace(/\//g, '_'); 
          const ref = doc(db, 'materials', safeId); 
          batch.set(ref, {
            name: name,
            stock: 0,
            min: 5,
            updatedAt: new Date().toISOString()
          });
          count++;
        });
        await batch.commit();
        log(`✅ Imported ${count} Materials.`);
      } catch (e) { log("❌ Error: " + e.message); } 
      finally { loading.value = false; }
    };

    // --- 2. Migrate History (GROUPED) ---
    const runHistoryMigration = async () => {
      loading.value = true;
      logs.value = [];
      try {
        log("🚀 Fetching Google Sheet History...");
        const payload = { start: '2020-01-01', end: '2030-12-31', type: '', material: '', project: '' };
        const res = await apiPost('getMovementReport', payload);
        
        if (!res || !res.data || res.data.length === 0) throw new Error("No history found.");

        const rows = res.data;
        log(`📥 Found ${rows.length} records. Grouping by Order...`);

        // Grouping Logic
        const groups = {};
        rows.forEach(row => {
          // Create a key to group by (Use docNo if available, else combine fields)
          const key = row.docNo || `${row.date}_${row.type}_${row.project}_${row.by}`;
          
          if (!groups[key]) {
            groups[key] = {
              docNo: row.docNo || 'MIG-' + Math.random().toString(36).substr(2, 9),
              date: row.date,
              type: row.type || 'UNKNOWN',
              project: row.project || '',
              requester: row.by || '',
              contractor: row.contractor || '', // If available
              items: [],
              migratedAt: new Date().toISOString()
            };
          }
          // Add item to the group
          groups[key].items.push({
            name: row.item,
            qty: Number(row.qty),
            note: row.note || ''
          });
        });

        const orders = Object.values(groups);
        log(`📦 Condensed into ${orders.length} Orders.`);

        // Upload in Batches
        const chunkSize = 400;
        for (let i = 0; i < orders.length; i += chunkSize) {
          const chunk = orders.slice(i, i + chunkSize);
          const batch = writeBatch(db);
          
          chunk.forEach(order => {
            // Use docNo as ID if unique, or auto-ID
            const ref = doc(collection(db, 'orders')); 
            batch.set(ref, order);
          });

          await batch.commit();
          log(`✅ Uploaded batch ${i} - ${i + chunk.length}`);
        }

        log("🎉 History Migration Complete!");
        toast("History Imported (Grouped)");

      } catch (e) {
        console.error(e);
        log("❌ Error: " + e.message);
      } finally {
        loading.value = false;
      }
    };

    return { logs, loading, runMigration, runHistoryMigration };
  },
  template: `
    <div class="space-y-6 pb-20">
      <section class="glass rounded-2xl p-6 shadow-sm text-center space-y-4">
        <h3 class="font-bold text-2xl text-slate-800">🔥 Database Migration</h3>
        <p class="text-slate-500">Import data from Google Sheets to Firestore.</p>
        
        <div class="flex flex-col gap-3 max-w-xs mx-auto">
            <button @click="runMigration" :disabled="loading" class="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-3 px-6 rounded-xl transition-all">
                1. Import Materials
            </button>
            <button @click="runHistoryMigration" :disabled="loading" class="bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-orange-500/30 transition-all">
                2. Import History (Grouped)
            </button>
        </div>
      </section>
      <div class="bg-slate-900 rounded-2xl p-4 font-mono text-sm text-green-400 h-64 overflow-y-auto shadow-inner border border-slate-700">
        <div v-if="logs.length === 0" class="text-slate-600 italic">Ready to start...</div>
        <div v-for="(l, i) in logs" :key="i" class="mb-1">> {{ l }}</div>
      </div>
    </div>
  `
};
