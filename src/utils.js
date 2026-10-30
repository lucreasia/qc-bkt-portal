// ============================================================================
// System Utilities & Sanitization Layer
// ============================================================================

import { createIcons, icons } from 'lucide';

// Safe HTML sanitizer to prevent Stored XSS
export function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

export const BASE_START_YEAR = 2026;

// Populate dynamic year dropdown selector
export function populateDynamicYearSelect(selectElement, allowNextYear = false) {
  if (!selectElement) return;
  const currentSavedValue = parseInt(selectElement.value, 10);
  const currentYear = new Date().getFullYear();
  const maxYear = allowNextYear ? Math.max(currentYear + 1, BASE_START_YEAR) : Math.max(currentYear, BASE_START_YEAR);
  const minYear = BASE_START_YEAR;

  selectElement.innerHTML = '';
  for (let y = maxYear; y >= minYear; y--) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = `${y + 543} (${y})`;
    selectElement.appendChild(opt);
  }

  // Restore previous selection if valid, otherwise default to currentYear
  if (currentSavedValue && currentSavedValue >= minYear && currentSavedValue <= maxYear) {
    selectElement.value = currentSavedValue;
  } else {
    selectElement.value = Math.min(Math.max(currentYear, minYear), maxYear);
  }
}

// Global Toast Notifications (XSS-Safe using textContent)
export function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `p-3.5 px-4 rounded-xl shadow-lg border text-xs font-medium flex items-center gap-2.5 transition transform translate-y-2 pointer-events-auto ${
    type === 'success' 
      ? 'bg-slate-900 text-white border-slate-700' 
      : 'bg-rose-600 text-white border-rose-700'
  }`;

  const iconName = type === 'success' ? 'check-circle-2' : 'alert-circle';
  toast.innerHTML = `<i data-lucide="${iconName}" class="w-4 h-4 ${type === 'success' ? 'text-emerald-400' : 'text-white'}"></i> <span class="toast-message-span"></span>`;

  const msgSpan = toast.querySelector('.toast-message-span');
  if (msgSpan) {
    msgSpan.textContent = message;
  }

  container.appendChild(toast);
  renderIcons(toast);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-4');
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// Convert technical Firebase/Network errors into user-friendly Thai messages
export function formatErrorMessage(err) {
  if (!err) return 'เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้ง';
  const msg = err.message || String(err);
  const code = err.code || '';

  if (code === 'permission-denied' || msg.includes('Missing or insufficient permissions')) {
    return 'ท่านไม่มีสิทธิ์ในการดำเนินการนี้ หรือระบบจำกัดการแก้ไขข้อมูล';
  }
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง';
  }
  if (code === 'auth/email-already-in-use') {
    return 'อีเมลนี้ถูกใช้งานในระบบแล้ว กรุณาใช้อีเมลอื่น';
  }
  if (code === 'auth/weak-password') {
    return 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร';
  }
  if (code === 'unavailable' || msg.includes('network-request-failed')) {
    return 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบสัญญาณอินเทอร์เน็ต';
  }
  return msg;
}

// Render Lucide icons safely from bundled npm package
export function renderIcons(root = document) {
  try {
    createIcons({
      icons,
      root: root instanceof HTMLElement ? root : document
    });
  } catch (err) {
    console.warn('[Icons Warning]:', err);
  }
}

// Keep backwards-compatible global lucide helper
if (typeof window !== 'undefined') {
  window.lucide = {
    createIcons: (options = {}) => {
      try {
        createIcons({
          icons,
          root: options.root || document,
          ...options
        });
      } catch (e) {
        console.warn('[Icons Warning]:', e);
      }
    }
  };
}

// Button loading state helper for double-submit prevention
export function setButtonLoading(button, isLoading, loadingText = 'กำลังดำเนินการ...', originalText = null) {
  if (!button) return;
  if (isLoading) {
    button.disabled = true;
    button.dataset.originalHtml = button.innerHTML;
    button.classList.add('opacity-70', 'cursor-not-allowed');
    button.innerHTML = `<span class="inline-flex items-center gap-1.5"><svg class="animate-spin h-3.5 w-3.5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg> <span>${esc(loadingText)}</span></span>`;
  } else {
    button.disabled = false;
    button.classList.remove('opacity-70', 'cursor-not-allowed');
    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    } else if (originalText) {
      button.textContent = originalText;
    }
    renderIcons(button);
  }
}
