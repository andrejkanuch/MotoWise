// MotoVault mobile design tokens — mirrors web, tuned for native
window.MV_TOKENS = {
  dark: {
    bg:        'oklch(0.12 0.01 55)',
    bg2:       'oklch(0.08 0.008 55)',
    surface:   'oklch(0.16 0.012 55)',
    surface2:  'oklch(0.20 0.014 55)',
    surface3:  'oklch(0.24 0.016 55)',
    ink:       'oklch(0.98 0.006 80)',
    ink2:      'oklch(0.80 0.012 70)',
    ink3:      'oklch(0.60 0.012 65)',
    ink4:      'oklch(0.42 0.012 60)',
    line:      'oklch(1 0 0 / 0.08)',
    line2:     'oklch(1 0 0 / 0.04)',
    warm:      'oklch(0.76 0.18 60)',
    warm2:     'oklch(0.84 0.15 68)',
    success:   'oklch(0.72 0.2 145)',
    danger:    'oklch(0.65 0.25 25)',
    info:      'oklch(0.65 0.2 250)',
    purple:    'oklch(0.62 0.22 295)',
  },
  light: {
    bg:        'oklch(0.98 0.004 80)',
    bg2:       'oklch(0.95 0.006 75)',
    surface:   'oklch(1 0 0)',
    surface2:  'oklch(0.96 0.006 75)',
    surface3:  'oklch(0.93 0.008 70)',
    ink:       'oklch(0.18 0.012 55)',
    ink2:      'oklch(0.38 0.012 60)',
    ink3:      'oklch(0.55 0.01 60)',
    ink4:      'oklch(0.70 0.008 60)',
    line:      'oklch(0.18 0.012 55 / 0.09)',
    line2:     'oklch(0.18 0.012 55 / 0.05)',
    warm:      'oklch(0.64 0.2 50)',
    warm2:     'oklch(0.72 0.18 60)',
    success:   'oklch(0.55 0.22 145)',
    danger:    'oklch(0.58 0.25 25)',
    info:      'oklch(0.58 0.22 250)',
    purple:    'oklch(0.55 0.22 295)',
  },
};

// Bike library — each is a "saved bike" the user can swap in
// Imagery: Unsplash (free to use under Unsplash license) — real motorcycle photography
window.MV_BIKES = [
  { id: 'gs', make: 'BMW', model: 'R 1250 GS', year: 2023, km: 13500,
    img: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=1200&q=80&auto=format&fit=crop',
    color: 'Ice Grey', tagline: 'Adventure-ready boxer twin',
    purchase: '€21,500', bought: 'May 2023' },
  { id: 'hd', make: 'Harley-Davidson', model: 'Sportster S', year: 2022, km: 8420,
    img: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=1200&q=80&auto=format&fit=crop',
    color: 'Midnight Crimson', tagline: 'Revolution Max cruiser',
    purchase: '€16,200', bought: 'Aug 2022' },
  { id: 'kt', make: 'KTM', model: '890 Adventure', year: 2024, km: 3100,
    img: 'https://images.unsplash.com/photo-1449426468159-d96dbf08f19f?w=1200&q=80&auto=format&fit=crop',
    color: 'Orange', tagline: 'Mid-weight adventure',
    purchase: '€12,900', bought: 'Feb 2024' },
];

// Sample trips (Dolomites etc from the screens shown)
window.MV_TRIPS = [
  { id: 'dolomites', name: 'Dolomites Loop — 3 Days', days: 3, stops: 7, distance: '412 km', rating: 4.9, kind: 'Spirited',
    img: 'https://images.unsplash.com/photo-1500520198921-6d4704f98092?w=1200&q=80&auto=format&fit=crop',
    tagline: 'Scenic 3-day loop through the Italian Dolomites. Sella, Pordoi, Gardena.' },
  { id: 'gavia', name: 'Passo di Gavia — Italian Alps', days: 1, stops: 4, distance: '28 km', rating: 4.8, kind: 'Editor\'s Pick',
    img: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=80&auto=format&fit=crop',
    tagline: '1988 Giro left riders hypothermic at the summit. Pair with Stelvio for an unforgettable double.' },
  { id: 'pch', name: 'Pacific Coast Highway — Big Sur', days: 2, stops: 6, distance: '182 km', rating: 5.0, kind: 'Editor\'s Pick',
    img: 'https://images.unsplash.com/photo-1527489377706-5bf97e608852?w=1200&q=80&auto=format&fit=crop',
    tagline: 'Narrow, twisty, and unforgettable. Arrive early to beat fog.' },
];

window.MV_MAINTENANCE = [
  { id: 'm1', title: '20,000 km Major Service', sub: 'Valve inspection · every 20,000 km', due: 'Due in 56 days', km: '20,000 km', priority: 'high' },
  { id: 'm2', title: 'Oil & filter change', sub: 'Every 10,000 km or yearly', due: 'Due in 12 days', km: '14,500 km', priority: 'medium' },
  { id: 'm3', title: 'Chain lubrication', sub: 'Every 600 km', due: 'Overdue by 3 days', km: '13,800 km', priority: 'critical' },
];

window.MV_RIDES = [
  { id: 'r1', name: 'Sunday breakfast loop', distance: '87 km', duration: '1h 42m', date: 'Apr 18', avg: '62 km/h' },
  { id: 'r2', name: 'Commute — office',    distance: '24 km', duration: '38m', date: 'Apr 16', avg: '38 km/h' },
  { id: 'r3', name: 'Twisties with Marek', distance: '214 km', duration: '3h 58m', date: 'Apr 12', avg: '54 km/h' },
];

// Per-bike analytics (12 months of spend + rides)
window.MV_ANALYTICS = {
  gs: {
    spend12: [180, 92, 210, 68, 140, 340, 220, 95, 410, 160, 184, 220],
    km12:    [120, 45, 280, 180, 220, 510, 620, 310, 480, 290, 412, 360],
    costPerKm: 0.34, totalSpend: 4622.65, tco: 26122.65, purchase: 21500,
    monthlyAvg: 420, avgRide: 58,
    byCat: [
      { name: 'Gear', amount: 1348.05, pct: 29 },
      { name: 'Service', amount: 890.40, pct: 19 },
      { name: 'Fuel', amount: 673.00, pct: 15 },
      { name: 'Insurance', amount: 540.00, pct: 12 },
      { name: 'Parts', amount: 420.00, pct: 9 },
      { name: 'Tyres', amount: 385.00, pct: 8 },
      { name: 'Other', amount: 366.20, pct: 8 },
    ],
    upcoming: [
      { label: '20,000 km Major Service', cost: '€420 est.', in: '56 days' },
      { label: 'Tyres (rear)', cost: '€280 est.', in: '3,800 km' },
    ],
  },
};
