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
    insights: (input: Record<string, unknown>) => ['onboarding', 'insights', input] as const,
    reveal: (make: string, year: number, model?: string | null) =>
      ['onboarding', 'reveal', make, year, model ?? null] as const,
    /** OEM maintenance-schedule preview — shared by the Maintenance screen and
     *  the Reveal prefetch that warms it. Both MUST use this key or the prefetch
     *  silently misses and the spinner returns. */
    oemSchedules: (make: string, model?: string | null, year?: number | null) =>
      ['oemSchedulesPreview', make, model ?? null, year ?? null] as const,
  },
  shareLinks: {
    byMotorcycle: (motorcycleId: string) => ['shareLinks', 'byMotorcycle', motorcycleId] as const,
  },
  expenses: {
    byMotorcycle: (motorcycleId: string) => ['expenses', 'byMotorcycle', motorcycleId] as const,
  },
  rides: {
    all: ['rides'] as const,
    summary: ['rides', 'summary'] as const,
    overview: ['rides', 'overview'] as const,
    list: (cursor?: string) => ['rides', 'list', cursor] as const,
    detail: (id: string) => ['rides', 'detail', id] as const,
    waypoints: (id: string) => ['rides', 'waypoints', id] as const,
  },
  healthReports: {
    all: ['healthReports'] as const,
    byMotorcycle: (motorcycleId: string) =>
      ['healthReports', 'byMotorcycle', motorcycleId] as const,
  },
  feed: {
    all: ['feed'] as const,
  },
  kudos: {
    list: (rideId: string) => ['kudos', 'list', rideId] as const,
  },
  routes: {
    all: ['routes'] as const,
    discover: (filters: string) => ['routes', 'discover', filters] as const,
    editorPicks: ['routes', 'editorPicks'] as const,
    detail: (routeId: string) => ['routes', 'detail', routeId] as const,
    saved: ['routes', 'saved'] as const,
    gpxQuota: ['routes', 'gpx-quota'] as const,
  },
  typeahead: {
    search: (q: string) => ['typeahead', q] as const,
  },
  fuelStops: {
    nearRoute: (routeId: string, bikeId?: string) =>
      ['fuelStops', 'nearRoute', routeId, bikeId] as const,
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
    list: (scope: string) => ['trips', 'list', scope] as const,
    my: ['trips', 'my'] as const,
    /** Discover draft strip: user's draft trips (non-paginated). */
    myDrafts: ['trips', 'myDrafts'] as const,
    /** Discover horizontal strip: upcoming non-template public trips. */
    discoverRiderStrip: ['trips', 'discoverRiderStrip'] as const,
    gpxQuota: ['trips', 'gpx-quota'] as const,
  },
  tripTemplates: {
    all: ['tripTemplates'] as const,
    list: (filters: string) => ['tripTemplates', 'list', filters] as const,
  },
  savedTrips: {
    all: ['savedTrips'] as const,
  },
  isTripSaved: {
    check: (tripId: string) => ['isTripSaved', tripId] as const,
  },
  tripReviews: {
    all: ['tripReviews'] as const,
    byTrip: (tripId: string) => ['tripReviews', 'byTrip', tripId] as const,
  },
  subscription: {
    offerings: ['subscription', 'offerings'] as const,
  },
};
