import { ref } from 'vue';
import { findOrCreateByName } from '../data.js';
import { toastError } from '../toast.js';

export default {
  props: {
    modelValue: { type: String, default: '' },
    options: { type: Array, default: () => [] },
    placeholder: { type: String, default: 'เลือก' },
    newLabel: { type: String, default: '' },
    table: { type: String, required: true },
  },
  emits: ['update:modelValue', 'created'],
  setup(props, { emit }) {
    const adding = ref(false);
    const newName = ref('');
    const saving = ref(false);

    const onChange = (e) => {
      if (e.target.value === '__new__') {
        adding.value = true;
        newName.value = '';
      } else {
        emit('update:modelValue', e.target.value);
      }
    };

    const confirmAdd = async () => {
      const name = newName.value.trim();
      if (!name) { adding.value = false; return; }
      saving.value = true;
      try {
        const row = await findOrCreateByName(props.table, name);
        emit('created', row);
        emit('update:modelValue', row.id);
        adding.value = false;
      } catch (e) {
        toastError(e, 'บันทึกไม่สำเร็จ');
      } finally { saving.value = false; }
    };
    // Commits automatically if focus leaves the field without an explicit
    // confirm/cancel click (e.g. clicking straight to an outer submit button) —
    // otherwise the typed name silently gets lost and the field stays empty.
    const onBlur = () => { if (adding.value) confirmAdd(); };

    const cancelAdd = () => { adding.value = false; };

    return { adding, newName, saving, onChange, confirmAdd, cancelAdd, onBlur };
  },
  template: `
    <div v-if="!adding" >
      <select :value="modelValue" @change="onChange" class="input-field">
        <option value="">{{ placeholder }}</option>
        <option v-for="o in options" :key="o.id" :value="o.id">{{ o.name }}</option>
        <option value="__new__">+ เพิ่ม{{ newLabel }}ใหม่...</option>
      </select>
    </div>
    <div v-else style="position:relative;">
      <input v-model="newName" class="input-field" style="padding-right:64px;" :placeholder="'ชื่อ' + newLabel + 'ใหม่'" @keyup.enter="confirmAdd" @blur="onBlur" autofocus />
      <div style="position:absolute; right:4px; top:50%; transform:translateY(-50%); display:flex; gap:2px;">
        <button class="btn-icon" style="width:28px;height:28px;background:var(--success);color:#fff;" :disabled="saving" @mousedown.prevent @click="confirmAdd"><span class="icon" style="font-size:16px;">check</span></button>
        <button class="btn-icon" style="width:28px;height:28px;" @mousedown.prevent @click="cancelAdd"><span class="icon" style="font-size:16px;">close</span></button>
      </div>
    </div>
  `
};
