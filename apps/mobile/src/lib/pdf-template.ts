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
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
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

function renderTaskRow(task: PdfTask, mileageUnit: string): string {
  const date = task.completedAt
    ? formatDate(task.completedAt)
    : task.dueDate
      ? formatDate(task.dueDate)
      : '—';

  const mileage = task.completedMileage
    ? `${task.completedMileage.toLocaleString()} ${mileageUnit}`
    : task.targetMileage
      ? `${task.targetMileage.toLocaleString()} ${mileageUnit}`
      : '—';

  const pColor = priorityColor(task.priority);

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
      <td>${statusLabel(task.status)}</td>
      <td class="notes-cell">${notesCell || '—'}</td>
    </tr>`;
}

export function generateMaintenanceHistoryHTML(bike: PdfBike, tasks: PdfTask[]): string {
  const bikeName = `${bike.year} ${bike.make} ${bike.model}`;
  const displayName = bike.nickname ? `${bikeName} ("${bike.nickname}")` : bikeName;
  const generatedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const unit = bike.mileageUnit || 'mi';

  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const activeTasks = tasks.filter((t) => t.status !== 'completed');

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
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          ${sectionTasks.map((t) => renderTaskRow(t, unit)).join('')}
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

  <div class="generated-date">Generated on ${generatedDate}</div>

  ${emptyState}
  ${renderSection('Completed', completedTasks)}
  ${renderSection('Active / Pending', activeTasks)}

  <div class="footer">Generated by MotoVault &mdash; motovault.app</div>
</body>
</html>`;
}
