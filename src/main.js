// ============================================================================
// Main Application Controller (Production Modular Architecture)
// ============================================================================

import {
  apiLogin,
  apiLogout,
  apiGetCurrentUser,
  apiGetTestConfigs,
  apiSaveTestConfig,
  apiDeleteTestConfig,
  apiGetSubmissions,
  apiSaveSubmission,
  apiDeleteSubmission,
  apiSeedFirestore,
  isFirebaseConfigured
} from './firebase.js';

const MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const STATIC_USERS = {
  'Test1': { name: 'ศูนย์ทดสอบสาขา 1 (หน่วยงานที่ 1)', code: 'LAB-001', department: 'แผนกเคมีคลินิกและโลหิตวิทยา', contact: 'คุณประสิทธิ์ รักษ์การแพทย์' },
  'Test2': { name: 'ศูนย์ทดสอบสาขา 2 (หน่วยงานที่ 2)', code: 'LAB-002', department: 'แผนกจุลชีววิทยาและภูมิคุ้มกันวิทยา', contact: 'คุณศิริพร สุขสวัสดิ์' },
  'admin': { name: 'ผู้ดูแลระบบส่วนกลาง (Admin)', code: 'ADMIN-HQ', department: 'ศูนย์บริหารจัดการข้อมูลการทดสอบกลาง', contact: 'ผู้ควบคุมระบบส่วนกลาง' }
};

let currentUser = null;

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
// Core Initialization & Routing
// ============================================================================
export async function initApp() {
  currentUser = await apiGetCurrentUser();

  const viewLogin = document.getElementById('view-login');
  const viewUser = document.getElementById('view-user');
  const viewAdmin = document.getElementById('view-admin');
  const navUserInfo = document.getElementById('nav-user-info');

  viewLogin.classList.add('hidden');
  viewUser.classList.add('hidden');
  viewAdmin.classList.add('hidden');

  if (!currentUser) {
    viewLogin.classList.remove('hidden');
    navUserInfo.innerHTML = `
      <div class="text-xs text-slate-500 flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full ${isFirebaseConfigured ? 'bg-emerald-500' : 'bg-amber-400'}"></span>
        <span>${isFirebaseConfigured ? 'พร้อมเชื่อมต่อ Cloud Firestore' : 'โหมดสแตนด์อโลน'}</span>
      </div>
    `;
  } else if (currentUser.role === 'admin') {
    viewAdmin.classList.remove('hidden');
    navUserInfo.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="text-right hidden sm:block">
          <div class="text-xs font-bold text-slate-800">${currentUser.name || currentUser.username}</div>
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
    navUserInfo.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="text-right hidden sm:block">
          <div class="text-xs font-bold text-slate-800">${currentUser.name || currentUser.username}</div>
          <div class="text-[11px] text-slate-500 font-mono">${currentUser.code || currentUser.memberCode || 'LAB-SITE'}</div>
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
  showToast('ออกจากระบบเรียบร้อย');
  initApp();
}

// ============================================================================
// Login Form Controller
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
      showToast(`ยินดีต้อนรับเข้าสู่ระบบ: ${user.name || user.username}`);
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
// User Dashboard Controller
// ============================================================================
async function renderUserDashboard() {
  if (!currentUser) return;

  const yearSelect = document.getElementById('u-year-select');
  const year = parseInt(yearSelect.value) || 2026;
  const submissions = await apiGetSubmissions();
  const testConfigs = await apiGetTestConfigs();

  // Populate Org Info Header
  const orgDetails = STATIC_USERS[currentUser.username] || {};
  document.getElementById('u-org-name').textContent = currentUser.orgName || currentUser.name || orgDetails.name || currentUser.username;
  document.getElementById('u-member-id').textContent = currentUser.memberCode || currentUser.code || orgDetails.code || 'LAB-001';
  document.getElementById('u-org-address').textContent = currentUser.department || orgDetails.department || 'ห้องปฏิบัติการมาตรฐาน';
  document.getElementById('u-contact-person').textContent = currentUser.contactPerson || currentUser.contact || orgDetails.contact || 'เจ้าหน้าที่ผู้รับผิดชอบ';
  document.getElementById('u-current-year').textContent = `${year + 543} (${year})`;

  // Calculate submitted vs pending
  let submittedCount = 0;
  for (let m = 0; m < 12; m++) {
    const key = `${currentUser.username}_${year}_${m}`;
    if (submissions[key]) submittedCount++;
  }
  document.getElementById('u-stat-submitted').textContent = submittedCount;
  document.getElementById('u-stat-pending').textContent = 12 - submittedCount;

  // Render 12 Month Grid Cards
  const container = document.getElementById('u-months-grid');
  container.innerHTML = '';

  for (let m = 0; m < 12; m++) {
    const monthKey = `${currentUser.username}_${year}_${m}`;
    const sub = submissions[monthKey];
    const isSubmitted = !!sub;

    const card = document.createElement('div');
    card.className = `p-5 rounded-2xl border transition-all ${
      isSubmitted 
        ? 'bg-white border-emerald-200/90 shadow-sm hover:shadow-md' 
        : 'bg-white border-slate-200 hover:border-sky-300 hover:shadow-sm'
    }`;

    let statusBadgeHtml = isSubmitted
      ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
           <i data-lucide="check" class="w-3 h-3"></i> ลงผลแล้ว
         </span>`
      : `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
           <i data-lucide="clock" class="w-3 h-3"></i> ยังไม่ได้ลงผล
         </span>`;

    let resultPreviewHtml = '';
    if (isSubmitted) {
      resultPreviewHtml = `
        <div class="mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
          ${testConfigs.map(t => {
            const val = sub.results?.[t.id] || '-';
            return `
              <div class="flex justify-between items-center text-slate-600">
                <span class="font-medium text-slate-500">${t.name}:</span>
                <span class="font-semibold text-slate-800 text-right truncate max-w-[140px]">${val} ${t.unit || ''}</span>
              </div>
            `;
          }).join('')}
          <div class="text-[10px] text-slate-400 pt-1 flex items-center justify-between">
            <span>บันทึก: ${sub.submittedAt}</span>
          </div>
        </div>
      `;
    } else {
      resultPreviewHtml = `
        <div class="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-400 py-2">
          ยังไม่มีการบันทึกผลการทดสอบในรอบเดือนนี้
        </div>
      `;
    }

    const actionDiv = document.createElement('div');
    actionDiv.className = 'mt-4 pt-3 border-t border-slate-100';

    if (isSubmitted) {
      actionDiv.className += ' grid grid-cols-2 gap-2';
      
      const viewBtn = document.createElement('button');
      viewBtn.className = 'w-full py-1.5 px-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-lg border border-slate-200 transition flex items-center justify-center gap-1';
      viewBtn.innerHTML = '<i data-lucide="eye" class="w-3.5 h-3.5 text-slate-500"></i> ดูผลย้อนหลัง';
      viewBtn.onclick = () => openEntryModal(currentUser.username, year, m, true);

      const editBtn = document.createElement('button');
      editBtn.className = 'w-full py-1.5 px-2 bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-medium rounded-lg border border-sky-200 transition flex items-center justify-center gap-1';
      editBtn.innerHTML = '<i data-lucide="edit-3" class="w-3.5 h-3.5 text-sky-600"></i> แก้ไขผล';
      editBtn.onclick = () => openEntryModal(currentUser.username, year, m, false);

      actionDiv.appendChild(viewBtn);
      actionDiv.appendChild(editBtn);
    } else {
      const enterBtn = document.createElement('button');
      enterBtn.className = 'w-full py-2 px-3 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center justify-center gap-1.5';
      enterBtn.innerHTML = '<i data-lucide="plus-circle" class="w-4 h-4"></i> เข้าลงผลการทดสอบ';
      enterBtn.onclick = () => openEntryModal(currentUser.username, year, m, false);
      actionDiv.appendChild(enterBtn);
    }

    card.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="font-bold text-slate-800 text-base">
          ${MONTH_NAMES[m]}
        </div>
        ${statusBadgeHtml}
      </div>
      ${resultPreviewHtml}
    `;
    card.appendChild(actionDiv);
    container.appendChild(card);
  }

  if (window.lucide) {
    window.lucide.createIcons({ root: container });
  }
}

// ============================================================================
// Entry Modal Controller (Submit & View Result)
// ============================================================================
async function openEntryModal(username, year, monthIndex, isReadOnly = false) {
  const monthKey = `${username}_${year}_${monthIndex}`;
  const submissions = await apiGetSubmissions();
  const existing = submissions[monthKey];
  const testConfigs = await apiGetTestConfigs();
  const orgDetails = STATIC_USERS[username] || {};

  document.getElementById('entry-month-key').value = monthKey;
  document.getElementById('modal-entry-title').textContent = `แบบบันทึกผลการทดสอบประจำเดือน ${MONTH_NAMES[monthIndex]} ${year + 543} (${year})`;
  document.getElementById('modal-entry-subtitle').textContent = `หน่วยงาน: ${orgDetails.name || username} (${orgDetails.code || 'LAB'})`;

  const badge = document.getElementById('modal-mode-badge');
  const saveBtn = document.getElementById('btn-save-entry');
  const historyMeta = document.getElementById('entry-history-meta');

  if (isReadOnly) {
    badge.textContent = 'ดูผลย้อนหลัง (READ-ONLY)';
    badge.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 uppercase tracking-wider';
    saveBtn.classList.add('hidden');
  } else {
    badge.textContent = existing ? 'แก้ไขผลการทดสอบ' : 'ลงผลการทดสอบใหม่';
    badge.className = existing 
      ? 'px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wider'
      : 'px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-700 uppercase tracking-wider';
    saveBtn.classList.remove('hidden');
  }

  if (existing) {
    historyMeta.classList.remove('hidden');
    document.getElementById('entry-submitted-at').textContent = `บันทึกเมื่อ: ${existing.submittedAt}`;
    document.getElementById('entry-submitted-by').textContent = `ผู้บันทึก: ${orgDetails.name || username}`;
  } else {
    historyMeta.classList.add('hidden');
  }

  // Render Dynamic Inputs
  const container = document.getElementById('dynamic-test-fields');
  container.innerHTML = '';

  testConfigs.forEach((test, idx) => {
    const currentVal = (existing && existing.results) ? (existing.results[test.id] || '') : '';
    const fieldWrapper = document.createElement('div');
    fieldWrapper.className = 'p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2';

    let inputHtml = '';
    if (test.type === 'select') {
      const optionsHtml = (test.options || []).map(opt => {
        const isSelected = (currentVal === opt) ? 'selected' : '';
        return `<option value="${opt}" ${isSelected}>${opt}</option>`;
      }).join('');

      inputHtml = `
        <select name="test_${test.id}" ${isReadOnly ? 'disabled' : 'required'} class="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-sky-500 disabled:bg-slate-100 disabled:text-slate-600">
          <option value="">-- กรุณาเลือกผลการทดสอบ --</option>
          ${optionsHtml}
        </select>
      `;
    } else if (test.type === 'number') {
      inputHtml = `
        <div class="relative">
          <input type="number" step="any" name="test_${test.id}" value="${currentVal}" ${isReadOnly ? 'disabled' : 'required'} placeholder="ระบุตัวเลข เช่น 100.5" class="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2.5 pr-16 focus:ring-2 focus:ring-sky-500 disabled:bg-slate-100 disabled:text-slate-600">
          ${test.unit ? `<span class="absolute inset-y-0 right-0 pr-3 flex items-center text-xs font-semibold text-slate-400 pointer-events-none">${test.unit}</span>` : ''}
        </div>
      `;
    } else {
      inputHtml = `
        <input type="text" name="test_${test.id}" value="${currentVal}" ${isReadOnly ? 'disabled' : 'required'} placeholder="พิมพ์ข้อความตอบสั้นๆ เช่น ผ่านเกณฑ์ หรือรหัสผล" class="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-sky-500 disabled:bg-slate-100 disabled:text-slate-600">
      `;
    }

    fieldWrapper.innerHTML = `
      <div class="flex items-center justify-between">
        <label class="text-sm font-bold text-slate-800 flex items-center gap-2">
          <span class="w-6 h-6 rounded-md bg-slate-200/70 text-slate-700 flex items-center justify-center text-xs font-mono">${idx + 1}</span>
          <span>${test.name}</span>
        </label>
        <span class="text-[11px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
          ${test.type === 'select' ? 'ตัวเลือก' : test.type === 'number' ? 'ตัวเลข' : 'ข้อความ'}
        </span>
      </div>
      ${test.description ? `<p class="text-xs text-slate-500 pl-8">${test.description}</p>` : ''}
      <div class="pl-8 pt-1">
        ${inputHtml}
      </div>
    `;

    container.appendChild(fieldWrapper);
  });

  const remarksInput = document.getElementById('entry-remarks');
  remarksInput.value = existing ? (existing.remarks || '') : '';
  remarksInput.disabled = isReadOnly;

  document.getElementById('modal-entry').classList.remove('hidden');
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function closeEntryModal() {
  document.getElementById('modal-entry').classList.add('hidden');
}

async function handleSaveSubmission(event) {
  event.preventDefault();
  const monthKey = document.getElementById('entry-month-key').value;
  const [username, yearStr, monthIdxStr] = monthKey.split('_');
  const year = parseInt(yearStr);
  const monthIndex = parseInt(monthIdxStr);

  const form = document.getElementById('test-submission-form');
  const formData = new FormData(form);

  const testConfigs = await apiGetTestConfigs();
  const results = {};
  testConfigs.forEach(test => {
    results[test.id] = formData.get(`test_${test.id}`) || '';
  });

  const remarks = document.getElementById('entry-remarks').value.trim();

  const now = new Date();
  const pad = n => n.toString().padStart(2, '0');
  const timeStamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const payload = {
    userId: currentUser.uid || `uid_${username}`,
    username,
    year,
    monthIndex,
    results,
    remarks,
    submittedAt: timeStamp
  };

  await apiSaveSubmission(monthKey, payload);
  closeEntryModal();
  showToast(`บันทึกผลการทดสอบประจำเดือน ${MONTH_NAMES[monthIndex]} สำเร็จ`);

  if (currentUser.role === 'admin') {
    renderAdminResultsTable();
  } else {
    renderUserDashboard();
  }
}

// ============================================================================
// Admin Portal Controller
// ============================================================================
function initAdminView() {
  const monthSelect = document.getElementById('admin-filter-month');
  if (monthSelect.children.length <= 1) {
    MONTH_NAMES.forEach((name, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = name;
      monthSelect.appendChild(opt);
    });
  }

  renderAdminResultsTable();
  renderAdminTestConfigsList();
}

function switchAdminTab(tabName) {
  const resultsTab = document.getElementById('admin-tab-results');
  const configTab = document.getElementById('admin-tab-config');
  const resultsBtn = document.getElementById('admin-tab-results-btn');
  const configBtn = document.getElementById('admin-tab-config-btn');

  if (tabName === 'results') {
    resultsTab.classList.remove('hidden');
    configTab.classList.add('hidden');
    resultsBtn.className = 'pb-3 text-sm font-bold border-b-2 border-indigo-600 text-indigo-600 flex items-center gap-2 transition';
    configBtn.className = 'pb-3 text-sm font-semibold border-b-2 border-transparent text-slate-500 hover:text-slate-800 flex items-center gap-2 transition';
    renderAdminResultsTable();
  } else {
    resultsTab.classList.add('hidden');
    configTab.classList.remove('hidden');
    resultsBtn.className = 'pb-3 text-sm font-semibold border-b-2 border-transparent text-slate-500 hover:text-slate-800 flex items-center gap-2 transition';
    configBtn.className = 'pb-3 text-sm font-bold border-b-2 border-indigo-600 text-indigo-600 flex items-center gap-2 transition';
    renderAdminTestConfigsList();
  }

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

async function renderAdminResultsTable() {
  const userFilter = document.getElementById('admin-filter-user').value;
  const yearFilter = parseInt(document.getElementById('admin-filter-year').value) || 2026;
  const monthFilter = document.getElementById('admin-filter-month').value;

  const submissions = await apiGetSubmissions();
  const testConfigs = await apiGetTestConfigs();

  // Progress summary cards
  ['Test1', 'Test2'].forEach(usr => {
    let count = 0;
    for (let m = 0; m < 12; m++) {
      if (submissions[`${usr}_${yearFilter}_${m}`]) count++;
    }
    const pct = Math.round((count / 12) * 100);
    const cardStat = document.getElementById(`admin-card-stat-${usr.toLowerCase()}`);
    const progress = document.getElementById(`admin-progress-${usr.toLowerCase()}`);
    if (cardStat) cardStat.textContent = `${count} / 12 เดือน (${pct}%)`;
    if (progress) progress.style.width = `${pct}%`;
  });

  // Table header
  const thead = document.getElementById('admin-table-header');
  thead.innerHTML = `
    <th class="py-3 px-4">ประจำเดือน</th>
    <th class="py-3 px-4">หน่วยงาน / รหัส</th>
    ${testConfigs.map(t => `<th class="py-3 px-4">${t.name} ${t.unit ? `<span class="text-[10px] text-slate-400 font-normal">(${t.unit})</span>` : ''}</th>`).join('')}
    <th class="py-3 px-4">วันที่บันทึก</th>
    <th class="py-3 px-4 text-center">จัดการ</th>
  `;

  const targetUsers = (userFilter === 'ALL') ? ['Test1', 'Test2'] : [userFilter];
  const targetMonths = (monthFilter === 'ALL') ? Array.from({length: 12}, (_, i) => i) : [parseInt(monthFilter)];

  const tbody = document.getElementById('admin-results-table-body');
  tbody.innerHTML = '';
  let matchCount = 0;

  targetMonths.forEach(m => {
    targetUsers.forEach(u => {
      const key = `${u}_${yearFilter}_${m}`;
      const sub = submissions[key];
      const userInfo = STATIC_USERS[u] || { name: u, code: u };

      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 transition border-b border-slate-100';

      if (sub) {
        matchCount++;
        const testsCells = testConfigs.map(t => {
          const val = sub.results?.[t.id] || '-';
          return `<td class="py-3 px-4 font-medium text-slate-800">${val}</td>`;
        }).join('');

        tr.innerHTML = `
          <td class="py-3 px-4 whitespace-nowrap">
            <span class="font-bold text-slate-800">${MONTH_NAMES[m]}</span>
            <span class="text-xs text-slate-400 block">${yearFilter + 543}</span>
          </td>
          <td class="py-3 px-4 whitespace-nowrap">
            <div class="font-semibold text-slate-800 text-xs">${userInfo.name}</div>
            <div class="text-[11px] text-slate-400 font-mono">${userInfo.code}</div>
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
        editBtn.title = 'แก้ไขผลนี้';
        editBtn.innerHTML = '<i data-lucide="edit-2" class="w-3.5 h-3.5"></i>';
        editBtn.onclick = () => openEntryModal(u, yearFilter, m, false);

        const delBtn = document.createElement('button');
        delBtn.className = 'p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition';
        delBtn.title = 'ลบผลการทดสอบนี้';
        delBtn.innerHTML = '<i data-lucide="trash-2" class="w-3.5 h-3.5"></i>';
        delBtn.onclick = async () => {
          if (confirm('คุณต้องการลบข้อมูลผลการทดสอบนี้หรือไม่?')) {
            await apiDeleteSubmission(key);
            showToast('ลบรายการผลการทดสอบเรียบร้อยแล้ว');
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
          </td>
          <td class="py-3 px-4 whitespace-nowrap">
            <div class="font-semibold text-slate-500 text-xs">${userInfo.name}</div>
            <div class="text-[11px] text-slate-400 font-mono">${userInfo.code}</div>
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
        addBtn.onclick = () => openEntryModal(u, yearFilter, m, false);
        actionTd.appendChild(addBtn);
        tr.appendChild(actionTd);
      }

      tbody.appendChild(tr);
    });
  });

  document.getElementById('admin-results-count-text').textContent = `แสดงผล ${matchCount} รายการที่ส่งแล้ว`;
  if (window.lucide) {
    window.lucide.createIcons({ root: tbody });
  }
}

// ============================================================================
// Test Configurations Controller
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
      typeBadge = '<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">รูปแบบ: ตัวเลือก (Dropdown)</span>';
      detailsHtml = `<div class="text-xs text-slate-500 mt-1">ตัวเลือก: <span class="font-medium text-slate-700">${(test.options || []).join(' | ')}</span></div>`;
    } else if (test.type === 'number') {
      typeBadge = '<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">รูปแบบ: ตัวเลข (Numeric)</span>';
      detailsHtml = `<div class="text-xs text-slate-500 mt-1">หน่วยวัด: <span class="font-semibold text-slate-700">${test.unit || 'ไม่ระบุหน่วย'}</span></div>`;
    } else {
      typeBadge = '<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">รูปแบบ: พิมพ์ข้อความสั้นๆ (Short Text)</span>';
      detailsHtml = `<div class="text-xs text-slate-500 mt-1">ให้พิมพ์ตอบข้อความแบบกระชับ</div>`;
    }

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
      if (confirm(`คุณต้องการลบแบบทดสอบ "${test.name}" หรือไม่?`)) {
        await apiDeleteTestConfig(test.id);
        showToast(`ลบรายการ ${test.name} เรียบร้อยแล้ว`);
        renderAdminTestConfigsList();
        renderAdminResultsTable();
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

async function openTestConfigModal(testId = null) {
  const tests = await apiGetTestConfigs();
  const modal = document.getElementById('modal-test-config');
  const title = document.getElementById('modal-test-config-title');

  if (testId) {
    const test = tests.find(t => t.id === testId);
    if (!test) return;
    title.textContent = `แก้ไขรายการ: ${test.name}`;
    document.getElementById('cfg-test-id').value = test.id;
    document.getElementById('cfg-test-key').value = test.key;
    document.getElementById('cfg-test-name').value = test.name;
    document.getElementById('cfg-test-desc').value = test.description || '';
    document.getElementById('cfg-test-type').value = test.type;
    document.getElementById('cfg-test-options').value = (test.options || []).join(', ');
    document.getElementById('cfg-test-unit').value = test.unit || '';
  } else {
    title.textContent = 'เพิ่มรายการ Test ใหม่';
    document.getElementById('cfg-test-id').value = '';
    document.getElementById('cfg-test-key').value = `TEST_${String.fromCharCode(65 + tests.length)}`;
    document.getElementById('cfg-test-name').value = `Test ${String.fromCharCode(65 + tests.length)}`;
    document.getElementById('cfg-test-desc').value = '';
    document.getElementById('cfg-test-type').value = 'select';
    document.getElementById('cfg-test-options').value = 'Positive, Negative';
    document.getElementById('cfg-test-unit').value = '';
  }

  toggleConfigOptionFields();
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

  const id = testId || `test_${Date.now()}`;
  const config = {
    id,
    key,
    name,
    description: desc,
    type,
    options,
    unit,
    order: Date.now()
  };

  await apiSaveTestConfig(config);
  showToast(`บันทึกแบบทดสอบ ${name} เรียบร้อย`);
  closeTestConfigModal();
  renderAdminTestConfigsList();
  renderAdminResultsTable();
}

// ============================================================================
// PDF Report Generation (Preview, Print & True PDF File Export)
// ============================================================================
async function openPdfModal(targetUser = 'ALL') {
  const year = parseInt(document.getElementById('admin-filter-year')?.value) || 2026;
  const submissions = await apiGetSubmissions();
  const testConfigs = await apiGetTestConfigs();

  document.getElementById('pdf-doc-number').textContent = `DOC-${year}-${Math.floor(1000 + Math.random() * 9000)}`;
  
  const now = new Date();
  const pad = n => n.toString().padStart(2, '0');
  document.getElementById('pdf-generated-date').textContent = `ออกเอกสารเมื่อ: ${pad(now.getDate())}/${pad(now.getMonth()+1)}/${year + 543} ${pad(now.getHours())}:${pad(now.getMinutes())} น.`;

  if (targetUser !== 'ALL' && STATIC_USERS[targetUser]) {
    const u = STATIC_USERS[targetUser];
    document.getElementById('pdf-site-name').textContent = u.name;
    document.getElementById('pdf-site-code').textContent = `รหัสสมาชิก: ${u.code}`;
    document.getElementById('pdf-filter-label').textContent = `ข้อมูลเฉพาะหน่วยงาน: ${u.name}`;
  } else {
    document.getElementById('pdf-site-name').textContent = 'รายงานรวมทุกหน่วยงาน (All Participating Sites)';
    document.getElementById('pdf-site-code').textContent = 'รหัสสมาชิก: ศูนย์ทดสอบ 1 & ศูนย์ทดสอบ 2';
    document.getElementById('pdf-filter-label').textContent = 'ครอบคลุมทุกหน่วยงานที่เข้าร่วมโครงการ';
  }

  document.getElementById('pdf-period-name').textContent = `ประจำปี ${year + 543} (${year})`;

  // Build Table Header
  const headerRow = document.getElementById('pdf-table-header');
  headerRow.innerHTML = `
    <th class="p-2 border-r border-slate-200">เดือน</th>
    <th class="p-2 border-r border-slate-200">หน่วยงาน</th>
    ${testConfigs.map(t => `<th class="p-2 border-r border-slate-200">${t.name}</th>`).join('')}
    <th class="p-2 border-r border-slate-200">วันที่ส่งผล</th>
    <th class="p-2 text-center">สถานะ</th>
  `;

  // Build Table Body
  const tbody = document.getElementById('pdf-table-body');
  tbody.innerHTML = '';
  const usersToExport = (targetUser === 'ALL') ? ['Test1', 'Test2'] : [targetUser];

  for (let m = 0; m < 12; m++) {
    usersToExport.forEach(u => {
      const key = `${u}_${year}_${m}`;
      const sub = submissions[key];
      const userInfo = STATIC_USERS[u] || { name: u, code: u };

      const tr = document.createElement('tr');
      tr.className = 'border-b border-slate-200';

      if (sub) {
        const testCells = testConfigs.map(t => {
          const val = sub.results?.[t.id] || '-';
          return `<td class="p-2 border-r border-slate-200 font-semibold text-slate-800">${val} ${t.unit || ''}</td>`;
        }).join('');

        tr.innerHTML = `
          <td class="p-2 border-r border-slate-200 font-bold text-slate-800">${MONTH_NAMES[m]}</td>
          <td class="p-2 border-r border-slate-200">${userInfo.name} <span class="text-slate-400">(${userInfo.code})</span></td>
          ${testCells}
          <td class="p-2 border-r border-slate-200 font-mono text-[11px]">${sub.submittedAt}</td>
          <td class="p-2 text-center text-emerald-700 font-bold">สมบูรณ์</td>
        `;
      } else {
        const emptyCells = testConfigs.map(() => `<td class="p-2 border-r border-slate-200 text-slate-300">-</td>`).join('');
        tr.innerHTML = `
          <td class="p-2 border-r border-slate-200 text-slate-500">${MONTH_NAMES[m]}</td>
          <td class="p-2 border-r border-slate-200 text-slate-500">${userInfo.name}</td>
          ${emptyCells}
          <td class="p-2 border-r border-slate-200 text-slate-400 text-center">-</td>
          <td class="p-2 text-center text-amber-600 font-semibold">รอส่งผล</td>
        `;
      }

      tbody.appendChild(tr);
    });
  }

  document.getElementById('modal-pdf').classList.remove('hidden');
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function closePdfModal() {
  document.getElementById('modal-pdf').classList.add('hidden');
}

/**
 * Download real PDF using html2pdf.js
 */
function downloadRealPdf() {
  const element = document.getElementById('pdf-printable-area');
  const opt = {
    margin: [10, 10, 10, 10],
    filename: `Monthly_Test_Report_${Date.now()}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  showToast('กำลังประมวลผลไฟล์ PDF คุณภาพสูง...');
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

  // Admin Portal events
  document.getElementById('admin-tab-results-btn')?.addEventListener('click', () => switchAdminTab('results'));
  document.getElementById('admin-tab-config-btn')?.addEventListener('click', () => switchAdminTab('config'));
  document.getElementById('admin-filter-user')?.addEventListener('change', renderAdminResultsTable);
  document.getElementById('admin-filter-year')?.addEventListener('change', renderAdminResultsTable);
  document.getElementById('admin-filter-month')?.addEventListener('change', renderAdminResultsTable);
  document.getElementById('admin-quick-pdf-btn')?.addEventListener('click', () => {
    const userFilter = document.getElementById('admin-filter-user').value;
    openPdfModal(userFilter);
  });
  document.getElementById('admin-export-pdf-all-btn')?.addEventListener('click', () => openPdfModal('ALL'));
  document.getElementById('pdf-site-btn-test1')?.addEventListener('click', () => openPdfModal('Test1'));
  document.getElementById('pdf-site-btn-test2')?.addEventListener('click', () => openPdfModal('Test2'));

  // Admin Test Config events
  document.getElementById('admin-add-test-btn')?.addEventListener('click', () => openTestConfigModal(null));
  document.getElementById('modal-test-config-close-btn')?.addEventListener('click', closeTestConfigModal);
  document.getElementById('modal-test-config-cancel-btn')?.addEventListener('click', closeTestConfigModal);
  document.getElementById('cfg-test-type')?.addEventListener('change', toggleConfigOptionFields);
  document.getElementById('form-test-config')?.addEventListener('submit', handleSaveTestConfig);

  // PDF Modal events
  document.getElementById('pdf-close-btn')?.addEventListener('click', closePdfModal);
  document.getElementById('pdf-print-btn')?.addEventListener('click', () => window.print());
  document.getElementById('pdf-download-file-btn')?.addEventListener('click', downloadRealPdf);

  // Seed Firebase utility
  document.getElementById('admin-seed-firebase-btn')?.addEventListener('click', async () => {
    if (!isFirebaseConfigured) {
      alert('ยังไม่ได้ใส่ Firebase Config ในไฟล์ .env หรือยังไม่ได้เชื่อมต่อ Firebase ค่ะ\nกรุณานำค่าจาก Firebase Console มาใส่ใน .env ก่อนนะคะ');
      return;
    }
    if (confirm('ต้องการนำข้อมูลตัวอย่าง Test A, B, C และผลทดสอบส่งขึ้น Cloud Firestore หรือไม่?')) {
      try {
        await apiSeedFirestore();
        showToast('Seed ข้อมูลขึ้น Cloud Firestore สำเร็จแล้ว!');
        renderAdminResultsTable();
      } catch (err) {
        alert('เกิดข้อผิดพลาดในการเชื่อมต่อ Firestore: ' + err.message);
      }
    }
  });

  // Start app
  initApp();
});
