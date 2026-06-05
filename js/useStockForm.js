import { ref } from 'vue';
import { LOOKUPS, materialStockStyle } from './shared.js';

export function useStockForm(initialLineFn) {
  const lines = ref([initialLineFn()]);

  const addLine = () => lines.value.push(initialLineFn());

  const removeLine = (idx) => {
    if (lines.value.length > 1) {
      lines.value.splice(idx, 1);
    }
  };

  const onMaterialSelect = (line) => {
    if (!line.name) return;
    const mat = LOOKUPS.MATERIALS.find(m => m.name === line.name);
    if (mat) {
      const s = Number(mat.stock || 0);
      const m = Number(mat.min || 0);
      line.stock = materialStockStyle(s, m);
      line.sysStock = line.stock; // for Adjust
    } else {
      line.stock = null;
      line.sysStock = null;
    }
  };

  return { lines, addLine, removeLine, onMaterialSelect };
}
