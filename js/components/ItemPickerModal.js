import { ref, computed, onMounted } from 'vue';
import { supabase } from '../supabase.js';
import { fetchMaterials, fetchCategories } from '../data.js';
import { toast, toastError } from '../toast.js';
import { useModalOpenState } from '../modalState.js';

export default {
  props: {
    multiple: { type: Boolean, default: true },
    excludeIds: { type: Array, default: () => [] },
    confirmLabel: { type: String, default: 'เพิ่มเข้าใบเบิก' },
  },
  emits: ['close', 'confirm', 'select'],
  setup(props, { emit }) {
    useModalOpenState();
    const materials = ref([]);
    const loading = ref(true);
    const search = ref('');
    const category = ref('ทั้งหมด');
    const selected = ref(new Map());
    const categoryChips = ref(['ทั้งหมด']);

    onMounted(async () => {
      try {
        const [mats, cats] = await Promise.all([fetchMaterials(), fetchCategories()]);
        materials.value = mats;
        categoryChips.value = ['ทั้งหมด', ...cats];
      } finally { loading.value = false; }
    });

    const results = computed(() => {
      const q = search.value.trim().toLowerCase();
      return materials.value
        .filter(m => !props.excludeIds.includes(m.id) || selected.value.has(m.id))
        .filter(m => category.value === 'ทั้งหมด' || m.category === category.value)
        .filter(m => !q || m.name.toLowerCase().includes(q));
    });

    const isLow = (m) => Number(m.stock || 0) <= Number(m.min || 0);
    const isSelected = (m) => selected.value.has(m.id);

    const toggle = (m) => {
      if (props.multiple) {
        if (selected.value.has(m.id)) selected.value.delete(m.id);
        else selected.value.set(m.id, m);
        selected.value = new Map(selected.value);
      } else {
        emit('select', m);
        emit('close');
      }
    };

    const confirm = () => {
      emit('confirm', Array.from(selected.value.values()));
      emit('close');
    };

    const creating = ref(false);
    const createMaterial = async () => {
      const name = search.value.trim();
      if (!name) return;
      creating.value = true;
      try {
        const { data, error } = await supabase.from('materials').insert({ name, category: 'อื่นๆ', stock: 0, min: 5 }).select().single();
        if (error) throw error;
        toast('เพิ่มวัสดุแล้ว');
        const newMat = { ...data, category: data.category || 'อื่นๆ' };
        materials.value = [...materials.value, newMat];
        search.value = '';
        toggle(newMat);
      } catch (e) {
        toastError(e, 'เพิ่มวัสดุไม่สำเร็จ');
      } finally { creating.value = false; }
    };

    return { materials, loading, search, category, categoryChips, results, isLow, isSelected, toggle, confirm, selected, creating, createMaterial };
  },
  template: `
    <div class="scrim" @click.self="$emit('close')">
      <div class="sheet">
        <div class="sheet-handle" style="flex-shrink:0;"></div>
        <div class="flex items-center justify-between p-4" style="padding-bottom:12px; flex-shrink:0;">
          <h3 class="card-title">เลือกวัสดุ</h3>
          <button class="btn-icon" @click="$emit('close')"><span class="icon">close</span></button>
        </div>
        <div class="px-4" style="padding-bottom:12px; flex-shrink:0;">
          <div class="search-field w-full">
            <span class="icon icon-sm text-tertiary">search</span>
            <input v-model="search" placeholder="ค้นหาวัสดุ..." autofocus />
          </div>
        </div>
        <div class="flex gap-2 px-4 overflow-x-auto" style="padding-bottom:12px; flex-shrink:0;">
          <button v-for="c in categoryChips" :key="c" class="chip-filter" :class="{active: category===c}" @click="category=c">{{ c }}</button>
        </div>
        <div class="flex-1 overflow-y-auto px-4" style="min-height:200px;">
          <div v-if="loading" class="flex justify-center p-6"><span class="icon animate-spin text-secondary">refresh</span></div>
          <div v-else-if="results.length===0" class="flex flex-col items-center gap-3 text-center text-secondary text-sm p-6">
            <span>ไม่พบวัสดุ</span>
            <button v-if="search.trim()" class="btn btn-surface" :disabled="creating" @click="createMaterial">
              <span v-if="creating" class="icon animate-spin icon-sm">refresh</span>
              <span class="icon icon-sm">add</span>เพิ่ม "{{ search.trim() }}" เป็นวัสดุใหม่
            </button>
          </div>
          <div v-else class="flex flex-col gap-2" style="padding-bottom:12px;">
            <div v-for="m in results" :key="m.id" class="flex items-center gap-3 p-3" style="border-radius:14px; background:var(--field); cursor:pointer;" @click="toggle(m)">
              <div class="flex items-center justify-center" style="width:38px;height:38px;border-radius:11px;background:var(--accent-dim);color:var(--accent);flex-shrink:0;">
                <span class="icon icon-sm">inventory_2</span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-primary truncate">{{ m.name }}</div>
                <div class="text-xs truncate" :class="isLow(m) ? 'text-danger' : 'text-secondary'">
                  หมวด: {{ m.category }} · คงเหลือ {{ m.stock }}<span v-if="isLow(m)"> (ใกล้หมด)</span>
                </div>
              </div>
              <button class="btn-icon" style="flex-shrink:0;" :style="isSelected(m) ? 'background:var(--success);color:#fff;' : 'background:var(--accent);color:#fff;'">
                <span class="icon icon-sm">{{ isSelected(m) ? 'check' : 'add' }}</span>
              </button>
            </div>
          </div>
        </div>
        <div v-if="multiple" class="flex items-center justify-between p-4" style="border-top:1px solid var(--divider);">
          <span class="text-sm text-secondary">เลือกแล้ว {{ selected.size }} รายการ</span>
          <button class="btn btn-primary" :disabled="selected.size===0" @click="confirm">{{ confirmLabel }}</button>
        </div>
      </div>
    </div>
  `
};
