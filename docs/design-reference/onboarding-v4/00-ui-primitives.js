// MotoVault mobile — Core UI primitives (Pill, Button, Card, Chip, etc.)
// Styled for RN-portability: flat style objects, no CSS selectors.

const mvT = () => window.MV_TOKENS[window.__mvTheme || 'dark'];

// Premium button
const MVButton = ({ label, icon, onPress, variant = 'primary', size = 'md', style = {}, full = false }) => {
  const t = mvT();
  const sizes = {
    sm: { padV: 10, padH: 14, fs: 13, gap: 6, ic: 16, r: 12 },
    md: { padV: 14, padH: 18, fs: 15, gap: 8, ic: 18, r: 14 },
    lg: { padV: 18, padH: 22, fs: 16, gap: 10, ic: 20, r: 16 },
  }[size];
  const variants = {
    primary: { bg: t.warm, fg: '#1a1208', border: 'transparent' },
    dark:    { bg: t.ink, fg: t.bg, border: 'transparent' },
    ghost:   { bg: 'transparent', fg: t.ink, border: t.line },
    solid:   { bg: t.surface2, fg: t.ink, border: t.line },
    danger:  { bg: 'transparent', fg: t.danger, border: 'transparent' },
  }[variant];
  return (
    <button onClick={onPress} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      gap: sizes.gap, padding: `${sizes.padV}px ${sizes.padH}px`,
      background: variants.bg, color: variants.fg,
      border: `1px solid ${variants.border}`,
      borderRadius: sizes.r, fontFamily: 'inherit', fontSize: sizes.fs,
      fontWeight: 600, letterSpacing: '-0.01em',
      cursor: 'pointer', width: full ? '100%' : 'auto',
      transition: 'transform .12s, background .15s, opacity .15s',
      ...style,
    }} onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.97)'}
       onMouseUp={(e) => e.currentTarget.style.transform = ''}
       onMouseLeave={(e) => e.currentTarget.style.transform = ''}>
      {icon && <MVIcon name={icon} size={sizes.ic} color={variants.fg}/>}
      {label}
    </button>
  );
};

// Chip / tag
const MVChip = ({ label, icon, active, color, onPress, size = 'md', style = {} }) => {
  const t = mvT();
  const pad = size === 'sm' ? '5px 10px' : '7px 12px';
  const fs  = size === 'sm' ? 11 : 12;
  const bg  = active ? (color || t.warm) : t.surface2;
  const fg  = active ? '#1a1208' : t.ink2;
  return (
    <div onClick={onPress} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: pad, borderRadius: 999, background: bg, color: fg,
      fontSize: fs, fontWeight: 600, letterSpacing: '-0.005em',
      border: `1px solid ${active ? 'transparent' : t.line}`,
      cursor: onPress ? 'pointer' : 'default',
      whiteSpace: 'nowrap', ...style,
    }}>
      {icon && <MVIcon name={icon} size={fs + 2} color={fg}/>}
      {label}
    </div>
  );
};

// Card container
const MVCard = ({ children, style = {}, pad = 16, onPress }) => {
  const t = mvT();
  return (
    <div onClick={onPress} style={{
      background: t.surface, border: `1px solid ${t.line}`,
      borderRadius: 20, padding: pad, cursor: onPress ? 'pointer' : 'default',
      ...style,
    }}>{children}</div>
  );
};

// Section header (caption + optional trailing)
const MVSection = ({ title, action, onAction, children, style = {}, gap = 10 }) => {
  const t = mvT();
  return (
    <div style={{ ...style }}>
      {(title || action) && (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 4px', marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: t.ink3 }}>
            {title}
          </div>
          {action && <div onClick={onAction} style={{ fontSize: 12, color: t.ink2, cursor: 'pointer', fontWeight: 500 }}>{action}</div>}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap }}>
        {children}
      </div>
    </div>
  );
};

// Tiny stat tile
const MVStat = ({ label, value, tone }) => {
  const t = mvT();
  return (
    <div style={{
      flex: 1, padding: '12px 14px', background: t.surface,
      borderRadius: 14, border: `1px solid ${t.line}`,
    }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.ink3, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, color: tone || t.ink, letterSpacing: '-0.02em' }}>
        {value}
      </div>
    </div>
  );
};

// Priority pill (low/med/high/critical)
const MVPriority = ({ level }) => {
  const t = mvT();
  const map = {
    low:      { c: t.success, label: 'Low' },
    medium:   { c: t.info, label: 'Medium' },
    high:     { c: t.warm, label: 'High' },
    critical: { c: t.danger, label: 'Critical' },
  };
  const { c, label } = map[level];
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 9px', background: `color-mix(in oklch, ${c} 18%, transparent)`,
      border: `1px solid color-mix(in oklch, ${c} 32%, transparent)`,
      borderRadius: 999, fontSize: 10, fontWeight: 700,
      letterSpacing: '0.08em', textTransform: 'uppercase', color: c,
    }}>
      <div style={{ width: 6, height: 6, borderRadius: 3, background: c }}/>
      {label}
    </div>
  );
};

// Progress bar
const MVProgress = ({ value, color }) => {
  const t = mvT();
  return (
    <div style={{ height: 6, background: t.surface2, borderRadius: 999, overflow: 'hidden' }}>
      <div style={{
        width: `${value * 100}%`, height: '100%',
        background: color || t.warm,
        borderRadius: 999,
      }}/>
    </div>
  );
};

// Divider
const MVDivider = ({ style = {} }) => {
  const t = mvT();
  return <div style={{ height: 1, background: t.line, ...style }}/>;
};

// Avatar
const MVAvatar = ({ src, size = 36, initials }) => {
  const t = mvT();
  return (
    <div style={{
      width: size, height: size, borderRadius: size / 2,
      background: src ? `url(${src}) center/cover` : t.surface3,
      display: 'grid', placeItems: 'center', color: t.ink, fontWeight: 600, fontSize: size * 0.4,
      border: `1px solid ${t.line}`,
    }}>
      {!src && initials}
    </div>
  );
};

Object.assign(window, {
  MVButton, MVChip, MVCard, MVSection, MVStat, MVPriority, MVProgress, MVDivider, MVAvatar, mvT,
});
