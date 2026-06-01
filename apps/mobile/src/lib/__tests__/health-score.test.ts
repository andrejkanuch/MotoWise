import { computeHealthScore } from '../health-score';

// Build an ISO timestamp at local midnight ± deltaDays so the diff against the
// function's internal local-midnight `today` is exactly deltaDays (TZ-safe).
function at(deltaDays: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString();
}

describe('computeHealthScore', () => {
  it('returns no-data default for an empty task list', () => {
    expect(computeHealthScore([])).toEqual({
      score: 0,
      grade: 'A',
      hasData: false,
      overdueTasks: 0,
      urgentTasks: 0,
    });
  });

  it('scores 100 when every task is completed', () => {
    const result = computeHealthScore([
      { status: 'completed', priority: 'high', completedAt: at(-1), dueDate: at(-2) },
      { status: 'completed', priority: 'low', completedAt: at(-5) },
    ]);
    expect(result).toMatchObject({ score: 100, grade: 'A', hasData: true });
  });

  it('reports no data when active tasks have no due dates and nothing is completed', () => {
    const result = computeHealthScore([
      { status: 'pending', priority: 'medium' },
      { status: 'in_progress', priority: 'high' },
    ]);
    expect(result).toMatchObject({ score: 0, hasData: false });
  });

  it('gives a perfect score for a single task due far in the future', () => {
    const result = computeHealthScore([{ status: 'pending', priority: 'medium', dueDate: at(30) }]);
    expect(result).toMatchObject({ score: 100, grade: 'A', overdueTasks: 0, urgentTasks: 0 });
  });

  it('penalises a long-overdue critical task', () => {
    // 100 days overdue, critical (weight 4) → overdue component collapses to 0,
    // urgency + completion stay at 100 → round(0*.5 + 100*.25 + 100*.25) = 50 (grade D).
    const result = computeHealthScore([
      { status: 'pending', priority: 'critical', dueDate: at(-100) },
    ]);
    expect(result.score).toBe(50);
    expect(result.grade).toBe('D');
    expect(result.overdueTasks).toBe(1);
  });

  it('counts urgent tasks due within 3 days and lowers the grade', () => {
    // medium task due in 2 days → urgency score 50 → round(100*.5+50*.25+100*.25)=88 (grade B).
    const result = computeHealthScore([{ status: 'pending', priority: 'medium', dueDate: at(2) }]);
    expect(result.score).toBe(88);
    expect(result.grade).toBe('B');
    expect(result.urgentTasks).toBe(1);
  });

  it('does not count tasks due more than 7 days out as urgent', () => {
    const result = computeHealthScore([{ status: 'pending', priority: 'high', dueDate: at(10) }]);
    expect(result.urgentTasks).toBe(0);
  });

  it('treats on-time completions within the 3-day grace window as on time', () => {
    // Completed 2 days after due (inside grace) + one active future task to avoid the
    // all-completed short-circuit. Completion score should stay 100.
    const result = computeHealthScore([
      { status: 'completed', priority: 'medium', dueDate: at(-5), completedAt: at(-3) },
      { status: 'pending', priority: 'low', dueDate: at(30) },
    ]);
    expect(result.score).toBe(100);
  });

  it('drops completion score for late completions beyond the grace window', () => {
    const result = computeHealthScore([
      { status: 'completed', priority: 'medium', dueDate: at(-30), completedAt: at(-5) },
      { status: 'pending', priority: 'low', dueDate: at(30) },
    ]);
    // completion score 0 → round(100*.5 + 100*.25 + 0*.25) = 75 (grade B).
    expect(result.score).toBe(75);
    expect(result.grade).toBe('B');
  });
});
