// ============================================================================
// Administrator Control Panel & Configurations Controller
// ============================================================================

import {
  apiGetUsers,
  apiCreateUserByAdmin,
  apiUpdateUser,
  apiDeleteUser,
  apiGetTestConfigs,
  apiSaveTestConfig,
  apiDeleteTestConfig,
  apiGetMonthlyLots,
  apiSaveMonthlyLot
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

import { logAuditEvent } from './audit.js';

let cachedUsersList = [];
let cachedAdminMonthlyLots = {};

// Switch Admin Tabs (Matrix, Results, Config, Lots, Users)
export function switchAdminTab(tabName, callbacks = {}) {
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
    if (callbacks.renderMatrix) callbacks.renderMatrix();
  } else if (tabName === 'results') {
    resultsTab?.classList.remove('hidden');
    if (resultsBtn) resultsBtn.className = activeClass;
    if (callbacks.renderResults) callbacks.renderResults();
  } else if (tabName === 'config') {
    configTab?.classList.remove('hidden');
    if (configBtn) configBtn.className = activeClass;
    renderAdminTestConfigsList(callbacks);
  } else if (tabName === 'lots') {
    lotsTab?.classList.remove('hidden');
    if (lotsBtn) lotsBtn.className = activeClass;
    renderAdminLotAnswersConfig();
  } else {
    usersTab?.classList.remove('hidden');
    if (usersBtn) usersBtn.className = activeClass;
    renderAdminUsersTable(callbacks);
  }

  renderIcons(document.getElementById('view-admin'));
}

// Populate Admin Users Filter Dropdown
export async function loadAdminUsersDropdown() {
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

// ============================================================================
// TAB 2: Test Configurations Management (Layer 1)
// ============================================================================
export async function renderAdminTestConfigsList(callbacks = {}) {
  const tests = await apiGetTestConfigs();
  const countBadge = document.getElementById('admin-tests-count-badge');
  if (countBadge) countBadge.textContent = tests.length;

  const container = document.getElementById('admin-tests-list');
  if (!container) return;
  container.innerHTML = '';

  tests.forEach((test, idx) => {
    const card = document.createElement('div');
    card.className = 'bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-indigo-200 transition';

    let typeBadge = '';
    let detailsHtml = '';

    if (test.type === 'select') {
      typeBadge = '<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">ตัวเลือก (Dropdown)</span>';
      detailsHtml = `<div class="text-xs text-slate-500 mt-1">ตัวเลือก: <span class="font-medium text-slate-700">${(test.options || []).map(esc).join(' | ')}</span></div>`;
    } else if (test.type === 'number') {
      typeBadge = `<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">ตัวเลข (${esc(test.unit || 'ไม่ระบุหน่วย')})</span>`;
      detailsHtml = `<div class="text-xs text-slate-500 mt-1">หน่วยวัด: <span class="font-semibold text-slate-700">${esc(test.unit || '-')}</span></div>`;
    } else {
      typeBadge = '<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">พิมพ์ข้อความสั้น</span>';
      detailsHtml = `<div class="text-xs text-slate-500 mt-1">พิมพ์คำตอบแบบกระชับ</div>`;
    }

    const levelsInfo = test.enableLevels 
      ? `<span class="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">Levels: ${(test.levels || []).map(esc).join(', ')}</span>`
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
        renderAdminTestConfigsList(callbacks);
        if (callbacks.renderResults) callbacks.renderResults();
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
            <h4 class="text-base font-bold text-slate-800">${esc(test.name)}</h4>
            <span class="text-xs text-slate-400 font-mono font-medium">[${esc(test.key)}]</span>
          </div>
          <p class="text-xs text-slate-500 mt-0.5">${esc(test.description || 'ไม่มีคำอธิบาย')}</p>
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

  renderIcons(container);
}

export function toggleConfigOptionFields() {
  const type = document.getElementById('cfg-test-type')?.value;
  const boxOptions = document.getElementById('cfg-box-options');
  const boxUnit = document.getElementById('cfg-box-unit');

  if (type === 'select') {
    boxOptions?.classList.remove('hidden');
    boxUnit?.classList.add('hidden');
  } else if (type === 'number') {
    boxOptions?.classList.add('hidden');
    boxUnit?.classList.remove('hidden');
  } else {
    boxOptions?.classList.add('hidden');
    boxUnit?.classList.add('hidden');
  }
}

export function toggleConfigLevelAndMachineFields() {
  const enableLevels = document.getElementById('cfg-enable-levels')?.checked;
  const boxLevels = document.getElementById('cfg-box-levels');
  if (enableLevels) boxLevels?.classList.remove('hidden');
  else boxLevels?.classList.add('hidden');

  const enableMachine = document.getElementById('cfg-enable-machine')?.checked;
  const boxMachine = document.getElementById('cfg-box-machine');
  if (enableMachine) boxMachine?.classList.remove('hidden');
  else boxMachine?.classList.add('hidden');
}

export async function openTestConfigModal(testId = null) {
  const tests = await apiGetTestConfigs();
  const modal = document.getElementById('modal-test-config');
  const title = document.getElementById('modal-test-config-title');
  if (!modal) return;

  if (testId) {
    const test = tests.find(t => t.id === testId);
    if (!test) return;
    if (title) title.textContent = `แก้ไขโครงสร้าง: ${test.name}`;
    document.getElementById('cfg-test-id').value = test.id;
    document.getElementById('cfg-test-key').value = test.key;
    document.getElementById('cfg-test-name').value = test.name;
    document.getElementById('cfg-test-desc').value = test.description || '';
    document.getElementById('cfg-test-type').value = test.type;
    document.getElementById('cfg-test-options').value = (test.options || []).join(', ');
    document.getElementById('cfg-test-unit').value = test.unit || '';
    document.getElementById('cfg-enable-levels').checked = Boolean(test.enableLevels);
    document.getElementById('cfg-levels-list').value = (test.levels || ['LV1', 'LV2', 'LV3']).join(', ');
    document.getElementById('cfg-enable-machine').checked = Boolean(test.enableMultiMachine);
    document.getElementById('cfg-max-machines').value = test.maxMachines || 3;
  } else {
    if (title) title.textContent = 'เพิ่มโครงสร้างแบบทดสอบใหม่';
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
  renderIcons(modal);
}

export function closeTestConfigModal() {
  document.getElementById('modal-test-config')?.classList.add('hidden');
}

export async function handleSaveTestConfig(event, callbacks = {}) {
  event.preventDefault();
  const saveBtn = event.target?.querySelector('button[type="submit"]');

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
  const maxMachines = parseInt(document.getElementById('cfg-max-machines').value, 10) || 3;

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

  setButtonLoading(saveBtn, true, 'กำลังบันทึกโครงสร้าง...');

  try {
    await apiSaveTestConfig(config);
    showToast(`บันทึกโครงสร้างแบบทดสอบ ${name} เรียบร้อยแล้ว`);
    logAuditEvent(
      testId ? 'CONFIG_UPDATE' : 'CONFIG_CREATE',
      'CONFIG',
      name,
      `${testId ? 'แก้ไข' : 'สร้างใหม่'} โครงสร้างแบบทดสอบ ${name} [${key}]`
    );
    closeTestConfigModal();
    renderAdminTestConfigsList(callbacks);
    if (callbacks.renderResults) callbacks.renderResults();
    renderAdminLotAnswersConfig();
  } catch (err) {
    showToast(`เกิดข้อผิดพลาด: ${formatErrorMessage(err)}`, 'error');
  } finally {
    setButtonLoading(saveBtn, false);
  }
}

// ============================================================================
// TAB 3: Monthly Lot & Answer Key Controller (Layer 2)
// ============================================================================
export async function renderAdminLotAnswersConfig() {
  const m = parseInt(document.getElementById('lot-select-month')?.value, 10) || 0;
  const y = parseInt(document.getElementById('lot-select-year')?.value, 10) || 2026;
  const lotKey = `${y}_${m}`;

  cachedAdminMonthlyLots = await apiGetMonthlyLots(true);
  const currentLot = cachedAdminMonthlyLots[lotKey] || {};
  const testConfigs = await apiGetTestConfigs();

  const lotNumInput = document.getElementById('lot-input-number');
  const remarksInput = document.getElementById('lot-input-remarks');
  if (lotNumInput) lotNumInput.value = currentLot.lotNumber || `LOT-${y}${String(m+1).padStart(2, '0')}-BKT`;
  if (remarksInput) remarksInput.value = currentLot.remarks || '';

  const container = document.getElementById('lot-answer-keys-container');
  if (!container) return;
  container.innerHTML = '';

  testConfigs.forEach((t) => {
    const levels = t.enableLevels && t.levels?.length > 0 ? t.levels : ['Result'];
    const card = document.createElement('div');
    card.className = 'p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3';

    card.innerHTML = `
      <div class="flex items-center justify-between border-b border-slate-200 pb-2">
        <div>
          <span class="text-xs font-bold text-slate-800">${esc(t.name)}</span>
          <span class="text-xs text-slate-400 font-mono ml-1">[${esc(t.key)}]</span>
        </div>
        <span class="text-[11px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
          ${t.type === 'number' ? `ตัวเลข (${esc(t.unit || '-')})` : t.type === 'select' ? 'ตัวเลือก' : 'ข้อความ'}
        </span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-${Math.min(levels.length, 3)} gap-3" id="lot-levels-box-${esc(t.id)}"></div>
    `;

    const levelsBox = card.querySelector(`#lot-levels-box-${t.id}`);
    levels.forEach(lv => {
      const savedAns = currentLot.answers?.[t.id]?.[lv] || {};
      const lvDiv = document.createElement('div');
      lvDiv.className = 'p-3 rounded-lg bg-white border border-slate-200 space-y-2';

      if (t.type === 'number') {
        lvDiv.innerHTML = `
          <label class="block text-xs font-bold text-indigo-700">${esc(lv)}</label>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <span class="text-[10px] text-slate-500 block">ช่วงต่ำสุด (Min)</span>
              <input type="number" step="any" id="ans_${esc(t.id)}_${esc(lv)}_min" value="${esc(savedAns.min || '')}" placeholder="Min" class="w-full text-xs border border-slate-200 rounded-lg p-1.5 focus:ring-2 focus:ring-indigo-500">
            </div>
            <div>
              <span class="text-[10px] text-slate-500 block">ช่วงสูงสุด (Max)</span>
              <input type="number" step="any" id="ans_${esc(t.id)}_${esc(lv)}_max" value="${esc(savedAns.max || '')}" placeholder="Max" class="w-full text-xs border border-slate-200 rounded-lg p-1.5 focus:ring-2 focus:ring-indigo-500">
            </div>
          </div>
        `;
      } else if (t.type === 'select') {
        const optionsHtml = (t.options || []).map(opt => `<option value="${esc(opt)}" ${savedAns.expected === opt ? 'selected' : ''}>${esc(opt)}</option>`).join('');
        lvDiv.innerHTML = `
          <label class="block text-xs font-bold text-indigo-700">${esc(lv)}</label>
          <span class="text-[10px] text-slate-500 block">คำตอบที่ถูกต้อง (Expected)</span>
          <select id="ans_${esc(t.id)}_${esc(lv)}_expected" class="w-full text-xs bg-white border border-slate-200 rounded-lg p-1.5 focus:ring-2 focus:ring-indigo-500">
            <option value="">-- เลือกคำตอบเฉลย --</option>
            ${optionsHtml}
          </select>
        `;
      } else {
        lvDiv.innerHTML = `
          <label class="block text-xs font-bold text-indigo-700">${esc(lv)}</label>
          <span class="text-[10px] text-slate-500 block">คำตอบที่ถูกต้อง (Expected)</span>
          <input type="text" id="ans_${esc(t.id)}_${esc(lv)}_expected" value="${esc(savedAns.expected || '')}" placeholder="พิมพ์คำตอบเฉลย" class="w-full text-xs border border-slate-200 rounded-lg p-1.5 focus:ring-2 focus:ring-indigo-500">
        `;
      }
      levelsBox.appendChild(lvDiv);
    });

    container.appendChild(card);
  });
}

export async function handleSaveLotAnswers(onSavedCallback) {
  const saveBtn = document.getElementById('btn-save-lot-answers');
  const m = parseInt(document.getElementById('lot-select-month').value, 10) || 0;
  const y = parseInt(document.getElementById('lot-select-year').value, 10) || 2026;
  const lotKey = `${y}_${m}`;
  const lotNumber = document.getElementById('lot-input-number').value.trim();
  const remarks = document.getElementById('lot-input-remarks').value.trim();

  setButtonLoading(saveBtn, true, 'กำลังบันทึก Lot...');

  try {
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

    if (typeof onSavedCallback === 'function') {
      onSavedCallback();
    }
  } catch (err) {
    showToast(`เกิดข้อผิดพลาดในการบันทึก Lot: ${formatErrorMessage(err)}`, 'error');
  } finally {
    setButtonLoading(saveBtn, false);
  }
}

// ============================================================================
// TAB 4: User Accounts Management
// ============================================================================
export async function renderAdminUsersTable(callbacks = {}) {
  const users = await apiGetUsers();
  const countBadge = document.getElementById('admin-users-count-badge');
  if (countBadge) countBadge.textContent = users.length;

  const tbody = document.getElementById('admin-users-table-body');
  if (!tbody) return;
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
        renderAdminUsersTable(callbacks);
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
        renderAdminUsersTable(callbacks);
        loadAdminUsersDropdown();
        if (callbacks.renderResults) callbacks.renderResults();
      }
    };

    actWrap.appendChild(toggleRoleBtn);
    actWrap.appendChild(delUserBtn);
    actTd.appendChild(actWrap);
    tr.appendChild(actTd);

    tbody.appendChild(tr);
  });

  renderIcons(tbody);
}

export function openCreateUserModal() {
  const form = document.getElementById('form-user-create');
  form?.reset();
  document.getElementById('modal-user-create')?.classList.remove('hidden');
  renderIcons(document.getElementById('modal-user-create'));
}

export function closeCreateUserModal() {
  document.getElementById('modal-user-create')?.classList.add('hidden');
}

export async function handleCreateUser(e, callbacks = {}) {
  e.preventDefault();
  const btn = document.getElementById('btn-save-new-user');

  const email = document.getElementById('new-user-email').value.trim();
  const password = document.getElementById('new-user-password').value;
  const name = document.getElementById('new-user-name').value.trim();
  const code = document.getElementById('new-user-code').value.trim();
  const department = document.getElementById('new-user-department').value.trim();
  const contact = document.getElementById('new-user-contact').value.trim();
  const role = document.getElementById('new-user-role').value;

  setButtonLoading(btn, true, 'กำลังสร้างบัญชี...');

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
    renderAdminUsersTable(callbacks);
    loadAdminUsersDropdown();
    if (callbacks.renderResults) callbacks.renderResults();
  } catch (err) {
    showToast(`ไม่สามารถสร้างผู้ใช้งาน: ${formatErrorMessage(err)}`, 'error');
  } finally {
    setButtonLoading(btn, false);
  }
}
