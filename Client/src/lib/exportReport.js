// FOLLO DASHBOARD
// Programmatic PDF generation — no DOM screenshotting
// All data passed in directly from Redux state

export async function exportReportPDF({
  workspaceName,
  projects,       // array of project objects with tasks
  allTasks,       // flat array of all tasks
  members,        // array of workspace members
  generatedBy,    // admin name string
}) {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // ── CONSTANTS ──────────────────────────────────────
  const W = 210;       // A4 width mm
  const H = 297;       // A4 height mm
  const ML = 14;       // margin left
  const MR = W - 14;   // margin right
  const CW = MR - ML;  // content width
  let y = 0;           // current Y cursor

  // Colors (rgb arrays)
  const C = {
    black:    [17, 24, 39],
    gray:     [107, 114, 128],
    lightGray:[243, 244, 246],
    border:   [229, 231, 235],
    green:    [34, 197, 94],
    amber:    [245, 158, 11],
    red:      [239, 68, 68],
    blue:     [59, 130, 246],
    purple:   [139, 92, 246],
    white:    [255, 255, 255],
    brand:    [37, 99, 235],   // follo blue
  };

  // ── HELPERS ────────────────────────────────────────

  const setColor = (rgb, type = 'text') => {
    if (type === 'text') doc.setTextColor(...rgb);
    if (type === 'fill') doc.setFillColor(...rgb);
    if (type === 'draw') doc.setDrawColor(...rgb);
  };

  const newPage = () => {
    doc.addPage();
    y = 16;
    // page border line at top
    setColor(C.border, 'draw');
    doc.setLineWidth(0.3);
    doc.line(ML, 8, MR, 8);
  };

  const checkPageBreak = (needed = 20) => {
    if (y + needed > H - 16) newPage();
  };

  const drawText = (text, x, yPos, opts = {}) => {
    const { size = 10, color = C.black, bold = false, align = 'left' } = opts;
    doc.setFontSize(size);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    setColor(color, 'text');
    doc.text(String(text ?? ''), x, yPos, { align });
  };

  const drawLine = (x1, yPos, x2, color = C.border, width = 0.3) => {
    setColor(color, 'draw');
    doc.setLineWidth(width);
    doc.line(x1, yPos, x2, yPos);
  };

  const drawRect = (x, yPos, w, h, fillColor, radius = 0) => {
    setColor(fillColor, 'fill');
    setColor(fillColor, 'draw');
    doc.roundedRect(x, yPos, w, h, radius, radius, 'F');
  };

  const drawProgressBar = (x, yPos, w, h, pct, color = C.brand) => {
    // Background
    drawRect(x, yPos, w, h, C.lightGray, 1);
    // Fill
    if (pct > 0) {
      const fillW = Math.max(1, (pct / 100) * w);
      drawRect(x, yPos, fillW, h, color, 1);
    }
  };

  const slaColor = (status) => {
    const map = {
      HEALTHY: C.green,
      AT_RISK: C.amber,
      BREACHED: C.red,
      BLOCKED: C.red,
      PENDING_APPROVAL: C.blue,
      RESOLVED_ON_TIME: C.green,
      RESOLVED_LATE: C.gray,
    };
    return map[status] || C.gray;
  };

  const statusLabel = (s) => {
    const map = {
      TODO: 'To Do', IN_PROGRESS: 'In Progress',
      PENDING_APPROVAL: 'Pending Approval', DONE: 'Done', BLOCKED: 'Blocked',
    };
    return map[s] || s || '—';
  };

  const calcPct = (tasks) => {
    const done = tasks.filter(t => t.status === 'DONE').length;
    return tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;
  };

  const today = new Date();
  const fmt = (d) => d ? new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  }) : '—';

  // ── PAGE 1: COVER + METRICS ────────────────────────

  // Header band
  drawRect(0, 0, W, 38, C.brand);
  drawText('FOLLO', ML, 14, { size: 22, color: C.white, bold: true });
  drawText('Project Performance Report', ML, 22, { size: 12, color: C.white });
  drawText(workspaceName || 'Workspace', ML, 30, { size: 9, color: [196, 214, 255] });
  drawText(`Generated: ${fmt(today)}  ·  By: ${generatedBy || 'Admin'}`, MR, 30,
    { size: 8, color: [196, 214, 255], align: 'right' });

  y = 48;

  // ── SECTION: HEADLINE METRICS (2x3 grid of stat boxes) ──
  drawText('Performance Summary', ML, y, { size: 13, bold: true, color: C.black });
  y += 6;
  drawLine(ML, y, MR);
  y += 5;

  const totalTasks = allTasks.length;
  const doneTasks = allTasks.filter(t => t.status === 'DONE').length;
  const completionPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const onTimeTasks = allTasks.filter(t => t.slaStatus === 'RESOLVED_ON_TIME').length;
  const resolvedTasks = allTasks.filter(t =>
    t.slaStatus === 'RESOLVED_ON_TIME' || t.slaStatus === 'RESOLVED_LATE').length;
  const slaOnTimePct = resolvedTasks > 0 ? Math.round((onTimeTasks / resolvedTasks) * 100) : 100;
  const breachedCount = allTasks.filter(t => t.slaStatus === 'BREACHED').length;
  const atRiskCount = allTasks.filter(t => t.slaStatus === 'AT_RISK').length;
  const blockedCount = allTasks.filter(t => t.slaStatus === 'BLOCKED').length;
  const pendingCount = allTasks.filter(t => t.slaStatus === 'PENDING_APPROVAL').length;

  const metrics = [
    { label: 'Total Tasks',     value: totalTasks,       sub: `${doneTasks} completed`,      color: C.brand },
    { label: 'Completion',      value: `${completionPct}%`, sub: `${doneTasks} done`,        color: C.green },
    { label: 'SLA On-Time',     value: `${slaOnTimePct}%`, sub: 'resolved on time',          color: C.green },
    { label: 'SLA Breaches',    value: breachedCount,    sub: 'past due date',               color: breachedCount > 0 ? C.red : C.green },
    { label: 'At Risk',         value: atRiskCount,      sub: 'approaching deadline',        color: atRiskCount > 0 ? C.amber : C.green },
    { label: 'Pending Approval',value: pendingCount,     sub: 'awaiting review',             color: pendingCount > 0 ? C.blue : C.gray },
  ];

  const boxW = (CW - 10) / 3;
  const boxH = 22;
  metrics.forEach((m, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const bx = ML + col * (boxW + 5);
    const by = y + row * (boxH + 4);

    drawRect(bx, by, boxW, boxH, C.lightGray, 2);
    // Left color accent bar
    drawRect(bx, by, 3, boxH, m.color, 0);
    drawText(m.label, bx + 6, by + 7, { size: 7.5, color: C.gray });
    drawText(String(m.value), bx + 6, by + 14, { size: 14, bold: true, color: C.black });
    drawText(m.sub, bx + 6, by + 19.5, { size: 7, color: C.gray });
  });

  y += 2 * (boxH + 4) + 8;

  // ── SECTION: PROJECT BREAKDOWN ──────────────────────
  checkPageBreak(15);
  drawText('Project Breakdown', ML, y, { size: 13, bold: true, color: C.black });
  y += 6;
  drawLine(ML, y, MR);
  y += 6;

  for (const project of projects) {
    const tasks = project.tasks || [];
    const pct = project.progress ?? calcPct(tasks);
    const done = tasks.filter(t => t.status === 'DONE').length;
    const breached = tasks.filter(t => t.slaStatus === 'BREACHED').length;
    const blocked = tasks.filter(t => t.slaStatus === 'BLOCKED').length;
    const ragColor = breached > 0 || blocked > 0 ? C.red
                   : pct >= 75 ? C.green
                   : C.amber;

    checkPageBreak(22);

    // Project name + RAG dot
    drawRect(ML, y - 3, 4, 4, ragColor, 2);
    drawText(project.name, ML + 7, y, { size: 11, bold: true });
    drawText(project.status || 'ACTIVE', MR, y,
      { size: 8, color: C.gray, align: 'right' });
    y += 5;

    // Progress bar
    drawProgressBar(ML, y, CW, 4, pct, ragColor);
    drawText(`${pct}%`, MR, y + 3.5, { size: 8, bold: true, align: 'right' });
    y += 8;

    // Stats row
    drawText(`${done}/${tasks.length} tasks completed`, ML, y, { size: 8, color: C.gray });
    if (breached > 0)
      drawText(`${breached} breached`, ML + 55, y, { size: 8, color: C.red });
    if (blocked > 0)
      drawText(`${blocked} blocked`, ML + 80, y, { size: 8, color: C.amber });
    y += 10;
    drawLine(ML, y, MR, C.border);
    y += 5;
  }

  // ── PAGE 2: CONTRACTOR PERFORMANCE ─────────────────
  newPage();
  drawText('Team & Contractor Performance', ML, y, { size: 13, bold: true });
  y += 6;
  drawLine(ML, y, MR);
  y += 6;

  // Table header
  const cols = [
    { label: 'Name',     x: ML,      w: 45 },
    { label: 'Assigned', x: ML + 47, w: 20 },
    { label: 'Done',     x: ML + 69, w: 20 },
    { label: 'On Time',  x: ML + 91, w: 22 },
    { label: 'Breached', x: ML + 115, w: 22 },
    { label: 'SLA Score',x: ML + 139, w: 27 },
  ];

  // Header row
  drawRect(ML, y - 4, CW, 8, C.lightGray, 1);
  cols.forEach(c => {
    drawText(c.label, c.x + 1, y, { size: 8, bold: true, color: C.gray });
  });
  y += 6;
  drawLine(ML, y, MR, C.border);
  y += 4;

  // Member rows
  for (const member of members) {
    const memberTasks = allTasks.filter(t =>
      t.assigneeId === member.userId ||
      t.assignee?.id === member.userId ||
      (t.assignee?.firstName + ' ' + t.assignee?.lastName).trim() === member.name
    );
    const mDone = memberTasks.filter(t => t.status === 'DONE').length;
    const mOnTime = memberTasks.filter(t => t.slaStatus === 'RESOLVED_ON_TIME').length;
    const mBreached = memberTasks.filter(t => t.slaStatus === 'BREACHED').length;
    const mResolved = memberTasks.filter(t =>
      ['RESOLVED_ON_TIME','RESOLVED_LATE'].includes(t.slaStatus)).length;
    const mScore = member.contractorScore ??
      (mResolved > 0 ? Math.round((mOnTime / mResolved) * 100) : 100);

    checkPageBreak(10);

    // Alternating row bg
    const rowBg = members.indexOf(member) % 2 === 0 ? C.white : [249, 250, 251];
    drawRect(ML, y - 4, CW, 8, rowBg, 0);

    drawText(member.name || member.email, cols[0].x + 1, y, { size: 9 });
    drawText(memberTasks.length, cols[1].x + 1, y, { size: 9 });
    drawText(mDone, cols[2].x + 1, y, { size: 9 });
    drawText(`${mOnTime}/${mResolved}`, cols[3].x + 1, y, { size: 9 });
    drawText(mBreached, cols[4].x + 1, y, {
      size: 9, color: mBreached > 0 ? C.red : C.black
    });

    // Score with color
    const scoreColor = mScore >= 80 ? C.green : mScore >= 60 ? C.amber : C.red;
    drawRect(cols[5].x + 1, y - 3.5, 18, 5, scoreColor, 1);
    drawText(`${mScore}pts`, cols[5].x + 2, y, { size: 8, bold: true, color: C.white });

    y += 8;
    drawLine(ML, y - 4, MR, C.border, 0.2);
  }

  // ── PAGE 3: ALL TASKS TABLE ─────────────────────────
  newPage();
  drawText('Task Register', ML, y, { size: 13, bold: true });
  y += 6;
  drawLine(ML, y, MR);
  y += 6;

  const taskCols = [
    { label: 'Task',      x: ML,      w: 50 },
    { label: 'Project',   x: ML + 52, w: 30 },
    { label: 'Assignee',  x: ML + 84, w: 32 },
    { label: 'Status',    x: ML + 118, w: 24 },
    { label: 'SLA',       x: ML + 144, w: 24 },
    { label: 'Due',       x: ML + 170, w: 25 },
  ];

  // Header
  drawRect(ML, y - 4, CW, 8, C.lightGray, 1);
  taskCols.forEach(c => {
    drawText(c.label, c.x + 1, y, { size: 8, bold: true, color: C.gray });
  });
  y += 6;
  drawLine(ML, y, MR, C.border);
  y += 4;

  // Sort: breached first, then blocked, then by due date
  const sortedTasks = [...allTasks].sort((a, b) => {
    const urgency = { BREACHED: 0, BLOCKED: 1, AT_RISK: 2,
                      PENDING_APPROVAL: 3, IN_PROGRESS: 4,
                      HEALTHY: 5, TODO: 6, DONE: 7 };
    return (urgency[a.slaStatus] ?? 5) - (urgency[b.slaStatus] ?? 5);
  });

  sortedTasks.forEach((task, i) => {
    checkPageBreak(9);

    const rowBg = i % 2 === 0 ? C.white : [249, 250, 251];
    drawRect(ML, y - 4, CW, 8, rowBg, 0);

    const assigneeName = task.assignee
      ? `${task.assignee.firstName || ''} ${task.assignee.lastName || ''}`.trim()
      : '—';

    const projectName = task.project?.name ||
      projects.find(p => p.id === task.projectId)?.name || '—';

    // Truncate long text
    const truncate = (s, n) => s?.length > n ? s.slice(0, n) + '…' : (s || '—');

    drawText(truncate(task.title, 28), taskCols[0].x + 1, y, { size: 8 });
    drawText(truncate(projectName, 16), taskCols[1].x + 1, y, { size: 8 });
    drawText(truncate(assigneeName, 17), taskCols[2].x + 1, y, { size: 8 });
    drawText(statusLabel(task.status), taskCols[3].x + 1, y, { size: 8 });

    // SLA badge (colored rectangle)
    if (task.slaStatus) {
      const sColor = slaColor(task.slaStatus);
      drawRect(taskCols[4].x + 1, y - 3.5, 20, 5, sColor, 1);
      const sLabel = task.slaStatus.replace('_', ' ').slice(0, 10);
      drawText(sLabel, taskCols[4].x + 2, y, { size: 6.5, color: C.white, bold: true });
    }

    drawText(fmt(task.dueDate), taskCols[5].x + 1, y, { size: 8, color: C.gray });

    y += 8;
  });

  // ── FOOTER on every page ───────────────────────────
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawLine(ML, H - 10, MR, C.border);
    drawText('Follo — Confidential', ML, H - 6, { size: 7, color: C.gray });
    drawText(`Page ${p} of ${totalPages}`, MR, H - 6,
      { size: 7, color: C.gray, align: 'right' });
    drawText(workspaceName || '', W / 2, H - 6,
      { size: 7, color: C.gray, align: 'center' });
  }

  // ── SAVE ───────────────────────────────────────────
  const filename = `${(workspaceName || 'follo')
    .replace(/\s+/g, '-').toLowerCase()}-report-${
    new Date().toISOString().split('T')[0]
  }.pdf`;

  doc.save(filename);
}
