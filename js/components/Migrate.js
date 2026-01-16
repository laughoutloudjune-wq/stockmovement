import { ref } from 'vue';
import { apiGet, apiPost, toast } from '../shared.js';
import { db } from '../firebase.js';
import { writeBatch, doc, collection, getDocs, setDoc } from 'firebase/firestore';

export default {
  setup() {
    const logs = ref([]);
    const loading = ref(false);

    const log = (msg) => logs.value.push(msg);

    // --- 1. Migrate Master Data (Materials) ---
    const runMasterMigration = async () => {
      loading.value = true;
      logs.value = [];
      try {
        const batch = writeBatch(db);
        let count = 0;

        // A. Materials
        log("📦 Fetching Materials...");
        const materials = await apiGet('listMaterials');
        if (Array.isArray(materials)) {
            materials.forEach(name => {
                if (!name) return;
                const safeId = name.replace(/\//g, '_'); 
                // Use set with MERGE so we don't zero-out existing stock if run again
                batch.set(doc(db, 'materials', safeId), { name, min: 5 }, { merge: true });
                count++;
            });
            log(`- Prepared ${materials.length} Materials`);
        }

        // B. Projects
        log("🏗️ Fetching Projects...");
        const projects = await apiGet('listProjects');
        if (Array.isArray(projects)) {
            projects.forEach(name => {
                if (!name) return;
                batch.set(doc(db, 'projects', name), { name }, { merge: true });
                count++;
            });
        }

        // C. Contractors
        log("👷 Fetching Contractors...");
        const contractors = await apiGet('listContractors');
        if (Array.isArray(contractors)) {
            contractors.forEach(name => {
                if (!name) return;
                batch.set(doc(db, 'contractors', name), { name }, { merge: true });
                count++;
            });
        }
        
        // D. Requesters
        log("👤 Fetching Requesters...");
        const requesters = await apiGet('listRequesters');
        if (Array.isArray(requesters)) {
            requesters.forEach(name => {
                if (!name) return;
                batch.set(doc(db, 'requesters', name), { name }, { merge: true });
                count++;
            });
        }

        log(`🚀 Committing ${count} items to Firestore...`);
        await batch.commit();
        log("✅ Master Data Migration Complete!");

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
          const key = row.docNo || `${row.date}_${row.type}_${row.project}_${row.by}`;
          if (!groups[key]) {
            groups[key] = {
              docNo: row.docNo || 'MIG-' + Math.random().toString(36).substr(2, 9),
              date: row.date,
              type: row.type || 'UNKNOWN',
              project: row.project || '',
              requester: row.by || '',
              contractor: row.contractor || '', 
              items: [],
              migratedAt: new Date().toISOString()
            };
          }
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
            const ref = doc(collection(db, 'orders')); 
            batch.set(ref, order);
          });
          await batch.commit();
          log(`✅ Uploaded batch ${i} - ${i + chunk.length}`);
        }

        log("🎉 History Imported! (Now run Recalculate)");
        toast("History Imported");

      } catch (e) {
        console.error(e);
        log("❌ Error: " + e.message);
      } finally {
        loading.value = false;
      }
    };

    // --- 3. RECALCULATE STOCK ---
    const recalculateStock = async () => {
      loading.value = true;
      logs.value = [];
      try {
        log("🔄 Reading all orders from Firestore...");
        
        const snap = await getDocs(collection(db, 'orders'));
        const tallies = {};

        log(`📊 Processing ${snap.size} orders...`);

        snap.docs.forEach(d => {
            const data = d.data();
            const type = data.type; // IN, OUT, ADJUST
            
            if (data.items && Array.isArray(data.items)) {
                data.items.forEach(item => {
                    const name = item.name;
                    if (!name) return;
                    
                    const qty = Number(item.qty || 0);
                    if (!tallies[name]) tallies[name] = 0;

                    // Calculation Logic
                    if (type === 'IN' || type === 'ADJUST') {
                        tallies[name] += qty;
                    } else if (type === 'OUT') {
                        tallies[name] -= qty;
                    }
                });
            }
        });

        const materialNames = Object.keys(tallies);
        log(`💾 Updating stock for ${materialNames.length} items...`);

        // Batch Update (Chunked)
        const chunkSize = 400;
        for (let i = 0; i < materialNames.length; i += chunkSize) {
            const batch = writeBatch(db);
            const chunk = materialNames.slice(i, i + chunkSize);
            
            chunk.forEach(name => {
                const safeId = name.replace(/\//g, '_');
                const ref = doc(db, 'materials', safeId);
                // Update stock, create doc if missing (merge)
                batch.set(ref, { name: name, stock: tallies[name] }, { merge: true });
            });

            await batch.commit();
            log(`✅ Updated batch ${i} - ${i + chunk.length}`);
        }

        log("🎉 Stock Levels Updated Successfully!");
        toast("Stock Recalculated");

      } catch (e) {
         console.error(e);
         log("❌ Error: " + e.message);
      } finally {
         loading.value = false;
      }
    };

    return { logs, loading, runMasterMigration, runHistoryMigration, recalculateStock };
  },
  template: `
    <div class="space-y-6 pb-20">
      <section class="glass rounded-2xl p-6 shadow-sm text-center space-y-4">
        <h3 class="font-bold text-2xl text-slate-800">🔥 Database Migration</h3>
        <p class="text-slate-500">Import data from Google Sheets to Firestore.</p>
        
        <div class="flex flex-col gap-3 max-w-sm mx-auto">
            <button @click="runMasterMigration" :disabled="loading" class="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-3 px-6 rounded-xl transition-all text-sm">
                1. Import Master Data (Materials/Projects)
            </button>
            <button @click="runHistoryMigration" :disabled="loading" class="bg-orange-200 hover:bg-orange-300 text-orange-800 font-bold py-3 px-6 rounded-xl transition-all text-sm">
                2. Import History (Orders)
            </button>
            <button @click="recalculateStock" :disabled="loading" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-blue-500/30 transition-all text-sm">
                3. Recalculate Stock Levels
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
