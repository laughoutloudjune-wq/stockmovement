import { createApp, ref, computed, onMounted } from 'vue';
import { supabase } from './supabase.js';
import { openModalCount } from './modalState.js';
import Login from './components/Login.js';
import DashboardPage from './components/DashboardPage.js';
import RequestPage from './components/RequestPage.js';
import AdjustPage from './components/AdjustPage.js';
import PurchasePage from './components/PurchasePage.js';
import ReportPage from './components/ReportPage.js';
import SettingsPage from './components/SettingsPage.js';

const NAV = [
  { key: 'dashboard', icon: 'grid_view', label: 'แดชบอร์ด', component: DashboardPage },
  { key: 'request', icon: 'inventory_2', label: 'เบิกวัสดุ', component: RequestPage },
  { key: 'adjust', icon: 'tune', label: 'ปรับสต๊อก', component: AdjustPage },
  { key: 'purchase', icon: 'shopping_cart', label: 'จัดซื้อ', component: PurchasePage },
  { key: 'report', icon: 'bar_chart', label: 'รายงาน', component: ReportPage },
];
const SETTINGS_TAB = { key: 'settings', icon: 'settings', label: 'ตั้งค่า', component: SettingsPage };
const ALL_TABS = [...NAV, SETTINGS_TAB];

const App = {
  setup() {
    const session = ref(null);
    const requester = ref(null);
    const loadingAuth = ref(true);
    const theme = ref(localStorage.getItem('theme') || 'light');
    const currentTab = ref('dashboard');

    document.documentElement.setAttribute('data-theme', theme.value);

    const ensureRequesterProfile = async () => {
      const user = session.value.user;
      const { data: existing } = await supabase.from('requesters').select('*').eq('auth_user_id', user.id).maybeSingle();
      if (existing) { requester.value = existing; return; }
      const name = user.user_metadata?.name || user.email.split('@')[0];
      const { data: created, error } = await supabase
        .from('requesters')
        .insert({ auth_user_id: user.id, email: user.email, name })
        .select().single();
      if (!error) requester.value = created;
    };

    onMounted(async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      session.value = s;
      if (s) await ensureRequesterProfile();
      loadingAuth.value = false;

      supabase.auth.onAuthStateChange(async (_event, s2) => {
        session.value = s2;
        if (s2) await ensureRequesterProfile();
        else requester.value = null;
      });
    });

    const logout = async () => { await supabase.auth.signOut(); };

    const toggleTheme = () => {
      theme.value = theme.value === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', theme.value);
      document.documentElement.setAttribute('data-theme', theme.value);
    };

    const navigate = (key) => { currentTab.value = key; };
    const activeComponent = computed(() => ALL_TABS.find(t => t.key === currentTab.value)?.component);
    const initials = computed(() => (requester.value?.name || '?').trim().charAt(0).toUpperCase());

    return { session, requester, loadingAuth, theme, currentTab, NAV, SETTINGS_TAB,
             logout, toggleTheme, navigate, activeComponent, initials, openModalCount };
  },
  template: `
    <div class="app-bg-orbs"><div class="orb orb-1"></div><div class="orb orb-2"></div><div class="orb orb-3"></div></div>

    <div v-if="loadingAuth" class="flex items-center justify-center" style="min-height:100vh;">
      <span class="icon animate-spin icon-lg text-accent">refresh</span>
    </div>

    <Login v-else-if="!session" />

    <div v-else>
      <!-- Desktop sidebar -->
      <aside class="sidebar desktop-only">
        <div class="sidebar-logo">
          <div class="sidebar-logo-icon"><span class="icon icon-sm">inventory_2</span></div>
          <span class="font-bold text-base text-primary">สต๊อกวัสดุ</span>
        </div>
        <nav class="sidebar-nav">
          <button v-for="t in NAV" :key="t.key" class="nav-item" :class="{active: currentTab===t.key}" @click="navigate(t.key)">
            <span class="icon">{{ t.icon }}</span>{{ t.label }}
          </button>
          <button class="nav-item" :class="{active: currentTab===SETTINGS_TAB.key}" @click="navigate(SETTINGS_TAB.key)">
            <span class="icon">{{ SETTINGS_TAB.icon }}</span>{{ SETTINGS_TAB.label }}
          </button>
        </nav>
        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between px-2">
            <button class="btn-icon" @click="toggleTheme"><span class="icon">{{ theme==='dark' ? 'light_mode' : 'dark_mode' }}</span></button>
            <button class="btn-icon text-danger" @click="logout"><span class="icon">logout</span></button>
          </div>
          <div class="user-card">
            <div class="avatar">{{ initials }}</div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-semibold text-primary truncate">{{ requester?.name }}</div>
            </div>
          </div>
        </div>
      </aside>

      <!-- Mobile top bar -->
      <header class="mobile-only flex items-center justify-between" style="padding:16px;">
        <div class="flex items-center gap-2">
          <div class="sidebar-logo-icon" style="width:30px;height:30px;border-radius:9px;"><span class="icon icon-sm">inventory_2</span></div>
          <span class="font-bold text-base text-primary">สต๊อกวัสดุ</span>
        </div>
        <div class="flex items-center gap-2">
          <button class="btn-icon" :class="{'text-accent': currentTab===SETTINGS_TAB.key}" @click="navigate(SETTINGS_TAB.key)"><span class="icon">settings</span></button>
          <button class="btn-icon" @click="toggleTheme"><span class="icon">{{ theme==='dark' ? 'light_mode' : 'dark_mode' }}</span></button>
          <div class="avatar" style="width:32px;height:32px;font-size:13px;" @click="logout">{{ initials }}</div>
        </div>
      </header>

      <main class="main-wrapper">
        <component :is="activeComponent" :requester="requester" :key="currentTab" />
      </main>

      <!-- Mobile bottom nav (hidden while a modal/sheet is open, e.g. the item picker) -->
      <nav v-if="openModalCount===0" class="mobile-nav mobile-only">
        <button v-for="t in NAV" :key="t.key" class="mobile-tab" :class="{active: currentTab===t.key}" @click="navigate(t.key)">
          <span class="icon icon-sm">{{ t.icon }}</span>
          <span class="mobile-tab-label">{{ t.label }}</span>
        </button>
      </nav>
    </div>
  `,
  components: { Login }
};

createApp(App).mount('#app');
