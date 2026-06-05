import { createApp, ref, computed, onMounted } from 'vue';
import { STR, currentLang, setupRealtimeLookups } from './shared.js';
import { auth, googleProvider } from './firebase.js';
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';

// Components
import Dashboard from './components/Dashboard.js';
import StockIn from './components/In.js';
import StockOut from './components/Out.js';
import Adjust from './components/Adjust.js';
import Purchase from './components/Purchase.js';
import Report from './components/Report.js';
import OutHistory from './components/OutHistory.js';
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
        if (e.code === 'auth/popup-closed-by-user') return;
        if (
          e.code === 'auth/popup-blocked' ||
          e.code === 'auth/operation-not-supported-in-this-environment'
        ) {
          try {
            await signInWithRedirect(auth, googleProvider);
          } catch (e2) {
            console.error(e2);
            alert('Sign-in failed: ' + e2.message);
          }
          return;
        }
        if (e.code === 'auth/unauthorized-domain') {
          alert(
            'This origin is not allowed for Google sign-in.\n\n' +
              'In Firebase Console → Authentication → Settings → Authorized domains, add:\n' +
              '• localhost\n' +
              '• 127.0.0.1\n\n' +
              'Use the same URL you opened in the browser (localhost vs 127.0.0.1 must match).'
          );
          return;
        }
        alert('Login failed: ' + e.message);
      }
    };

    const logout = async () => {
      await signOut(auth);
      window.location.reload();
    };

    onMounted(async () => {
      try {
        await getRedirectResult(auth);
      } catch (e) {
        console.error(e);
      }

      onAuthStateChanged(auth, (u) => {
        user.value = u;
        loadingAuth.value = false;
        if (u) {
          setupRealtimeLookups();
        }
      });

      window.addEventListener('switch-tab', (e) => {
        if (e.detail) currentTab.value = e.detail;
      });
    });

    // --- Tabs Configuration ---
    const tabs = [
      { key: 'dashboard', label: 'dash', component: Dashboard },
      { key: 'out',       label: 'out',  component: StockOut },
      { key: 'in',        label: 'in',   component: StockIn },
      { key: 'adjust',    label: 'adj',  component: Adjust },
      { key: 'purchase',  label: 'pur',  component: Purchase },
      { key: 'report',    label: 'report', component: Report },
      { key: 'settings',  label: 'settings', component: Settings },
      { key: 'out_history', label: 'out', component: OutHistory }
    ];

    const activeComponent = computed(() => tabs.find(t => t.key === currentTab.value)?.component);

    const switchLang = (l) => {
      lang.value = l;
      localStorage.setItem('app_lang', l);
    };

    return { lang, S, currentTab, tabs, activeComponent, switchLang, user, login, logout, loadingAuth };
  },
  template: `
    <div class="max-w-4xl mx-auto min-h-screen flex flex-col bg-[#FEF7FF]">
      
      <!-- Loading State -->
      <div v-if="loadingAuth" class="flex-1 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div class="w-10 h-10 border-4 border-[#6750A4] border-t-transparent rounded-full animate-spin"></div>
        <div class="text-sm font-medium text-[#49454F]">Connecting...</div>
      </div>

      <!-- Login Screen -->
      <div v-else-if="!user" class="flex-1 flex flex-col items-center justify-center min-h-[70vh] px-6 gap-10">
        <div class="text-center space-y-3">
          <h1 class="text-3xl font-normal text-[#1D1B20] tracking-tight">{{ S.title }}</h1>
          <p class="text-sm text-[#49454F]">Please sign in to continue</p>
        </div>
        
        <button aria-label="Sign in with Google" @click="login"
          class="bg-[#F3EDF7] text-[#1D192B] px-6 py-4 rounded-full shadow-md3-elevation-1 font-medium text-base flex items-center gap-3 hover:bg-[#E8DEF8] active:scale-[0.98] transition-all md3-ripple">
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google Logo" class="w-5 h-5" />
          Sign in with Google
        </button>
      </div>

      <!-- Main App Shell -->
      <div v-else class="flex flex-col min-h-screen">
        
        <!-- MD3 Top App Bar -->
        <header class="sticky top-0 z-40 bg-[#FEF7FF] px-4 h-16 flex justify-between items-center transition-shadow shadow-sm">
          <h1 class="text-[22px] font-normal text-[#1D1B20]">{{ S.title }}</h1>
          
          <div class="flex gap-2 items-center">
            <!-- Language Toggle (Segmented Button Style) -->
            <div class="flex bg-[#F3EDF7] rounded-full p-0.5 border border-[#CAC4D0]">
              <button @click="switchLang('th')" :class="lang==='th' ? 'bg-[#E8DEF8] text-[#1D192B]' : 'text-[#49454F]'" class="px-4 py-1.5 rounded-full text-sm font-medium transition-colors md3-ripple">TH</button>
              <button @click="switchLang('en')" :class="lang==='en' ? 'bg-[#E8DEF8] text-[#1D192B]' : 'text-[#49454F]'" class="px-4 py-1.5 rounded-full text-sm font-medium transition-colors md3-ripple">EN</button>
            </div>

            <!-- Profile / Logout -->
            <button aria-label="Logout" @click="logout" class="w-10 h-10 rounded-full overflow-hidden border border-[#CAC4D0] hover:opacity-80 transition-opacity">
              <img :src="user.photoURL" alt="Profile" class="w-full h-full object-cover" />
            </button>
          </div>
        </header>

        <!-- Page Content -->
        <main class="flex-1 px-4 pb-28 md:pb-8 pt-4">
          <transition name="fade" mode="out-in">
            <component v-if="activeComponent" :is="activeComponent" :lang="lang" :user="user" />
          </transition>
        </main>

        <!-- MD3 Bottom Navigation Bar -->
        <nav v-if="!['out_history'].includes(currentTab)" 
          class="fixed bottom-0 left-0 right-0 z-50 bg-[#F3EDF7] pb-safe shadow-[0_-1px_3px_rgba(0,0,0,0.05)]">
          <div class="flex max-w-4xl mx-auto h-[80px]">
            <button 
              v-for="t in tabs.filter(x => x.key !== 'out_history')" 
              :key="t.key"
              @click="currentTab = t.key"
              class="flex-1 flex flex-col items-center justify-center gap-1 transition-colors relative md3-ripple"
              :class="currentTab === t.key ? 'text-[#1D192B]' : 'text-[#49454F] hover:text-[#1D1B20]'"
            >
              <!-- Active Pill -->
              <div class="w-16 h-8 rounded-full flex items-center justify-center transition-colors"
                   :class="currentTab === t.key ? 'bg-[#E8DEF8]' : 'bg-transparent'">
                <!-- Placeholder SVG Icons based on key -->
                <svg v-if="t.key==='dashboard'" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                <svg v-else-if="t.key==='out'" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
                <svg v-else-if="t.key==='in'" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
                <svg v-else-if="t.key==='adjust'" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="14 2 18 6 7 17 3 17 3 13 14 2"></polygon><line x1="3" y1="22" x2="21" y2="22"></line></svg>
                <svg v-else-if="t.key==='purchase'" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                <svg v-else-if="t.key==='report'" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                <svg v-else-if="t.key==='settings'" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              </div>
              <span class="text-[12px] font-medium leading-none">{{ S.tabs[t.label] || t.label }}</span>
            </button>
          </div>
        </nav>

        <!-- Top App Bar for Sub-pages -->
        <div v-if="currentTab === 'out_history'" class="fixed top-0 left-0 right-0 z-50 bg-[#FEF7FF] px-4 h-16 flex items-center gap-4 shadow-sm">
          <button @click="currentTab='out'" class="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#E7E0EC] transition-colors text-[#1D1B20] md3-ripple" aria-label="Back">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <span class="text-[22px] font-normal text-[#1D1B20]">{{ S.history }}</span>
        </div>
      </div>

    </div>
  `
};

createApp(App).mount('#app');
