import { createApp, ref, computed, onMounted } from 'vue';
import { STR, currentLang, preloadLookups } from './shared.js';

// Components
import Dashboard from './components/Dashboard.js';
import StockIn from './components/In.js';
import StockOut from './components/Out.js';
import Adjust from './components/Adjust.js';
import Purchase from './components/Purchase.js';
import Report from './components/Report.js';
import OutHistory from './components/OutHistory.js';
import Migrate from './components/Migrate.js'; // <--- NEW

const App = {
  setup() {
    const lang = ref(currentLang());
    const currentTab = ref('dashboard');
    const S = computed(() => STR[lang.value]);

    const tabs = [
      { key: 'dashboard', label: 'dash', component: Dashboard },
      { key: 'out',       label: 'out',  component: StockOut },
      { key: 'in',        label: 'in',   component: StockIn },
      { key: 'adjust',    label: 'adj',  component: Adjust },
      { key: 'purchase',  label: 'pur',  component: Purchase },
      { key: 'report',    label: 'report', component: Report },
      { key: 'out_history', label: 'out', component: OutHistory },
      // Hidden Tab for Migration
      { key: 'migrate', label: 'Migrate', component: Migrate } 
    ];

    const activeComponent = computed(() => tabs.find(t => t.key === currentTab.value)?.component);

    const switchLang = (l) => {
      lang.value = l;
      localStorage.setItem('app_lang', l);
    };

    onMounted(() => {
      preloadLookups();
      window.addEventListener('switch-tab', (e) => {
        if(e.detail) currentTab.value = e.detail;
      });
    });

    return { lang, S, currentTab, tabs, activeComponent, switchLang };
  },
  template: `
    <div class="max-w-4xl mx-auto p-4 pb-24 min-h-screen flex flex-col gap-6">
      
      <header class="flex justify-between items-center px-1">
        <h1 class="text-2xl font-bold text-slate-800 tracking-tight">{{ S.title }}</h1>
        
        <div class="flex gap-2">
          <button @click="currentTab='migrate'" class="p-2 text-slate-300 hover:text-slate-500 transition-colors" title="Migrate DB">⚙️</button>
          
          <div class="flex bg-white rounded-full p-1 shadow-sm border border-slate-200">
            <button @click="switchLang('th')" :class="lang==='th'?'bg-blue-500 text-white shadow':'text-slate-500 hover:bg-slate-50'" class="px-4 py-1 rounded-full text-sm font-bold transition-all">TH</button>
            <button @click="switchLang('en')" :class="lang==='en'?'bg-blue-500 text-white shadow':'text-slate-500 hover:bg-slate-50'" class="px-4 py-1 rounded-full text-sm font-bold transition-all">EN</button>
          </div>
        </div>
      </header>

      <nav v-if="!['out_history','migrate'].includes(currentTab)" class="sticky top-2 z-40 glass rounded-2xl p-1.5 flex gap-1 overflow-x-auto no-scrollbar shadow-lg shadow-blue-900/5">
        <button 
          v-for="t in tabs.filter(x => !['out_history','migrate'].includes(x.key))" 
          :key="t.key"
          @click="currentTab = t.key"
          :class="currentTab === t.key ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'"
          class="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap"
        >
          {{ S.tabs[t.label] || t.label }}
        </button>
      </nav>

      <div v-if="currentTab === 'out_history'" class="sticky top-2 z-40 flex">
        <button @click="currentTab='out'" class="bg-white text-slate-600 px-4 py-2 rounded-xl shadow-sm border border-slate-200 font-bold text-sm flex items-center gap-2">⬅ Back to OUT</button>
      </div>
      <div v-if="currentTab === 'migrate'" class="sticky top-2 z-40 flex">
        <button @click="currentTab='dashboard'" class="bg-white text-slate-600 px-4 py-2 rounded-xl shadow-sm border border-slate-200 font-bold text-sm flex items-center gap-2">⬅ Back to Dashboard</button>
      </div>

      <main class="flex-1">
        <transition name="fade" mode="out-in">
          <component v-if="activeComponent" :is="activeComponent" :lang="lang" />
        </transition>
      </main>
    </div>
  `
};

createApp(App).mount('#app');
