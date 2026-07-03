import { ref } from 'vue';
import { findOrCreateByName } from '../data.js';
import { toastError } from '../toast.js';

export default {
  props: {
    modelValue: { type: String, default: '' },
    options: { type: Array, default: () => [] },
  },
  emits: ['update:modelValue', 'created'],
  setup(props, { emit }) {
    const adding = ref(false);
    const newValue = ref('');
    const saving = ref(false);

    const onChange = (e) => {
      if (e.target.value === '__new__') {
        adding.value = true;
        newValue.value = '';
      } else {
        emit('update:modelValue', e.target.value);
      }
    };

    const confirmAdd = async () => {
      const v = newValue.value.trim();
      if (!v) { adding.value = false; return; }
      saving.value = true;
      try {
        await findOrCreateByName('categories', v);
        emit('created', v);
        emit('update:modelValue', v);
        adding.value = false;
      } catch (e) {
        toastError(e, 'เพิ่มหมวดหมู่ไม่สำเร็จ');
      } finally { saving.value = false; }
    };
    // Commits automatically if focus leaves the field without an explicit
    // confirm/cancel click (e.g. clicking straight to an outer "add" button) —
    // otherwise the typed category silently gets lost.
    const onBlur = () => { if (adding.value) confirmAdd(); };
    const cancelAdd = () => { adding.value = false; };

    return { adding, newValue, saving, onChange, confirmAdd, cancelAdd, onBlur };
  },
  template: `
    <div v-if="!adding">
      <select :value="modelValue" @change="onChange" class="input-field">
        <option v-for="o in options" :key="o" :value="o">{{ o }}</option>
        <option value="__new__">+ เพิ่มหมวดหมู่ใหม่...</option>
      </select>
    </div>
    <div v-else style="position:relative;">
      <input v-model="newValue" class="input-field" style="padding-right:64px;" placeholder="ชื่อหมวดหมู่ใหม่" @keyup.enter="confirmAdd" @blur="onBlur" autofocus />
      <div style="position:absolute; right:4px; top:50%; transform:translateY(-50%); display:flex; gap:2px;">
        <button class="btn-icon" style="width:28px;height:28px;background:var(--success);color:#fff;" :disabled="saving" @mousedown.prevent @click="confirmAdd"><span class="icon" style="font-size:16px;">check</span></button>
        <button class="btn-icon" style="width:28px;height:28px;" @mousedown.prevent @click="cancelAdd"><span class="icon" style="font-size:16px;">close</span></button>
      </div>
    </div>
  `
};
