import { createApp, ref, computed, onMounted } from 'vue';
import { STR, currentLang, preloadLookups } from './shared.js';
import { auth, googleProvider } from './firebase.js';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';

// Components
import Dashboard from './components/Dashboard.js';
import StockIn from './components/In.js';
import StockOut from './components/Out.js';
import Adjust from './components/Adjust.js';
import Purchase from './components/Purchase.js';
import Report from './components/Report.js';
import OutHistory from './components/OutHistory.js';
import Migrate from './components/Migrate.js';
import Settings from './components/Settings.js';

const App = {
  setup() {
    const lang = ref(currentLang());
    const currentTab = ref('dashboard');
    const user = ref(null); // Store the logged-in user
    const loadingAuth = ref(true);
    const S = computed(() => STR[lang.value]);

    // --- Authentication ---
    const login = async () => {
      try {
        await signInWithPopup(auth, googleProvider);
      } catch (e) {
        console.error(e);
        alert("Login failed: " + e.message);
      }
    };

    const logout = async () => {
      await signOut(auth);
      window.location.reload();
    };

    onMounted(() => {
      // Listen for login state changes
      onAuthStateChanged(auth, (u) => {
        user.value = u;
        loadingAuth.value = false;
        if (u) {
          preloadLookups(); // Load data only after login
        }
      });

      window.addEventListener('switch-tab', (e) => {
        if(e.detail) currentTab.value = e.detail;
      });
    });

    // --- Tabs Configuration ---
    const tabs = [
      { key: 'dashboard', label: 'dash', component: Dashboard },
      { key: 'out',       label: 'out',  component: StockOut },
      { key: 'in',        label: 'in',   component: StockIn },
      { key: 'adjust',    label: 'adj',  component: Adjust },
      { key: 'purchase',  label: 'pur',  component: Purchase }, // We will pass 'user' prop to this
      { key: 'report',    label: 'report', component: Report },
      { key: 'settings',  label: 'settings', component: Settings },
      { key: 'out_history', label: 'out', component: OutHistory },
      { key: 'migrate', label: 'Migrate', component: Migrate } 
    ];

    const activeComponent = computed(() => tabs.find(t => t.key === currentTab.value)?.component);

    const switchLang = (l) => {
      lang.value = l;
      localStorage.setItem('app_lang', l);
    };

    return { lang, S, currentTab, tabs, activeComponent, switchLang, user, login, logout, loadingAuth };
  },
  template: `
    <div class="max-w-4xl mx-auto p-4 pb-24 min-h-screen flex flex-col">
      
      <div v-if="loadingAuth" class="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
        <div class="animate-spin text-4xl mb-4">🌀</div>
        <div class="text-slate-500 font-bold">Connecting...</div>
      </div>

      <div v-else-if="!user" class="flex-1 flex flex-col items-center justify-center min-h-[70vh] space-y-8">
        <div class="text-center space-y-2">
          <h1 class="text-4xl font-black text-slate-800 tracking-tight">{{ S.title }}</h1>
          <p class="text-slate-500">Please sign in to continue</p>
        </div>
        
        <button @click="login" class="bg-white text-slate-700 border border-slate-200 px-8 py-4 rounded-2xl shadow-xl shadow-blue-900/5 font-bold text-lg flex items-center gap-3 hover:bg-slate-50 transition-transform active:scale-95">
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" class="w-6 h-6" />
          Sign in with Google
        </button>
      </div>

      <div v-else class="flex flex-col gap-6">
        
        <header class="flex justify-between items-center px-1">
          <div class="flex items-center gap-3">
             <h1 class="text-2xl font-bold text-slate-800 tracking-tight">{{ S.title }}</h1>
          </div>
          
          <div class="flex gap-2 items-center">
            <button @click="logout" class="flex items-center gap-2 bg-white pl-2 pr-4 py-1.5 rounded-full shadow-sm border border-slate-200 hover:bg-red-50 hover:border-red-100 transition-all group">
              <img :src="user.photoURL" class="w-6 h-6 rounded-full border border-slate-100" />
              <span class="text-xs font-bold text-slate-600 group-hover:text-red-500">Logout</span>
            </button>

            <div class="flex bg-white rounded-full p-1 shadow-sm border border-slate-200">
              <button @click="switchLang('th')" :class="lang==='th'?'bg-blue-500 text-white shadow':'text-slate-500 hover:bg-slate-50'" class="px-3 py-1 rounded-full text-xs font-bold transition-all">TH</button>
              <button @click="switchLang('en')" :class="lang==='en'?'bg-blue-500 text-white shadow':'text-slate-500 hover:bg-slate-50'" class="px-3 py-1 rounded-full text-xs font-bold transition-all">EN</button>
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

        <main class="flex-1">
          <transition name="fade" mode="out-in">
            <component v-if="activeComponent" :is="activeComponent" :lang="lang" :user="user" />
          </transition>
        </main>
      </div>

    </div>
  `
};

createApp(App).mount('#app');
