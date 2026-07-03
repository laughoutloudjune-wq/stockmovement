import { ref } from 'vue';
import { findOrCreateByName } from '../data.js';

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
      if (!name) return;
      saving.value = true;
      try {
        const row = await findOrCreateByName(props.table, name);
        emit('created', row);
        emit('update:modelValue', row.id);
        adding.value = false;
      } finally { saving.value = false; }
    };

    const cancelAdd = () => { adding.value = false; };

    return { adding, newName, saving, onChange, confirmAdd, cancelAdd };
  },
  template: `
    <div v-if="!adding" >
      <select :value="modelValue" @change="onChange" class="input-field">
        <option value="">{{ placeholder }}</option>
        <option v-for="o in options" :key="o.id" :value="o.id">{{ o.name }}</option>
        <option value="__new__">+ เพิ่ม{{ newLabel }}ใหม่...</option>
      </select>
    </div>
    <div v-else class="flex gap-2">
      <input v-model="newName" class="input-field" :placeholder="'ชื่อ' + newLabel + 'ใหม่'" @keyup.enter="confirmAdd" autofocus />
      <button class="btn-icon" style="background:var(--success);color:#fff;flex-shrink:0;" :disabled="saving" @click="confirmAdd"><span class="icon icon-sm">check</span></button>
      <button class="btn-icon" style="flex-shrink:0;" @click="cancelAdd"><span class="icon icon-sm">close</span></button>
    </div>
  `
};
