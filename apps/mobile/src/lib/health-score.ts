const PRIORITY_WEIGHTS: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const GRADE_THRESHOLDS = [
  { min: 90, grade: 'A' as const },
  { min: 75, grade: 'B' as const },
  { min: 60, grade: 'C' as const },
  { min: 40, grade: 'D' as const },
  { min: 0, grade: 'F' as const },
] as const;

export type HealthGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface HealthScoreResult {
  score: number;
  grade: HealthGrade;
  hasData: boolean;
  overdueTasks: number;
  urgentTasks: number;
}

interface TaskInput {
  dueDate?: string | null;
  priority: string;
  status: string;
  completedAt?: string | null;
}

export function computeHealthScore(tasks: TaskInput[]): HealthScoreResult {
  if (tasks.length === 0) {
    return { score: 0, grade: 'A', hasData: false, overdueTasks: 0, urgentTasks: 0 };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const activeTasks = tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  // If all tasks are completed, score is 100
  if (activeTasks.length === 0 && completedTasks.length > 0) {
    return { score: 100, grade: 'A', hasData: true, overdueTasks: 0, urgentTasks: 0 };
  }

  // Overdue score (50% weight)
  let overdueMaxPenalty = 0;
  let overduePenalty = 0;
  let overdueTasks = 0;
  for (const task of activeTasks) {
    if (!task.dueDate) continue;
    const due = new Date(task.dueDate);
    const daysOverdue = Math.floor((today.getTime() - due.getTime()) / 86400000);
    const weight = PRIORITY_WEIGHTS[task.priority] ?? 2;
    overdueMaxPenalty += weight * 5;
    if (daysOverdue > 0) {
      overduePenalty += weight * Math.sqrt(daysOverdue);
      overdueTasks++;
    }
  }
  const overdueScore =
    overdueMaxPenalty > 0 ? Math.max(0, 100 - (overduePenalty / overdueMaxPenalty) * 100) : 100;

  // Urgency score (25% weight) — tasks due within 7 days
  let urgencyMaxPenalty = 0;
  let urgencyPenalty = 0;
  let urgentTasks = 0;
  for (const task of activeTasks) {
    if (!task.dueDate) continue;
    const due = new Date(task.dueDate);
    const daysUntil = Math.floor((due.getTime() - today.getTime()) / 86400000);
    const weight = PRIORITY_WEIGHTS[task.priority] ?? 2;
    if (daysUntil >= 0 && daysUntil <= 7) {
      urgencyMaxPenalty += weight;
      if (daysUntil <= 3) {
        urgencyPenalty += weight;
        urgentTasks++;
      } else {
        urgencyPenalty += weight * ((7 - daysUntil) / 7);
        urgentTasks++;
      }
    }
  }
  const urgencyScore =
    urgencyMaxPenalty > 0 ? Math.max(0, 100 - (urgencyPenalty / urgencyMaxPenalty) * 50) : 100;

  // Completion rate (25% weight)
  let completionScore = 100;
  if (completedTasks.length > 0) {
    const onTimeCount = completedTasks.filter((t) => {
      if (!t.dueDate || !t.completedAt) return true;
      const due = new Date(t.dueDate);
      const completed = new Date(t.completedAt);
      const grace = 3 * 86400000;
      return completed.getTime() <= due.getTime() + grace;
    }).length;
    completionScore = (onTimeCount / completedTasks.length) * 100;
  }

  const hasDateTasks = activeTasks.some((t) => t.dueDate);
  if (!hasDateTasks && completedTasks.length === 0) {
    return { score: 0, grade: 'A', hasData: false, overdueTasks: 0, urgentTasks: 0 };
  }

  const score = Math.round(overdueScore * 0.5 + urgencyScore * 0.25 + completionScore * 0.25);
  const grade = GRADE_THRESHOLDS.find((g) => score >= g.min)?.grade ?? 'F';

  return { score, grade, hasData: true, overdueTasks, urgentTasks };
}

export function getRelativeDueDate(dueDate: string): {
  key: string;
  params?: Record<string, number>;
  isOverdue: boolean;
  daysAway: number;
} {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(dueDate);
  const diffDays = Math.floor((due.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0) {
    return {
      key: 'maintenance.overdueByDays',
      params: { count: Math.abs(diffDays) },
      isOverdue: true,
      daysAway: diffDays,
    };
  }
  if (diffDays === 0) {
    return { key: 'maintenance.dueToday', isOverdue: false, daysAway: 0 };
  }
  if (diffDays === 1) {
    return { key: 'maintenance.dueTomorrow', isOverdue: false, daysAway: 1 };
  }
  return {
    key: 'maintenance.dueInDays',
    params: { count: diffDays },
    isOverdue: false,
    daysAway: diffDays,
  };
}
