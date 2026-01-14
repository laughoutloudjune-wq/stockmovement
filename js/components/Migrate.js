import { ref } from 'vue';
import { apiGet, toast } from '../shared.js'; // Old Backend
import { db } from '../firebase.js';           // New Backend
import { writeBatch, doc, collection, getDocs } from 'firebase/firestore';

export default {
  setup() {
    const logs = ref([]);
    const loading = ref(false);
    const progress = ref(0);

    const log = (msg) => logs.value.push(msg);

    const runMigration = async () => {
      loading.value = true;
      logs.value = [];
      progress.value = 0;
      
      try {
        log("🚀 Starting Migration...");
        
        // 1. Fetch Materials from Google Sheets
        log("📥 Fetching Materials from Google Sheets...");
        const materials = await apiGet('listMaterials');
        
        if (!materials || !Array.isArray(materials) || materials.length === 0) {
          throw new Error("No materials found in Google Sheets.");
        }
        log(`✅ Found ${materials.length} SKUs.`);

        // 2. Prepare Firebase Batch (Max 500 ops per batch)
        const batch = writeBatch(db);
        let count = 0;

        materials.forEach(name => {
          if (!name) return;
          // Create document with ID = Name (prevents duplicates)
          const ref = doc(db, 'materials', name); 
          batch.set(ref, {
            name: name,
            stock: 0,      // Default stock (Safest to start fresh or do Stock Take)
            min: 5,        // Default min limit
            updatedAt: new Date().toISOString()
          });
          count++;
        });

        // 3. Commit to Firebase
        log(`📤 Uploading ${count} items to Firestore...`);
        await batch.commit();
        
        progress.value = 100;
        log("🎉 SUCCESS! Migration Complete.");
        toast("Data Migrated Successfully");

      } catch (e) {
        console.error(e);
        log("❌ Error: " + e.message);
      } finally {
        loading.value = false;
      }
    };

    return { logs, loading, runMigration, progress };
  },
  template: `
    <div class="space-y-6 pb-20">
      <section class="glass rounded-2xl p-6 shadow-sm text-center">
        <h3 class="font-bold text-2xl text-slate-800 mb-2">🔥 Database Migration</h3>
        <p class="text-slate-500 mb-6">Move data from Google Sheets to Firebase.</p>
        
        <button 
          @click="runMigration" 
          :disabled="loading"
          class="bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-orange-500/30 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="loading" class="animate-spin inline-block mr-2">C</span>
          {{ loading ? 'Migrating...' : 'Start Migration' }}
        </button>
      </section>

      <div class="bg-slate-900 rounded-2xl p-4 font-mono text-sm text-green-400 h-64 overflow-y-auto shadow-inner border border-slate-700">
        <div v-if="logs.length === 0" class="text-slate-600 italic">Ready to start...</div>
        <div v-for="(l, i) in logs" :key="i" class="mb-1">> {{ l }}</div>
      </div>
    </div>
  `
};
