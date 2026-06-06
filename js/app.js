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
    const user = ref(null);
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
          try { await signInWithRedirect(auth, googleProvider); } catch (e2) {
            console.error(e2);
            alert('Sign-in failed: ' + e2.message);
          }
          return;
        }
        if (e.code === 'auth/unauthorized-domain') {
          alert(
            'This origin is not allowed for Google sign-in.\n\n' +
            'In Firebase Console → Authentication → Settings → Authorized domains, add:\n' +
            '• localhost\n• 127.0.0.1\n\nUse the same URL you opened in the browser.'
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
      try { await getRedirectResult(auth); } catch (e) { console.error(e); }

      onAuthStateChanged(auth, (u) => {
        user.value = u;
        loadingAuth.value = false;
        if (u) setupRealtimeLookups();
      });

      window.addEventListener('switch-tab', (e) => {
        if (e.detail) currentTab.value = e.detail;
      });
    });

    // --- Tabs ---
    const tabs = [
      { key: 'dashboard', icon: 'home',         label: 'dash',     component: Dashboard },
      { key: 'out',       icon: 'upload',        label: 'out',      component: StockOut },
      { key: 'in',        icon: 'download',      label: 'in',       component: StockIn },
      { key: 'adjust',    icon: 'tune',          label: 'adj',      component: Adjust },
      { key: 'purchase',  icon: 'shopping_cart', label: 'pur',      component: Purchase },
      { key: 'report',    icon: 'bar_chart',     label: 'report',   component: Report },
      { key: 'settings',  icon: 'settings',      label: 'settings', component: Settings },
      { key: 'out_history', icon: 'history',     label: 'out',      component: OutHistory },
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

      <!-- ── Loading State ── -->
      <div v-if="loadingAuth" class="flex-1 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div class="w-10 h-10 border-[3px] border-[#E8DEF8] border-t-[#6750A4] rounded-full animate-spin"></div>
        <p class="text-sm font-medium text-[#49454F]">Connecting…</p>
      </div>

      <!-- ── Login Screen ── -->
      <div v-else-if="!user" class="flex-1 flex flex-col items-center justify-center min-h-[70vh] px-6 gap-12">
        <div class="text-center space-y-3">
          <!-- Wordmark / logo area -->
          <div class="w-16 h-16 rounded-[24px] bg-[#EADDFF] flex items-center justify-center mx-auto mb-2">
            <span class="material-symbols-outlined icon-filled text-[#6750A4]" style="font-size:36px">inventory_2</span>
          </div>
          <h1 class="text-[28px] font-normal text-[#1D1B20] tracking-tight">{{ S.title }}</h1>
          <p class="text-[14px] text-[#49454F]">Sign in to continue</p>
        </div>

        <button aria-label="Sign in with Google" @click="login"
          class="md3-btn-tonal md3-ripple flex items-center gap-3 px-6 py-0 h-[56px] text-base shadow-md3-elevation-1">
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" class="w-5 h-5" />
          Sign in with Google
        </button>
      </div>

      <!-- ── Main App Shell ── -->
      <div v-else class="flex flex-col min-h-screen">

        <!-- MD3 Small Top App Bar -->
        <header class="sticky top-0 z-40 bg-[#FEF7FF] px-4 h-16 flex justify-between items-center border-b border-[#E6E0E9]">
          <h1 class="text-[22px] font-normal text-[#1D1B20] tracking-tight truncate">{{ S.title }}</h1>

          <div class="flex gap-1 items-center">
            <!-- Language Segmented Button -->
            <div class="md3-segmented shrink-0">
              <button @click="switchLang('th')"
                :class="lang==='th' ? 'active' : ''"
                class="md3-segmented-btn md3-ripple flex items-center gap-1">
                <span class="material-symbols-outlined icon-sm" style="font-size:16px">translate</span>
                TH
              </button>
              <button @click="switchLang('en')"
                :class="lang==='en' ? 'active' : ''"
                class="md3-segmented-btn md3-ripple">
                EN
              </button>
            </div>

            <!-- Profile / Logout -->
            <button aria-label="Logout" @click="logout"
              class="ml-1 w-10 h-10 rounded-full overflow-hidden border-2 border-[#6750A4] hover:opacity-80 transition-opacity md3-ripple shrink-0">
              <img :src="user.photoURL" :alt="user.displayName || 'Profile'" class="w-full h-full object-cover" />
            </button>
          </div>
        </header>

        <!-- Page Content -->
        <main class="flex-1 px-4 pb-28 md:pb-8 pt-4">
          <transition name="fade" mode="out-in">
            <component v-if="activeComponent" :is="activeComponent" :lang="lang" :user="user" />
          </transition>
        </main>

        <!-- MD3 Navigation Bar -->
        <nav v-if="!['out_history'].includes(currentTab)"
          class="fixed bottom-0 left-0 right-0 z-50 bg-[#F3EDF7] border-t border-[#E6E0E9] pb-safe">
          <div class="flex max-w-4xl mx-auto" style="height:80px">
            <button
              v-for="t in tabs.filter(x => x.key !== 'out_history')"
              :key="t.key"
              @click="currentTab = t.key"
              class="flex-1 flex flex-col items-center justify-center gap-1 md3-ripple transition-colors"
              :class="currentTab === t.key ? 'text-[#1D192B]' : 'text-[#49454F]'"
            >
              <!-- Active indicator pill -->
              <div class="md3-nav-indicator" :class="currentTab === t.key ? 'active' : 'bg-transparent'">
                <span class="material-symbols-outlined icon-sm"
                  :class="currentTab === t.key ? 'icon-filled-sm' : ''"
                  style="font-variation-settings: inherit">{{ t.icon }}</span>
              </div>
              <span style="font-size:12px; font-weight:500; line-height:1">{{ S.tabs[t.label] || t.label }}</span>
            </button>
          </div>
        </nav>

        <!-- Sub-page Top App Bar (Out History) -->
        <div v-if="currentTab === 'out_history'"
          class="fixed top-0 left-0 right-0 z-50 bg-[#FEF7FF] px-2 h-16 flex items-center gap-1 border-b border-[#E6E0E9]">
          <button @click="currentTab='out'" class="md3-icon-btn md3-ripple" aria-label="Back">
            <span class="material-symbols-outlined">arrow_back</span>
          </button>
          <span class="text-[22px] font-normal text-[#1D1B20] ml-1">{{ S.history }}</span>
        </div>

      </div>
    </div>
  `
};

// Vue transition styles injected globally
const style = document.createElement('style');
style.textContent = `
  .fade-enter-active, .fade-leave-active {
    transition: opacity 0.2s cubic-bezier(0.2,0,0,1), transform 0.2s cubic-bezier(0.2,0,0,1);
  }
  .fade-enter-from { opacity: 0; transform: translateY(8px); }
  .fade-leave-to   { opacity: 0; transform: translateY(-8px); }
`;
document.head.appendChild(style);

createApp(App).mount('#app');
