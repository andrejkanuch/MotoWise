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
    byMotorcycle: (motorcycleId: string) =>
      ['maintenance-tasks', 'motorcycle', motorcycleId] as const,
  },
  articles: {
    all: ['articles'] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.articles.all, 'list', filters] as const,
    detail: (slug: string) => ['articles', 'detail', slug] as const,
  },
};
