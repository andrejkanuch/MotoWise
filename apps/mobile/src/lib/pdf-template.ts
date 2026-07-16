import { type Currency, type MeasurementSystem, mileageUnitLabel } from '@motovault/types';
import { formatCurrency } from './expense-constants';

export interface PdfBike {
  make: string;
  model: string;
  year: number;
  nickname?: string;
  vin?: string;
  currentMileage?: number;
  mileageUnit: string; // 'km' or 'mi'
}

export interface PdfTask {
  title: string;
  status: string;
  priority: string;
  dueDate?: string;
  completedAt?: string;
  completedMileage?: number;
  targetMileage?: number;
  notes?: string;
  photoCount: number;
  cost?: number;
  currency?: string;
}

export interface PdfExportOptions {
  /** YYYY-MM-DD inclusive start filter. If undefined, no lower bound. */
  dateFrom?: string;
  /** YYYY-MM-DD inclusive end filter. If undefined, no upper bound. */
  dateTo?: string;
  /** Human label shown in the PDF header (e.g. "Last 12 months"). */
  dateRangeLabel?: string;
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export interface PdfDiagnostic {
  severity?: string | null;
  confidence?: number | null;
  description?: string | null;
  createdAt: string;
  resultJson?: {
    part?: string;
    description?: string;
    issues?: Array<{ description: string; probability?: number }>;
    toolsNeeded?: string[];
    difficulty?: string;
    nextSteps?: string[];
    confidence?: number;
  } | null;
}

function severityColor(severity: string): string {
  switch (severity) {
    case 'critical':
      return '#ef4444';
    case 'high':
      return '#FF6B35';
    case 'medium':
      return '#f59e0b';
    case 'low':
      return '#22c55e';
    default:
      return '#737373';
  }
}

function difficultyLabel(difficulty: string): string {
  switch (difficulty) {
    case 'easy':
      return 'Easy — DIY Friendly';
    case 'moderate':
      return 'Moderate — Some Experience';
    case 'hard':
      return 'Hard — Advanced';
    case 'professional':
      return 'Professional Only';
    default:
      return difficulty;
  }
}

function priorityColor(priority: string): string {
  switch (priority) {
    case 'critical':
      return '#ef4444';
    case 'high':
      return '#f59e0b';
    case 'medium':
      return '#3366e6';
    case 'low':
      return '#22c55e';
    default:
      return '#737373';
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'in_progress':
      return 'In Progress';
    case 'pending':
      return 'Pending';
    default:
      return status;
  }
}

function formatCost(amount: number, currency = 'USD'): string {
  return formatCurrency(amount, currency as Currency);
}

function renderTaskRow(task: PdfTask, system: MeasurementSystem): string {
  const date = task.completedAt
    ? formatDate(task.completedAt)
    : task.dueDate
      ? formatDate(task.dueDate)
      : '—';

  // completedMileage / targetMileage are stored raw in the user's unit.
  const safeUnit = escapeHtml(mileageUnitLabel(system));
  const mileage = task.completedMileage
    ? `${task.completedMileage.toLocaleString()} ${safeUnit}`
    : task.targetMileage
      ? `${task.targetMileage.toLocaleString()} ${safeUnit}`
      : '—';

  const pColor = priorityColor(task.priority);

  const costCell = task.cost != null ? formatCost(task.cost, task.currency) : '—';

  const notesCell = [
    task.notes ? escapeHtml(task.notes) : '',
    task.photoCount > 0 ? `${task.photoCount} photo${task.photoCount > 1 ? 's' : ''}` : '',
  ]
    .filter(Boolean)
    .join('<br/>');

  return `
    <tr>
      <td>${date}</td>
      <td><strong>${escapeHtml(task.title)}</strong></td>
      <td>${mileage}</td>
      <td><span class="priority-badge" style="background:${pColor}20;color:${pColor}">${escapeHtml(task.priority)}</span></td>
      <td>${escapeHtml(statusLabel(task.status))}</td>
      <td class="cost-cell">${costCell}</td>
      <td class="notes-cell">${notesCell || '—'}</td>
    </tr>`;
}

export function generateMaintenanceHistoryHTML(
  bike: PdfBike,
  tasks: PdfTask[],
  system: MeasurementSystem,
  options: PdfExportOptions = {},
): string {
  const bikeName = `${bike.year} ${bike.make} ${bike.model}`;
  const displayName = bike.nickname ? `${bikeName} ("${bike.nickname}")` : bikeName;
  const generatedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const unit = mileageUnitLabel(system);

  // Apply optional date range filter (matches on completedAt || dueDate)
  const filtered = tasks.filter((t) => {
    const ref = t.completedAt ?? t.dueDate;
    if (!ref) return true; // no date means always include
    if (options.dateFrom && ref < options.dateFrom) return false;
    if (options.dateTo && ref > options.dateTo) return false;
    return true;
  });

  const completedTasks = filtered.filter((t) => t.status === 'completed');
  const activeTasks = filtered.filter((t) => t.status !== 'completed');

  // Cost summary (completed tasks only — these are the resale-documentation value)
  const totalCost = completedTasks.reduce((sum, t) => sum + (t.cost ?? 0), 0);
  const costCurrency = completedTasks.find((t) => t.currency)?.currency ?? 'USD';
  const hasCosts = completedTasks.some((t) => (t.cost ?? 0) > 0);

  const renderSection = (title: string, sectionTasks: PdfTask[]): string => {
    if (sectionTasks.length === 0) return '';
    return `
      <h2>${title} (${sectionTasks.length})</h2>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Task</th>
            <th>Mileage</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Cost</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          ${sectionTasks.map((t) => renderTaskRow(t, system)).join('')}
        </tbody>
      </table>`;
  };

  const bikeInfoRows = [
    bike.vin ? `<span class="info-item"><strong>VIN:</strong> ${escapeHtml(bike.vin)}</span>` : '',
    bike.currentMileage != null
      ? `<span class="info-item"><strong>Mileage:</strong> ${bike.currentMileage.toLocaleString()} ${unit}</span>`
      : '',
  ]
    .filter(Boolean)
    .join('');

  const emptyState =
    tasks.length === 0 ? '<div class="empty-state"><p>No maintenance records yet.</p></div>' : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Maintenance History — ${escapeHtml(bikeName)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1a1a1a;
      font-size: 12px;
      line-height: 1.5;
      padding: 40px;
    }
    .header {
      border-bottom: 3px solid #FF6B35;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .header h1 {
      font-size: 22px;
      font-weight: 800;
      color: #FF6B35;
      margin-bottom: 2px;
    }
    .header .subtitle {
      font-size: 11px;
      color: #737373;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .bike-info {
      margin-bottom: 24px;
    }
    .bike-info h2 {
      font-size: 18px;
      font-weight: 700;
      color: #1a1a1a;
      margin-bottom: 4px;
    }
    .bike-info .meta {
      color: #525252;
      font-size: 12px;
    }
    .info-item {
      margin-right: 20px;
    }
    .generated-date {
      font-size: 11px;
      color: #a3a3a3;
      margin-bottom: 24px;
    }
    h2 {
      font-size: 14px;
      font-weight: 700;
      color: #404040;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
      margin-top: 24px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    thead tr {
      background: #f5f5f5;
    }
    th {
      text-align: left;
      font-size: 10px;
      font-weight: 700;
      color: #737373;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      padding: 8px 10px;
      border-bottom: 1px solid #e5e5e5;
    }
    td {
      padding: 8px 10px;
      border-bottom: 1px solid #f5f5f5;
      font-size: 11px;
      vertical-align: top;
    }
    .priority-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .notes-cell {
      max-width: 160px;
      color: #525252;
      font-size: 10px;
    }
    .cost-cell {
      font-weight: 600;
      color: #1a1a1a;
      white-space: nowrap;
    }
    .cost-summary {
      margin-top: 24px;
      padding: 16px 20px;
      background: #f8f9fa;
      border-left: 3px solid #FF6B35;
      border-radius: 4px;
    }
    .cost-summary-label {
      font-size: 11px;
      color: #737373;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      font-weight: 700;
    }
    .cost-summary-value {
      font-size: 20px;
      font-weight: 800;
      color: #1a1a1a;
      margin-top: 4px;
    }
    .date-range {
      display: inline-block;
      padding: 3px 10px;
      background: #FF6B3515;
      color: #FF6B35;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      margin-left: 6px;
    }
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #a3a3a3;
      font-size: 14px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #e5e5e5;
      text-align: center;
      font-size: 10px;
      color: #a3a3a3;
    }
    @media print {
      body { padding: 20px; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>MotoVault</h1>
    <div class="subtitle">Maintenance History Report</div>
  </div>

  <div class="bike-info">
    <h2>${escapeHtml(displayName)}</h2>
    ${bikeInfoRows ? `<div class="meta">${bikeInfoRows}</div>` : ''}
  </div>

  <div class="generated-date">
    Generated on ${generatedDate}
    ${options.dateRangeLabel ? `<span class="date-range">${escapeHtml(options.dateRangeLabel)}</span>` : ''}
  </div>

  ${emptyState}
  ${renderSection('Completed', completedTasks)}
  ${renderSection('Active / Pending', activeTasks)}

  ${
    hasCosts
      ? `<div class="cost-summary">
           <div class="cost-summary-label">Total documented maintenance spend</div>
           <div class="cost-summary-value">${formatCost(totalCost, costCurrency)}</div>
         </div>`
      : ''
  }

  <div class="footer">Generated by MotoVault &mdash; motovault.app</div>
</body>
</html>`;
}

export function generateDiagnosticReportHTML(diagnostic: PdfDiagnostic, bikeName: string): string {
  const result = diagnostic.resultJson;
  const generatedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const diagDate = formatDate(diagnostic.createdAt);
  const severity = diagnostic.severity ?? 'unknown';
  const sevColor = severityColor(severity);
  const confidence = diagnostic.confidence ?? result?.confidence ?? 0;
  const confidencePercent = Math.round(confidence * 100);

  const issuesRows = (result?.issues ?? [])
    .map((issue) => {
      const prob = issue.probability != null ? `${Math.round(issue.probability * 100)}%` : '—';
      return `
        <tr>
          <td>${escapeHtml(issue.description)}</td>
          <td style="text-align:center;font-weight:600">${prob}</td>
        </tr>`;
    })
    .join('');

  const toolsList = (result?.toolsNeeded ?? [])
    .map((tool) => `<span class="tool-chip">${escapeHtml(tool)}</span>`)
    .join('');

  const nextStepsList = (result?.nextSteps ?? [])
    .map(
      (step, i) =>
        `<div class="next-step"><span class="step-num">${i + 1}</span> ${escapeHtml(step)}</div>`,
    )
    .join('');

  const diffKey = result?.difficulty ?? '';
  const diffLabel = diffKey ? difficultyLabel(diffKey) : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Diagnostic Report — ${escapeHtml(bikeName)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1a1a1a;
      font-size: 12px;
      line-height: 1.5;
      padding: 40px;
    }
    .header {
      border-bottom: 3px solid #FF6B35;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .header h1 {
      font-size: 22px;
      font-weight: 800;
      color: #FF6B35;
      margin-bottom: 2px;
    }
    .header .subtitle {
      font-size: 11px;
      color: #737373;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .bike-info {
      margin-bottom: 24px;
    }
    .bike-info h2 {
      font-size: 18px;
      font-weight: 700;
      color: #1a1a1a;
      margin-bottom: 4px;
    }
    .bike-info .meta {
      color: #525252;
      font-size: 12px;
    }
    .generated-date {
      font-size: 11px;
      color: #a3a3a3;
      margin-bottom: 24px;
    }
    .severity-badge {
      display: inline-block;
      padding: 6px 16px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 16px;
    }
    .confidence-bar-container {
      margin-bottom: 20px;
    }
    .confidence-label {
      font-size: 11px;
      font-weight: 700;
      color: #737373;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      margin-bottom: 6px;
    }
    .confidence-bar {
      height: 8px;
      background: #f5f5f5;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 4px;
    }
    .confidence-fill {
      height: 100%;
      border-radius: 4px;
    }
    .confidence-value {
      font-size: 13px;
      font-weight: 700;
    }
    h3 {
      font-size: 14px;
      font-weight: 700;
      color: #404040;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
      margin-top: 24px;
    }
    .description {
      font-size: 13px;
      color: #404040;
      line-height: 1.6;
      margin-bottom: 20px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    thead tr {
      background: #f5f5f5;
    }
    th {
      text-align: left;
      font-size: 10px;
      font-weight: 700;
      color: #737373;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      padding: 8px 10px;
      border-bottom: 1px solid #e5e5e5;
    }
    td {
      padding: 8px 10px;
      border-bottom: 1px solid #f5f5f5;
      font-size: 11px;
      vertical-align: top;
    }
    .tool-chip {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 11px;
      background: #f5f5f5;
      color: #525252;
      margin: 2px 4px 2px 0;
    }
    .difficulty-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      margin-top: 4px;
    }
    .next-step {
      font-size: 12px;
      color: #404040;
      line-height: 1.6;
      margin-bottom: 8px;
    }
    .step-num {
      display: inline-block;
      width: 20px;
      height: 20px;
      line-height: 20px;
      text-align: center;
      border-radius: 10px;
      background: #FF6B3515;
      color: #FF6B35;
      font-size: 10px;
      font-weight: 700;
      margin-right: 6px;
    }
    .disclaimer {
      margin-top: 32px;
      padding: 12px 16px;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 6px;
      font-size: 11px;
      color: #92400e;
      line-height: 1.5;
    }
    .footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #e5e5e5;
      text-align: center;
      font-size: 10px;
      color: #a3a3a3;
    }
    @media print {
      body { padding: 20px; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>MotoVault</h1>
    <div class="subtitle">Diagnostic Report</div>
  </div>

  <div class="bike-info">
    <h2>${escapeHtml(bikeName)}</h2>
    <div class="meta">Diagnosed on ${diagDate}</div>
  </div>

  <div class="generated-date">Report generated on ${generatedDate}</div>

  ${result?.part ? `<h3>Affected Part</h3><div class="description"><strong>${escapeHtml(result.part)}</strong></div>` : ''}

  ${result?.description ? `<div class="description">${escapeHtml(result.description)}</div>` : ''}

  <div style="margin-bottom: 20px;">
    <span class="severity-badge" style="background:${sevColor}15;color:${sevColor}">
      Severity: ${escapeHtml(severity)}
    </span>
  </div>

  <div class="confidence-bar-container">
    <div class="confidence-label">Confidence</div>
    <div class="confidence-bar">
      <div class="confidence-fill" style="width:${confidencePercent}%;background:${confidencePercent > 70 ? '#22c55e' : confidencePercent > 40 ? '#f59e0b' : '#ef4444'}"></div>
    </div>
    <div class="confidence-value" style="color:${confidencePercent > 70 ? '#22c55e' : confidencePercent > 40 ? '#f59e0b' : '#ef4444'}">${confidencePercent}%</div>
  </div>

  ${
    issuesRows
      ? `<h3>Issues Found</h3>
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th style="text-align:center">Probability</th>
        </tr>
      </thead>
      <tbody>${issuesRows}</tbody>
    </table>`
      : ''
  }

  ${toolsList ? `<h3>Tools Needed</h3><div style="margin-bottom:16px">${toolsList}</div>` : ''}

  ${
    diffLabel
      ? `<h3>Difficulty</h3><div class="difficulty-badge" style="background:${severityColor(diffKey === 'easy' ? 'low' : diffKey === 'moderate' ? 'medium' : diffKey === 'hard' ? 'high' : 'critical')}15;color:${severityColor(diffKey === 'easy' ? 'low' : diffKey === 'moderate' ? 'medium' : diffKey === 'hard' ? 'high' : 'critical')}">${escapeHtml(diffLabel)}</div>`
      : ''
  }

  ${nextStepsList ? `<h3>Next Steps</h3><div style="margin-bottom:16px">${nextStepsList}</div>` : ''}

  <div class="disclaimer">
    This report is generated by MotoVault for informational purposes only.
    Always consult a certified mechanic for professional diagnosis.
  </div>

  <div class="footer">Generated by MotoVault &mdash; motovault.app</div>
</body>
</html>`;
}
