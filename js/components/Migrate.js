import { ref } from 'vue';
import { apiGet, apiPost, toast } from '../shared.js';
import { db } from '../firebase.js';
import { writeBatch, doc, collection, getDocs, addDoc } from 'firebase/firestore';

export default {
  setup() {
    const logs = ref([]);
    const loading = ref(false);
    const log = (msg) => logs.value.push(msg);

    // --- ENHANCED EXPORT: FLATTENS NESTED ITEMS INTO MOVEMENTS ---
    const exportAllData = async () => {
      loading.value = true;
      log("📡 Starting Deep Export for Relational Migration...");
      try {
        const collections = ['materials', 'projects', 'contractors', 'requesters', 'orders'];
        const exportData = {
            materials: [],
            projects: [],
            contractors: [],
            requesters: [],
            orders: [],
            movements: [] // This is what you were missing
        };

        for (const colName of collections) {
          log(`Processing ${colName}...`);
          const snap = await getDocs(collection(db, colName));
          const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          
          exportData[colName] = docs;

          // SPECIAL LOGIC: If we are processing 'orders', create the 'movements' rows
          if (colName === 'orders') {
            log("🔧 Flattening Order Items into individual Movements...");
            docs.forEach(order => {
                if (order.items && Array.isArray(order.items)) {
                    order.items.forEach(item => {
                        exportData.movements.push({
                            date: order.date || order.timestamp?.split('T')[0],
                            type: order.type,
                            doc_no: order.docNo,
                            material_name: item.name,
                            qty: item.qty,
                            project_name: order.project || '',
                            unit_number: order.note || '', // Temporary mapping for your units
                            requester: order.requester || '',
                            contractor: order.contractor || '',
                            timestamp: order.timestamp || new Date().toISOString()
                        });
                    });
                }
            });
          }
        }

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Relational_MaterialFlow_Export_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
        
        log(`✅ Export Complete! Created ${exportData.movements.length} movement rows.`);
        toast("Export Successful");
      } catch (e) {
        log("❌ Export Failed: " + e.message);
      } finally {
        loading.value = false;
      }
    };

    // Existing Migration Functions
    const runMasterMigration = async () => { /* ... existing code ... */ };
    const runHistoryMigration = async () => { /* ... existing code ... */ };
    const recalculateStock = async () => { /* ... existing code ... */ };
    const runPurchaseMigration = async () => { /* ... existing code ... */ };

    return { logs, loading, runMasterMigration, runHistoryMigration, recalculateStock, runPurchaseMigration, exportAllData };
  },
  template: `
    <div class="space-y-6 pb-20">
      <section class="glass rounded-2xl p-6 shadow-sm text-center space-y-4">
        <h3 class="font-bold text-2xl text-slate-800">📦 Relational Export Tool</h3>
        <p class="text-xs text-slate-500">This will extract hidden items from Orders and turn them into a 'movements' list for Supabase.</p>
        
        <div class="grid grid-cols-1 gap-3 max-w-sm mx-auto">
            <button @click="exportAllData" :disabled="loading" class="w-full bg-green-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-green-600/20 hover:bg-green-700 active:scale-95 transition-all flex items-center justify-center gap-2">
               <span v-if="loading" class="animate-spin text-xl">C</span>
               <span v-else>⬇️ EXPORT FOR SUPABASE (JSON)</span>
            </button>
        </div>
      </section>
      <div class="bg-slate-900 rounded-2xl p-4 font-mono text-sm text-green-400 h-64 overflow-y-auto shadow-inner border border-slate-700">
        <div v-if="logs.length === 0" class="text-slate-600 italic">Ready to transform your data...</div>
        <div v-for="(l, i) in logs" :key="i" class="mb-1 text-xs whitespace-nowrap">{{ l }}</div>
      </div>
    </div>
  `
};
