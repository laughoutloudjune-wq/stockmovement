let hideTimer = null;

export function toast(message, type = 'success') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.className = type === 'error' ? 'toast-error' : 'toast-success';
  const icon = type === 'error' ? '⚠' : '✓';
  el.textContent = icon + '  ' + message;
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

export function toastError(err, fallback = 'เกิดข้อผิดพลาด') {
  toast(err?.message || fallback, 'error');
}
