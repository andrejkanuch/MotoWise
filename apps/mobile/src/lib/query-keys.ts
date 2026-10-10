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
    popular: (first?: number) => [...queryKeys.articles.all, 'popular', first] as const,
    detail: (slug: string) => ['articles', 'detail', slug] as const,
  },
  onboarding: {
    reveal: (make: string, year: number, model?: string | null) =>
      ['onboarding', 'reveal', make, year, model ?? null] as const,
    /** OEM maintenance-schedule preview — shared by the Maintenance screen and
     *  the Reveal prefetch that warms it. Both MUST use this key or the prefetch
     *  silently misses and the spinner returns. */
    oemSchedules: (
      make: string,
      model?: string | null,
      year?: number | null,
      variant?: string | null,
    ) => ['oemSchedulesPreview', make, model ?? null, year ?? null, variant ?? null] as const,
  },
  expenses: {
    byMotorcycle: (motorcycleId: string) => ['expenses', 'byMotorcycle', motorcycleId] as const,
  },
  expensePhotos: {
    byExpense: (expenseId: string) => ['expense-photos', expenseId] as const,
  },
  odometer: {
    /** Prefix of every odometer key — invalidate it after any write that moves `currentMileage`. */
    all: ['odometer'] as const,
    readings: (motorcycleId: string) =>
      [...queryKeys.odometer.all, 'readings', motorcycleId] as const,
    pendingRides: (motorcycleId: string) =>
      [...queryKeys.odometer.all, 'pendingRides', motorcycleId] as const,
  },
  notes: {
    byMotorcycle: (motorcycleId: string) => ['notes', 'byMotorcycle', motorcycleId] as const,
  },
  receiptScans: {
    /** Server-authoritative monthly used-count (drives the client paywall gate). */
    quota: ['receipt-scans', 'quota'] as const,
    /** Completed-but-unreviewed scans — resume + home priority card. */
    unreviewed: ['receipt-scans', 'unreviewed'] as const,
  },
  documents: {
    byMotorcycle: (motorcycleId: string) => ['documents', 'byMotorcycle', motorcycleId] as const,
    /** Prefix key — invalidate this to refresh BOTH includeHidden variants. */
    categoriesAll: ['documents', 'categories'] as const,
    categories: (includeHidden: boolean) =>
      [...queryKeys.documents.categoriesAll, includeHidden] as const,
    expiring: ['documents', 'expiring'] as const,
  },
  makeStats: {
    all: ['makeStats'] as const,
  },
  motorcycleRecalls: {
    byMotorcycle: (motorcycleId: string) => ['motorcycle-recalls', motorcycleId] as const,
  },
  weatherForecast: {
    byCoords: (lat?: number, lon?: number) => ['weather-forecast', lat, lon] as const,
  },
  userCountry: {
    detected: ['user-country'] as const,
  },
  rides: {
    /**
     * Broad invalidation root: EVERY ride-list variant below descends from
     * this prefix (`summary`, `overview`, `list`, `byMotorcycle`, `heatmap`).
     * Invalidating `queryKeys.rides.all` therefore refetches all ride lists —
     * use it after ride create/delete instead of a single narrow list key so
     * no list silently shows stale data.
     */
    all: ['rides'] as const,
    summary: ['rides', 'summary'] as const,
    overview: ['rides', 'overview'] as const,
    list: (cursor?: string) => ['rides', 'list', cursor] as const,
    detail: (id: string) => ['rides', 'detail', id] as const,
    waypoints: (id: string) => ['rides', 'waypoints', id] as const,
    heatmap: ['rides', 'heatmap'] as const,
    byMotorcycle: (motorcycleId: string) => ['rides', 'motorcycle', motorcycleId] as const,
  },
  healthReports: {
    byMotorcycle: (motorcycleId: string) =>
      ['healthReports', 'byMotorcycle', motorcycleId] as const,
  },
  typeahead: {
    search: (q: string) => ['typeahead', q] as const,
  },
  comments: {
    byRide: (rideId: string) => ['comments', 'ride', rideId] as const,
    byRoute: (routeId: string) => ['comments', 'route', routeId] as const,
    byGroupRide: (groupRideId: string) => ['comments', 'groupRide', groupRideId] as const,
    byTrip: (tripId: string) => ['comments', 'trip', tripId] as const,
  },
  profiles: {
    byUsername: (username: string) => ['profiles', 'byUsername', username] as const,
  },
  followers: {
    list: (userId: string) => ['followers', 'list', userId] as const,
  },
  following: {
    list: (userId: string) => ['following', 'list', userId] as const,
  },
  groupRides: {
    all: ['groupRides'] as const,
    detail: (id: string) => ['groupRides', 'detail', id] as const,
  },
  trips: {
    all: ['trips'] as const,
    detail: (id: string) => ['trips', 'detail', id] as const,
    /** Source trip loaded into the create/edit screen (edit or clone mode). */
    edit: (tripId: string) => ['trip-edit', tripId] as const,
    list: (scope: string) => ['trips', 'list', scope] as const,
    my: ['trips', 'my'] as const,
    /** Discover draft strip: user's draft trips (non-paginated). */
    myDrafts: ['trips', 'myDrafts'] as const,
    /** Discover horizontal strip: upcoming non-template public trips. */
    discoverRiderStrip: ['trips', 'discoverRiderStrip'] as const,
    suggestions: (tripId: string) => ['trip-suggestions', tripId] as const,
    /** Public share-token trampoline (`tripByShareToken`). */
    byShareToken: (token: string) => ['trip-by-share-token', token] as const,
    /** Universal-link slug resolve (`/route/:country/:region/:slug`). */
    bySlugDeeplink: (country: string, region: string, slug: string) =>
      ['trip-by-slug-deeplink', country, region, slug] as const,
  },
  tripTemplates: {
    list: (filters: string) => ['tripTemplates', 'list', filters] as const,
  },
  savedTrips: {
    all: ['savedTrips'] as const,
  },
  tripReviews: {
    byTrip: (tripId: string) => ['tripReviews', 'byTrip', tripId] as const,
  },
};
