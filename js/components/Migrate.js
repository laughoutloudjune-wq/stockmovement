import { ref } from 'vue';
import { db } from '../firebase.js';
<<<<<<< HEAD
import { writeBatch, doc, collection, getDocs } from 'firebase/firestore';
import { toast } from '../shared.js';
=======
import { writeBatch, doc, collection, getDocs, addDoc } from 'firebase/firestore';
>>>>>>> 34c68ed864abec94c0b4f0ab099c3326d89c916f

export default {
  setup() {
    const logs = ref([]);
    const loading = ref(false);
    const log = (msg) => logs.value.push(msg);

<<<<<<< HEAD
    const recalculateStock = async () => {
      loading.value = true;
      logs.value = [];
      try {
        log('Recalculating material stock from order history...');
        const snap = await getDocs(collection(db, 'orders'));
        const tallies = {};

        snap.docs.forEach(d => {
          const data = d.data();
          (data.items || []).forEach(i => {
            const key = i.name;
            if (!key) return;
            if (!tallies[key]) tallies[key] = 0;
            if (data.type === 'IN' || data.type === 'ADJUST') tallies[key] += Number(i.qty || 0);
            else if (data.type === 'OUT') tallies[key] -= Number(i.qty || 0);
          });
        });

        const keys = Object.keys(tallies);
        log(`Updating ${keys.length} material rows...`);

        const chunkSize = 400;
        for (let i = 0; i < keys.length; i += chunkSize) {
          const batch = writeBatch(db);
          keys.slice(i, i + chunkSize).forEach(k => {
            batch.set(doc(db, 'materials', k.replace(/\//g, '_')), { name: k, stock: tallies[k] }, { merge: true });
          });
          await batch.commit();
        }

        log('Stock updated.');
        toast('Done');
      } catch (e) {
        console.error(e);
        log('Error: ' + e.message);
=======
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
>>>>>>> 34c68ed864abec94c0b4f0ab099c3326d89c916f
      } finally {
        loading.value = false;
      }
    };

<<<<<<< HEAD
    const backfillOrderDates = async () => {
      loading.value = true;
      logs.value = [];
      try {
        log('Backfilling missing order date fields from timestamp...');
        const snap = await getDocs(collection(db, 'orders'));
        const updates = [];

        snap.docs.forEach(d => {
          const data = d.data();
          if (!data.date) {
            const date = data.timestamp ? String(data.timestamp).slice(0, 10) : new Date().toISOString().split('T')[0];
            updates.push({ id: d.id, date });
          }
        });

        const chunkSize = 400;
        for (let i = 0; i < updates.length; i += chunkSize) {
          const batch = writeBatch(db);
          updates.slice(i, i + chunkSize).forEach(u => {
            batch.update(doc(db, 'orders', u.id), { date: u.date });
          });
          await batch.commit();
        }

        log(`Backfilled ${updates.length} orders.`);
        toast('Done');
      } catch (e) {
        console.error(e);
        log('Error: ' + e.message);
      } finally {
        loading.value = false;
      }
    };

    const normalizePurchaseItems = async () => {
      loading.value = true;
      logs.value = [];
      try {
        log('Normalizing purchase item fields (status/supplier/note)...');
        const snap = await getDocs(collection(db, 'orders'));
        const purchases = snap.docs.filter(d => d.data().type === 'PURCHASE');

        let updated = 0;
        const chunkSize = 300;
        for (let i = 0; i < purchases.length; i += chunkSize) {
          const batch = writeBatch(db);
          purchases.slice(i, i + chunkSize).forEach(d => {
            const data = d.data();
            const items = (data.items || []).map(item => ({
              name: item.name || '',
              qty: Number(item.qty || 0),
              supplier: item.supplier || '',
              status: item.status || 'Requested',
              note: item.note || ''
            }));
            batch.update(doc(db, 'orders', d.id), { items });
            updated += 1;
          });
          await batch.commit();
        }

        log(`Normalized ${updated} purchase orders.`);
        toast('Done');
      } catch (e) {
        console.error(e);
        log('Error: ' + e.message);
      } finally {
        loading.value = false;
      }
    };

    return { logs, loading, recalculateStock, backfillOrderDates, normalizePurchaseItems };
=======
    // Existing Migration Functions
    const runMasterMigration = async () => { /* ... existing code ... */ };
    const runHistoryMigration = async () => { /* ... existing code ... */ };
    const recalculateStock = async () => { /* ... existing code ... */ };
    const runPurchaseMigration = async () => { /* ... existing code ... */ };

    return { logs, loading, runMasterMigration, runHistoryMigration, recalculateStock, runPurchaseMigration, exportAllData };
>>>>>>> 34c68ed864abec94c0b4f0ab099c3326d89c916f
  },
  template: `
    <div class="space-y-6 pb-20">
      <section class="glass rounded-2xl p-6 shadow-sm text-center space-y-4">
<<<<<<< HEAD
        <h3 class="font-bold text-2xl text-slate-800">Database Tools</h3>

        <div class="grid grid-cols-1 gap-3 max-w-sm mx-auto">
          <button @click="recalculateStock" :disabled="loading" class="btn">1. Recalculate Stock</button>
          <button @click="backfillOrderDates" :disabled="loading" class="btn">2. Backfill Missing Dates</button>
          <button @click="normalizePurchaseItems" :disabled="loading" class="btn">3. Normalize Purchase Items</button>
=======
        <h3 class="font-bold text-2xl text-slate-800">📦 Relational Export Tool</h3>
        <p class="text-xs text-slate-500">This will extract hidden items from Orders and turn them into a 'movements' list for Supabase.</p>
        
        <div class="grid grid-cols-1 gap-3 max-w-sm mx-auto">
            <button @click="exportAllData" :disabled="loading" class="w-full bg-green-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-green-600/20 hover:bg-green-700 active:scale-95 transition-all flex items-center justify-center gap-2">
               <span v-if="loading" class="animate-spin text-xl">C</span>
               <span v-else>⬇️ EXPORT FOR SUPABASE (JSON)</span>
            </button>
>>>>>>> 34c68ed864abec94c0b4f0ab099c3326d89c916f
        </div>
      </section>

      <div class="bg-slate-900 rounded-2xl p-4 font-mono text-sm text-green-400 h-64 overflow-y-auto shadow-inner border border-slate-700">
        <div v-if="logs.length === 0" class="text-slate-600 italic">Ready to transform your data...</div>
        <div v-for="(l, i) in logs" :key="i" class="mb-1 text-xs whitespace-nowrap">{{ l }}</div>
      </div>
    </div>
  `
};
