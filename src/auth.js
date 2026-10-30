// ============================================================================
// Authentication & Session Controller
// ============================================================================

import { apiLogin, apiLogout, apiGetCurrentUser } from './firebase.js';
import { esc, showToast, formatErrorMessage, renderIcons, setButtonLoading } from './utils.js';
import { logAuditEvent, setAuditCurrentUser } from './audit.js';

let currentUserState = null;

export function getCurrentUserState() {
  return currentUserState;
}

export function setCurrentUserState(user) {
  currentUserState = user;
  setAuditCurrentUser(user);
}

// Check initial Firebase Auth session
export async function checkInitialAuth() {
  try {
    const user = await apiGetCurrentUser();
    setCurrentUserState(user);
    return user;
  } catch (err) {
    console.warn('[Auth Notice] Initial auth check failed:', err);
    setCurrentUserState(null);
    return null;
  }
}

// Update Top Navigation Bar User Information
export function updateAuthUI(user, onLogout) {
  const navUserInfo = document.getElementById('nav-user-info');
  if (!navUserInfo) return;

  if (!user) {
    navUserInfo.innerHTML = '';
    navUserInfo.classList.add('hidden');
    return;
  }

  navUserInfo.classList.remove('hidden');
  const isAdmin = (user.role === 'admin');

  navUserInfo.innerHTML = `
    <div class="flex items-center gap-3">
      <div class="text-left">
        <div class="text-xs font-bold text-slate-800">${esc(user.name || user.username)}</div>
        <div class="text-[11px] ${isAdmin ? 'text-indigo-600 font-semibold' : 'text-slate-500'} font-mono">
          ${isAdmin ? 'ADMINISTRATOR' : esc(user.code || user.memberCode || 'LAB-SITE')}
        </div>
      </div>
      <button id="nav-logout-btn" class="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-rose-600 transition flex items-center gap-1.5 shadow-2xs">
        <i data-lucide="log-out" class="w-3.5 h-3.5"></i>
        <span>ออกจากระบบ</span>
      </button>
    </div>
  `;

  document.getElementById('nav-logout-btn')?.addEventListener('click', () => {
    handleLogout(onLogout);
  });

  renderIcons(navUserInfo);
}

// Handle User Logout
export async function handleLogout(onLogoutDone) {
  const previousUser = currentUserState;
  await apiLogout();
  setCurrentUserState(null);
  showToast('ออกจากระบบเรียบร้อย');

  if (previousUser) {
    logAuditEvent(
      'USER_LOGOUT',
      'AUTH',
      previousUser.username || previousUser.email,
      `ออกจากระบบสำเร็จ`
    );
  }

  if (typeof onLogoutDone === 'function') {
    onLogoutDone();
  }
}

// Setup Login Form Controller with Double-Submit Prevention & Friendly Thai Errors
export function setupLoginController(onLoginSuccess) {
  const form = document.getElementById('login-form');
  const errBox = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-submit-btn');

  if (!form || form.dataset.authBound) return;
  form.dataset.authBound = 'true';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (errBox) errBox.classList.add('hidden');

    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    const username = usernameInput ? usernameInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';

    if (!username || !password) {
      if (errBox) {
        errBox.textContent = 'กรุณากรอกชื่อผู้ใช้งานและรหัสผ่านให้ครบถ้วน';
        errBox.classList.remove('hidden');
      }
      return;
    }

    setButtonLoading(submitBtn, true, 'กำลังเข้าสู่ระบบ...');

    try {
      const user = await apiLogin(username, password);
      setCurrentUserState(user);
      showToast(`เข้าสู่ระบบสำเร็จ: ${user.name || user.username}`);

      logAuditEvent(
        'USER_LOGIN',
        'AUTH',
        user.username || user.email,
        `เข้าสู่ระบบสำเร็จในฐานะ ${user.role === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'ผู้ใช้งานห้องปฏิบัติการ'}`
      );

      if (typeof onLoginSuccess === 'function') {
        onLoginSuccess(user);
      }
    } catch (err) {
      const friendlyMsg = formatErrorMessage(err);
      if (errBox) {
        errBox.textContent = friendlyMsg;
        errBox.classList.remove('hidden');
      }

      // Log failed authentication attempt for security audit trail
      logAuditEvent(
        'AUTH_LOGIN_FAILED',
        'AUTH',
        username,
        `การเข้าสู่ระบบล้มเหลว: ${friendlyMsg}`,
        { username, role: 'unknown', name: username }
      );
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });
}
