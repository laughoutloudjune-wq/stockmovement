import { ref, onMounted, onUnmounted } from 'vue';

// Shared counter so the app shell can hide the mobile bottom nav bar while
// any full-screen sheet/modal is open, regardless of which page opened it.
export const openModalCount = ref(0);

export function useModalOpenState() {
  onMounted(() => { openModalCount.value++; });
  onUnmounted(() => { openModalCount.value--; });
}
