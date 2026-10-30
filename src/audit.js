// ============================================================================
// Audit Logging & Security Trail Controller
// ============================================================================

import { apiAddAuditLog, apiGetAuditLogs } from './firebase.js';
import { esc, renderIcons } from './utils.js';

let cachedAuditLogs = [];
let auditCurrentUser = null;

export function setAuditCurrentUser(user) {
  auditCurrentUser = user;
}

// Fire-and-forget audit event logger
export function logAuditEvent(action, category, target, details, customActor = null) {
  const actor = customActor || auditCurrentUser;
  apiAddAuditLog({
    action,
    category,
    target,
    details,
    actor
  });
}

// Open Audit Logs Modal (Admin-only)
export async function openAuditLogModal() {
  if (!auditCurrentUser || auditCurrentUser.role !== 'admin') return;

  const modal = document.getElementById('modal-audit-log');
  if (!modal) return;

  modal.classList.remove('hidden');
  
  // Log that admin inspected the audit trails
  logAuditEvent(
    'AUDIT_VIEW',
    'AUTH',
    'AuditLogViewer',
    `ผู้ดูแลระบบ (${auditCurrentUser.name || auditCurrentUser.username}) เข้าเปิดดูประวัติกิจกรรมความปลอดภัยของระบบ`
  );

  await renderAuditLogsTable(true);
  renderIcons(modal);
}

export function closeAuditLogModal() {
  document.getElementById('modal-audit-log')?.classList.add('hidden');
}

// Render Audit Logs Table
export async function renderAuditLogsTable(forceRefresh = false) {
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
          <div>กำลังโหลดประวัติกิจกรรมจาก Cloud Firestore...</div>
        </td>
      </tr>
    `;
    renderIcons(tbody);
    cachedAuditLogs = await apiGetAuditLogs(300);
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
          <div>ไม่พบประวัติกิจกรรมตามเงื่อนไขที่ค้นหา</div>
        </td>
      </tr>
    `;
    renderIcons(tbody);
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

  renderIcons(tbody);
}

// Bind Secret Double-Click Trigger on App Logo
export function initAuditSecretTrigger() {
  const logoBtn = document.getElementById('app-logo-btn');
  if (!logoBtn || logoBtn.dataset.auditBound) return;
  logoBtn.dataset.auditBound = 'true';

  logoBtn.addEventListener('dblclick', () => {
    if (auditCurrentUser?.role === 'admin') {
      openAuditLogModal();
    }
  });

  document.getElementById('modal-audit-close-btn')?.addEventListener('click', closeAuditLogModal);
  document.getElementById('modal-audit-close-bottom-btn')?.addEventListener('click', closeAuditLogModal);
  document.getElementById('audit-refresh-btn')?.addEventListener('click', () => renderAuditLogsTable(true));
  document.getElementById('audit-filter-category')?.addEventListener('change', () => renderAuditLogsTable(false));
  document.getElementById('audit-filter-search')?.addEventListener('input', () => renderAuditLogsTable(false));
}
