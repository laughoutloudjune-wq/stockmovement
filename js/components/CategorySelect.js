import { ref } from 'vue';

export default {
  props: {
    modelValue: { type: String, default: '' },
    options: { type: Array, default: () => [] },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const adding = ref(false);
    const newValue = ref('');

    const onChange = (e) => {
      if (e.target.value === '__new__') {
        adding.value = true;
        newValue.value = '';
      } else {
        emit('update:modelValue', e.target.value);
      }
    };

    const confirmAdd = () => {
      const v = newValue.value.trim();
      if (!v) return;
      emit('update:modelValue', v);
      adding.value = false;
    };
    const cancelAdd = () => { adding.value = false; };

    return { adding, newValue, onChange, confirmAdd, cancelAdd };
  },
  template: `
    <div v-if="!adding">
      <select :value="modelValue" @change="onChange" class="input-field">
        <option v-for="o in options" :key="o" :value="o">{{ o }}</option>
        <option value="__new__">+ เพิ่มหมวดหมู่ใหม่...</option>
      </select>
    </div>
    <div v-else class="flex gap-2">
      <input v-model="newValue" class="input-field" placeholder="ชื่อหมวดหมู่ใหม่" @keyup.enter="confirmAdd" autofocus />
      <button class="btn-icon" style="background:var(--success);color:#fff;flex-shrink:0;" @click="confirmAdd"><span class="icon icon-sm">check</span></button>
      <button class="btn-icon" style="flex-shrink:0;" @click="cancelAdd"><span class="icon icon-sm">close</span></button>
    </div>
  `
};
