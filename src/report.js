// ============================================================================
// Reporting, Matrix Overview, PDF & Excel/CSV Export Controller
// ============================================================================

import {
  apiGetUsers,
  apiGetSubmissions,
  apiGetTestConfigs,
  apiGetMonthlyLots,
  apiDeleteSubmission
} from './firebase.js';

import {
  esc,
  MONTH_NAMES,
  showToast,
  renderIcons
} from './utils.js';

import { logAuditEvent } from './audit.js';

let cachedMonthlyLots = {};

// ============================================================================
// TAB 0: Submission Progress Matrix / Mini-Dashboard
// ============================================================================
export async function renderSubmissionMatrix(onViewSubmission) {
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

  const labUsers = users.filter(u => u.role !== 'admin');
  const totalLabsEl = document.getElementById('stat-total-labs');
  if (totalLabsEl) totalLabsEl.textContent = labUsers.length;

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
    renderIcons(tr);
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
      if (typeof onViewSubmission === 'function') {
        onViewSubmission(uName, yr, mo, true);
      }
    });
  });

  renderIcons(tbody);
}

// ============================================================================
// TAB 1: Admin Results & Comparison Table (With Answer Key Range Check)
// ============================================================================
export async function renderAdminResultsTable(onOpenEntry) {
  const userFilter = document.getElementById('admin-filter-user')?.value || 'ALL';
  const yearFilter = parseInt(document.getElementById('admin-filter-year')?.value, 10) || 2026;
  const monthFilter = document.getElementById('admin-filter-month')?.value || 'ALL';

  const submissions = await apiGetSubmissions();
  const testConfigs = await apiGetTestConfigs();
  const users = await apiGetUsers();
  cachedMonthlyLots = await apiGetMonthlyLots(true);

  const thead = document.getElementById('admin-table-header');
  if (thead) {
    thead.innerHTML = `
      <th class="py-3 px-4">ประจำเดือน / Lot</th>
      <th class="py-3 px-4">หน่วยงาน / รหัส</th>
      ${testConfigs.map(t => `<th class="py-3 px-4">${esc(t.name)} ${t.unit ? `<span class="text-[10px] text-slate-400 font-normal">(${esc(t.unit)})</span>` : ''}</th>`).join('')}
      <th class="py-3 px-4">วันที่บันทึก</th>
      <th class="py-3 px-4 text-center">จัดการ</th>
    `;
  }

  let targetUsers = [];
  if (userFilter === 'ALL') {
    targetUsers = users.map(u => u.username || u.email?.split('@')[0]);
  } else {
    targetUsers = [userFilter];
  }

  const targetMonths = (monthFilter === 'ALL') ? Array.from({ length: 12 }, (_, i) => i) : [parseInt(monthFilter, 10)];
  const tbody = document.getElementById('admin-results-table-body');
  if (!tbody) return;
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
        const testsCells = testConfigs.map(t => {
          const testRes = sub.results?.[t.id];
          if (!testRes) return '<td class="py-3 px-4 text-slate-300">-</td>';

          const machineEntries = Object.entries(testRes);
          const cellHtml = machineEntries.map(([mName, lvData]) => {
            const levelRows = Object.entries(lvData).map(([lv, val]) => {
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
                      : `<span class="text-[10px] text-rose-500 font-bold ml-1">✕ Out (${esc(min)}-${esc(max)})</span>`;
                  }
                } else if (ansInfo.expected) {
                  const isPass = (val.toLowerCase().trim() === ansInfo.expected.toLowerCase().trim());
                  evalBadge = isPass 
                    ? `<span class="text-[10px] text-emerald-600 font-bold ml-1">✓ Pass</span>`
                    : `<span class="text-[10px] text-rose-500 font-bold ml-1">✕ (เฉลย: ${esc(ansInfo.expected)})</span>`;
                }
              }
              return `<div class="text-xs"><span class="text-slate-400 font-medium">${esc(lv)}:</span> <strong class="text-slate-800">${esc(val)}</strong>${evalBadge}</div>`;
            }).join('');

            return `
              <div class="mb-1.5 last:mb-0 p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                <div class="text-[10px] font-bold text-indigo-700 font-mono">${esc(mName)}</div>
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
            ${lotData?.lotNumber ? `<span class="inline-block mt-0.5 text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 font-bold">LOT: ${esc(lotData.lotNumber)}</span>` : ''}
          </td>
          <td class="py-3 px-4 whitespace-nowrap">
            <div class="font-semibold text-slate-800 text-xs">${esc(userObj.name)}</div>
            <div class="text-[11px] text-slate-400 font-mono">${esc(userObj.code)}</div>
          </td>
          ${testsCells}
          <td class="py-3 px-4 whitespace-nowrap text-xs text-slate-500 font-mono">
            ${esc(sub.submittedAt)}
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
        editBtn.onclick = () => {
          if (typeof onOpenEntry === 'function') onOpenEntry(uKey, yearFilter, m, false);
        };

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
            renderAdminResultsTable(onOpenEntry);
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
            ${lotData?.lotNumber ? `<span class="inline-block mt-0.5 text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 font-bold">LOT: ${esc(lotData.lotNumber)}</span>` : ''}
          </td>
          <td class="py-3 px-4 whitespace-nowrap">
            <div class="font-semibold text-slate-500 text-xs">${esc(userObj.name)}</div>
            <div class="text-[11px] text-slate-400 font-mono">${esc(userObj.code)}</div>
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
        addBtn.onclick = () => {
          if (typeof onOpenEntry === 'function') onOpenEntry(uKey, yearFilter, m, false);
        };
        actionTd.appendChild(addBtn);
        tr.appendChild(actionTd);
      }

      tbody.appendChild(tr);
    });
  });

  const countText = document.getElementById('admin-results-count-text');
  if (countText) countText.textContent = `แสดงผล ${matchCount} รายการที่บันทึกแล้ว`;
  renderIcons(tbody);
}

// ============================================================================
// Feature C1: Export Admin Results to Excel/CSV with UTF-8 BOM
// ============================================================================
export async function exportAdminResultsCsv() {
  const userFilter = document.getElementById('admin-filter-user')?.value || 'ALL';
  const yearFilter = parseInt(document.getElementById('admin-filter-year')?.value, 10) || 2026;
  const monthFilter = document.getElementById('admin-filter-month')?.value || 'ALL';

  showToast('กำลังเตรียมข้อมูลสำหรับส่งออก Excel/CSV...');

  const submissions = await apiGetSubmissions();
  const testConfigs = await apiGetTestConfigs();
  const users = await apiGetUsers();
  cachedMonthlyLots = await apiGetMonthlyLots(true);

  let targetUsers = [];
  if (userFilter === 'ALL') {
    targetUsers = users.map(u => u.username || u.email?.split('@')[0]);
  } else {
    targetUsers = [userFilter];
  }

  const targetMonths = (monthFilter === 'ALL') ? Array.from({ length: 12 }, (_, i) => i) : [parseInt(monthFilter, 10)];

  // CSV Headers
  const headers = [
    'ลำดับ',
    'ปี (พ.ศ.)',
    'ปี (ค.ศ.)',
    'รอบประจำเดือน',
    'หมายเลข LOT',
    'ชื่อหน่วยงาน',
    'รหัสหน่วยงาน',
    'ชื่อผู้ใช้งาน (Username)',
    'รายการทดสอบ',
    'รหัสแบบทดสอบ',
    'เครื่องตรวจวัด',
    'ระดับ (Level)',
    'ผลที่รายงาน',
    'หน่วยวัด',
    'เกณฑ์เฉลย (Target / Range)',
    'ผลการประเมิน',
    'วันที่บันทึกผล',
    'หมายเหตุ'
  ];

  function csvEscape(field) {
    if (field === null || field === undefined) return '""';
    const str = String(field).replace(/"/g, '""');
    return `"${str}"`;
  }

  const rows = [];
  let rowSeq = 1;

  targetMonths.forEach(m => {
    const lotKey = `${yearFilter}_${m}`;
    const lotData = cachedMonthlyLots[lotKey] || {};
    const lotNumber = lotData.lotNumber || '-';

    targetUsers.forEach(uKey => {
      const key = `${uKey}_${yearFilter}_${m}`;
      const sub = submissions[key];
      const userObj = users.find(x => (x.username === uKey || x.email?.split('@')[0] === uKey)) || { name: uKey, code: uKey, username: uKey };

      if (!sub) {
        // Unsubmitted entry
        rows.push([
          rowSeq++,
          yearFilter + 543,
          yearFilter,
          MONTH_NAMES[m],
          lotNumber,
          userObj.name || uKey,
          userObj.code || '-',
          uKey,
          '-',
          '-',
          '-',
          '-',
          '-',
          '-',
          '-',
          'รอดำเนินการ (ยังไม่ส่งผล)',
          '-',
          '-'
        ].map(csvEscape).join(','));
        return;
      }

      // Submitted entry - iterate results
      testConfigs.forEach(t => {
        const testRes = sub.results?.[t.id];
        if (!testRes) {
          rows.push([
            rowSeq++,
            yearFilter + 543,
            yearFilter,
            MONTH_NAMES[m],
            lotNumber,
            userObj.name || uKey,
            userObj.code || '-',
            uKey,
            t.name,
            t.key,
            '-',
            '-',
            '-',
            t.unit || '-',
            '-',
            'ไม่ได้ระบุผลการตรวจนี้',
            sub.submittedAt || '-',
            sub.remarks || '-'
          ].map(csvEscape).join(','));
          return;
        }

        Object.entries(testRes).forEach(([mName, lvData]) => {
          Object.entries(lvData).forEach(([lv, val]) => {
            const ansInfo = lotData?.answers?.[t.id]?.[lv];
            let targetRange = '-';
            let evalResult = 'ไม่มีเกณฑ์ประเมิน';

            if (ansInfo) {
              if (t.type === 'number') {
                if (ansInfo.min !== undefined && ansInfo.max !== undefined && ansInfo.min !== '' && ansInfo.max !== '') {
                  targetRange = `${ansInfo.min} - ${ansInfo.max}`;
                  const numVal = parseFloat(val);
                  const min = parseFloat(ansInfo.min);
                  const max = parseFloat(ansInfo.max);
                  if (!isNaN(numVal) && !isNaN(min) && !isNaN(max)) {
                    evalResult = (numVal >= min && numVal <= max) ? 'ผ่านเกณฑ์ (Pass)' : 'นอกเกณฑ์ (Out of Range)';
                  }
                }
              } else if (ansInfo.expected) {
                targetRange = ansInfo.expected;
                evalResult = (val.toLowerCase().trim() === ansInfo.expected.toLowerCase().trim()) ? 'ผ่านเกณฑ์ (Pass)' : 'ไม่ตรงเกณฑ์';
              }
            }

            rows.push([
              rowSeq++,
              yearFilter + 543,
              yearFilter,
              MONTH_NAMES[m],
              lotNumber,
              userObj.name || uKey,
              userObj.code || '-',
              uKey,
              t.name,
              t.key,
              mName,
              lv,
              val || '-',
              t.unit || '-',
              targetRange,
              evalResult,
              sub.submittedAt || '-',
              sub.remarks || '-'
            ].map(csvEscape).join(','));
          });
        });
      });
    });
  });

  // Prepend UTF-8 BOM (\uFEFF) to guarantee Excel reads Thai properly
  const csvContent = '\uFEFF' + headers.map(csvEscape).join(',') + '\r\n' + rows.join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const monthSuffix = monthFilter === 'ALL' ? 'AllMonths' : `Month_${parseInt(monthFilter, 10) + 1}`;
  link.setAttribute('href', url);
  link.setAttribute('download', `EQA_Evaluation_Report_${yearFilter}_${monthSuffix}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast('ส่งออกไฟล์ Excel/CSV เรียบร้อยแล้ว');

  logAuditEvent(
    'REPORT_EXPORT_CSV',
    'LOT',
    `Year_${yearFilter}_${monthSuffix}`,
    `ส่งออกข้อมูลผลการทดสอบทั้งหมดในรูปแบบ CSV (${rows.length} แถวข้อมูล)`
  );
}

// ============================================================================
// PDF Report Modal & Generator
// ============================================================================
export async function openPdfModal(targetUser = 'ALL') {
  const year = parseInt(document.getElementById('admin-filter-year')?.value, 10) || 2026;
  const monthFilter = document.getElementById('admin-filter-month')?.value || 'ALL';
  const targetMonth = monthFilter === 'ALL' ? (new Date().getMonth()) : parseInt(monthFilter, 10);

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
  if (!tbody) return;
  tbody.innerHTML = '';
  const usersToExport = (targetUser === 'ALL') ? users.map(u => u.username || u.email?.split('@')[0]) : [targetUser];

  usersToExport.forEach(uKey => {
    const key = `${uKey}_${year}_${targetMonth}`;
    const sub = submissions[key];
    const userInfo = users.find(x => (x.username === uKey || x.email?.split('@')[0] === uKey)) || { name: uKey, code: uKey };

    testConfigs.forEach(t => {
      const testRes = sub?.results?.[t.id];

      if (!testRes) {
        const tr = document.createElement('tr');
        tr.className = 'border-b border-slate-200';
        tr.innerHTML = `
          <td class="p-2 border-r border-slate-200 font-bold text-slate-800">${esc(t.name)}</td>
          <td class="p-2 border-r border-slate-200 text-slate-500">${esc(userInfo.name)}</td>
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
                rangeText = `${esc(ansInfo.min)} - ${esc(ansInfo.max)} ${esc(t.unit || '')}`;
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
              rangeText = esc(ansInfo.expected);
              evalText = (val.toLowerCase().trim() === ansInfo.expected.toLowerCase().trim())
                ? '<span class="text-emerald-700 font-bold">ผ่านเกณฑ์ (Pass)</span>'
                : '<span class="text-rose-600 font-bold">ไม่ตรงเกณฑ์</span>';
            }
          }

          const tr = document.createElement('tr');
          tr.className = 'border-b border-slate-200';
          tr.innerHTML = `
            <td class="p-2 border-r border-slate-200 font-semibold text-slate-800">${esc(t.name)}</td>
            <td class="p-2 border-r border-slate-200 text-slate-700">${esc(userInfo.name)} • <span class="font-mono text-indigo-700 font-bold">${esc(mName)}</span> [${esc(lv)}]</td>
            <td class="p-2 border-r border-slate-200 text-center font-bold text-slate-900">${esc(val)} ${esc(t.unit || '')}</td>
            <td class="p-2 border-r border-slate-200 text-center font-mono font-semibold text-indigo-900 bg-indigo-50/40">${rangeText}</td>
            <td class="p-2 text-center text-[11px]">${evalText}</td>
          `;
          tbody.appendChild(tr);
        });
      });
    });
  });

  document.getElementById('modal-pdf')?.classList.remove('hidden');
  renderIcons(document.getElementById('modal-pdf'));
}

export function closePdfModal() {
  document.getElementById('modal-pdf')?.classList.add('hidden');
}

export function downloadRealPdf() {
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
      logAuditEvent(
        'REPORT_EXPORT_PDF',
        'LOT',
        'PDF_Report',
        'ส่งออกเอกสารรายงานผลประเมิน EQA ในรูปแบบไฟล์ PDF'
      );
    });
  } else {
    window.print();
  }
}
