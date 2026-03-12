export const queryKeys = {
  user: {
    me: ['user', 'me'] as const,
  },
  motorcycles: {
    all: ['motorcycles'] as const,
    lists: () => [...queryKeys.motorcycles.all, 'list'] as const,
  },
  diagnostics: {
    all: ['diagnostics'] as const,
    detail: (id: string) => ['diagnostics', 'detail', id] as const,
  },
  progress: {
    all: ['progress'] as const,
  },
  nhtsa: {
    makes: ['nhtsa', 'makes'] as const,
    models: (params: { makeId: number; year: number }) => ['nhtsa', 'models', params] as const,
  },
  maintenanceTasks: {
    all: ['maintenance-tasks'] as const,
    allUser: ['maintenance-tasks', 'all-user'] as const,
    byMotorcycle: (motorcycleId: string) =>
      ['maintenance-tasks', 'motorcycle', motorcycleId] as const,
    history: (motorcycleId: string) => ['maintenance-tasks', 'history', motorcycleId] as const,
    spending: (motorcycleId: string) => ['maintenance-tasks', 'spending', motorcycleId] as const,
  },
  articles: {
    all: ['articles'] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.articles.all, 'list', filters] as const,
    detail: (slug: string) => ['articles', 'detail', slug] as const,
  },
  onboarding: {
    insights: (input: Record<string, unknown>) => ['onboarding', 'insights', input] as const,
  },
  shareLinks: {
    byMotorcycle: (motorcycleId: string) => ['shareLinks', 'byMotorcycle', motorcycleId] as const,
  },
  quizzes: {
    byArticle: (articleId: string) => ['quizzes', 'byArticle', articleId] as const,
  },
  subscription: {
    offerings: ['subscription', 'offerings'] as const,
  },
};
