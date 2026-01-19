import { ref } from 'vue';
import { apiGet, apiPost, toast } from '../shared.js';
import { db } from '../firebase.js';
import { writeBatch, doc, collection, getDocs } from 'firebase/firestore';

export default {
  setup() {
    const logs = ref([]);
    const loading = ref(false);

    const log = (msg) => logs.value.push(msg);

    // 1. MASTER DATA
    const runMasterMigration = async () => {
      loading.value = true;
      logs.value = [];
      try {
        const batch = writeBatch(db);
        let count = 0;
        
        log("📦 Materials...");
        const materials = await apiGet('listMaterials');
        if (Array.isArray(materials)) materials.forEach(n => { if(n) batch.set(doc(db,'materials',n.replace(/\//g,'_')), {name:n,min:5},{merge:true}); });

        log("🏗️ Projects...");
        const projects = await apiGet('listProjects');
        if (Array.isArray(projects)) projects.forEach(n => { if(n) batch.set(doc(db,'projects',n), {name:n},{merge:true}); });

        log("👷 Contractors...");
        const contractors = await apiGet('listContractors');
        if (Array.isArray(contractors)) contractors.forEach(n => { if(n) batch.set(doc(db,'contractors',n), {name:n},{merge:true}); });
        
        log("👤 Requesters...");
        const requesters = await apiGet('listRequesters');
        if (Array.isArray(requesters)) requesters.forEach(n => { if(n) batch.set(doc(db,'requesters',n), {name:n},{merge:true}); });

        await batch.commit();
        log("✅ Master Data Done!");
      } catch (e) { log("❌ Error: " + e.message); } finally { loading.value = false; }
    };

    // 2. MOVEMENT HISTORY
    const runHistoryMigration = async () => {
      loading.value = true;
      logs.value = [];
      try {
        log("🚀 Google Sheets History...");
        const res = await apiPost('getMovementReport', { start:'2020-01-01', end:'2030-12-31' });
        const rows = res.data || [];
        
        const groups = {};
        rows.forEach(row => {
          const key = row.docNo || `${row.date}_${row.type}_${row.project}_${row.by}`;
          if (!groups[key]) groups[key] = {
              docNo: row.docNo || 'MIG-'+Math.random().toString(36).substr(2,9),
              date: row.date,
              type: row.type || 'UNKNOWN',
              project: row.project || '',
              requester: row.by || '',
              contractor: row.contractor || '',
              items: [],
              timestamp: new Date().toISOString()
          };
          groups[key].items.push({ name: row.item, qty: Number(row.qty), note: row.note||'' });
        });

        const orders = Object.values(groups);
        log(`📦 Saving ${orders.length} Orders...`);
        
        const chunkSize = 400;
        for (let i = 0; i < orders.length; i += chunkSize) {
          const batch = writeBatch(db);
          orders.slice(i, i+chunkSize).forEach(o => batch.set(doc(collection(db,'orders')), o));
          await batch.commit();
        }
        log("✅ History Done!");
      } catch (e) { log("❌ " + e.message); } finally { loading.value = false; }
    };

    // 3. RECALCULATE STOCK
    const recalculateStock = async () => {
      loading.value = true;
      logs.value = [];
      try {
        log("🔄 Recalculating...");
        const snap = await getDocs(collection(db, 'orders'));
        const tallies = {};
        snap.docs.forEach(d => {
            const data = d.data();
            if (data.items) data.items.forEach(i => {
                if(!tallies[i.name]) tallies[i.name] = 0;
                if(data.type === 'IN' || data.type === 'ADJUST') tallies[i.name] += Number(i.qty);
                else if(data.type === 'OUT') tallies[i.name] -= Number(i.qty);
            });
        });
        
        const keys = Object.keys(tallies);
        log(`💾 Updating ${keys.length} items...`);
        const chunkSize = 400;
        for (let i = 0; i < keys.length; i += chunkSize) {
            const batch = writeBatch(db);
            keys.slice(i, i+chunkSize).forEach(k => {
                batch.set(doc(db,'materials',k.replace(/\//g,'_')), {name:k, stock:tallies[k]}, {merge:true});
            });
            await batch.commit();
        }
        log("✅ Stock Updated!");
      } catch (e) { log("❌ " + e.message); } finally { loading.value = false; }
    };

    // 4. IMPORT PURCHASE HISTORY (NEW)
    const runPurchaseMigration = async () => {
      loading.value = true;
      logs.value = [];
      try {
        log("🛒 Fetching Purchase History...");
        const list = await apiGet('pur_History'); // Fetches headers
        
        if (!Array.isArray(list)) throw new Error("No purchase history found");
        log(`📥 Found ${list.length} Requests. Importing...`);
        
        // Note: Old API pur_History didn't give items list in the summary.
        // We will import the headers so they appear in the list.
        // If you need full details, it requires fetching line-by-line which is slow,
        // so we start with this to populate the list.

        const batch = writeBatch(db);
        list.forEach(h => {
             const ref = doc(collection(db, 'orders'));
             batch.set(ref, {
                 type: 'PURCHASE',
                 docNo: h.docNo,
                 date: h.date || h.ts.split(' ')[0], // Try to parse date
                 timestamp: h.ts || new Date().toISOString(),
                 project: h.project,
                 contractor: '', // Old summary might not have this
                 requester: '',
                 status: h.status,
                 needBy: h.needBy,
                 items: [] // Items might be empty if not in summary
             });
        });
        
        await batch.commit();
        log("✅ Purchase History Imported!");
        
      } catch (e) { log("❌ " + e.message); } finally { loading.value = false; }
    };

    return { logs, loading, runMasterMigration, runHistoryMigration, recalculateStock, runPurchaseMigration };
  },
  template: `
    <div class="space-y-6 pb-20">
      <section class="glass rounded-2xl p-6 shadow-sm text-center space-y-4">
        <h3 class="font-bold text-2xl text-slate-800">🔥 Database Migration</h3>
        
        <div class="grid grid-cols-1 gap-3 max-w-sm mx-auto">
            <button @click="runMasterMigration" :disabled="loading" class="btn">1. Import Master Data</button>
            <button @click="runHistoryMigration" :disabled="loading" class="btn">2. Import Movement History</button>
            <button @click="recalculateStock" :disabled="loading" class="btn">3. Recalculate Stock</button>
            <button @click="runPurchaseMigration" :disabled="loading" class="btn bg-purple-100 text-purple-700 hover:bg-purple-200">4. Import Purchase History</button>
        </div>
      </section>
      <div class="bg-slate-900 rounded-2xl p-4 font-mono text-sm text-green-400 h-64 overflow-y-auto shadow-inner border border-slate-700">
        <div v-if="logs.length === 0" class="text-slate-600 italic">Ready...</div>
        <div v-for="(l, i) in logs" :key="i" class="mb-1">> {{ l }}</div>
      </div>
    </div>
  `,
  styles: `
    .btn { background: #e2e8f0; color: #334155; font-weight: 700; padding: 12px; rounded: 12px; transition: all; }
    .btn:hover { background: #cbd5e1; }
  `
};
