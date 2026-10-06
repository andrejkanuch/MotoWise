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
