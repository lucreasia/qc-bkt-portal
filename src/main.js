// ============================================================================
// Main Application Controller (Preview Track Enabled)
// ============================================================================

import {
  apiLogin,
  apiLogout,
  apiGetCurrentUser,
  apiGetUsers,
  apiCreateUserByAdmin,
  apiUpdateUser,
  apiDeleteUser,
  apiGetTestConfigs,
  apiSaveTestConfig,
  apiDeleteTestConfig,
  apiGetMonthlyLots,
  apiSaveMonthlyLot,
  apiGetSubmissions,
  apiSaveSubmission,
  apiDeleteSubmission,
  apiInvalidateCache,
  apiAddAuditLog,
  apiGetAuditLogs,
  isFirebaseConfigured
} from './firebase.js';

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

const MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const BASE_START_YEAR = 2026;

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

let currentUser = null;
let cachedUsersList = [];
let cachedMonthlyLots = {};
let cachedAuditLogs = [];

// Helper to record audit logs without throwing
export function logAuditEvent(action, category, target, details) {
  apiAddAuditLog({
    action,
    category,
    target,
    details,
    actor: currentUser
  });
}

// ============================================================================
// UI Helper: Toast Notifications
// ============================================================================
export function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `p-3.5 px-4 rounded-xl shadow-lg border text-xs font-medium flex items-center gap-2.5 transition transform translate-y-2 pointer-events-auto ${
    type === 'success' 
      ? 'bg-slate-900 text-white border-slate-700' 
      : 'bg-rose-600 text-white border-rose-700'
  }`;
  const icon = type === 'success' ? 'check-circle-2' : 'alert-circle';
  toast.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4 text-emerald-400"></i> <span>${message}</span>`;
  container.appendChild(toast);
  
  if (window.lucide) {
    window.lucide.createIcons({ root: toast });
  }

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-4');
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// ============================================================================
// Core Initialization & Routing (Error-Safe)
// ============================================================================
export async function initApp() {
  const viewLogin = document.getElementById('view-login');
  const viewUser = document.getElementById('view-user');
  const viewAdmin = document.getElementById('view-admin');
  const navUserInfo = document.getElementById('nav-user-info');

  try {
    currentUser = await apiGetCurrentUser();
  } catch (err) {
    console.warn('apiGetCurrentUser notice:', err);
    currentUser = null;
  }

  viewLogin.classList.add('hidden');
  viewUser.classList.add('hidden');
  viewAdmin.classList.add('hidden');

  if (!currentUser) {
    // Show Login View Immediately
    viewLogin.classList.remove('hidden');
    navUserInfo.innerHTML = '';
    navUserInfo.classList.add('hidden');
  } else if (currentUser.role === 'admin') {
    viewAdmin.classList.remove('hidden');
    navUserInfo.classList.remove('hidden');
    navUserInfo.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="text-left">
          <div class="text-xs font-bold text-slate-800">${esc(currentUser.name || currentUser.username)}</div>
          <div class="text-[11px] text-indigo-600 font-semibold font-mono">ADMINISTRATOR</div>
        </div>
        <button id="nav-logout-btn" class="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-rose-600 transition flex items-center gap-1.5">
          <i data-lucide="log-out" class="w-3.5 h-3.5"></i>
          <span>ออกจากระบบ</span>
        </button>
      </div>
    `;
    document.getElementById('nav-logout-btn')?.addEventListener('click', handleLogout);
    initAdminView();
  } else {
    viewUser.classList.remove('hidden');
    navUserInfo.classList.remove('hidden');
    navUserInfo.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="text-left">
          <div class="text-xs font-bold text-slate-800">${esc(currentUser.name || currentUser.username)}</div>
          <div class="text-[11px] text-slate-500 font-mono">${esc(currentUser.code || currentUser.memberCode || 'LAB-SITE')}</div>
        </div>
        <button id="nav-logout-btn" class="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-rose-600 transition flex items-center gap-1.5">
          <i data-lucide="log-out" class="w-3.5 h-3.5"></i>
          <span>ออกจากระบบ</span>
        </button>
      </div>
    `;
    document.getElementById('nav-logout-btn')?.addEventListener('click', handleLogout);
    renderUserDashboard();
  }

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

async function handleLogout() {
  await apiLogout();
  currentUser = null;
  showToast('ออกจากระบบเรียบร้อย');
  initApp();
}

// ============================================================================
// Login Controller
// ============================================================================
function setupLoginController() {
  const form = document.getElementById('login-form');
  const errBox = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-submit-btn');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    errBox.classList.add('hidden');
    submitBtn.disabled = true;
    submitBtn.classList.add('opacity-70');

    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {
      const user = await apiLogin(username, password);
      showToast(`เข้าสู่ระบบสำเร็จ: ${user.name || user.username}`);
      logAuditEvent(
        'USER_LOGIN',
        'AUTH',
        user.username || user.email,
        `เข้าสู่ระบบสำเร็จในฐานะ ${user.role === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'ผู้ใช้งานห้องปฏิบัติการ'}`
      );
      initApp();
    } catch (err) {
      errBox.textContent = err.message || 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง';
      errBox.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.classList.remove('opacity-70');
    }
  });
}

// ============================================================================
// User Dashboard Controller (New 2-Tier Structured Layout)
// ============================================================================
let userSubmittedOpen = true;
let userOthersOpen = false;

function setupUserCollapsibleSections() {
  const toggleSubBtn = document.getElementById('u-toggle-submitted-btn');
  const toggleOthBtn = document.getElementById('u-toggle-others-btn');

  if (toggleSubBtn && !toggleSubBtn.dataset.bound) {
    toggleSubBtn.dataset.bound = 'true';
    toggleSubBtn.addEventListener('click', () => {
      userSubmittedOpen = !userSubmittedOpen;
      const wrap = document.getElementById('u-submitted-grid-wrap');
      const label = document.getElementById('u-label-submitted-toggle');
      const icon = document.getElementById('u-icon-submitted-toggle');
      if (wrap) wrap.classList.toggle('hidden', !userSubmittedOpen);
      if (label) label.textContent = userSubmittedOpen ? 'ซ่อนรายการ' : 'ขยายดูรายการ';
      if (icon) icon.style.transform = userSubmittedOpen ? 'rotate(0deg)' : 'rotate(180deg)';
    });
  }

  if (toggleOthBtn && !toggleOthBtn.dataset.bound) {
    toggleOthBtn.dataset.bound = 'true';
    toggleOthBtn.addEventListener('click', () => {
      userOthersOpen = !userOthersOpen;
      const wrap = document.getElementById('u-others-grid-wrap');
      const label = document.getElementById('u-label-others-toggle');
      const icon = document.getElementById('u-icon-others-toggle');
      if (wrap) wrap.classList.toggle('hidden', !userOthersOpen);
      if (label) label.textContent = userOthersOpen ? 'ซ่อนรายการ' : 'ขยายดูรายการ';
      if (icon) icon.style.transform = userOthersOpen ? 'rotate(180deg)' : 'rotate(0deg)';
    });
  }
}

async function renderUserDashboard() {
  if (!currentUser) return;

  setupUserCollapsibleSections();

  const yearSelect = document.getElementById('u-year-select');
  if (yearSelect && yearSelect.children.length === 0) {
    populateDynamicYearSelect(yearSelect, false);
  }
  const selectedYear = parseInt(yearSelect?.value, 10) || new Date().getFullYear();
  const submissions = await apiGetSubmissions();
  const testConfigs = await apiGetTestConfigs();
  cachedMonthlyLots = await apiGetMonthlyLots(false);

  const today = new Date();
  const realYear = today.getFullYear();
  const realMonth = today.getMonth();

  document.getElementById('u-org-name').textContent = currentUser.name || currentUser.orgName || currentUser.username;
  document.getElementById('u-member-id').textContent = currentUser.code || currentUser.memberCode || 'LAB-001';
  document.getElementById('u-org-address').textContent = currentUser.department || 'แผนกห้องปฏิบัติการมาตรฐาน';
  document.getElementById('u-contact-person').textContent = currentUser.contact || currentUser.contactPerson || 'เจ้าหน้าที่ผู้รับผิดชอบ';
  document.getElementById('u-current-year').textContent = `${selectedYear + 543} (${selectedYear})`;

  const userKey = currentUser.username || currentUser.email?.split('@')[0];

  let submittedCount = 0;
  for (let m = 0; m < 12; m++) {
    const key = `${userKey}_${selectedYear}_${m}`;
    if (submissions[key]) submittedCount++;
  }
  document.getElementById('u-stat-submitted').textContent = submittedCount;
  document.getElementById('u-stat-pending').textContent = 12 - submittedCount;

  // Containers
  const activeContainer = document.getElementById('u-active-month-container');
  const submittedGrid = document.getElementById('u-submitted-grid');
  const othersGrid = document.getElementById('u-others-grid');
  const badgeSubCount = document.getElementById('u-badge-submitted-count');
  const badgeOthCount = document.getElementById('u-badge-others-count');

  if (activeContainer) activeContainer.innerHTML = '';
  if (submittedGrid) submittedGrid.innerHTML = '';
  if (othersGrid) othersGrid.innerHTML = '';

  let submittedCardsCount = 0;
  let othersCardsCount = 0;

  // 1. Build Top Active Month Banner (Current Month: realMonth if viewing current year)
  const isViewingCurrentYear = (selectedYear === realYear);
  const activeMonthIdx = isViewingCurrentYear ? realMonth : null;

  if (activeMonthIdx !== null) {
    const activeMonthKey = `${userKey}_${selectedYear}_${activeMonthIdx}`;
    const activeLotKey = `${selectedYear}_${activeMonthIdx}`;
    const activeLotInfo = cachedMonthlyLots[activeLotKey];
    const activeSub = submissions[activeMonthKey];
    const isActiveSubmitted = !!activeSub;

    const heroBanner = document.createElement('div');
    heroBanner.className = `p-6 rounded-3xl border transition shadow-sm ${
      isActiveSubmitted 
        ? 'bg-gradient-to-br from-white via-emerald-50/20 to-emerald-100/30 border-emerald-300' 
        : 'bg-gradient-to-br from-white via-sky-50/30 to-indigo-50/40 border-sky-300 ring-2 ring-sky-200/50'
    }`;

    let summaryBadges = '';
    if (isActiveSubmitted) {
      const summaryItems = [];
      testConfigs.forEach(t => {
        const testRes = activeSub.results?.[t.id];
        if (testRes) {
          const mKeys = Object.keys(testRes);
          mKeys.forEach(mKey => {
            const mData = testRes[mKey];
            const lvDetails = Object.entries(mData).map(([lv, val]) => `${lv}: ${val}`).join(', ');
            summaryItems.push(`
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white border border-slate-200 text-xs shadow-2xs">
                <span class="font-semibold text-slate-700">${esc(t.name)}</span>
                <span class="text-slate-400 font-mono text-[11px]">(${mKey})</span>
                <span class="font-bold text-indigo-700">${esc(lvDetails)} ${esc(t.unit || '')}</span>
              </span>
            `);
          });
        }
      });
      summaryBadges = `
        <div class="mt-4 pt-4 border-t border-slate-100">
          <div class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">สรุปผลที่รายงานไว้ล่าสุด:</div>
          <div class="flex flex-wrap gap-2">${summaryItems.join('')}</div>
          <div class="text-[11px] text-slate-400 mt-2.5 flex items-center gap-1.5">
            <i data-lucide="clock" class="w-3.5 h-3.5"></i>
            <span>บันทึกเมื่อ: ${esc(activeSub.submittedAt)}</span>
          </div>
        </div>
      `;
    }

    heroBanner.innerHTML = `
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 mb-2">
            <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
              isActiveSubmitted 
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                : 'bg-sky-100 text-sky-800 border border-sky-300 animate-pulse'
            }">
              <i data-lucide="${isActiveSubmitted ? 'check-circle' : 'sparkles'}" class="w-3.5 h-3.5"></i>
              <span>${isActiveSubmitted ? 'บันทึกผลประจำเดือนนี้เรียบร้อยแล้ว' : 'รอบประจำเดือนที่ต้องลงผลในขณะนี้'}</span>
            </span>
            ${activeLotInfo?.lotNumber ? `<span class="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">LOT: ${esc(activeLotInfo.lotNumber)}</span>` : ''}
          </div>
          <h2 class="text-2xl font-bold text-slate-900 leading-tight">
            ประจำเดือน ${MONTH_NAMES[activeMonthIdx]} ${selectedYear + 543}
          </h2>
          <p class="text-xs text-slate-500 mt-1">
            ${isActiveSubmitted 
              ? 'คุณได้ทำการส่งข้อมูลผลการทดสอบของรอบนี้แล้ว สามารถคลิกดูผลหรือกดแก้ไขข้อมูลได้ตลอดระยะเวลาที่เปิดรับ' 
              : 'เปิดรับรายงานผลการทดสอบ กรุณากรอกข้อมูลผลการตรวจวัดให้ครบถ้วนตามรายการที่กำหนด'
            }
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2.5 self-start md:self-center">
          ${isActiveSubmitted ? `
            <button id="hero-view-btn" class="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 text-xs font-semibold shadow-2xs transition flex items-center gap-2">
              <i data-lucide="eye" class="w-4 h-4 text-slate-500"></i>
              <span>ดูผลที่ส่ง</span>
            </button>
            <button id="hero-edit-btn" class="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-600/20 transition flex items-center gap-2">
              <i data-lucide="edit-3" class="w-4 h-4"></i>
              <span>แก้ไขผลการทดสอบ</span>
            </button>
          ` : `
            <button id="hero-enter-btn" class="px-6 py-3 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-sky-600/25 transition transform hover:-translate-y-0.5 flex items-center gap-2">
              <i data-lucide="plus-circle" class="w-5 h-5"></i>
              <span>บันทึกผลการทดสอบประจำเดือน ${MONTH_NAMES[activeMonthIdx]}</span>
            </button>
          `}
        </div>
      </div>
      ${summaryBadges}
    `;

    activeContainer.appendChild(heroBanner);

    // Event bindings for hero action buttons
    document.getElementById('hero-view-btn')?.addEventListener('click', () => openEntryModal(userKey, selectedYear, activeMonthIdx, true));
    document.getElementById('hero-edit-btn')?.addEventListener('click', () => openEntryModal(userKey, selectedYear, activeMonthIdx, false));
    document.getElementById('hero-enter-btn')?.addEventListener('click', () => openEntryModal(userKey, selectedYear, activeMonthIdx, false));
  } else {
    // If not viewing current year (e.g. past year), show info banner
    const noticeBanner = document.createElement('div');
    noticeBanner.className = 'p-5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-600 text-xs flex items-center justify-between';
    noticeBanner.innerHTML = `
      <div class="flex items-center gap-3">
        <i data-lucide="calendar" class="w-5 h-5 text-slate-400"></i>
        <div>
          <span class="font-bold text-slate-800">กำลังดูข้อมูลย้อนหลังประจำปี ${selectedYear + 543}</span>
          <p class="text-slate-400 mt-0.5">การบันทึกผลรอบปัจจุบันจะเปิดให้ลงผลเฉพาะในปีปัจจุบันเท่านั้น</p>
        </div>
      </div>
    `;
    activeContainer.appendChild(noticeBanner);
  }

  // Helper to create compact month card
  function createMonthCard(m, sub, lotInfo, isPastMonth, isSubmitted) {
    const card = document.createElement('div');
    card.className = `p-4 rounded-2xl border transition-all ${
      isSubmitted 
        ? 'bg-white border-emerald-200/90 shadow-2xs hover:shadow-xs' 
        : 'bg-white border-slate-200/80 opacity-90'
    }`;

    let statusBadgeHtml = '';
    if (isSubmitted) {
      statusBadgeHtml = `
        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <i data-lucide="check" class="w-3 h-3"></i> ส่งแล้ว
        </span>
      `;
    } else {
      statusBadgeHtml = `
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
          <i data-lucide="lock" class="w-3 h-3"></i> ปิดรอบแล้ว
        </span>
      `;
    }

    let cardContentHtml = '';
    if (isSubmitted) {
      cardContentHtml = `
        <div class="mt-2.5 pt-2.5 border-t border-slate-100 text-xs">
          ${lotInfo?.lotNumber ? `<div class="text-[11px] font-mono text-indigo-600 font-bold mb-1">LOT: ${esc(lotInfo.lotNumber)}</div>` : ''}
          <div class="text-[11px] text-slate-400 flex items-center justify-between mt-1">
            <span>ส่งเมื่อ: ${esc(sub.submittedAt || '-')}</span>
          </div>
        </div>
      `;
    } else {
      cardContentHtml = `
        <div class="mt-2.5 pt-2.5 border-t border-slate-100 text-xs text-slate-400">
          ${lotInfo?.lotNumber ? `<div class="text-[11px] font-mono text-indigo-500 font-medium mb-1">LOT: ${esc(lotInfo.lotNumber)}</div>` : ''}
          <p class="text-[11px]">สิ้นสุดระยะเวลาการรายงานผล</p>
        </div>
      `;
    }

    const actionDiv = document.createElement('div');
    actionDiv.className = 'mt-3 pt-2.5 border-t border-slate-100';

    if (isSubmitted) {
      const viewBtn = document.createElement('button');
      viewBtn.className = 'w-full py-1.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-lg border border-slate-200 transition flex items-center justify-center gap-1.5';
      viewBtn.innerHTML = '<i data-lucide="eye" class="w-3.5 h-3.5 text-slate-500"></i> ตรวจสอบผลย้อนหลัง';
      viewBtn.onclick = () => openEntryModal(userKey, selectedYear, m, true);
      actionDiv.appendChild(viewBtn);
    } else {
      const disabledBtn = document.createElement('button');
      disabledBtn.disabled = true;
      disabledBtn.className = 'w-full py-1.5 px-3 bg-slate-50 text-slate-400 text-xs font-medium rounded-lg cursor-not-allowed flex items-center justify-center gap-1.5 border border-slate-100';
      disabledBtn.innerHTML = '<i data-lucide="lock" class="w-3 h-3"></i> ปิดรับรายงาน';
      actionDiv.appendChild(disabledBtn);
    }

    card.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="font-bold text-slate-800 text-sm">
          ${MONTH_NAMES[m]} ${selectedYear + 543}
        </div>
        ${statusBadgeHtml}
      </div>
      ${cardContentHtml}
    `;
    card.appendChild(actionDiv);
    return card;
  }

  // 2. Iterate months to distribute into Section 1 (Submitted) and Section 2 (Past Months)
  // Approach 2: Only show past months that have occurred; do NOT show future unopened months
  for (let m = 0; m < 12; m++) {
    const monthKey = `${userKey}_${selectedYear}_${m}`;
    const lotKey = `${selectedYear}_${m}`;
    const lotInfo = cachedMonthlyLots[lotKey];
    const sub = submissions[monthKey];
    const isSubmitted = !!sub;

    let isPastMonth = false;
    let isCurrentMonth = false;

    if (selectedYear < realYear) {
      isPastMonth = true;
    } else if (selectedYear === realYear) {
      if (m < realMonth) isPastMonth = true;
      else if (m === realMonth) isCurrentMonth = true;
    }

    // Skip future months in Section 1 and Section 2 completely (as per user choice Approach 2)
    const isFutureMonth = (selectedYear > realYear) || (selectedYear === realYear && m > realMonth);
    if (isFutureMonth) {
      continue;
    }

    // A. If submitted -> Add to Section 1 (Submitted Months)
    if (isSubmitted) {
      submittedCardsCount++;
      const card = createMonthCard(m, sub, lotInfo, isPastMonth, true);
      submittedGrid.appendChild(card);
    }

    // B. If past month and NOT submitted -> Add to Section 2 (Past Unsubmitted Months)
    if (isPastMonth && !isSubmitted) {
      othersCardsCount++;
      const card = createMonthCard(m, sub, lotInfo, true, false);
      othersGrid.appendChild(card);
    }
  }

  // Update Section Badges
  if (badgeSubCount) badgeSubCount.textContent = `${submittedCardsCount} รอบ`;
  if (badgeOthCount) badgeOthCount.textContent = `${othersCardsCount} รอบ`;

  // Empty state handling
  if (submittedCardsCount === 0 && submittedGrid) {
    submittedGrid.innerHTML = `
      <div class="col-span-full py-8 text-center text-slate-400 text-xs">
        <i data-lucide="file-question" class="w-8 h-8 mx-auto mb-2 text-slate-300"></i>
        <div>ยังไม่มีรอบที่บันทึกผลสำเร็จในปีนี้</div>
      </div>
    `;
  }

  if (othersCardsCount === 0 && othersGrid) {
    othersGrid.innerHTML = `
      <div class="col-span-full py-8 text-center text-slate-400 text-xs">
        <i data-lucide="check-check" class="w-8 h-8 mx-auto mb-2 text-emerald-400"></i>
        <div>ไม่มีรอบเดือนเก่าที่ค้างส่ง (รายงานครบถ้วนทุกรอบที่ผ่านมา)</div>
      </div>
    `;
  }

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// ============================================================================
// Multi-Level & Multi-Machine Entry Modal Controller
// ============================================================================

// ============================================================================
// Multi-Level & Multi-Machine Entry Modal Controller
// ============================================================================
let currentEditingSubmission = null;
let currentModalTestConfigs = [];
let currentMachineCounts = {}; // { testId: number_of_machines }

async function openEntryModal(username, year, monthIndex, isReadOnly = false) {
  const monthKey = `${username}_${year}_${monthIndex}`;
  const lotKey = `${year}_${monthIndex}`;
  const submissions = await apiGetSubmissions();
  const existing = submissions[monthKey];
  currentEditingSubmission = existing;
  currentModalTestConfigs = await apiGetTestConfigs();
  cachedMonthlyLots = await apiGetMonthlyLots(currentUser?.role === 'admin');
  const lotInfo = cachedMonthlyLots[lotKey];

  document.getElementById('entry-month-key').value = monthKey;
  document.getElementById('modal-entry-title').textContent = `แบบบันทึกผลการทดสอบประจำเดือน ${MONTH_NAMES[monthIndex]} ${year + 543} (${year})`;
  document.getElementById('modal-entry-subtitle').textContent = `หน่วยงาน: ${username.toUpperCase()}`;
  document.getElementById('modal-lot-badge').textContent = lotInfo?.lotNumber ? `LOT: ${lotInfo.lotNumber}` : 'LOT: ไม่ระบุ';

  const badge = document.getElementById('modal-mode-badge');
  const saveBtn = document.getElementById('btn-save-entry');
  const historyMeta = document.getElementById('entry-history-meta');

  if (isReadOnly) {
    badge.textContent = 'ตรวจสอบผลย้อนหลัง (ไม่อนุญาตให้แก้ไข)';
    badge.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 uppercase tracking-wider';
    saveBtn.classList.add('hidden');
  } else {
    badge.textContent = existing ? 'แก้ไขผลการทดสอบ' : 'บันทึกผลการทดสอบใหม่';
    badge.className = existing 
      ? 'px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wider'
      : 'px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-700 uppercase tracking-wider';
    saveBtn.classList.remove('hidden');
  }

  if (existing) {
    historyMeta.classList.remove('hidden');
    document.getElementById('entry-submitted-at').textContent = `บันทึกเมื่อ: ${existing.submittedAt}`;
    document.getElementById('entry-submitted-by').textContent = `ผู้บันทึก: ${username}`;
  } else {
    historyMeta.classList.add('hidden');
  }

  // Render Dynamic Multi-Level & Multi-Machine Container
  renderDynamicModalFields(isReadOnly);

  const remarksInput = document.getElementById('entry-remarks');
  remarksInput.value = existing ? (existing.remarks || '') : '';
  remarksInput.disabled = isReadOnly;

  document.getElementById('modal-entry').classList.remove('hidden');
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function renderDynamicModalFields(isReadOnly) {
  const container = document.getElementById('dynamic-test-fields');
  container.innerHTML = '';
  currentMachineCounts = {};

  currentModalTestConfigs.forEach((test, idx) => {
    const existingTestRes = currentEditingSubmission?.results?.[test.id] || {};
    // Determine existing machines or default to 1 machine
    const existingMachineKeys = Object.keys(existingTestRes);
    const initialMachineCount = existingMachineKeys.length > 0 ? existingMachineKeys.length : 1;
    currentMachineCounts[test.id] = initialMachineCount;

    const fieldCard = document.createElement('div');
    fieldCard.className = 'p-5 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-4';
    fieldCard.id = `test-wrapper-${test.id}`;

    // Header with badge
    fieldCard.innerHTML = `
      <div class="flex items-center justify-between border-b border-slate-200/80 pb-3">
        <div>
          <div class="flex items-center gap-2">
            <span class="w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-mono font-bold">${idx + 1}</span>
            <h4 class="text-sm font-bold text-slate-800">${test.name}</h4>
            <span class="text-xs text-slate-400 font-mono">[${test.key}]</span>
          </div>
          ${test.description ? `<p class="text-xs text-slate-500 pl-8 mt-0.5">${test.description}</p>` : ''}
        </div>
        <div class="flex items-center gap-2">
          ${test.enableLevels ? `<span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">${test.levels.length} Levels</span>` : ''}
          ${test.enableMultiMachine ? `<span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">หลายเครื่องตรวจ (สูงสุด ${test.maxMachines || 3})</span>` : ''}
        </div>
      </div>
      <div id="machines-container-${test.id}" class="space-y-4 pl-2 sm:pl-4"></div>
    `;

    // Add Machine Button if Multi-Machine enabled
    if (test.enableMultiMachine && !isReadOnly) {
      const addMachineBtnWrap = document.createElement('div');
      addMachineBtnWrap.className = 'pt-2 flex justify-end';
      const addMBtn = document.createElement('button');
      addMBtn.type = 'button';
      addMBtn.className = 'px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold transition flex items-center gap-1.5 shadow-sm';
      addMBtn.innerHTML = '<i data-lucide="plus" class="w-3.5 h-3.5"></i> <span>+ เพิ่มเครื่องตรวจวัด</span>';
      addMBtn.onclick = () => {
        if (currentMachineCounts[test.id] >= (test.maxMachines || 3)) {
          alert(`รายการทดสอบนี้กำหนดให้บันทึกได้สูงสุด ${test.maxMachines || 3} เครื่องค่ะ`);
          return;
        }
        currentMachineCounts[test.id]++;
        renderMachinesForTest(test, isReadOnly);
      };
      addMachineBtnWrap.appendChild(addMBtn);
      fieldCard.appendChild(addMachineBtnWrap);
    }

    container.appendChild(fieldCard);
    renderMachinesForTest(test, isReadOnly);
  });
}

function renderMachinesForTest(test, isReadOnly) {
  const container = document.getElementById(`machines-container-${test.id}`);
  if (!container) return;
  container.innerHTML = '';

  const count = currentMachineCounts[test.id] || 1;
  const levels = test.enableLevels && test.levels?.length > 0 ? test.levels : ['Result'];
  const existingTestRes = currentEditingSubmission?.results?.[test.id] || {};

  for (let m = 1; m <= count; m++) {
    const machineName = `เครื่องที่ ${m}`;
    const machineRes = existingTestRes[machineName] || {};

    const machineBox = document.createElement('div');
    machineBox.className = 'p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm space-y-3';

    // Header of machine box
    machineBox.innerHTML = `
      <div class="flex items-center justify-between border-b border-slate-100 pb-2">
        <span class="text-xs font-bold text-slate-700 flex items-center gap-1.5 font-mono">
          <i data-lucide="cpu" class="w-3.5 h-3.5 text-indigo-500"></i> ${machineName}
        </span>
        ${(count > 1 && !isReadOnly && m === count) ? `
          <button type="button" class="text-xs text-rose-500 hover:text-rose-700 flex items-center gap-1" onclick="removeLastMachine('${test.id}')">
            <i data-lucide="trash-2" class="w-3 h-3"></i> ลบเครื่องนี้
          </button>
        ` : ''}
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-${Math.min(levels.length, 3)} gap-3" id="levels-row-${test.id}-${m}"></div>
    `;

    const levelsRow = machineBox.querySelector(`#levels-row-${test.id}-${m}`);
    levels.forEach(lv => {
      const fieldId = `input_${test.id}_m${m}_${lv}`;
      const savedVal = machineRes[lv] || '';
      const lvCol = document.createElement('div');
      lvCol.className = 'space-y-1';

      let inputHtml = '';
      if (test.type === 'select') {
        const optionsHtml = (test.options || []).map(opt => {
          return `<option value="${opt}" ${savedVal === opt ? 'selected' : ''}>${opt}</option>`;
        }).join('');
        inputHtml = `
          <select id="${fieldId}" ${isReadOnly ? 'disabled' : 'required'} class="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100">
            <option value="">-- เลือก --</option>
            ${optionsHtml}
          </select>
        `;
      } else if (test.type === 'number') {
        inputHtml = `
          <div class="relative">
            <input type="number" step="any" id="${fieldId}" value="${savedVal}" ${isReadOnly ? 'disabled' : 'required'} placeholder="ระบุตัวเลข" class="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 pr-12 focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100">
            ${test.unit ? `<span class="absolute inset-y-0 right-0 pr-2 flex items-center text-[11px] font-semibold text-slate-400 pointer-events-none">${test.unit}</span>` : ''}
          </div>
        `;
      } else {
        inputHtml = `
          <input type="text" id="${fieldId}" value="${savedVal}" ${isReadOnly ? 'disabled' : 'required'} placeholder="พิมพ์คำตอบ" class="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100">
        `;
      }

      lvCol.innerHTML = `
        <label class="block text-[11px] font-bold text-slate-600">${lv}</label>
        ${inputHtml}
      `;
      levelsRow.appendChild(lvCol);
    });

    container.appendChild(machineBox);
  }

  if (window.lucide) {
    window.lucide.createIcons({ root: container });
  }
}

window.removeLastMachine = function(testId) {
  if (currentMachineCounts[testId] > 1) {
    currentMachineCounts[testId]--;
    const test = currentModalTestConfigs.find(t => t.id === testId);
    if (test) renderMachinesForTest(test, false);
  }
};

function closeEntryModal() {
  document.getElementById('modal-entry').classList.add('hidden');
}

async function handleSaveSubmission(event) {
  event.preventDefault();
  const monthKey = document.getElementById('entry-month-key').value;
  const [username, yearStr, monthIdxStr] = monthKey.split('_');
  const year = parseInt(yearStr);
  const monthIndex = parseInt(monthIdxStr);

  const results = {};
  currentModalTestConfigs.forEach(test => {
    const count = currentMachineCounts[test.id] || 1;
    const levels = test.enableLevels && test.levels?.length > 0 ? test.levels : ['Result'];
    const testObj = {};

    for (let m = 1; m <= count; m++) {
      const machineName = `เครื่องที่ ${m}`;
      const mObj = {};
      levels.forEach(lv => {
        const field = document.getElementById(`input_${test.id}_m${m}_${lv}`);
        mObj[lv] = field ? field.value.trim() : '';
      });
      testObj[machineName] = mObj;
    }
    results[test.id] = testObj;
  });

  const remarks = document.getElementById('entry-remarks').value.trim();
  const now = new Date();
  const pad = n => n.toString().padStart(2, '0');
  const timeStamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const payload = {
    userId: currentUser?.uid || `uid_${username}`,
    username,
    year,
    monthIndex,
    results,
    remarks,
    submittedAt: timeStamp
  };

  const isEdit = Boolean(currentEditingSubmission);
  await apiSaveSubmission(monthKey, payload);
  closeEntryModal();
  showToast(`บันทึกผลการทดสอบประจำเดือน ${MONTH_NAMES[monthIndex]} สำเร็จ`);

  logAuditEvent(
    isEdit ? 'SUBMISSION_UPDATE' : 'SUBMISSION_CREATE',
    'SUBMISSION',
    `${username} (${year}-${monthIndex + 1})`,
    `${currentUser.role === 'admin' ? '[ผู้ดูแลระบบแก้ไขแทน] ' : ''}${isEdit ? 'แก้ไขผลการทดสอบ' : 'ส่งผลการทดสอบใหม่'} ประจำเดือน ${MONTH_NAMES[monthIndex]} ${year + 543}`
  );

  if (currentUser.role === 'admin') {
    renderAdminResultsTable();
  } else {
    renderUserDashboard();
  }
}

// ============================================================================
// Admin Portal Controller
// ============================================================================
async function initAdminView() {
  const monthSelect = document.getElementById('admin-filter-month');
  if (monthSelect.children.length <= 1) {
    MONTH_NAMES.forEach((name, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = name;
      monthSelect.appendChild(opt);
    });
  }

  // Populate Lot month selector
  const lotMonthSelect = document.getElementById('lot-select-month');
  if (lotMonthSelect.children.length === 0) {
    MONTH_NAMES.forEach((name, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = name;
      lotMonthSelect.appendChild(opt);
    });
    lotMonthSelect.value = new Date().getMonth();
  }

  // Populate dynamic year selectors for Admin Portal
  const matrixYearSelect = document.getElementById('matrix-filter-year');
  if (matrixYearSelect && matrixYearSelect.children.length === 0) {
    populateDynamicYearSelect(matrixYearSelect, false);
  }

  const adminYearSelect = document.getElementById('admin-filter-year');
  if (adminYearSelect && adminYearSelect.children.length === 0) {
    populateDynamicYearSelect(adminYearSelect, false);
  }

  const lotYearSelect = document.getElementById('lot-select-year');
  if (lotYearSelect && lotYearSelect.children.length === 0) {
    populateDynamicYearSelect(lotYearSelect, true); // Allow setting up next year's lot in advance
  }

  await loadAdminUsersDropdown();
  renderSubmissionMatrix();
}

async function loadAdminUsersDropdown() {
  cachedUsersList = await apiGetUsers();
  const userSelect = document.getElementById('admin-filter-user');
  if (!userSelect) return;
  userSelect.innerHTML = '<option value="ALL">-- ทุกหน่วยงานที่ลงทะเบียน --</option>';

  cachedUsersList.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.username || u.email?.split('@')[0];
    opt.textContent = `${esc(u.name)} (${esc(u.code || u.username)})`;
    userSelect.appendChild(opt);
  });
}

function switchAdminTab(tabName) {
  const matrixTab = document.getElementById('admin-tab-matrix');
  const resultsTab = document.getElementById('admin-tab-results');
  const configTab = document.getElementById('admin-tab-config');
  const lotsTab = document.getElementById('admin-tab-lots');
  const usersTab = document.getElementById('admin-tab-users');

  const matrixBtn = document.getElementById('admin-tab-matrix-btn');
  const resultsBtn = document.getElementById('admin-tab-results-btn');
  const configBtn = document.getElementById('admin-tab-config-btn');
  const lotsBtn = document.getElementById('admin-tab-lots-btn');
  const usersBtn = document.getElementById('admin-tab-users-btn');

  const activeClass = 'pb-3 text-sm font-bold border-b-2 border-indigo-600 text-indigo-600 flex items-center gap-2 transition whitespace-nowrap';
  const inactiveClass = 'pb-3 text-sm font-semibold border-b-2 border-transparent text-slate-500 hover:text-slate-800 flex items-center gap-2 transition whitespace-nowrap';

  matrixTab?.classList.add('hidden');
  resultsTab?.classList.add('hidden');
  configTab?.classList.add('hidden');
  lotsTab?.classList.add('hidden');
  usersTab?.classList.add('hidden');

  if (matrixBtn) matrixBtn.className = inactiveClass;
  if (resultsBtn) resultsBtn.className = inactiveClass;
  if (configBtn) configBtn.className = inactiveClass;
  if (lotsBtn) lotsBtn.className = inactiveClass;
  if (usersBtn) usersBtn.className = inactiveClass;

  if (tabName === 'matrix') {
    matrixTab?.classList.remove('hidden');
    if (matrixBtn) matrixBtn.className = activeClass;
    renderSubmissionMatrix();
  } else if (tabName === 'results') {
    resultsTab?.classList.remove('hidden');
    if (resultsBtn) resultsBtn.className = activeClass;
    renderAdminResultsTable();
  } else if (tabName === 'config') {
    configTab?.classList.remove('hidden');
    if (configBtn) configBtn.className = activeClass;
    renderAdminTestConfigsList();
  } else if (tabName === 'lots') {
    lotsTab?.classList.remove('hidden');
    if (lotsBtn) lotsBtn.className = activeClass;
    renderAdminLotAnswersConfig();
  } else {
    usersTab?.classList.remove('hidden');
    if (usersBtn) usersBtn.className = activeClass;
    renderAdminUsersTable();
  }

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// ============================================================================
// TAB 0: Submission Progress Matrix / Mini-Dashboard
// ============================================================================
async function renderSubmissionMatrix() {
  const tbody = document.getElementById('matrix-tbody');
  if (!tbody) return;

  const yearSelect = document.getElementById('matrix-filter-year');
  const statusFilter = document.getElementById('matrix-filter-status');
  const selectedYear = parseInt(yearSelect?.value || new Date().getFullYear(), 10);
  const filterVal = statusFilter?.value || 'ALL';

  const users = await apiGetUsers();
  const submissions = await apiGetSubmissions();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIdx = now.getMonth();

  // Filter out admin accounts from matrix; display lab users only
  const labUsers = users.filter(u => u.role !== 'admin');
  const totalLabsEl = document.getElementById('stat-total-labs');
  if (totalLabsEl) totalLabsEl.textContent = labUsers.length;

  // Calculate current month statistics
  let currentMonthSubmitted = 0;
  let yearTotalSubmissions = 0;

  labUsers.forEach(u => {
    const keyThisMonth = `${u.username}_${selectedYear}_${currentMonthIdx}`;
    if (submissions[keyThisMonth]) {
      currentMonthSubmitted++;
    }
    for (let m = 0; m < 12; m++) {
      if (submissions[`${u.username}_${selectedYear}_${m}`]) {
        yearTotalSubmissions++;
      }
    }
  });

  const monthLabel = `${MONTH_NAMES[currentMonthIdx]} ${currentYear + 543}`;
  const statMonthLabelEl = document.getElementById('stat-current-month-label');
  if (statMonthLabelEl) {
    statMonthLabelEl.textContent = `ประจำเดือน ${monthLabel}`;
  }

  const submittedEl = document.getElementById('stat-month-submitted');
  const pendingEl = document.getElementById('stat-month-pending');
  const rateEl = document.getElementById('stat-month-rate');
  const totalSubmissionsEl = document.getElementById('stat-year-total-submissions');

  if (submittedEl) submittedEl.textContent = currentMonthSubmitted;
  if (pendingEl) pendingEl.textContent = Math.max(0, labUsers.length - currentMonthSubmitted);
  if (rateEl) {
    const rate = labUsers.length > 0 ? Math.round((currentMonthSubmitted / labUsers.length) * 100) : 0;
    rateEl.textContent = `${rate}%`;
  }
  if (totalSubmissionsEl) totalSubmissionsEl.textContent = yearTotalSubmissions;

  // Filter rows by status
  let displayUsers = labUsers;
  if (filterVal === 'PENDING_THIS_MONTH') {
    displayUsers = labUsers.filter(u => !submissions[`${u.username}_${selectedYear}_${currentMonthIdx}`]);
  } else if (filterVal === 'SUBMITTED_THIS_MONTH') {
    displayUsers = labUsers.filter(u => Boolean(submissions[`${u.username}_${selectedYear}_${currentMonthIdx}`]));
  }

  tbody.innerHTML = '';
  if (displayUsers.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td colspan="14" class="px-6 py-10 text-center text-slate-400">
        <i data-lucide="info" class="w-8 h-8 mx-auto mb-2 text-slate-300"></i>
        <div>ไม่พบข้อมูลศูนย์ทดสอบตามเงื่อนไขที่เลือก</div>
      </td>
    `;
    tbody.appendChild(tr);
    if (window.lucide) window.lucide.createIcons({ root: tr });
    return;
  }

  displayUsers.forEach(u => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50/70 transition';

    let submittedCount = 0;
    let monthCellsHtml = '';

    for (let m = 0; m < 12; m++) {
      const monthKey = `${u.username}_${selectedYear}_${m}`;
      const sub = submissions[monthKey];
      const isPast = (selectedYear < currentYear) || (selectedYear === currentYear && m < currentMonthIdx);
      const isCurrent = (selectedYear === currentYear && m === currentMonthIdx);

      if (sub) {
        submittedCount++;
        monthCellsHtml += `
          <td class="px-2 py-3 text-center">
            <button type="button" data-view-user="${esc(u.username)}" data-view-year="${selectedYear}" data-view-month="${m}" class="matrix-cell-btn inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:scale-105 border border-emerald-200 transition shadow-xs" title="คลิกเพื่อดูผลที่ส่ง (${esc(sub.submittedAt || '')})">
              <i data-lucide="check" class="w-4 h-4 text-emerald-600 stroke-[2.5]"></i>
            </button>
          </td>
        `;
      } else if (isCurrent) {
        monthCellsHtml += `
          <td class="px-2 py-3 text-center">
            <span class="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse" title="เดือนปัจจุบัน - รอส่งผล">
              รอส่ง
            </span>
          </td>
        `;
      } else if (isPast) {
        monthCellsHtml += `
          <td class="px-2 py-3 text-center">
            <span class="inline-flex items-center justify-center w-6 h-6 rounded-md bg-slate-100 text-slate-400 text-[11px]" title="ไม่ได้รับการรายงาน">
              -
            </span>
          </td>
        `;
      } else {
        monthCellsHtml += `
          <td class="px-2 py-3 text-center text-slate-300 text-xs">
            -
          </td>
        `;
      }
    }

    const progressPct = Math.round((submittedCount / 12) * 100);

    tr.innerHTML = `
      <td class="px-4 py-3 sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-100">
        <div class="font-bold text-slate-800">${esc(u.name)}</div>
        <div class="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
          <span>${esc(u.code || u.username)}</span>
          ${u.contact ? `<span class="text-slate-300">•</span><span class="truncate max-w-[120px]">${esc(u.contact)}</span>` : ''}
        </div>
      </td>
      ${monthCellsHtml}
      <td class="px-3 py-3 text-center">
        <div class="flex items-center justify-center gap-1.5">
          <span class="font-mono font-bold text-slate-700">${submittedCount}/12</span>
          <div class="w-10 bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div class="bg-indigo-600 h-1.5 rounded-full" style="width: ${progressPct}%"></div>
          </div>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.matrix-cell-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget;
      const uName = target.getAttribute('data-view-user');
      const yr = parseInt(target.getAttribute('data-view-year'), 10);
      const mo = parseInt(target.getAttribute('data-view-month'), 10);
      openEntryModal(uName, yr, mo, true);
    });
  });

  if (window.lucide) {
    window.lucide.createIcons({ root: tbody });
  }
}

// ============================================================================
// TAB 1: Admin Results & Comparison Table (With Answer Key Range Check)
// ============================================================================
async function renderAdminResultsTable() {
  const userFilter = document.getElementById('admin-filter-user')?.value || 'ALL';
  const yearFilter = parseInt(document.getElementById('admin-filter-year')?.value) || 2026;
  const monthFilter = document.getElementById('admin-filter-month')?.value || 'ALL';

  const submissions = await apiGetSubmissions();
  const testConfigs = await apiGetTestConfigs();
  const users = await apiGetUsers();
  cachedMonthlyLots = await apiGetMonthlyLots(true);

  const thead = document.getElementById('admin-table-header');
  thead.innerHTML = `
    <th class="py-3 px-4">ประจำเดือน / Lot</th>
    <th class="py-3 px-4">หน่วยงาน / รหัส</th>
    ${testConfigs.map(t => `<th class="py-3 px-4">${t.name} ${t.unit ? `<span class="text-[10px] text-slate-400 font-normal">(${t.unit})</span>` : ''}</th>`).join('')}
    <th class="py-3 px-4">วันที่บันทึก</th>
    <th class="py-3 px-4 text-center">จัดการ</th>
  `;

  let targetUsers = [];
  if (userFilter === 'ALL') {
    targetUsers = users.map(u => u.username || u.email?.split('@')[0]);
  } else {
    targetUsers = [userFilter];
  }

  const targetMonths = (monthFilter === 'ALL') ? Array.from({length: 12}, (_, i) => i) : [parseInt(monthFilter)];
  const tbody = document.getElementById('admin-results-table-body');
  tbody.innerHTML = '';
  let matchCount = 0;

  targetMonths.forEach(m => {
    const lotKey = `${yearFilter}_${m}`;
    const lotData = cachedMonthlyLots[lotKey];

    targetUsers.forEach(uKey => {
      const key = `${uKey}_${yearFilter}_${m}`;
      const sub = submissions[key];
      const userObj = users.find(x => (x.username === uKey || x.email?.split('@')[0] === uKey)) || { name: uKey, code: uKey };

      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 transition border-b border-slate-100';

      if (sub) {
        matchCount++;
        // Build dynamic cell contents per test
        const testsCells = testConfigs.map(t => {
          const testRes = sub.results?.[t.id];
          if (!testRes) return '<td class="py-3 px-4 text-slate-300">-</td>';

          const machineEntries = Object.entries(testRes);
          const cellHtml = machineEntries.map(([mName, lvData]) => {
            const levelRows = Object.entries(lvData).map(([lv, val]) => {
              // Compare with answer key if available
              const ansInfo = lotData?.answers?.[t.id]?.[lv];
              let evalBadge = '';
              if (ansInfo && val !== '') {
                if (t.type === 'number') {
                  const numVal = parseFloat(val);
                  const min = parseFloat(ansInfo.min);
                  const max = parseFloat(ansInfo.max);
                  if (!isNaN(numVal) && !isNaN(min) && !isNaN(max)) {
                    const isPass = numVal >= min && numVal <= max;
                    evalBadge = isPass 
                      ? `<span class="text-[10px] text-emerald-600 font-bold ml-1">✓ Pass</span>`
                      : `<span class="text-[10px] text-rose-500 font-bold ml-1">✕ Out (${min}-${max})</span>`;
                  }
                } else if (ansInfo.expected) {
                  const isPass = (val.toLowerCase().trim() === ansInfo.expected.toLowerCase().trim());
                  evalBadge = isPass 
                    ? `<span class="text-[10px] text-emerald-600 font-bold ml-1">✓ Pass</span>`
                    : `<span class="text-[10px] text-rose-500 font-bold ml-1">✕ (เฉลย: ${ansInfo.expected})</span>`;
                }
              }
              return `<div class="text-xs"><span class="text-slate-400 font-medium">${lv}:</span> <strong class="text-slate-800">${val}</strong>${evalBadge}</div>`;
            }).join('');

            return `
              <div class="mb-1.5 last:mb-0 p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                <div class="text-[10px] font-bold text-indigo-700 font-mono">${mName}</div>
                ${levelRows}
              </div>
            `;
          }).join('');

          return `<td class="py-3 px-4">${cellHtml}</td>`;
        }).join('');

        tr.innerHTML = `
          <td class="py-3 px-4 whitespace-nowrap">
            <span class="font-bold text-slate-800">${MONTH_NAMES[m]}</span>
            <span class="text-xs text-slate-400 block">${yearFilter + 543}</span>
            ${lotData?.lotNumber ? `<span class="inline-block mt-0.5 text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 font-bold">LOT: ${lotData.lotNumber}</span>` : ''}
          </td>
          <td class="py-3 px-4 whitespace-nowrap">
            <div class="font-semibold text-slate-800 text-xs">${userObj.name}</div>
            <div class="text-[11px] text-slate-400 font-mono">${userObj.code}</div>
          </td>
          ${testsCells}
          <td class="py-3 px-4 whitespace-nowrap text-xs text-slate-500 font-mono">
            ${sub.submittedAt}
          </td>
        `;

        const actionTd = document.createElement('td');
        actionTd.className = 'py-3 px-4 whitespace-nowrap text-center';
        const actWrap = document.createElement('div');
        actWrap.className = 'flex items-center justify-center gap-1.5';

        const editBtn = document.createElement('button');
        editBtn.className = 'p-1.5 rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100 transition';
        editBtn.title = 'แก้ไขผลนี้ (สิทธิ์ผู้ดูแลระบบ)';
        editBtn.innerHTML = '<i data-lucide="edit-2" class="w-3.5 h-3.5"></i>';
        editBtn.onclick = () => openEntryModal(uKey, yearFilter, m, false);

        const delBtn = document.createElement('button');
        delBtn.className = 'p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition';
        delBtn.title = 'ลบผลการทดสอบนี้';
        delBtn.innerHTML = '<i data-lucide="trash-2" class="w-3.5 h-3.5"></i>';
        delBtn.onclick = async () => {
          if (confirm('คุณต้องการลบข้อมูลผลการทดสอบนี้หรือไม่?')) {
            await apiDeleteSubmission(key);
            showToast('ลบรายการผลการทดสอบเรียบร้อยแล้ว');
            logAuditEvent(
              'SUBMISSION_DELETE',
              'SUBMISSION',
              `${uKey} (${yearFilter}-${m + 1})`,
              `ลบผลการทดสอบของ ${userObj.name} ประจำเดือน ${MONTH_NAMES[m]} ${yearFilter + 543}`
            );
            renderAdminResultsTable();
          }
        };

        actWrap.appendChild(editBtn);
        actWrap.appendChild(delBtn);
        actionTd.appendChild(actWrap);
        tr.appendChild(actionTd);
      } else {
        const emptyCells = testConfigs.map(() => `<td class="py-3 px-4 text-slate-300 font-mono">-</td>`).join('');
        tr.innerHTML = `
          <td class="py-3 px-4 whitespace-nowrap">
            <span class="font-bold text-slate-500">${MONTH_NAMES[m]}</span>
            <span class="text-xs text-slate-400 block">${yearFilter + 543}</span>
            ${lotData?.lotNumber ? `<span class="inline-block mt-0.5 text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 font-bold">LOT: ${lotData.lotNumber}</span>` : ''}
          </td>
          <td class="py-3 px-4 whitespace-nowrap">
            <div class="font-semibold text-slate-500 text-xs">${userObj.name}</div>
            <div class="text-[11px] text-slate-400 font-mono">${userObj.code}</div>
          </td>
          ${emptyCells}
          <td class="py-3 px-4 whitespace-nowrap text-xs text-amber-600 font-medium">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-200">
              <i data-lucide="clock" class="w-3 h-3"></i> รอดำเนินการ
            </span>
          </td>
        `;

        const actionTd = document.createElement('td');
        actionTd.className = 'py-3 px-4 whitespace-nowrap text-center';
        const addBtn = document.createElement('button');
        addBtn.className = 'px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded transition';
        addBtn.textContent = 'บันทึกแทน';
        addBtn.onclick = () => openEntryModal(uKey, yearFilter, m, false);
        actionTd.appendChild(addBtn);
        tr.appendChild(actionTd);
      }

      tbody.appendChild(tr);
    });
  });

  document.getElementById('admin-results-count-text').textContent = `แสดงผล ${matchCount} รายการที่บันทึกแล้ว`;
  if (window.lucide) {
    window.lucide.createIcons({ root: tbody });
  }
}

// ============================================================================
// TAB 3: Layer 2 - Monthly Lot & Answer Key Controller
// ============================================================================
async function renderAdminLotAnswersConfig() {
  const m = parseInt(document.getElementById('lot-select-month').value) || 0;
  const y = parseInt(document.getElementById('lot-select-year').value) || 2026;
  const lotKey = `${y}_${m}`;

  cachedMonthlyLots = await apiGetMonthlyLots(true);
  const currentLot = cachedMonthlyLots[lotKey] || {};
  const testConfigs = await apiGetTestConfigs();

  document.getElementById('lot-input-number').value = currentLot.lotNumber || `LOT-${y}${String(m+1).padStart(2, '0')}-BKT`;
  document.getElementById('lot-input-remarks').value = currentLot.remarks || '';

  const container = document.getElementById('lot-answer-keys-container');
  container.innerHTML = '';

  testConfigs.forEach((t) => {
    const levels = t.enableLevels && t.levels?.length > 0 ? t.levels : ['Result'];
    const card = document.createElement('div');
    card.className = 'p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3';

    card.innerHTML = `
      <div class="flex items-center justify-between border-b border-slate-200 pb-2">
        <div>
          <span class="text-xs font-bold text-slate-800">${t.name}</span>
          <span class="text-xs text-slate-400 font-mono ml-1">[${t.key}]</span>
        </div>
        <span class="text-[11px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
          ${t.type === 'number' ? `ตัวเลข (${t.unit || '-'})` : t.type === 'select' ? 'ตัวเลือก' : 'ข้อความ'}
        </span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-${Math.min(levels.length, 3)} gap-3" id="lot-levels-box-${t.id}"></div>
    `;

    const levelsBox = card.querySelector(`#lot-levels-box-${t.id}`);
    levels.forEach(lv => {
      const savedAns = currentLot.answers?.[t.id]?.[lv] || {};
      const lvDiv = document.createElement('div');
      lvDiv.className = 'p-3 rounded-lg bg-white border border-slate-200 space-y-2';

      if (t.type === 'number') {
        lvDiv.innerHTML = `
          <label class="block text-xs font-bold text-indigo-700">${lv}</label>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <span class="text-[10px] text-slate-500 block">ช่วงต่ำสุด (Min)</span>
              <input type="number" step="any" id="ans_${t.id}_${lv}_min" value="${savedAns.min || ''}" placeholder="Min" class="w-full text-xs border border-slate-200 rounded-lg p-1.5 focus:ring-2 focus:ring-indigo-500">
            </div>
            <div>
              <span class="text-[10px] text-slate-500 block">ช่วงสูงสุด (Max)</span>
              <input type="number" step="any" id="ans_${t.id}_${lv}_max" value="${savedAns.max || ''}" placeholder="Max" class="w-full text-xs border border-slate-200 rounded-lg p-1.5 focus:ring-2 focus:ring-indigo-500">
            </div>
          </div>
        `;
      } else if (t.type === 'select') {
        const optionsHtml = (t.options || []).map(opt => `<option value="${opt}" ${savedAns.expected === opt ? 'selected' : ''}>${opt}</option>`).join('');
        lvDiv.innerHTML = `
          <label class="block text-xs font-bold text-indigo-700">${lv}</label>
          <span class="text-[10px] text-slate-500 block">คำตอบที่ถูกต้อง (Expected)</span>
          <select id="ans_${t.id}_${lv}_expected" class="w-full text-xs bg-white border border-slate-200 rounded-lg p-1.5 focus:ring-2 focus:ring-indigo-500">
            <option value="">-- เลือกคำตอบเฉลย --</option>
            ${optionsHtml}
          </select>
        `;
      } else {
        lvDiv.innerHTML = `
          <label class="block text-xs font-bold text-indigo-700">${lv}</label>
          <span class="text-[10px] text-slate-500 block">คำตอบที่ถูกต้อง (Expected)</span>
          <input type="text" id="ans_${t.id}_${lv}_expected" value="${savedAns.expected || ''}" placeholder="พิมพ์คำตอบเฉลย" class="w-full text-xs border border-slate-200 rounded-lg p-1.5 focus:ring-2 focus:ring-indigo-500">
        `;
      }
      levelsBox.appendChild(lvDiv);
    });

    container.appendChild(card);
  });
}

async function handleSaveLotAnswers() {
  const m = parseInt(document.getElementById('lot-select-month').value) || 0;
  const y = parseInt(document.getElementById('lot-select-year').value) || 2026;
  const lotKey = `${y}_${m}`;
  const lotNumber = document.getElementById('lot-input-number').value.trim();
  const remarks = document.getElementById('lot-input-remarks').value.trim();

  const testConfigs = await apiGetTestConfigs();
  const answers = {};

  testConfigs.forEach(t => {
    const levels = t.enableLevels && t.levels?.length > 0 ? t.levels : ['Result'];
    const tAns = {};
    levels.forEach(lv => {
      if (t.type === 'number') {
        const minVal = document.getElementById(`ans_${t.id}_${lv}_min`)?.value.trim() || '';
        const maxVal = document.getElementById(`ans_${t.id}_${lv}_max`)?.value.trim() || '';
        tAns[lv] = { min: minVal, max: maxVal };
      } else {
        const expVal = document.getElementById(`ans_${t.id}_${lv}_expected`)?.value.trim() || '';
        tAns[lv] = { expected: expVal };
      }
    });
    answers[t.id] = tAns;
  });

  const payload = {
    year: y,
    monthIndex: m,
    lotNumber,
    remarks,
    answers,
    updatedAt: new Date().toISOString()
  };

  await apiSaveMonthlyLot(lotKey, payload);
  showToast(`บันทึกข้อมูล Lot และเฉลยประจำเดือน ${MONTH_NAMES[m]} ${y + 543} สำเร็จแล้ว!`);
  logAuditEvent(
    'LOT_SAVE',
    'LOT',
    lotNumber || lotKey,
    `กำหนด/อัปเดตหมายเลข Lot และเกณฑ์เฉลยประจำเดือน ${MONTH_NAMES[m]} ${y + 543}`
  );
  renderAdminResultsTable();
}

// ============================================================================
// TAB 2: Layer 1 - Test Configurations Controller
// ============================================================================
async function renderAdminTestConfigsList() {
  const tests = await apiGetTestConfigs();
  document.getElementById('admin-tests-count-badge').textContent = tests.length;

  const container = document.getElementById('admin-tests-list');
  container.innerHTML = '';

  tests.forEach((test, idx) => {
    const card = document.createElement('div');
    card.className = 'bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-indigo-200 transition';

    let typeBadge = '';
    let detailsHtml = '';

    if (test.type === 'select') {
      typeBadge = '<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">ตัวเลือก (Dropdown)</span>';
      detailsHtml = `<div class="text-xs text-slate-500 mt-1">ตัวเลือก: <span class="font-medium text-slate-700">${(test.options || []).join(' | ')}</span></div>`;
    } else if (test.type === 'number') {
      typeBadge = `<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">ตัวเลข (${test.unit || 'ไม่ระบุหน่วย'})</span>`;
      detailsHtml = `<div class="text-xs text-slate-500 mt-1">หน่วยวัด: <span class="font-semibold text-slate-700">${test.unit || '-'}</span></div>`;
    } else {
      typeBadge = '<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">พิมพ์ข้อความสั้น</span>';
      detailsHtml = `<div class="text-xs text-slate-500 mt-1">พิมพ์คำตอบแบบกระชับ</div>`;
    }

    const levelsInfo = test.enableLevels 
      ? `<span class="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">Levels: ${(test.levels || []).join(', ')}</span>`
      : '<span class="text-xs text-slate-400">Single Level</span>';

    const machineInfo = test.enableMultiMachine
      ? `<span class="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">รองรับหลายเครื่อง (สูงสุด ${test.maxMachines || 3})</span>`
      : '<span class="text-xs text-slate-400">เครื่องเดี่ยว</span>';

    const actionDiv = document.createElement('div');
    actionDiv.className = 'flex items-center gap-3 self-end sm:self-center';
    actionDiv.innerHTML = typeBadge;

    const btnWrap = document.createElement('div');
    btnWrap.className = 'flex items-center gap-1 border-l border-slate-200 pl-3';

    const editBtn = document.createElement('button');
    editBtn.className = 'p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-indigo-600 transition';
    editBtn.title = 'แก้ไข';
    editBtn.innerHTML = '<i data-lucide="edit-3" class="w-4 h-4"></i>';
    editBtn.onclick = () => openTestConfigModal(test.id);

    const delBtn = document.createElement('button');
    delBtn.className = 'p-2 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-600 transition';
    delBtn.title = 'ลบแบบทดสอบนี้';
    delBtn.innerHTML = '<i data-lucide="trash-2" class="w-4 h-4"></i>';
    delBtn.onclick = async () => {
      if (confirm(`คุณต้องการลบโครงสร้างแบบทดสอบ "${test.name}" หรือไม่?`)) {
        await apiDeleteTestConfig(test.id);
        showToast(`ลบรายการ ${test.name} เรียบร้อยแล้ว`);
        logAuditEvent(
          'CONFIG_DELETE',
          'CONFIG',
          test.name,
          `ลบโครงสร้างแบบทดสอบ ${test.name} [${test.key}] ออกจากระบบ`
        );
        renderAdminTestConfigsList();
        renderAdminResultsTable();
        renderAdminLotAnswersConfig();
      }
    };

    btnWrap.appendChild(editBtn);
    btnWrap.appendChild(delBtn);
    actionDiv.appendChild(btnWrap);

    card.innerHTML = `
      <div class="flex items-start gap-3.5">
        <div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-700 font-mono flex-shrink-0">
          ${idx + 1}
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h4 class="text-base font-bold text-slate-800">${test.name}</h4>
            <span class="text-xs text-slate-400 font-mono font-medium">[${test.key}]</span>
          </div>
          <p class="text-xs text-slate-500 mt-0.5">${test.description || 'ไม่มีคำอธิบาย'}</p>
          <div class="flex flex-wrap items-center gap-2 mt-2">
            ${levelsInfo}
            ${machineInfo}
          </div>
          ${detailsHtml}
        </div>
      </div>
    `;

    card.appendChild(actionDiv);
    container.appendChild(card);
  });

  if (window.lucide) {
    window.lucide.createIcons({ root: container });
  }
}

function toggleConfigOptionFields() {
  const type = document.getElementById('cfg-test-type').value;
  const boxOptions = document.getElementById('cfg-box-options');
  const boxUnit = document.getElementById('cfg-box-unit');

  if (type === 'select') {
    boxOptions.classList.remove('hidden');
    boxUnit.classList.add('hidden');
  } else if (type === 'number') {
    boxOptions.classList.add('hidden');
    boxUnit.classList.remove('hidden');
  } else {
    boxOptions.classList.add('hidden');
    boxUnit.classList.add('hidden');
  }
}

function toggleConfigLevelAndMachineFields() {
  const enableLevels = document.getElementById('cfg-enable-levels').checked;
  const boxLevels = document.getElementById('cfg-box-levels');
  if (enableLevels) boxLevels.classList.remove('hidden');
  else boxLevels.classList.add('hidden');

  const enableMachine = document.getElementById('cfg-enable-machine').checked;
  const boxMachine = document.getElementById('cfg-box-machine');
  if (enableMachine) boxMachine.classList.remove('hidden');
  else boxMachine.classList.add('hidden');
}

async function openTestConfigModal(testId = null) {
  const tests = await apiGetTestConfigs();
  const modal = document.getElementById('modal-test-config');
  const title = document.getElementById('modal-test-config-title');

  if (testId) {
    const test = tests.find(t => t.id === testId);
    if (!test) return;
    title.textContent = `แก้ไขโครงสร้าง: ${test.name}`;
    document.getElementById('cfg-test-id').value = test.id;
    document.getElementById('cfg-test-key').value = test.key;
    document.getElementById('cfg-test-name').value = test.name;
    document.getElementById('cfg-test-desc').value = test.description || '';
    document.getElementById('cfg-test-type').value = test.type;
    document.getElementById('cfg-test-options').value = (test.options || []).join(', ');
    document.getElementById('cfg-test-unit').value = test.unit || '';
    document.getElementById('cfg-enable-levels').checked = !!test.enableLevels;
    document.getElementById('cfg-levels-list').value = (test.levels || ['LV1', 'LV2', 'LV3']).join(', ');
    document.getElementById('cfg-enable-machine').checked = !!test.enableMultiMachine;
    document.getElementById('cfg-max-machines').value = test.maxMachines || 3;
  } else {
    title.textContent = 'เพิ่มโครงสร้างแบบทดสอบใหม่';
    document.getElementById('cfg-test-id').value = '';
    document.getElementById('cfg-test-key').value = `TEST_${String.fromCharCode(65 + tests.length)}`;
    document.getElementById('cfg-test-name').value = `แบบทดสอบใหม่ ${String.fromCharCode(65 + tests.length)}`;
    document.getElementById('cfg-test-desc').value = '';
    document.getElementById('cfg-test-type').value = 'number';
    document.getElementById('cfg-test-options').value = '';
    document.getElementById('cfg-test-unit').value = 'mg/dL';
    document.getElementById('cfg-enable-levels').checked = true;
    document.getElementById('cfg-levels-list').value = 'LV1, LV2, LV3';
    document.getElementById('cfg-enable-machine').checked = true;
    document.getElementById('cfg-max-machines').value = 3;
  }

  toggleConfigOptionFields();
  toggleConfigLevelAndMachineFields();
  modal.classList.remove('hidden');
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function closeTestConfigModal() {
  document.getElementById('modal-test-config').classList.add('hidden');
}

async function handleSaveTestConfig(event) {
  event.preventDefault();
  const testId = document.getElementById('cfg-test-id').value;
  const key = document.getElementById('cfg-test-key').value.trim().toUpperCase();
  const name = document.getElementById('cfg-test-name').value.trim();
  const desc = document.getElementById('cfg-test-desc').value.trim();
  const type = document.getElementById('cfg-test-type').value;

  const rawOptions = document.getElementById('cfg-test-options').value;
  const options = rawOptions ? rawOptions.split(',').map(s => s.trim()).filter(Boolean) : [];
  const unit = document.getElementById('cfg-test-unit').value.trim();

  const enableLevels = document.getElementById('cfg-enable-levels').checked;
  const rawLevels = document.getElementById('cfg-levels-list').value;
  const levels = enableLevels 
    ? (rawLevels ? rawLevels.split(',').map(s => s.trim()).filter(Boolean) : ['LV1', 'LV2'])
    : ['Result'];

  const enableMultiMachine = document.getElementById('cfg-enable-machine').checked;
  const maxMachines = parseInt(document.getElementById('cfg-max-machines').value) || 3;

  const id = testId || `test_${Date.now()}`;
  const config = {
    id,
    key,
    name,
    description: desc,
    type,
    options,
    unit,
    enableLevels,
    levels,
    enableMultiMachine,
    maxMachines,
    order: Date.now()
  };

  await apiSaveTestConfig(config);
  showToast(`บันทึกโครงสร้างแบบทดสอบ ${name} เรียบร้อยแล้ว`);
  logAuditEvent(
    testId ? 'CONFIG_UPDATE' : 'CONFIG_CREATE',
    'CONFIG',
    name,
    `${testId ? 'แก้ไข' : 'สร้างใหม่'} โครงสร้างแบบทดสอบ ${name} [${key}]`
  );
  closeTestConfigModal();
  renderAdminTestConfigsList();
  renderAdminResultsTable();
  renderAdminLotAnswersConfig();
}

// ============================================================================
// TAB 4: User Management Controller
// ============================================================================
async function renderAdminUsersTable() {
  const users = await apiGetUsers();
  document.getElementById('admin-users-count-badge').textContent = users.length;

  const tbody = document.getElementById('admin-users-table-body');
  tbody.innerHTML = '';

  users.forEach((u) => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition border-b border-slate-100';

    const isAdmin = (u.role === 'admin');
    const roleBadge = isAdmin
      ? '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200"><i data-lucide="shield-check" class="w-3.5 h-3.5"></i> ผู้ดูแลระบบ (Admin)</span>'
      : '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200"><i data-lucide="user" class="w-3.5 h-3.5"></i> ผู้ใช้งานทั่วไป</span>';

    tr.innerHTML = `
      <td class="py-3.5 px-4 whitespace-nowrap">
        <div class="font-bold text-slate-800 text-sm">${esc(u.email || u.username)}</div>
        <div class="text-[11px] text-slate-400 font-mono">UID: ${esc(u.uid?.substring(0, 10))}...</div>
      </td>
      <td class="py-3.5 px-4">
        <div class="font-semibold text-slate-800 text-xs">${esc(u.name)}</div>
        <div class="text-[11px] text-slate-500">${esc(u.department || '-')} • ติดต่อ: ${esc(u.contact || '-')}</div>
      </td>
      <td class="py-3.5 px-4 whitespace-nowrap font-mono text-xs font-semibold text-slate-700">
        ${esc(u.code || '-')}
      </td>
      <td class="py-3.5 px-4 whitespace-nowrap">
        ${roleBadge}
      </td>
    `;

    const actTd = document.createElement('td');
    actTd.className = 'py-3.5 px-4 whitespace-nowrap text-center';
    const actWrap = document.createElement('div');
    actWrap.className = 'flex items-center justify-center gap-2';

    const toggleRoleBtn = document.createElement('button');
    toggleRoleBtn.className = 'px-2.5 py-1 text-xs font-medium rounded-lg border transition ' + 
      (isAdmin ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100');
    toggleRoleBtn.textContent = isAdmin ? 'เปลี่ยนเป็น ผู้ใช้งาน' : 'แต่งตั้งเป็น Admin';
    toggleRoleBtn.onclick = async () => {
      const newRole = isAdmin ? 'user' : 'admin';
      if (confirm(`ต้องการเปลี่ยนสิทธิ์ของ "${u.name}" เป็น "${newRole}" หรือไม่?`)) {
        await apiUpdateUser(u.uid, { role: newRole });
        showToast('อัปเดตสิทธิ์การใช้งานเรียบร้อยแล้ว');
        logAuditEvent(
          'USER_ROLE_CHANGE',
          'USER',
          u.username || u.email,
          `เปลี่ยนสิทธิ์ของ ${u.name} เป็น ${newRole === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'ผู้ใช้งานทั่วไป'}`
        );
        renderAdminUsersTable();
      }
    };

    const delUserBtn = document.createElement('button');
    delUserBtn.className = 'p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition';
    delUserBtn.title = 'ลบผู้ใช้งานนี้';
    delUserBtn.innerHTML = '<i data-lucide="trash-2" class="w-3.5 h-3.5"></i>';
    delUserBtn.onclick = async () => {
      if (confirm(`คุณต้องการลบผู้ใช้งาน "${u.name}" (${u.email}) ออกจากระบบหรือไม่?`)) {
        await apiDeleteUser(u.uid);
        showToast('ลบผู้ใช้งานเรียบร้อยแล้ว');
        logAuditEvent(
          'USER_DELETE',
          'USER',
          u.username || u.email,
          `ลบบัญชีผู้ใช้งาน ${u.name} (${u.email}) ออกจากระบบ`
        );
        renderAdminUsersTable();
        loadAdminUsersDropdown();
        renderAdminResultsTable();
      }
    };

    actWrap.appendChild(toggleRoleBtn);
    actWrap.appendChild(delUserBtn);
    actTd.appendChild(actWrap);
    tr.appendChild(actTd);

    tbody.appendChild(tr);
  });

  if (window.lucide) {
    window.lucide.createIcons({ root: tbody });
  }
}

function openCreateUserModal() {
  document.getElementById('form-user-create').reset();
  document.getElementById('modal-user-create').classList.remove('hidden');
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function closeCreateUserModal() {
  document.getElementById('modal-user-create').classList.add('hidden');
}

async function handleCreateUser(e) {
  e.preventDefault();
  const email = document.getElementById('new-user-email').value;
  const password = document.getElementById('new-user-password').value;
  const name = document.getElementById('new-user-name').value;
  const code = document.getElementById('new-user-code').value;
  const department = document.getElementById('new-user-department').value;
  const contact = document.getElementById('new-user-contact').value;
  const role = document.getElementById('new-user-role').value;

  const btn = document.getElementById('btn-save-new-user');
  btn.disabled = true;
  btn.classList.add('opacity-70');

  try {
    await apiCreateUserByAdmin({
      email,
      password,
      name,
      code,
      department,
      contact,
      role
    });
    showToast(`สร้างบัญชีผู้ใช้งาน ${email} สำเร็จเรียบร้อย`);
    logAuditEvent(
      'USER_CREATE',
      'USER',
      email,
      `สร้างบัญชีผู้ใช้ใหม่: ${name} (${code || '-'}) สิทธิ์ ${role === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน'}`
    );
    closeCreateUserModal();
    renderAdminUsersTable();
    loadAdminUsersDropdown();
    renderAdminResultsTable();
  } catch (err) {
    alert(err.message || 'ไม่สามารถสร้างผู้ใช้งานได้');
  } finally {
    btn.disabled = false;
    btn.classList.remove('opacity-70');
  }
}

// ============================================================================
// PDF Report Generation (With True Answer Key Comparison Matrix)
// ============================================================================
async function openPdfModal(targetUser = 'ALL') {
  const year = parseInt(document.getElementById('admin-filter-year')?.value) || 2026;
  const monthFilter = document.getElementById('admin-filter-month').value;
  const targetMonth = monthFilter === 'ALL' ? (new Date().getMonth()) : parseInt(monthFilter);

  const lotKey = `${year}_${targetMonth}`;
  cachedMonthlyLots = await apiGetMonthlyLots(true);
  const currentLot = cachedMonthlyLots[lotKey] || {};

  const submissions = await apiGetSubmissions();
  const testConfigs = await apiGetTestConfigs();
  const users = await apiGetUsers();

  document.getElementById('pdf-doc-number').textContent = `EQA-${year}-${Math.floor(1000 + Math.random() * 9000)}`;
  
  const now = new Date();
  const pad = n => n.toString().padStart(2, '0');
  document.getElementById('pdf-generated-date').textContent = `ออกเอกสารเมื่อ: ${pad(now.getDate())}/${pad(now.getMonth()+1)}/${year + 543} ${pad(now.getHours())}:${pad(now.getMinutes())} น.`;

  if (targetUser !== 'ALL') {
    const u = users.find(x => x.username === targetUser || x.email?.split('@')[0] === targetUser) || { name: targetUser, code: targetUser };
    document.getElementById('pdf-site-name').textContent = u.name;
    document.getElementById('pdf-site-code').textContent = `รหัสสมาชิก: ${u.code}`;
  } else {
    document.getElementById('pdf-site-name').textContent = 'รายงานรวมทุกหน่วยงาน (All Participating Sites)';
    document.getElementById('pdf-site-code').textContent = 'รหัสสมาชิก: รวมทุกศูนย์ทดสอบที่ลงทะเบียน';
  }

  document.getElementById('pdf-period-name').textContent = `รอบประจำเดือน ${MONTH_NAMES[targetMonth]} ${year + 543} (${year})`;
  document.getElementById('pdf-lot-info').textContent = currentLot.lotNumber ? `LOT NO: ${currentLot.lotNumber}` : 'LOT NO: -';

  const tbody = document.getElementById('pdf-table-body');
  tbody.innerHTML = '';
  const usersToExport = (targetUser === 'ALL') ? users.map(u => u.username || u.email?.split('@')[0]) : [targetUser];

  usersToExport.forEach(uKey => {
    const key = `${uKey}_${year}_${targetMonth}`;
    const sub = submissions[key];
    const userInfo = users.find(x => (x.username === uKey || x.email?.split('@')[0] === uKey)) || { name: uKey, code: uKey };

    testConfigs.forEach(t => {
      const testRes = sub?.results?.[t.id];
      const levels = t.enableLevels && t.levels?.length > 0 ? t.levels : ['Result'];

      if (!testRes) {
        // Pending row
        const tr = document.createElement('tr');
        tr.className = 'border-b border-slate-200';
        tr.innerHTML = `
          <td class="p-2 border-r border-slate-200 font-bold text-slate-800">${t.name}</td>
          <td class="p-2 border-r border-slate-200 text-slate-500">${userInfo.name}</td>
          <td class="p-2 border-r border-slate-200 text-center text-slate-400 font-mono">-</td>
          <td class="p-2 border-r border-slate-200 text-center text-slate-400 font-mono">-</td>
          <td class="p-2 text-center text-amber-600 font-semibold text-[11px]">ยังไม่ส่งผล</td>
        `;
        tbody.appendChild(tr);
        return;
      }

      Object.entries(testRes).forEach(([mName, lvData]) => {
        Object.entries(lvData).forEach(([lv, val]) => {
          const ansInfo = currentLot.answers?.[t.id]?.[lv];
          let rangeText = '-';
          let evalText = '<span class="text-slate-400">-</span>';

          if (ansInfo) {
            if (t.type === 'number') {
              if (ansInfo.min && ansInfo.max) {
                rangeText = `${ansInfo.min} - ${ansInfo.max} ${t.unit || ''}`;
                const num = parseFloat(val);
                const min = parseFloat(ansInfo.min);
                const max = parseFloat(ansInfo.max);
                if (!isNaN(num)) {
                  evalText = (num >= min && num <= max)
                    ? '<span class="text-emerald-700 font-bold">ผ่านเกณฑ์ (Pass)</span>'
                    : '<span class="text-rose-600 font-bold">นอกเกณฑ์ (Out of Range)</span>';
                }
              }
            } else if (ansInfo.expected) {
              rangeText = ansInfo.expected;
              evalText = (val.toLowerCase().trim() === ansInfo.expected.toLowerCase().trim())
                ? '<span class="text-emerald-700 font-bold">ผ่านเกณฑ์ (Pass)</span>'
                : '<span class="text-rose-600 font-bold">ไม่ตรงเกณฑ์</span>';
            }
          }

          const tr = document.createElement('tr');
          tr.className = 'border-b border-slate-200';
          tr.innerHTML = `
            <td class="p-2 border-r border-slate-200 font-semibold text-slate-800">${t.name}</td>
            <td class="p-2 border-r border-slate-200 text-slate-700">${userInfo.name} • <span class="font-mono text-indigo-700 font-bold">${mName}</span> [${lv}]</td>
            <td class="p-2 border-r border-slate-200 text-center font-bold text-slate-900">${val} ${t.unit || ''}</td>
            <td class="p-2 border-r border-slate-200 text-center font-mono font-semibold text-indigo-900 bg-indigo-50/40">${rangeText}</td>
            <td class="p-2 text-center text-[11px]">${evalText}</td>
          `;
          tbody.appendChild(tr);
        });
      });
    });
  });

  document.getElementById('modal-pdf').classList.remove('hidden');
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function closePdfModal() {
  document.getElementById('modal-pdf').classList.add('hidden');
}

// ============================================================================
// Audit Logs Controller (Admin Secret Access)
// ============================================================================
async function openAuditLogModal() {
  if (!currentUser || currentUser.role !== 'admin') return;

  const modal = document.getElementById('modal-audit-log');
  if (!modal) return;

  modal.classList.remove('hidden');
  await renderAuditLogsTable();

  if (window.lucide) {
    window.lucide.createIcons({ root: modal });
  }
}

function closeAuditLogModal() {
  document.getElementById('modal-audit-log')?.classList.add('hidden');
}

async function renderAuditLogsTable(forceRefresh = false) {
  const tbody = document.getElementById('audit-logs-tbody');
  const countText = document.getElementById('audit-logs-count-text');
  const searchInput = document.getElementById('audit-filter-search');
  const categorySelect = document.getElementById('audit-filter-category');

  if (!tbody) return;

  if (forceRefresh || cachedAuditLogs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="py-10 text-center text-slate-400">
          <i data-lucide="loader-2" class="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600"></i>
          <div>กำลังโหลดประวัติกิจกรรมจากคลาวด์...</div>
        </td>
      </tr>
    `;
    if (window.lucide) window.lucide.createIcons({ root: tbody });
    cachedAuditLogs = await apiGetAuditLogs(200);
  }

  const searchTerm = (searchInput?.value || '').toLowerCase().trim();
  const selectedCat = categorySelect?.value || 'ALL';

  let filtered = cachedAuditLogs;
  if (selectedCat !== 'ALL') {
    filtered = filtered.filter(log => log.category === selectedCat);
  }

  if (searchTerm) {
    filtered = filtered.filter(log => {
      const matchActor = (log.actor?.name || '').toLowerCase().includes(searchTerm) ||
                         (log.actor?.username || '').toLowerCase().includes(searchTerm);
      const matchTarget = (log.target || '').toLowerCase().includes(searchTerm);
      const matchDetails = (log.details || '').toLowerCase().includes(searchTerm);
      const matchAction = (log.action || '').toLowerCase().includes(searchTerm);
      return matchActor || matchTarget || matchDetails || matchAction;
    });
  }

  if (countText) {
    countText.textContent = `แสดง ${filtered.length} จากทั้งหมด ${cachedAuditLogs.length} รายการกิจกรรมล่าสุด`;
  }

  tbody.innerHTML = '';
  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="py-10 text-center text-slate-400">
          <i data-lucide="inbox" class="w-7 h-7 mx-auto mb-2 text-slate-300"></i>
          <div>ไม่พบประวัติกิจกรรมตามเงื่อนไขที่เลือก</div>
        </td>
      </tr>
    `;
    if (window.lucide) window.lucide.createIcons({ root: tbody });
    return;
  }

  const categoryColorMap = {
    SUBMISSION: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    LOT: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    CONFIG: 'bg-purple-50 text-purple-700 border-purple-200',
    USER: 'bg-amber-50 text-amber-700 border-amber-200',
    AUTH: 'bg-sky-50 text-sky-700 border-sky-200'
  };

  filtered.forEach(log => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition border-b border-slate-100';

    const catBadgeClass = categoryColorMap[log.category] || 'bg-slate-100 text-slate-700 border-slate-200';
    const isActorAdmin = (log.actor?.role === 'admin');

    tr.innerHTML = `
      <td class="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
        ${esc(log.createdAt || '-')}
      </td>
      <td class="py-3 px-4 whitespace-nowrap">
        <div class="font-bold text-slate-800 text-xs">${esc(log.actor?.name || log.actor?.username || 'Unknown')}</div>
        <div class="text-[10px] flex items-center gap-1 font-mono">
          <span class="text-slate-400">${esc(log.actor?.username || '')}</span>
          <span class="px-1.5 py-0.2 rounded text-[9px] font-bold ${isActorAdmin ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}">
            ${isActorAdmin ? 'ADMIN' : 'USER'}
          </span>
        </div>
      </td>
      <td class="py-3 px-4 whitespace-nowrap">
        <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${catBadgeClass}">
          ${esc(log.action)}
        </span>
      </td>
      <td class="py-3 px-4 font-mono text-xs font-semibold text-slate-700 whitespace-nowrap">
        ${esc(log.target || '-')}
      </td>
      <td class="py-3 px-4 text-xs text-slate-600 leading-relaxed">
        ${esc(log.details || '-')}
      </td>
    `;

    tbody.appendChild(tr);
  });

  if (window.lucide) {
    window.lucide.createIcons({ root: tbody });
  }
}

function downloadRealPdf() {
  const element = document.getElementById('pdf-printable-area');
  const opt = {
    margin: [10, 10, 10, 10],
    filename: `EQA_Evaluation_Report_${Date.now()}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  showToast('กำลังประมวลผลไฟล์รายงาน PDF คุณภาพสูงพร้อมเฉลย...');
  if (window.html2pdf) {
    window.html2pdf().set(opt).from(element).save().then(() => {
      showToast('ดาวน์โหลดไฟล์ PDF เรียบร้อยแล้ว');
    });
  } else {
    window.print();
  }
}

// ============================================================================
// Event Listeners Binding on DOM Ready
// ============================================================================
window.addEventListener('DOMContentLoaded', () => {
  setupLoginController();

  // User Dashboard events
  document.getElementById('u-year-select')?.addEventListener('change', renderUserDashboard);
  document.getElementById('modal-entry-close-btn')?.addEventListener('click', closeEntryModal);
  document.getElementById('modal-entry-cancel-btn')?.addEventListener('click', closeEntryModal);
  document.getElementById('test-submission-form')?.addEventListener('submit', handleSaveSubmission);

  // Admin Portal Navigation Tabs
  document.getElementById('admin-tab-matrix-btn')?.addEventListener('click', () => switchAdminTab('matrix'));
  document.getElementById('admin-tab-results-btn')?.addEventListener('click', () => switchAdminTab('results'));
  document.getElementById('admin-tab-config-btn')?.addEventListener('click', () => switchAdminTab('config'));
  document.getElementById('admin-tab-lots-btn')?.addEventListener('click', () => switchAdminTab('lots'));
  document.getElementById('admin-tab-users-btn')?.addEventListener('click', () => switchAdminTab('users'));

  // Dashboard Matrix filters
  document.getElementById('matrix-filter-year')?.addEventListener('change', renderSubmissionMatrix);
  document.getElementById('matrix-filter-status')?.addEventListener('change', renderSubmissionMatrix);
  document.getElementById('matrix-refresh-btn')?.addEventListener('click', () => {
    apiInvalidateCache();
    renderSubmissionMatrix();
    showToast('รีเฟรชข้อมูลเรียบร้อย');
  });

  // Admin Results Filter events
  document.getElementById('admin-filter-user')?.addEventListener('change', renderAdminResultsTable);
  document.getElementById('admin-filter-year')?.addEventListener('change', renderAdminResultsTable);
  document.getElementById('admin-filter-month')?.addEventListener('change', renderAdminResultsTable);
  document.getElementById('admin-quick-pdf-btn')?.addEventListener('click', () => {
    const userFilter = document.getElementById('admin-filter-user').value;
    openPdfModal(userFilter);
  });
  document.getElementById('admin-export-pdf-all-btn')?.addEventListener('click', () => openPdfModal('ALL'));

  // Layer 1 Test Config events
  document.getElementById('admin-add-test-btn')?.addEventListener('click', () => openTestConfigModal(null));
  document.getElementById('modal-test-config-close-btn')?.addEventListener('click', closeTestConfigModal);
  document.getElementById('modal-test-config-cancel-btn')?.addEventListener('click', closeTestConfigModal);
  document.getElementById('cfg-test-type')?.addEventListener('change', toggleConfigOptionFields);
  document.getElementById('cfg-enable-levels')?.addEventListener('change', toggleConfigLevelAndMachineFields);
  document.getElementById('cfg-enable-machine')?.addEventListener('change', toggleConfigLevelAndMachineFields);
  document.getElementById('form-test-config')?.addEventListener('submit', handleSaveTestConfig);

  // Layer 2 Monthly Lot & Answer Keys events
  document.getElementById('lot-select-month')?.addEventListener('change', renderAdminLotAnswersConfig);
  document.getElementById('lot-select-year')?.addEventListener('change', renderAdminLotAnswersConfig);
  document.getElementById('btn-save-lot-answers')?.addEventListener('click', handleSaveLotAnswers);

  // Admin User Management events
  document.getElementById('admin-add-user-btn')?.addEventListener('click', openCreateUserModal);
  document.getElementById('modal-user-close-btn')?.addEventListener('click', closeCreateUserModal);
  document.getElementById('modal-user-cancel-btn')?.addEventListener('click', closeCreateUserModal);
  document.getElementById('form-user-create')?.addEventListener('submit', handleCreateUser);

  // PDF Modal events
  document.getElementById('pdf-close-btn')?.addEventListener('click', closePdfModal);
  document.getElementById('pdf-print-btn')?.addEventListener('click', () => window.print());
  document.getElementById('pdf-download-file-btn')?.addEventListener('click', downloadRealPdf);

  // Secret Audit Log access (Double click on Blue Logo for Admin only)
  const logoBtn = document.getElementById('app-logo-btn');
  logoBtn?.addEventListener('dblclick', () => {
    if (currentUser?.role === 'admin') {
      openAuditLogModal();
    }
  });

  // Audit Modal internal events
  document.getElementById('modal-audit-close-btn')?.addEventListener('click', closeAuditLogModal);
  document.getElementById('modal-audit-close-bottom-btn')?.addEventListener('click', closeAuditLogModal);
  document.getElementById('audit-refresh-btn')?.addEventListener('click', () => renderAuditLogsTable(true));
  document.getElementById('audit-filter-category')?.addEventListener('change', () => renderAuditLogsTable(false));
  document.getElementById('audit-filter-search')?.addEventListener('input', () => renderAuditLogsTable(false));

  // Start app
  initApp();
});
