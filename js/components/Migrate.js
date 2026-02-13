import { ref } from 'vue';
import { apiGet, apiPost, toast } from '../shared.js';
import { db } from '../firebase.js';
import { writeBatch, doc, collection, getDocs, addDoc } from 'firebase/firestore';

export default {
  setup() {
    const logs = ref([]);
    const loading = ref(false);

    const log = (msg) => logs.value.push(msg);

    // --- NEW: EXPORT FUNCTION ---
    const exportAllData = async () => {
      loading.value = true;
      log("📡 Starting full export from Firebase...");
      try {
        const collections = ['materials', 'projects', 'contractors', 'requesters', 'orders'];
        const allData = {};

        for (const colName of collections) {
          log(`Reading ${colName}...`);
          const snap = await getDocs(collection(db, colName));
          allData[colName] = snap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
        }

        // Create the JSON file for download
        const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `construction_data_backup_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
        
        log("✅ Export Complete! Check your downloads folder.");
        toast("Export Successful");
      } catch (e) {
        log("❌ Export Failed: " + e.message);
        console.error(e);
      } finally {
        loading.value = false;
      }
    };

    // 1. MASTER DATA
    const runMasterMigration = async () => {
      loading.value = true;
      logs.value = [];
      try {
        const batch = writeBatch(db);
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

    // 4. IMPORT PURCHASE HISTORY
    const runPurchaseMigration = async () => {
      loading.value = true;
      logs.value = [];
      try {
        log("🛒 Fetching Purchase List...");
        const list = await apiGet('pur_History'); 
        
        if (!Array.isArray(list)) throw new Error("No purchase history found");
        log(`📥 Found ${list.length} Requests. fetching details...`);

        for (let i = 0; i < list.length; i++) {
           const h = list[i];
           log(`> Fetching details for ${h.docNo} (${i+1}/${list.length})...`);
           
           let items = [];
           try {
             const lines = await apiGet('pur_DocLines', { payload: { docNo: h.docNo } });
             if (Array.isArray(lines)) {
                 items = lines.map(l => ({ name: l.item, qty: Number(l.qty) }));
             }
           } catch(err) {
             log(`⚠️ Could not fetch items for ${h.docNo}, saving header only.`);
           }

           await addDoc(collection(db, 'orders'), {
                 type: 'PURCHASE',
                 docNo: h.docNo,
                 date: h.date || (h.ts ? h.ts.split(' ')[0] : new Date().toISOString().split('T')[0]),
                 timestamp: h.ts || new Date().toISOString(),
                 project: h.project || '',
                 contractor: '', 
                 requester: '',
                 status: h.status || 'Requested',
                 needBy: h.needBy || '',
                 items: items
           });
        }
        
        log("✅ Purchase History Imported with Details!");
        toast("Done");
        
      } catch (e) { log("❌ " + e.message); } finally { loading.value = false; }
    };

    return { logs, loading, runMasterMigration, runHistoryMigration, recalculateStock, runPurchaseMigration, exportAllData };
  },
  template: `
    <div class="space-y-6 pb-20">
      <section class="glass rounded-2xl p-6 shadow-sm text-center space-y-4">
        <h3 class="font-bold text-2xl text-slate-800">🔥 Database Migration</h3>
        
        <div class="grid grid-cols-1 gap-3 max-w-sm mx-auto">
            <button @click="exportAllData" :disabled="loading" class="w-full bg-green-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-green-500/20 hover:bg-green-600 active:scale-95 transition-all flex items-center justify-center gap-2">
               <span v-if="loading" class="animate-spin text-xl">C</span>
               <span v-else>⬇️ Export All Data (JSON)</span>
            </button>

            <div class="h-4"></div> <button @click="runMasterMigration" :disabled="loading" class="btn">1. Import Master Data</button>
            <button @click="runHistoryMigration" :disabled="loading" class="btn">2. Import Movement History</button>
            <button @click="recalculateStock" :disabled="loading" class="btn">3. Recalculate Stock</button>
            <button @click="runPurchaseMigration" :disabled="loading" class="btn bg-purple-100 text-purple-700 hover:bg-purple-200">4. Import Purchase History</button>
        </div>
      </section>
      <div class="bg-slate-900 rounded-2xl p-4 font-mono text-sm text-green-400 h-64 overflow-y-auto shadow-inner border border-slate-700">
        <div v-if="logs.length === 0" class="text-slate-600 italic">Ready for migration or export...</div>
        <div v-for="(l, i) in logs" :key="i" class="mb-1 text-xs whitespace-nowrap">{{ l }}</div>
      </div>
    </div>
  `,
  styles: `
    .btn { background: #e2e8f0; color: #334155; font-weight: 700; padding: 12px; rounded: 12px; transition: all; }
    .btn:hover { background: #cbd5e1; }
  `
};
