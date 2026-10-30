// ============================================================================
// User Dashboard & Test Submission Controller
// ============================================================================

import {
  apiGetSubmissions,
  apiSaveSubmission,
  apiGetTestConfigs,
  apiGetMonthlyLots
} from './firebase.js';

import {
  esc,
  MONTH_NAMES,
  populateDynamicYearSelect,
  showToast,
  formatErrorMessage,
  renderIcons,
  setButtonLoading
} from './utils.js';

import { getCurrentUserState } from './auth.js';
import { logAuditEvent } from './audit.js';

let userSubmittedOpen = true;
let userOthersOpen = false;

let currentEditingSubmission = null;
let currentModalTestConfigs = [];
let currentMachineCounts = {}; // { [testId]: number }
let cachedUserLots = {};

// Setup Collapsible Accordion Sections in User Dashboard
export function setupUserCollapsibleSections() {
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

// Render User Dashboard View
export async function renderUserDashboard() {
  const currentUser = getCurrentUserState();
  if (!currentUser) return;

  setupUserCollapsibleSections();

  const yearSelect = document.getElementById('u-year-select');
  if (yearSelect && yearSelect.children.length === 0) {
    populateDynamicYearSelect(yearSelect, false);
  }
  const selectedYear = parseInt(yearSelect?.value, 10) || new Date().getFullYear();

  // User-scoped submissions retrieval (Optimized & Secure)
  const userKey = currentUser.username || currentUser.email?.split('@')[0];
  const submissions = await apiGetSubmissions(false, currentUser.role === 'admin' ? null : userKey);
  const testConfigs = await apiGetTestConfigs();
  cachedUserLots = await apiGetMonthlyLots(false);

  const today = new Date();
  const realYear = today.getFullYear();
  const realMonth = today.getMonth();
  const realDay = today.getDate();

  // Populate User Profile Header
  document.getElementById('u-org-name').textContent = currentUser.name || currentUser.orgName || currentUser.username;
  document.getElementById('u-member-id').textContent = currentUser.code || currentUser.memberCode || 'LAB-001';
  document.getElementById('u-org-address').textContent = currentUser.department || 'แผนกห้องปฏิบัติการมาตรฐาน';
  document.getElementById('u-contact-person').textContent = currentUser.contact || currentUser.contactPerson || 'เจ้าหน้าที่ผู้รับผิดชอบ';
  document.getElementById('u-current-year').textContent = `${selectedYear + 543} (${selectedYear})`;

  let submittedCount = 0;
  for (let m = 0; m < 12; m++) {
    const key = `${userKey}_${selectedYear}_${m}`;
    if (submissions[key]) submittedCount++;
  }
  document.getElementById('u-stat-submitted').textContent = submittedCount;
  document.getElementById('u-stat-pending').textContent = Math.max(0, 12 - submittedCount);

  // Containers
  const deadlineAlertContainer = document.getElementById('u-deadline-alert-container');
  const activeContainer = document.getElementById('u-active-month-container');
  const submittedGrid = document.getElementById('u-submitted-grid');
  const othersGrid = document.getElementById('u-others-grid');
  const badgeSubCount = document.getElementById('u-badge-submitted-count');
  const badgeOthCount = document.getElementById('u-badge-others-count');

  if (deadlineAlertContainer) deadlineAlertContainer.innerHTML = '';
  if (activeContainer) activeContainer.innerHTML = '';
  if (submittedGrid) submittedGrid.innerHTML = '';
  if (othersGrid) othersGrid.innerHTML = '';

  let submittedCardsCount = 0;
  let othersCardsCount = 0;

  const isViewingCurrentYear = (selectedYear === realYear);
  const activeMonthIdx = isViewingCurrentYear ? realMonth : null;
  const activeMonthKey = `${userKey}_${realYear}_${realMonth}`;
  const isCurrentMonthSubmitted = Boolean(submissions[activeMonthKey]);

  // =========================================================================
  // Feature C3: Near Month-End Urgent Warning Banner (If Day >= 20 and Unsubmitted)
  // =========================================================================
  if (deadlineAlertContainer) {
    if (realDay >= 20 && !isCurrentMonthSubmitted && isViewingCurrentYear) {
      const banner = document.createElement('div');
      banner.className = 'bg-amber-50 border-l-4 border-amber-500 p-4 rounded-xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 mb-2';
      banner.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
            <i data-lucide="alert-triangle" class="w-5 h-5"></i>
          </div>
          <div>
            <div class="text-sm font-bold text-amber-900">แจ้งเตือน: ใกล้สิ้นสุดรอบการส่งผลประจำเดือน ${MONTH_NAMES[realMonth]}</div>
            <div class="text-xs text-amber-700 mt-0.5">ขณะนี้ถึงช่วงปลายเดือนแล้ว กรุณาบันทึกผลการทดสอบให้เรียบร้อยก่อนปิดรอบสิ้นเดือนนี้ค่ะ</div>
          </div>
        </div>
        <button id="u-deadline-quick-enter-btn" class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold whitespace-nowrap transition flex items-center justify-center gap-1.5 shadow-sm">
          <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
          <span>ลงผลทันที</span>
        </button>
      `;
      deadlineAlertContainer.appendChild(banner);
      renderIcons(deadlineAlertContainer);

      document.getElementById('u-deadline-quick-enter-btn')?.addEventListener('click', () => {
        openEntryModal(userKey, realYear, realMonth, false);
      });
    }
  }

  // =========================================================================
  // 1. Top Hero Banner: Active Month (Large Full-Width)
  // =========================================================================
  if (activeMonthIdx !== null) {
    const activeLotKey = `${selectedYear}_${activeMonthIdx}`;
    const activeLotInfo = cachedUserLots[activeLotKey];
    const activeSub = submissions[activeMonthKey];
    const isActiveSubmitted = Boolean(activeSub);

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
            const lvDetails = Object.entries(mData).map(([lv, val]) => `${esc(lv)}: ${esc(val)}`).join(', ');
            summaryItems.push(`
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white border border-slate-200 text-xs shadow-2xs">
                <span class="font-semibold text-slate-700">${esc(t.name)}</span>
                <span class="text-slate-400 font-mono text-[11px]">(${esc(mKey)})</span>
                <span class="font-bold text-indigo-700">${lvDetails} ${esc(t.unit || '')}</span>
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
              ? 'ท่านได้ส่งผลการทดสอบรอบนี้แล้ว สามารถตรวจสอบผลหรือแก้ไขข้อมูลได้ตลอดระยะเวลาที่เปิดรับ' 
              : 'เปิดรับรายงานผลการทดสอบ กรุณากรอกผลการตรวจวัดให้ครบถ้วนตามรายการที่กำหนด'
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

    document.getElementById('hero-view-btn')?.addEventListener('click', () => openEntryModal(userKey, selectedYear, activeMonthIdx, true));
    document.getElementById('hero-edit-btn')?.addEventListener('click', () => openEntryModal(userKey, selectedYear, activeMonthIdx, false));
    document.getElementById('hero-enter-btn')?.addEventListener('click', () => openEntryModal(userKey, selectedYear, activeMonthIdx, false));
  } else {
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

  // Create Compact Month Card Helper
  function createMonthCard(m, sub, lotInfo, isPastMonth, isSubmitted) {
    const card = document.createElement('div');
    card.className = `p-4 rounded-2xl border transition-all ${
      isSubmitted 
        ? 'bg-white border-emerald-200/90 shadow-2xs hover:shadow-xs' 
        : 'bg-white border-slate-200/80 opacity-90'
    }`;

    const statusBadgeHtml = isSubmitted
      ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"><i data-lucide="check" class="w-3 h-3"></i> ส่งแล้ว</span>`
      : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200"><i data-lucide="lock" class="w-3 h-3"></i> ปิดรอบแล้ว</span>`;

    const cardContentHtml = isSubmitted
      ? `
        <div class="mt-2.5 pt-2.5 border-t border-slate-100 text-xs">
          ${lotInfo?.lotNumber ? `<div class="text-[11px] font-mono text-indigo-600 font-bold mb-1">LOT: ${esc(lotInfo.lotNumber)}</div>` : ''}
          <div class="text-[11px] text-slate-400 flex items-center justify-between mt-1">
            <span>ส่งเมื่อ: ${esc(sub.submittedAt || '-')}</span>
          </div>
        </div>
      `
      : `
        <div class="mt-2.5 pt-2.5 border-t border-slate-100 text-xs text-slate-400">
          ${lotInfo?.lotNumber ? `<div class="text-[11px] font-mono text-indigo-500 font-medium mb-1">LOT: ${esc(lotInfo.lotNumber)}</div>` : ''}
          <p class="text-[11px]">สิ้นสุดระยะเวลาการรายงานผล</p>
        </div>
      `;

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

  // Iterate months (Approach 2: do not show future unopened months)
  for (let m = 0; m < 12; m++) {
    const monthKey = `${userKey}_${selectedYear}_${m}`;
    const lotKey = `${selectedYear}_${m}`;
    const lotInfo = cachedUserLots[lotKey];
    const sub = submissions[monthKey];
    const isSubmitted = Boolean(sub);

    let isPastMonth = false;
    if (selectedYear < realYear) {
      isPastMonth = true;
    } else if (selectedYear === realYear) {
      if (m < realMonth) isPastMonth = true;
    }

    const isFutureMonth = (selectedYear > realYear) || (selectedYear === realYear && m > realMonth);
    if (isFutureMonth) continue;

    if (isSubmitted) {
      submittedCardsCount++;
      const card = createMonthCard(m, sub, lotInfo, isPastMonth, true);
      submittedGrid.appendChild(card);
    } else if (isPastMonth) {
      othersCardsCount++;
      const card = createMonthCard(m, sub, lotInfo, true, false);
      othersGrid.appendChild(card);
    }
  }

  if (badgeSubCount) badgeSubCount.textContent = `${submittedCardsCount} รอบ`;
  if (badgeOthCount) badgeOthCount.textContent = `${othersCardsCount} รอบ`;

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

  renderIcons(document.getElementById('view-user'));
}

// Open Multi-Level & Multi-Machine Entry Modal
export async function openEntryModal(username, year, monthIndex, isReadOnly = false) {
  const currentUser = getCurrentUserState();
  const monthKey = `${username}_${year}_${monthIndex}`;
  const lotKey = `${year}_${monthIndex}`;

  const submissions = await apiGetSubmissions(false, currentUser?.role === 'admin' ? null : username);
  const existing = submissions[monthKey];
  currentEditingSubmission = existing;
  currentModalTestConfigs = await apiGetTestConfigs();
  cachedUserLots = await apiGetMonthlyLots(currentUser?.role === 'admin');
  const lotInfo = cachedUserLots[lotKey];

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
    document.getElementById('entry-submitted-at').textContent = `บันทึกเมื่อ: ${esc(existing.submittedAt)}`;
    document.getElementById('entry-submitted-by').textContent = `ผู้บันทึก: ${esc(username)}`;
  } else {
    historyMeta.classList.add('hidden');
  }

  renderDynamicModalFields(isReadOnly);

  const remarksInput = document.getElementById('entry-remarks');
  remarksInput.value = existing ? (existing.remarks || '') : '';
  remarksInput.disabled = isReadOnly;

  document.getElementById('modal-entry').classList.remove('hidden');
  renderIcons(document.getElementById('modal-entry'));
}

export function closeEntryModal() {
  document.getElementById('modal-entry').classList.add('hidden');
}

// Render Test Fields dynamically with full XSS Sanitization
function renderDynamicModalFields(isReadOnly) {
  const container = document.getElementById('dynamic-test-fields');
  container.innerHTML = '';
  currentMachineCounts = {};

  currentModalTestConfigs.forEach((test, idx) => {
    const existingTestRes = currentEditingSubmission?.results?.[test.id] || {};
    const existingMachineKeys = Object.keys(existingTestRes);
    const initialMachineCount = existingMachineKeys.length > 0 ? existingMachineKeys.length : 1;
    currentMachineCounts[test.id] = initialMachineCount;

    const fieldCard = document.createElement('div');
    fieldCard.className = 'p-5 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-4';
    fieldCard.id = `test-wrapper-${test.id}`;

    fieldCard.innerHTML = `
      <div class="flex items-center justify-between border-b border-slate-200/80 pb-3">
        <div>
          <div class="flex items-center gap-2">
            <span class="w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-mono font-bold">${idx + 1}</span>
            <h4 class="text-sm font-bold text-slate-800">${esc(test.name)}</h4>
            <span class="text-xs text-slate-400 font-mono">[${esc(test.key)}]</span>
          </div>
          ${test.description ? `<p class="text-xs text-slate-500 pl-8 mt-0.5">${esc(test.description)}</p>` : ''}
        </div>
        <div class="flex items-center gap-2">
          ${test.enableLevels ? `<span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">${test.levels.length} Levels</span>` : ''}
          ${test.enableMultiMachine ? `<span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">หลายเครื่องตรวจ (สูงสุด ${test.maxMachines || 3})</span>` : ''}
        </div>
      </div>
      <div id="machines-container-${test.id}" class="space-y-4 pl-2 sm:pl-4"></div>
    `;

    if (test.enableMultiMachine && !isReadOnly) {
      const addMachineBtnWrap = document.createElement('div');
      addMachineBtnWrap.className = 'pt-2 flex justify-end';
      const addMBtn = document.createElement('button');
      addMBtn.type = 'button';
      addMBtn.className = 'px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold transition flex items-center gap-1.5 shadow-sm';
      addMBtn.innerHTML = '<i data-lucide="plus" class="w-3.5 h-3.5"></i> <span>+ เพิ่มเครื่องตรวจวัด</span>';
      addMBtn.onclick = () => {
        if (currentMachineCounts[test.id] >= (test.maxMachines || 3)) {
          showToast(`รายการทดสอบนี้กำหนดให้บันทึกได้สูงสุด ${test.maxMachines || 3} เครื่องค่ะ`, 'error');
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

    machineBox.innerHTML = `
      <div class="flex items-center justify-between border-b border-slate-100 pb-2">
        <span class="text-xs font-bold text-slate-700 flex items-center gap-1.5 font-mono">
          <i data-lucide="cpu" class="w-3.5 h-3.5 text-indigo-500"></i> ${esc(machineName)}
        </span>
        ${(count > 1 && !isReadOnly && m === count) ? `
          <button type="button" class="text-xs text-rose-500 hover:text-rose-700 flex items-center gap-1 remove-machine-btn" data-testid="${esc(test.id)}">
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
          return `<option value="${esc(opt)}" ${savedVal === opt ? 'selected' : ''}>${esc(opt)}</option>`;
        }).join('');
        inputHtml = `
          <select id="${esc(fieldId)}" ${isReadOnly ? 'disabled' : 'required'} class="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100">
            <option value="">-- เลือก --</option>
            ${optionsHtml}
          </select>
        `;
      } else if (test.type === 'number') {
        inputHtml = `
          <div class="relative">
            <input type="number" step="any" id="${esc(fieldId)}" value="${esc(savedVal)}" ${isReadOnly ? 'disabled' : 'required'} placeholder="ระบุตัวเลข" class="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 pr-12 focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100">
            ${test.unit ? `<span class="absolute inset-y-0 right-0 pr-2 flex items-center text-[11px] font-semibold text-slate-400 pointer-events-none">${esc(test.unit)}</span>` : ''}
          </div>
        `;
      } else {
        inputHtml = `
          <input type="text" id="${esc(fieldId)}" value="${esc(savedVal)}" ${isReadOnly ? 'disabled' : 'required'} placeholder="พิมพ์คำตอบ" class="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100">
        `;
      }

      lvCol.innerHTML = `
        <label class="block text-[11px] font-bold text-slate-600">${esc(lv)}</label>
        ${inputHtml}
      `;
      levelsRow.appendChild(lvCol);
    });

    const remBtn = machineBox.querySelector('.remove-machine-btn');
    if (remBtn) {
      remBtn.addEventListener('click', () => {
        if (currentMachineCounts[test.id] > 1) {
          currentMachineCounts[test.id]--;
          renderMachinesForTest(test, isReadOnly);
        }
      });
    }

    container.appendChild(machineBox);
  }

  renderIcons(container);
}

// Handle Form Submission Save with Month-Lock and Double-Submit Guard
export async function handleSaveSubmission(event, onSavedCallback) {
  event.preventDefault();
  const currentUser = getCurrentUserState();
  const saveBtn = document.getElementById('btn-save-entry');

  const monthKey = document.getElementById('entry-month-key').value;
  const [username, yearStr, monthIdxStr] = monthKey.split('_');
  const year = parseInt(yearStr, 10);
  const monthIndex = parseInt(monthIdxStr, 10);

  // =========================================================================
  // Security Enforcement (H3): Strict Month-Lock for Regular Lab Users
  // =========================================================================
  if (currentUser?.role !== 'admin') {
    const now = new Date();
    if (year !== now.getFullYear() || monthIndex !== now.getMonth()) {
      showToast('ระบบเปิดให้ลงผลหรือแก้ไขได้เฉพาะรอบประจำเดือนปัจจุบันเท่านั้นค่ะ', 'error');
      return;
    }
  }

  setButtonLoading(saveBtn, true, 'กำลังบันทึกผล...');

  try {
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
    showToast(`บันทึกผลการทดสอบประจำเดือน ${MONTH_NAMES[monthIndex]} สำเร็จเรียบร้อย`);

    logAuditEvent(
      isEdit ? 'SUBMISSION_UPDATE' : 'SUBMISSION_CREATE',
      'SUBMISSION',
      `${username} (${year}-${monthIndex + 1})`,
      `${currentUser.role === 'admin' ? '[ผู้ดูแลระบบบันทึกแทน] ' : ''}${isEdit ? 'แก้ไขผลการทดสอบ' : 'ส่งผลการทดสอบใหม่'} ประจำเดือน ${MONTH_NAMES[monthIndex]} ${year + 543}`
    );

    if (typeof onSavedCallback === 'function') {
      onSavedCallback();
    }
  } catch (err) {
    const friendlyMsg = formatErrorMessage(err);
    showToast(`เกิดข้อผิดพลาดในการบันทึก: ${friendlyMsg}`, 'error');
  } finally {
    setButtonLoading(saveBtn, false);
  }
}
