// ============================================================================
// Main Application Bootstrap & Lifecycle Router
// ============================================================================

import {
  apiInvalidateCache
} from './firebase.js';

import {
  MONTH_NAMES,
  populateDynamicYearSelect,
  showToast,
  renderIcons
} from './utils.js';

import {
  checkInitialAuth,
  getCurrentUserState,
  setupLoginController,
  updateAuthUI,
  handleLogout
} from './auth.js';

import {
  renderUserDashboard,
  openEntryModal,
  closeEntryModal,
  handleSaveSubmission
} from './user.js';

import {
  switchAdminTab,
  loadAdminUsersDropdown,
  renderAdminTestConfigsList,
  openTestConfigModal,
  closeTestConfigModal,
  handleSaveTestConfig,
  toggleConfigOptionFields,
  toggleConfigLevelAndMachineFields,
  renderAdminLotAnswersConfig,
  handleSaveLotAnswers,
  renderAdminUsersTable,
  openCreateUserModal,
  closeCreateUserModal,
  handleCreateUser
} from './admin.js';

import {
  renderSubmissionMatrix,
  renderAdminResultsTable,
  exportAdminResultsCsv,
  openPdfModal,
  closePdfModal,
  downloadRealPdf
} from './report.js';

import {
  initAuditSecretTrigger
} from './audit.js';

// Application State Router
export async function initApp() {
  const viewLogin = document.getElementById('view-login');
  const viewUser = document.getElementById('view-user');
  const viewAdmin = document.getElementById('view-admin');

  const currentUser = await checkInitialAuth();

  viewLogin?.classList.add('hidden');
  viewUser?.classList.add('hidden');
  viewAdmin?.classList.add('hidden');

  updateAuthUI(currentUser, () => {
    initApp();
  });

  if (!currentUser) {
    viewLogin?.classList.remove('hidden');
  } else if (currentUser.role === 'admin') {
    viewAdmin?.classList.remove('hidden');
    await initAdminPortal();
  } else {
    viewUser?.classList.remove('hidden');
    await renderUserDashboard();
  }

  renderIcons();
}

// Initialize Admin Portal components & initial data
async function initAdminPortal() {
  const monthSelect = document.getElementById('admin-filter-month');
  if (monthSelect && monthSelect.children.length <= 1) {
    MONTH_NAMES.forEach((name, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = name;
      monthSelect.appendChild(opt);
    });
  }

  const lotMonthSelect = document.getElementById('lot-select-month');
  if (lotMonthSelect && lotMonthSelect.children.length === 0) {
    MONTH_NAMES.forEach((name, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = name;
      lotMonthSelect.appendChild(opt);
    });
    lotMonthSelect.value = new Date().getMonth();
  }

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
    populateDynamicYearSelect(lotYearSelect, true);
  }

  await loadAdminUsersDropdown();
  renderSubmissionMatrix((u, yr, mo) => openEntryModal(u, yr, mo, true));
}

// Bind Global DOM Event Listeners
window.addEventListener('DOMContentLoaded', () => {
  // Login Form
  setupLoginController((_user) => {
    initApp();
  });

  // User Dashboard
  document.getElementById('u-year-select')?.addEventListener('change', renderUserDashboard);
  document.getElementById('modal-entry-close-btn')?.addEventListener('click', closeEntryModal);
  document.getElementById('modal-entry-cancel-btn')?.addEventListener('click', closeEntryModal);
  document.getElementById('test-submission-form')?.addEventListener('submit', (e) => {
    handleSaveSubmission(e, () => {
      const user = getCurrentUserState();
      if (user?.role === 'admin') {
        renderAdminResultsTable((u, y, m, ro) => openEntryModal(u, y, m, ro));
      } else {
        renderUserDashboard();
      }
    });
  });

  // Admin Tab Navigation
  const adminCallbacks = {
    renderMatrix: () => renderSubmissionMatrix((u, yr, mo) => openEntryModal(u, yr, mo, true)),
    renderResults: () => renderAdminResultsTable((u, y, m, ro) => openEntryModal(u, y, m, ro))
  };

  document.getElementById('admin-tab-matrix-btn')?.addEventListener('click', () => switchAdminTab('matrix', adminCallbacks));
  document.getElementById('admin-tab-results-btn')?.addEventListener('click', () => switchAdminTab('results', adminCallbacks));
  document.getElementById('admin-tab-config-btn')?.addEventListener('click', () => switchAdminTab('config', adminCallbacks));
  document.getElementById('admin-tab-lots-btn')?.addEventListener('click', () => switchAdminTab('lots', adminCallbacks));
  document.getElementById('admin-tab-users-btn')?.addEventListener('click', () => switchAdminTab('users', adminCallbacks));

  // Dashboard Matrix filters
  document.getElementById('matrix-filter-year')?.addEventListener('change', () => {
    renderSubmissionMatrix((u, yr, mo) => openEntryModal(u, yr, mo, true));
  });
  document.getElementById('matrix-filter-status')?.addEventListener('change', () => {
    renderSubmissionMatrix((u, yr, mo) => openEntryModal(u, yr, mo, true));
  });
  document.getElementById('matrix-refresh-btn')?.addEventListener('click', () => {
    apiInvalidateCache();
    renderSubmissionMatrix((u, yr, mo) => openEntryModal(u, yr, mo, true));
    showToast('รีเฟรชข้อมูลเรียบร้อย');
  });

  // Admin Results Filter & Actions
  const onResultsOpenEntry = (u, y, m, ro) => openEntryModal(u, y, m, ro);
  document.getElementById('admin-filter-user')?.addEventListener('change', () => renderAdminResultsTable(onResultsOpenEntry));
  document.getElementById('admin-filter-year')?.addEventListener('change', () => renderAdminResultsTable(onResultsOpenEntry));
  document.getElementById('admin-filter-month')?.addEventListener('change', () => renderAdminResultsTable(onResultsOpenEntry));

  // Quick PDF & CSV Export buttons
  document.getElementById('admin-quick-pdf-btn')?.addEventListener('click', () => {
    const userFilter = document.getElementById('admin-filter-user')?.value || 'ALL';
    openPdfModal(userFilter);
  });
  document.getElementById('admin-export-pdf-all-btn')?.addEventListener('click', () => openPdfModal('ALL'));
  document.getElementById('admin-export-csv-btn')?.addEventListener('click', exportAdminResultsCsv);

  // Layer 1 Test Config events
  document.getElementById('admin-add-test-btn')?.addEventListener('click', () => openTestConfigModal(null));
  document.getElementById('modal-test-config-close-btn')?.addEventListener('click', closeTestConfigModal);
  document.getElementById('modal-test-config-cancel-btn')?.addEventListener('click', closeTestConfigModal);
  document.getElementById('cfg-test-type')?.addEventListener('change', toggleConfigOptionFields);
  document.getElementById('cfg-enable-levels')?.addEventListener('change', toggleConfigLevelAndMachineFields);
  document.getElementById('cfg-enable-machine')?.addEventListener('change', toggleConfigLevelAndMachineFields);
  document.getElementById('form-test-config')?.addEventListener('submit', (e) => handleSaveTestConfig(e, adminCallbacks));

  // Layer 2 Monthly Lot & Answer Keys events
  document.getElementById('lot-select-month')?.addEventListener('change', renderAdminLotAnswersConfig);
  document.getElementById('lot-select-year')?.addEventListener('change', renderAdminLotAnswersConfig);
  document.getElementById('btn-save-lot-answers')?.addEventListener('click', () => {
    handleSaveLotAnswers(() => {
      renderAdminResultsTable(onResultsOpenEntry);
    });
  });

  // Admin User Management events
  document.getElementById('admin-add-user-btn')?.addEventListener('click', openCreateUserModal);
  document.getElementById('modal-user-close-btn')?.addEventListener('click', closeCreateUserModal);
  document.getElementById('modal-user-cancel-btn')?.addEventListener('click', closeCreateUserModal);
  document.getElementById('form-user-create')?.addEventListener('submit', (e) => handleCreateUser(e, adminCallbacks));

  // PDF Modal events
  document.getElementById('pdf-close-btn')?.addEventListener('click', closePdfModal);
  document.getElementById('pdf-print-btn')?.addEventListener('click', () => window.print());
  document.getElementById('pdf-download-file-btn')?.addEventListener('click', downloadRealPdf);

  // Initialize Secret Audit Trigger on Blue Logo
  initAuditSecretTrigger();

  // Boot app
  initApp();
});
