// =============================================================================
// MotoVault — Onboarding (reordered, activation-first) — CORE
// Shared tokens, header chrome, CTA, skip, and bike data.
// Brand: warm darks, exhaust-copper accent, Plus Jakarta Sans + Instrument Serif
//        italic copper display + Geist Mono eyebrows. Squircle radii, <300ms motion.
// Accent + UI font are driven by CSS vars (--ac / --ui-font) so Tweaks can re-skin live.
// =============================================================================

const FT = {
  bg:    '#161412',          // warm near-black
  bg2:   '#100E0C',          // deeper — hero / loaders
  card:  '#1E1C19',          // elevated surface
  card2: '#262320',
  line:  'rgba(244,239,233,0.09)',
  line2: 'rgba(244,239,233,0.05)',
  ac:     'var(--ac)',                                    // exhaust copper (tweakable)
  acText: 'color-mix(in srgb, var(--ac) 80%, #ffe0c2)',   // brighter copper for display italics + key data
  acSoft: 'color-mix(in srgb, var(--ac) 14%, transparent)',
  acLine: 'color-mix(in srgb, var(--ac) 34%, transparent)',
  ink:   '#F4EFE9',
  ink2:  'rgba(244,239,233,0.64)',
  ink3:  'rgba(244,239,233,0.40)',
  ink4:  'rgba(244,239,233,0.24)',
  blue:  '#5B8DEF',   // trust
  teal:  '#3FB8A0',   // growth
  amber: '#E0A03F',   // encouragement
  green: '#5BBF7A',
  danger:'#D9583E',
  darkInk: '#1A1208',
  serif: '"Instrument Serif", Georgia, serif',
  mono:  '"Geist Mono", ui-monospace, monospace',
};

// Safe-area top spacer (clears the status bar / dynamic island).
const ObSafeTop = ({ children, style = {} }) => (
  <div style={{ paddingTop: 54, ...style }}>{children}</div>
);

// Mono eyebrow — ALL-CAPS, wide tracking. Optional leading dot.
const FEyebrow = ({ children, color, dot = true, style = {} }) => (
  <div style={{
    display: 'inline-flex', alignItems: 'center', gap: 7,
    fontFamily: FT.mono, fontSize: 10.5, fontWeight: 500,
    letterSpacing: '0.22em', textTransform: 'uppercase',
    color: color || FT.ink3, ...style,
  }}>
    {dot && <span style={{ width: 4, height: 4, borderRadius: 2, background: color || FT.acText }}/>}
    {children}
  </div>
);

// Back affordance — chevron inside a rounded warm-surface circle, top-left.
const FBack = ({ onPress }) => (
  <div onClick={onPress} style={{
    position: 'absolute', top: 58, left: 20, zIndex: 30,
    width: 38, height: 38, borderRadius: 13,
    background: 'rgba(244,239,233,0.06)',
    border: `1px solid ${FT.line}`,
    backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
    display: 'grid', placeItems: 'center', cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  }}>
    <MVIcon name="chevron-left" size={20} color={FT.ink2} strokeWidth={2}/>
  </div>
);

// Thin segmented progress — filled segments in copper.
const FProgress = ({ step, total }) => (
  <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
    {Array.from({ length: total }).map((_, i) => {
      const filled = i < step;
      return (
        <div key={i} style={{
          flex: 1, height: 3, borderRadius: 2,
          background: filled ? 'var(--ac)' : 'rgba(244,239,233,0.12)',
          boxShadow: filled ? '0 0 8px color-mix(in srgb, var(--ac) 50%, transparent)' : 'none',
          transition: 'background .35s ease, box-shadow .35s ease',
        }}/>
      );
    })}
  </div>
);

// Standard step header: back + progress + step counter eyebrow.
// Steps 3–8 + 11 share this. We map them onto a 7-segment journey.
const FHeader = ({ step, total = 7, onBack, eyebrow }) => (
  <ObSafeTop style={{ padding: '58px 26px 0', position: 'relative' }}>
    {onBack && <FBack onPress={onBack}/>}
    <div style={{ height: 44 }}/>
    <FProgress step={step} total={total}/>
    {eyebrow && (
      <div style={{ marginTop: 20 }}>
        <FEyebrow>{eyebrow}</FEyebrow>
      </div>
    )}
  </ObSafeTop>
);

// Display headline — Instrument Serif, with optional italic copper accent line.
const FTitle = ({ children, size = 34, style = {} }) => (
  <div style={{
    fontFamily: FT.serif, fontSize: size, lineHeight: 1.0,
    color: FT.ink, letterSpacing: '-0.018em', ...style,
  }}>{children}</div>
);
const FAccent = ({ children }) => (
  <em style={{ fontStyle: 'italic', color: FT.acText }}>{children}</em>
);

// Primary CTA — full-width copper, dark text, right-arrow.
const FButton = ({ label, icon = 'arrow-right', onPress, disabled = false, style = {}, tone }) => (
  <button onClick={disabled ? undefined : onPress} disabled={disabled} style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
    width: '100%', padding: '17px 22px', borderRadius: 16,
    background: tone || 'var(--ac)', color: FT.darkInk,
    border: 'none', fontFamily: 'inherit', fontSize: 16, fontWeight: 700,
    letterSpacing: '-0.01em', cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    transition: 'transform .12s ease, opacity .2s ease',
    WebkitTapHighlightColor: 'transparent',
    boxShadow: disabled ? 'none' : '0 10px 30px color-mix(in srgb, var(--ac) 24%, transparent)',
    ...style,
  }}
    onMouseDown={(e) => { if (!disabled) e.currentTarget.style.transform = 'scale(0.975)'; }}
    onMouseUp={(e) => e.currentTarget.style.transform = ''}
    onMouseLeave={(e) => e.currentTarget.style.transform = ''}>
    {label}
    {icon && <MVIcon name={icon} size={19} color={FT.darkInk} strokeWidth={2.2}/>}
  </button>
);

// Read a live tweak/config value (set by the Tweaks panel) with a fallback.
const fcfg = (key, fallback) => {
  const c = window.__FCFG || {};
  return c[key] !== undefined ? c[key] : fallback;
};

// Resolve an asset URL: prefers an inlined blob (standalone build sets window.__resources),
// otherwise falls back to the normal path — so non-bundled files keep working unchanged.
window.__res = (id, fb) => (window.__resources && window.__resources[id]) || fb;

// Demoted skip — small, muted, single line. NOT a co-equal copper link.
const FSkip = ({ label, onPress, style = {} }) => {
  if (fcfg('skipStyle', 'Demoted text') === 'Hidden') return null;
  return (
  <div style={{ textAlign: 'center', marginTop: 14, ...style }}>
    <span onClick={onPress} style={{
      fontSize: 12.5, color: FT.ink3, cursor: 'pointer', fontWeight: 500,
      letterSpacing: '-0.005em', WebkitTapHighlightColor: 'transparent',
    }}>{label}</span>
  </div>
  );
};

// Soft warm grain overlay (reusable).
const FGrain = ({ opacity = 0.05 }) => (
  <div style={{
    position: 'absolute', inset: 0, opacity, mixBlendMode: 'overlay', pointerEvents: 'none',
    backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
  }}/>
);

// ── Bike data ────────────────────────────────────────────────────────────────
const F_POPULAR_MAKES = ['BMW', 'Honda', 'Kawasaki', 'Yamaha', 'KTM', 'Suzuki', 'Triumph', 'Harley-Davidson'];
const F_ALL_MAKES = [
  'BMW', 'Honda', 'Kawasaki', 'Yamaha', 'KTM', 'Suzuki', 'Triumph', 'Harley-Davidson',
  'Ducati', 'Royal Enfield', 'Aprilia', 'CFMoto', 'Husqvarna', 'Indian',
  'Moto Guzzi', 'MV Agusta', 'Norton', 'Zero', 'Vespa', 'Benelli',
];
const F_MAKE_COLORS = {
  'BMW': '#1C69D4', 'Ducati': '#CC0000', 'KTM': '#FF6600', 'Harley-Davidson': '#F59800',
  'Honda': '#E40521', 'Yamaha': '#0B5FA5', 'Triumph': '#C9A227', 'Kawasaki': '#4CAF50',
  'Suzuki': '#0F62C4', 'Aprilia': '#C8102E', 'Indian': '#8B1A1A', 'Moto Guzzi': '#B31B1B',
  'MV Agusta': '#E30613', 'Royal Enfield': '#3A3A3A', 'Husqvarna': '#1B3A5A',
  'Benelli': '#008C45', 'CFMoto': '#E4002B', 'Zero': '#00A859', 'Norton': '#28406A', 'Vespa': '#C9A66B',
};
const F_MODELS = {
  'BMW':             ['R 1250 GS', 'R nineT', 'F 900 XR', 'S 1000 RR', 'R 18'],
  'Honda':           ['Africa Twin', 'CB650R', 'Rebel 1100', 'NC750X', 'CBR600RR'],
  'Kawasaki':        ['Ninja 650', 'Z900', 'Versys 650', 'KLR650', 'W800'],
  'Yamaha':          ['MT-07', 'Ténéré 700', 'XSR900', 'MT-09', 'YZF-R7'],
  'KTM':             ['390 Duke', '890 Adventure', '1290 Super Duke R', '690 SMC R'],
  'Suzuki':          ['SV650', 'V-Strom 650', 'GSX-R1000', 'Katana'],
  'Triumph':         ['Street Triple', 'Bonneville T120', 'Tiger 900', 'Speed Twin'],
  'Harley-Davidson': ['Pan America', 'Sportster S', 'Road Glide', 'Fat Bob'],
  'Ducati':          ['Monster', 'Panigale V4', 'Multistrada V4', 'Scrambler'],
  'Royal Enfield':   ['INT 650', 'Classic 350', 'Hunter 350', 'Himalayan'],
  'Aprilia':         ['Tuono V4', 'RS 660', 'Tuareg 660'],
  'CFMoto':          ['450NK', '700 CL-X'],
  'Husqvarna':       ['Svartpilen 401', 'Norden 901'],
  'Indian':          ['Scout', 'FTR 1200'],
};
// tagline + real-ish fleet popularity for the brand takeover + reveal
const F_BRAND_DNA = {
  'BMW':             { type: 'adv',     tagline: 'Bavarian engineering, every ride.',  intervals: '10,000 km', riders: 25, rank: 1 },
  'Honda':           { type: 'sport',   tagline: 'Built to outlast the road.',         intervals: '12,000 km', riders: 20, rank: 2 },
  'Kawasaki':        { type: 'sport',   tagline: 'Let the good times roll.',           intervals: '12,000 km', riders: 10, rank: 3 },
  'Yamaha':          { type: 'sport',   tagline: 'Engineering joy since 1955.',        intervals: '10,000 km', riders: 8,  rank: 4 },
  'KTM':             { type: 'adv',     tagline: 'Ready to race.',                     intervals: '7,500 km',  riders: 7,  rank: 5 },
  'Suzuki':          { type: 'sport',   tagline: 'Way of life on two wheels.',         intervals: '12,000 km', riders: 6,  rank: 6 },
  'Triumph':         { type: 'sport',   tagline: 'British character, modern craft.',   intervals: '10,000 km', riders: 6,  rank: 7 },
  'Harley-Davidson': { type: 'cruiser', tagline: 'Freedom, distilled into thunder.',   intervals: '8,000 km',  riders: 6,  rank: 8 },
  'Ducati':          { type: 'sport',   tagline: 'Italian passion, distilled.',        intervals: '12,000 km', riders: 5,  rank: 9 },
  'Royal Enfield':   { type: 'cruiser', tagline: 'Pure motorcycling, refined.',        intervals: '10,000 km', riders: 5,  rank: 10 },
  'Aprilia':         { type: 'sport',   tagline: 'Italian racing pedigree.',           intervals: '10,000 km', riders: 2,  rank: 12 },
  'CFMoto':          { type: 'sport',   tagline: 'New world, new ride.',               intervals: '10,000 km', riders: 2,  rank: 13 },
  'Husqvarna':       { type: 'adv',     tagline: 'Pioneering since 1903.',             intervals: '7,500 km',  riders: 2,  rank: 14 },
  'Indian':          { type: 'cruiser', tagline: 'An American original since 1901.',   intervals: '8,000 km',  riders: 1,  rank: 16 },
  __default:         { type: 'sport',   tagline: 'Tell us more — we adapt.',           intervals: 'configurable' },
};
// Representative photography for the garage reveal (Unsplash — free license).
const F_BIKE_IMG = {
  'BMW':             'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=1200&q=80&auto=format&fit=crop',
  'Harley-Davidson': 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=1200&q=80&auto=format&fit=crop',
  'KTM':             'https://images.unsplash.com/photo-1449426468159-d96dbf08f19f?w=1200&q=80&auto=format&fit=crop',
  'Ducati':          'https://images.unsplash.com/photo-1517232115160-ff93364542dd?w=1200&q=80&auto=format&fit=crop',
  'Triumph':         'https://images.unsplash.com/photo-1609630875171-b1321377ee65?w=1200&q=80&auto=format&fit=crop',
  __default:         'assets/default-bike.jpg',
};
const bikeImg = (make) => {
  const url = F_BIKE_IMG[make] || F_BIKE_IMG.__default;
  const id = F_BIKE_IMG_ID[make] || F_BIKE_IMG_ID.__default;
  return window.__res(id, url);
};
const F_BIKE_IMG_ID = {
  'BMW': 'bikeBMW', 'Harley-Davidson': 'bikeHarley', 'KTM': 'bikeKTM',
  'Ducati': 'bikeDucati', 'Triumph': 'bikeTriumph', __default: 'bikeDefault',
};
const makeColor = (make) => (make && make !== '__other') ? (F_MAKE_COLORS[make] || 'var(--ac)') : 'var(--ac)';

Object.assign(window, {
  FT, ObSafeTop, FEyebrow, FBack, FProgress, FHeader, FTitle, FAccent, FButton, FSkip, FGrain, fcfg,
  F_POPULAR_MAKES, F_ALL_MAKES, F_MAKE_COLORS, F_MODELS, F_BRAND_DNA, F_BIKE_IMG,
  bikeImg, makeColor,
});
