import {
  escapeHtml,
  generateMaintenanceHistoryHTML,
  type PdfBike,
  type PdfTask,
} from '../pdf-template';

const BIKE: PdfBike = {
  make: 'Yamaha',
  model: 'MT-07',
  year: 2022,
  mileageUnit: 'km',
};

function task(overrides: Partial<PdfTask> & { title: string }): PdfTask {
  return {
    status: 'completed',
    priority: 'medium',
    photoCount: 0,
    ...overrides,
  };
}

describe('escapeHtml', () => {
  it('escapes all five HTML-sensitive characters', () => {
    expect(escapeHtml(`<script>"it's" & </script>`)).toBe(
      '&lt;script&gt;&quot;it&#39;s&quot; &amp; &lt;/script&gt;',
    );
  });

  it('escapes ampersands before entity-like sequences (no double-encoding gaps)', () => {
    expect(escapeHtml('Tom & Jerry <tag>')).toBe('Tom &amp; Jerry &lt;tag&gt;');
  });

  it('leaves plain text untouched', () => {
    expect(escapeHtml('Oil change 5W-30')).toBe('Oil change 5W-30');
  });
});

describe('generateMaintenanceHistoryHTML — date range filter', () => {
  it('escapes user-entered task titles into the output', () => {
    const html = generateMaintenanceHistoryHTML(BIKE, [
      task({ title: '<b>Chain</b>', completedAt: '2026-01-10' }),
    ]);
    expect(html).toContain('&lt;b&gt;Chain&lt;/b&gt;');
    expect(html).not.toContain('<b>Chain</b>');
  });

  it('includes tasks within [dateFrom, dateTo] and excludes those outside', () => {
    const tasks = [
      task({ title: 'TooEarly', completedAt: '2025-12-01' }),
      task({ title: 'InRange', completedAt: '2026-01-15' }),
      task({ title: 'TooLate', completedAt: '2026-03-01' }),
    ];
    const html = generateMaintenanceHistoryHTML(BIKE, tasks, {
      dateFrom: '2026-01-01',
      dateTo: '2026-02-01',
    });
    expect(html).toContain('InRange');
    expect(html).not.toContain('TooEarly');
    expect(html).not.toContain('TooLate');
  });

  it('falls back to dueDate when completedAt is absent', () => {
    const html = generateMaintenanceHistoryHTML(
      BIKE,
      [task({ title: 'DueDated', status: 'pending', dueDate: '2026-01-20' })],
      { dateFrom: '2026-01-01', dateTo: '2026-02-01' },
    );
    expect(html).toContain('DueDated');
  });

  it('always includes tasks that have neither completedAt nor dueDate', () => {
    const html = generateMaintenanceHistoryHTML(
      BIKE,
      [task({ title: 'NoDates', status: 'pending' })],
      {
        dateFrom: '2026-01-01',
        dateTo: '2026-02-01',
      },
    );
    expect(html).toContain('NoDates');
  });
});
