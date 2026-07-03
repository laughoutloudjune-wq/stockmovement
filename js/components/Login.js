import { ref } from 'vue';
import { supabase } from '../supabase.js';

export default {
  emits: ['done'],
  setup() {
    const email = ref('');
    const password = ref('');
    const loading = ref(false);
    const error = ref('');

    const submit = async () => {
      error.value = '';
      if (!email.value || !password.value) {
        error.value = 'กรุณากรอกข้อมูลให้ครบ';
        return;
      }
      loading.value = true;
      try {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.value,
          password: password.value
        });
        if (signInError) throw signInError;
      } catch (e) {
        error.value = e.message || 'เข้าสู่ระบบไม่สำเร็จ';
      } finally {
        loading.value = false;
      }
    };

    return { email, password, loading, error, submit };
  },
  template: `
    <div class="flex flex-col items-center justify-center" style="min-height:100vh; padding:24px;">
      <div class="glass-panel flex flex-col gap-5" style="width:100%; max-width:380px;">
        <div class="flex flex-col items-center gap-3 text-center">
          <div class="sidebar-logo-icon" style="width:52px; height:52px; border-radius:16px;">
            <span class="icon icon-lg">inventory_2</span>
          </div>
          <div>
            <h1 class="page-title">สต๊อกวัสดุ</h1>
            <p class="text-sm text-secondary">ระบบเบิก-จ่ายวัสดุ</p>
          </div>
        </div>

        <div class="input-group">
          <label class="input-label">อีเมล</label>
          <input v-model="email" type="email" class="input-field" placeholder="you@example.com" />
        </div>
        <div class="input-group">
          <label class="input-label">รหัสผ่าน</label>
          <input v-model="password" type="password" class="input-field" placeholder="••••••••" @keyup.enter="submit" />
        </div>

        <p v-if="error" class="text-sm text-danger">{{ error }}</p>

        <button class="btn btn-primary w-full" :disabled="loading" @click="submit">
          <span v-if="loading" class="icon animate-spin icon-sm">refresh</span>
          <span>เข้าสู่ระบบ</span>
        </button>

        <p class="text-xs text-tertiary text-center">ยังไม่มีบัญชี? ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์เข้าใช้งาน</p>
      </div>
    </div>
  `
};
