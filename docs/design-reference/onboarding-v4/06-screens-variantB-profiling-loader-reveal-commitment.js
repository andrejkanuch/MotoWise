// =============================================================================
// MotoVault — Onboarding flow — VARIANT B (derived from Variant A)
// B = "Invested & personalized": same design system / components / motion as A.
// Only difference: invest the user MORE before the paywall.
//
// NEW screens (built from A's existing card / loader components):
//   03a Frequency · 03b Stay-on-top-of · 03c Last service & mileage · 04L Building your plan
// MODIFIED screens (same layout/components as A, content/behaviour changed):
//   05 Reveal (projection-led + AI known-issues) · 08 Commitment (signature pledge)
//
// Progress bar gains more segments via window.__FSTEPMAP / __FTOTAL (set in the
// host page) — the SAME FProgress component, just a longer journey.
// =============================================================================

// ── B data ───────────────────────────────────────────────────────────────────
const F_FREQUENCY = [
  { id: 'daily',    title: 'Almost daily',     sub: 'Daily rider',   icon: 'gauge',    accent: 'var(--ac)' },
  { id: 'weekly',   title: 'A few times a week', sub: 'Weekly',       icon: 'calendar', accent: 'oklch(0.62 0.13 230)' },
  { id: 'weekends', title: 'Mostly weekends',  sub: 'Weekends',      icon: 'compass',  accent: 'oklch(0.66 0.13 165)' },
  { id: 'occasional', title: 'Now and then',   sub: 'Occasional',    icon: 'clock',    accent: 'oklch(0.72 0.13 78)' },
  { id: 'seasonal', title: 'Seasonally',       sub: 'Fair-weather',  icon: 'sun',      accent: 'oklch(0.58 0.17 32)' },
];

const F_CONCERNS = [
  { id: 'service', icon: 'bell',     label: 'Never miss a service', sub: 'Reminders before each task is due' },
  { id: 'costs',   icon: 'dollar',   label: 'Avoid surprise costs', sub: 'See what’s coming and budget for it' },
  { id: 'resale',  icon: 'book',     label: 'Keep resale value',    sub: 'Build a documented service history' },
  { id: 'issues',  icon: 'shield',   label: 'Catch issues early',   sub: 'Recalls and common problems for your bike' },
  { id: 'enjoy',   icon: 'sparkle',  label: 'Just enjoy the ride',  sub: 'Keep it light', casual: true },
];

const F_LAST_SERVICE = ['Just did it', '< 3 months', '3–6 months', '6–12 months', '1 year+', 'Not sure'];

// Projected first-year scheduled-service cost per make (loss-aversion lead on the Reveal).
const F_PROJECTION = {
  'BMW':             { cost: 420, line: 'mostly an oil service + valve check' },
  'Honda':           { cost: 360, line: 'mostly an oil service + chain check' },
  'Kawasaki':        { cost: 340, line: 'mostly an oil service + chain check' },
  'Yamaha':          { cost: 330, line: 'mostly an oil service + chain check' },
  'KTM':             { cost: 480, line: 'oil service + an early valve check' },
  'Suzuki':          { cost: 330, line: 'mostly an oil service + chain check' },
  'Triumph':         { cost: 410, line: 'oil service + a brake-fluid flush' },
  'Harley-Davidson': { cost: 450, line: 'oil service + primary & belt check' },
  'Ducati':          { cost: 560, line: 'oil service + desmo valve check' },
  'Royal Enfield':   { cost: 260, line: 'mostly an oil service + tappet check' },
  __default:         { cost: 390, line: 'mostly an oil service + chain check' },
};
const projection = (make) => F_PROJECTION[make] || F_PROJECTION.__default;

// AI-style "known issues" — always hedged ("owners commonly report…"). Hidden if absent.
const F_KNOWN_ISSUES = {
  'BMW':             ['Owners commonly check the final-drive seal at higher mileage', 'Some report a slight clutch judder on early R 1250s', 'A few note ABS sensor wear over time'],
  'Honda':           ['Some owners report regulator/rectifier heat', 'Occasional cam-chain tensioner noise is mentioned', 'A few note minor fork-seal weep'],
  'Kawasaki':        ['Owners often mention cam-chain tensioner noise', 'Some report fork seals weeping over time', 'A few watch regulator heat at high miles'],
  'Yamaha':          ['Some owners note a notchy gearbox when cold', 'Occasional fuel-pump relay faults are reported', 'A few mention rear-shock fade with miles'],
  'KTM':             ['Owners commonly do an early camshaft check', 'Some report water-pump seal seepage', 'A few watch fuel-pump wiring on older units'],
  'Suzuki':          ['Some owners report reg/rec failures', 'Occasional clutch-basket chatter is mentioned', 'A few watch fork seals at high miles'],
  'Triumph':         ['Some report sprag-clutch wear on older triples', 'Occasional fuelling glitches are mentioned', 'A few note headlight condensation'],
  'Harley-Davidson': ['Some owners watch cam-chain tensioner wear', 'Occasional charging-system reports appear', 'A few keep an eye on primary-chain tension'],
  'Ducati':          ['Owners commonly budget for desmo valve service', 'Some report charging-system quirks', 'A few watch the clutch slave on older bikes'],
  'Royal Enfield':   ['Some owners report minor oil weeps', 'Occasional electrical gremlins are mentioned', 'A few re-check vibration-loosened fasteners'],
};
const knownIssues = (make) => F_KNOWN_ISSUES[make] || null;

// Small shared "why we ask" line — what makes B's extra length feel worthwhile.
const FWhy = ({ children }) => (
  <div style={{ fontSize: 13.5, color: FT.ink2, lineHeight: 1.45, maxWidth: 322, marginTop: 10 }}>{children}</div>
);
// Social-proof footnote (Geist Mono) — present on every B question.
const FProof = ({ children, style = {} }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: FT.mono, fontSize: 10.5,
        letterSpacing: '0.06em', color: FT.ink3, lineHeight: 1.4, ...style }}>
    <span style={{ width: 6, height: 6, borderRadius: 3, background: FT.green, boxShadow: `0 0 7px ${FT.green}`, flexShrink: 0 }}/>
    <span>{children}</span>
  </div>
);

// ── 03a — FREQUENCY (NEW) — clone of 03 Experience: single-select, auto-advance ─
const F03aFrequency = ({ go, state, setState }) => {
  const picked = state.ridingFrequency;
  const [pending, setPending] = React.useState(null);
  const [exiting, setExiting] = React.useState(false);

  const choose = (o) => {
    if (pending) return;
    setPending(o.id);
    setState(s => ({ ...s, ridingFrequency: o.id }));
    setTimeout(() => setExiting(true), 620);
    setTimeout(() => go('03b-concerns')(), 800);
  };
  const activeId = pending || picked;
  const glowC = (F_FREQUENCY.find(o => o.id === activeId) || {}).accent || 'var(--ac)';

  return (
    <div style={{ position: 'relative', height: '100%', background: FT.bg, display: 'flex', flexDirection: 'column',
                  overflow: 'hidden', opacity: exiting ? 0 : 1, transform: exiting ? 'translateY(-8px)' : 'none',
                  transition: 'opacity .2s ease, transform .2s ease' }}>
      <div className="fb2-glow" style={{ position: 'absolute', inset: '-15% -20% auto -20%', height: '44%',
            background: `radial-gradient(ellipse 60% 80% at 50% 18%, color-mix(in srgb, ${glowC} 24%, transparent) 0%, transparent 70%)`,
            filter: 'blur(26px)', pointerEvents: 'none', transition: 'background .5s ease' }}/>
      <FGrain/>
      <FHeader step={21} onBack={go('03-experience')} eyebrow="Your riding"/>
      <div style={{ padding: '18px 26px 0' }}>
        <FTitle size={34}>How often do you<br/><FAccent>get out?</FAccent></FTitle>
        <FWhy>We’ll tune service intervals and reminders to your real mileage.</FWhy>
      </div>

      <div style={{ flex: 1, padding: '20px 20px 14px', display: 'flex', flexDirection: 'column', gap: 9, justifyContent: 'center' }}>
        {F_FREQUENCY.map((o, i) => {
          const active = picked === o.id, isPicked = pending === o.id, dim = pending && !isPicked;
          return (
            <div key={o.id} onClick={() => choose(o)} className="fb2-card" style={{ animationDelay: `${200 + i * 70}ms`,
                  padding: '13px 15px', borderRadius: 16, cursor: 'pointer',
                  background: active ? `color-mix(in srgb, ${o.accent} 12%, #1E1C19)` : FT.card,
                  border: `1px solid ${active ? `color-mix(in srgb, ${o.accent} 45%, transparent)` : FT.line}`,
                  transition: 'all .22s ease, opacity .3s ease', transform: isPicked ? 'scale(0.985)' : 'scale(1)',
                  opacity: dim ? 0.4 : 1, display: 'flex', alignItems: 'center', gap: 14,
                  boxShadow: active ? `0 12px 30px color-mix(in srgb, ${o.accent} 18%, transparent)` : 'none',
                  WebkitTapHighlightColor: 'transparent' }}>
              <div style={{ width: 44, height: 44, borderRadius: 13, flexShrink: 0,
                    background: active ? o.accent : `color-mix(in srgb, ${o.accent} 12%, #262320)`,
                    display: 'grid', placeItems: 'center', transition: 'background .22s ease' }}>
                <MVIcon name={o.icon} size={21} color={active ? FT.darkInk : o.accent}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15.5, fontWeight: 600, color: FT.ink, letterSpacing: '-0.012em' }}>{o.title}</div>
                <div style={{ fontFamily: FT.mono, fontSize: 9.5, fontWeight: 500, letterSpacing: '0.16em',
                      textTransform: 'uppercase', color: active ? o.accent : FT.ink3, marginTop: 3 }}>{o.sub}</div>
              </div>
              {active && (
                <div className="fb2-ck" style={{ width: 26, height: 26, borderRadius: 13, background: o.accent,
                      display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <MVIcon name="check" size={14} color={FT.darkInk} strokeWidth={3}/>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ padding: '0 26px 30px' }}>
        <FProof>Riders who set this get reminders that actually fit.</FProof>
      </div>
      <style>{`
        @keyframes fb2In   { from { opacity:0; transform: translateY(14px); } to { opacity:1; transform:none; } }
        @keyframes fb2Ck   { 0% { opacity:0; transform: scale(.4); } 60% { transform: scale(1.15); } 100% { opacity:1; transform: scale(1); } }
        @keyframes fb2Glow { 0%,100% { opacity:.85; transform: translateX(-2%); } 50% { opacity:1; transform: translateX(2%); } }
        .fb2-card { animation: fb2In .5s cubic-bezier(.2,.7,.2,1) both; }
        .fb2-ck   { animation: fb2Ck .28s cubic-bezier(.2,.7,.2,1) both; }
        .fb2-glow { animation: fb2Glow 3.6s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

// ── 03b — STAY ON TOP OF (NEW) — clone of 06 Goals: multi-select + Continue ────
const F03bConcerns = ({ go, state, setState }) => {
  const picked = state.concerns || [];
  const [affirm, setAffirm] = React.useState(false);
  const toggle = (id) => setState(s => {
    const cur = s.concerns || [];
    return { ...s, concerns: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] };
  });
  const cont = () => {
    if (!picked.length) return;
    const primary = F_CONCERNS.find(c => picked.includes(c.id) && c.id !== 'enjoy') || F_CONCERNS.find(c => picked.includes(c.id));
    setState(s => ({ ...s, primaryConcern: primary ? primary.id : null }));
    setAffirm(true);
    setTimeout(() => go('03c-service')(), 640);
  };

  return (
    <div style={{ position: 'relative', height: '100%', background: FT.bg, display: 'flex', flexDirection: 'column' }}>
      <FHeader step={22} onBack={go('03a-frequency')} eyebrow="What matters to you"/>
      <div style={{ padding: '16px 26px 0' }}>
        <FTitle size={29}>What do you want<br/>to <FAccent>stay on top of?</FAccent></FTitle>
        <FWhy>We’ll lead with what matters most to you.</FWhy>
      </div>

      <div style={{ flex: 1, padding: '18px 20px 10px', display: 'flex', flexDirection: 'column', gap: 9, overflow: 'auto' }}>
        {F_CONCERNS.map((g, i) => {
          const on = picked.includes(g.id);
          return (
            <div key={g.id} onClick={() => toggle(g.id)} className="fb2-in" style={{ animationDelay: `${140 + i * 65}ms`,
                  padding: '13px 15px', borderRadius: 15, minHeight: 60, cursor: 'pointer',
                  background: on ? 'color-mix(in srgb, var(--ac) 9%, #1E1C19)' : FT.card,
                  border: `1px solid ${on ? FT.acLine : FT.line}`, display: 'flex', alignItems: 'center', gap: 13,
                  transition: 'all .16s ease', WebkitTapHighlightColor: 'transparent' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                    background: on ? 'color-mix(in srgb, var(--ac) 18%, #262320)' : '#262320',
                    display: 'grid', placeItems: 'center', transition: 'background .2s' }}>
                <MVIcon name={g.icon} size={20} color={on ? FT.acText : FT.ink3}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: FT.ink, letterSpacing: '-0.01em' }}>{g.label}</div>
                <div style={{ fontSize: 12, color: FT.ink3, lineHeight: 1.35, fontStyle: g.casual ? 'italic' : 'normal' }}>{g.sub}</div>
              </div>
              <div className={on ? 'fb2-ck2' : ''} style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0,
                    background: on ? 'var(--ac)' : 'transparent', border: on ? 'none' : `1.5px solid ${FT.ink4}`,
                    display: 'grid', placeItems: 'center', transition: 'all .2s ease' }}>
                {on && <MVIcon name="check" size={13} color={FT.darkInk} strokeWidth={3}/>}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ padding: '10px 20px 26px' }}>
        <FProof style={{ marginBottom: 12, justifyContent: 'center' }}>This shapes what your garage shows first.</FProof>
        {affirm && <div className="fb2-af" style={{ fontSize: 13.5, color: FT.acText, textAlign: 'center', marginBottom: 12, fontWeight: 600 }}>Got it — we’ll lead with that.</div>}
        <FButton label="Continue" onPress={cont} disabled={!picked.length}/>
        <div style={{ marginTop: 10, textAlign: 'center', fontFamily: FT.mono, fontSize: 11, letterSpacing: '0.1em', color: FT.ink4 }}>{picked.length} of {F_CONCERNS.length} picked</div>
      </div>
      <style>{`
        @keyframes fb2bIn { from { opacity:0; transform: translateY(12px); } to { opacity:1; transform:none; } }
        @keyframes fb2bCk { 0% { transform: scale(.4); } 60% { transform: scale(1.12); } 100% { transform: scale(1); } }
        @keyframes fb2bAf { from { opacity:0; transform: translateY(-3px); } to { opacity:1; transform:none; } }
        .fb2-in  { animation: fb2bIn .46s cubic-bezier(.2,.7,.2,1) both; }
        .fb2-ck2 { animation: fb2bCk .2s cubic-bezier(.2,.7,.2,1) both; }
        .fb2-af  { animation: fb2bAf .26s ease both; }
      `}</style>
    </div>
  );
};

// ── 03c — LAST SERVICE & MILEAGE (NEW) — chips + numeric input ─────────────────
const F03cService = ({ go, state, setState }) => {
  const last = state.lastService;
  const unit = state.unit || 'km';
  const mileage = state.currentMileage || '';
  const setLast = (v) => setState(s => ({ ...s, lastService: v }));
  const setMileage = (v) => setState(s => ({ ...s, currentMileage: v.replace(/[^0-9]/g, '').slice(0, 7) }));
  const setUnit = (u) => setState(s => ({ ...s, unit: u }));
  const cont = () => go('04-bike')();
  const notSure = () => { setState(s => ({ ...s, lastService: s.lastService || 'Not sure' })); go('04-bike')(); };

  return (
    <div style={{ position: 'relative', height: '100%', background: FT.bg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: '-15% -20% auto -20%', height: '40%',
            background: 'radial-gradient(ellipse 60% 80% at 50% 18%, color-mix(in srgb, var(--ac) 18%, transparent) 0%, transparent 70%)',
            filter: 'blur(26px)', pointerEvents: 'none' }}/>
      <FGrain/>
      <FHeader step={23} onBack={go('03b-concerns')} eyebrow="Your starting point"/>
      <div style={{ padding: '16px 26px 0' }}>
        <FTitle size={32}>Where does your<br/><FAccent>plan start?</FAccent></FTitle>
        <FWhy>So your maintenance plan and costs start from the right place.</FWhy>
      </div>

      <div style={{ flex: 1, padding: '22px 22px 10px', display: 'flex', flexDirection: 'column', gap: 24, overflow: 'auto' }}>
        {/* last service — single-select chips */}
        <div className="fb2-in">
          <FEyebrow style={{ marginBottom: 12 }}>Last service</FEyebrow>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {F_LAST_SERVICE.map(v => {
              const on = last === v;
              return (
                <div key={v} onClick={() => setLast(on ? null : v)} style={{ padding: '10px 15px', borderRadius: 999,
                      cursor: 'pointer', fontSize: 13.5, fontWeight: 600, transition: 'all .15s ease',
                      background: on ? 'var(--ac)' : FT.card, color: on ? FT.darkInk : FT.ink2,
                      border: `1px solid ${on ? 'transparent' : FT.line}`, WebkitTapHighlightColor: 'transparent' }}>{v}</div>
              );
            })}
          </div>
        </div>

        {/* current mileage — optional numeric + unit toggle */}
        <div className="fb2-in" style={{ animationDelay: '70ms' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
            <FEyebrow>Current mileage</FEyebrow>
            <span style={{ fontSize: 11, color: FT.ink4 }}>optional</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: FT.card,
                border: `1px solid ${FT.line}`, borderRadius: 15, padding: '6px 8px 6px 16px' }}>
            <input value={mileage} onChange={(e) => setMileage(e.target.value)} inputMode="numeric" placeholder="e.g. 18,400"
              style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none',
                       color: FT.ink, fontFamily: FT.mono, fontSize: 18, fontWeight: 600, letterSpacing: '0.02em' }}/>
            <div style={{ display: 'flex', background: '#262320', borderRadius: 11, padding: 3, flexShrink: 0 }}>
              {['km', 'mi'].map(u => {
                const on = unit === u;
                return (
                  <div key={u} onClick={() => setUnit(u)} style={{ padding: '8px 14px', borderRadius: 9, cursor: 'pointer',
                        fontFamily: FT.mono, fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                        background: on ? 'var(--ac)' : 'transparent', color: on ? FT.darkInk : FT.ink3,
                        transition: 'all .15s ease', WebkitTapHighlightColor: 'transparent' }}>{u}</div>
                );
              })}
            </div>
          </div>
          <div style={{ fontSize: 12, color: FT.ink3, lineHeight: 1.4, marginTop: 10, paddingLeft: 2 }}>
            Helps us time your next service — you can refine it later.
          </div>
        </div>
      </div>

      <div style={{ padding: '10px 20px 28px' }}>
        <FProof style={{ marginBottom: 12, justifyContent: 'center' }}>Last question before we read your bike’s data.</FProof>
        <FButton label="Continue" onPress={cont}/>
        <FSkip label="I’m not sure — use sensible defaults" onPress={notSure} style={{ marginTop: 12 }}/>
      </div>
      <style>{`
        @keyframes fb2cIn { from { opacity:0; transform: translateY(12px); } to { opacity:1; transform:none; } }
        .fb2-in { animation: fb2cIn .46s cubic-bezier(.2,.7,.2,1) both; }
      `}</style>
    </div>
  );
};

// ── 04L — BUILDING YOUR PLAN (NEW) — short pre-Reveal loader (12-style ring) ───
const F04LBuilding = ({ go, state, startDone }) => {
  const make = state.bikeMake || 'your bike';
  const lines = [
    `Checking recalls for your ${make}…`,
    'Pulling your OEM service schedule…',
    'Estimating your yearly costs…',
    `Finding ${make} riders like you…`,
  ];
  const [step, setStep] = React.useState(startDone ? lines.length : 0);

  React.useEffect(() => {
    if (startDone) return;
    const ts = [];
    lines.forEach((_, i) => ts.push(setTimeout(() => setStep(i + 1), 480 + i * 480)));
    ts.push(setTimeout(() => go('05-garage')(), lines.length * 480 + 620));
    return () => ts.forEach(clearTimeout);
  }, []);

  return (
    <div style={{ position: 'relative', height: '100%', background: FT.bg2, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', padding: '60px 28px', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: '-25% -25% auto -25%', height: '60%',
            background: 'radial-gradient(ellipse 60% 70% at 50% 40%, color-mix(in srgb, var(--ac) 18%, transparent) 0%, transparent 70%)',
            filter: 'blur(30px)', pointerEvents: 'none' }}/>
      <FGrain/>
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        <div style={{ position: 'relative', width: 120, height: 120, marginBottom: 30, display: 'grid', placeItems: 'center' }}>
          <div className="fb2l-ring" style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid var(--ac)' }}/>
          <div className="fb2l-ring fb2l-ring2" style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1.5px solid color-mix(in srgb, var(--ac) 55%, transparent)' }}/>
          <div style={{ width: 62, height: 62, borderRadius: 20, background: 'color-mix(in srgb, var(--ac) 18%, #1E1C19)',
                border: '1px solid color-mix(in srgb, var(--ac) 34%, transparent)', display: 'grid', placeItems: 'center' }}>
            <MVIcon name="sparkle" size={30} color={FT.acText}/>
          </div>
        </div>
        <FTitle size={30} style={{ textAlign: 'center', marginBottom: 8 }}>Building<br/><FAccent>your plan…</FAccent></FTitle>
        <div style={{ fontSize: 13, color: FT.ink3, textAlign: 'center', marginBottom: 30 }}>Reading your bike’s real service data</div>
        <div style={{ width: '100%', maxWidth: 300, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {lines.map((s, i) => {
            const sd = i < step, sa = i === step;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: sd || sa ? 1 : 0.32, transition: 'opacity .3s' }}>
                <div style={{ width: 22, height: 22, borderRadius: 11, flexShrink: 0,
                      background: sd ? FT.green : 'transparent', border: sa ? '2px solid var(--ac)' : sd ? 'none' : `1px solid ${FT.line}`,
                      display: 'grid', placeItems: 'center', transition: 'background .3s ease' }}>
                  {sd && <MVIcon name="check" size={13} color="#0E1A10" strokeWidth={3}/>}
                  {sa && <div style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--ac)', animation: 'fb2lPulse 1s ease-in-out infinite' }}/>}
                </div>
                <div style={{ fontFamily: FT.mono, fontSize: 12.5, letterSpacing: '0.01em', color: sd ? FT.ink2 : sa ? FT.ink : FT.ink3 }}>{s}</div>
              </div>
            );
          })}
        </div>
      </div>
      <style>{`
        @keyframes fb2lPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.4); } }
        @keyframes fb2lRing { 0% { transform: scale(.82); opacity:.85; } 70% { opacity:0; } 100% { transform: scale(1.28); opacity:0; } }
        .fb2l-ring { animation: fb2lRing 1.8s ease-out infinite; }
        .fb2l-ring2 { animation-delay: .6s; }
      `}</style>
    </div>
  );
};

// ── 05 — REVEAL (B) — projection-led + AI known-issues ────────────────────────
// Same layout / card system as A's F05Garage. Only the ORDER changes and one
// AI card is added: B leads with the COST PROJECTION (loss-aversion), keeps the
// factual recall check, adds a hedged AI "known issues" card, then community.
const F05RevealB = ({ go, state }) => {
  const make = state.bikeMake || 'BMW';
  const model = state.bikeModel;
  const year = state.bikeYear || (new Date().getFullYear() - 3);
  const brandC = makeColor(make);
  const dna = F_BRAND_DNA[make] || F_BRAND_DNA.__default;
  const img = bikeImg(make);
  const near = (dna.riders || 1) + 9;
  const proj = projection(make);
  const issues = knownIssues(make);
  const concern = state.primaryConcern;
  const dispStep = (window.__FSTEPMAP || {})[3] || 3;
  const dispTotal = window.__FTOTAL || 7;
  const issuesLabel = model || make;

  // Emphasis bias from 03b: which proof leads with a copper ★ "lead" flag.
  const leadCosts  = concern === 'costs'  || !concern;
  const leadIssues = concern === 'issues';

  return (
    <div style={{ position: 'relative', height: '100%', background: FT.bg, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '30%', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 90% 70% at 50% -10%, ${brandC}33 0%, transparent 62%)` }}/>
      </div>
      <FBack onPress={go('04-bike')}/>
      <ObSafeTop style={{ padding: '58px 26px 0', position: 'relative', zIndex: 2 }}>
        <div style={{ height: 44 }}/>
        <FProgress step={dispStep} total={dispTotal}/>
      </ObSafeTop>

      <div style={{ position: 'relative', zIndex: 2, flex: 1, overflow: 'auto', padding: '18px 22px 12px', display: 'flex', flexDirection: 'column' }}>
        <div className="fb2g-rise" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
              padding: '5px 11px', borderRadius: 999, marginBottom: 13,
              background: 'color-mix(in srgb, var(--ac) 18%, transparent)', border: '1px solid color-mix(in srgb, var(--ac) 36%, transparent)' }}>
          <MVIcon name="check" size={12} color={FT.acText} strokeWidth={3}/>
          <span style={{ fontFamily: FT.mono, fontSize: 10, fontWeight: 500, letterSpacing: '0.16em', textTransform: 'uppercase', color: FT.acText }}>Garage unlocked</span>
        </div>

        <div className="fb2g-rise" style={{ animationDelay: '70ms' }}>
          <FTitle size={33} style={{ marginBottom: 14 }}>Here’s your<br/><FAccent>{year} {make} plan.</FAccent></FTitle>
        </div>

        {/* premium bike card — unchanged from A */}
        <div className="fb2g-card" style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', marginBottom: 16,
              border: `1px solid color-mix(in srgb, ${brandC} 34%, transparent)`,
              background: `linear-gradient(165deg, color-mix(in srgb, ${brandC} 18%, #1E1C19) 0%, #1A1815 60%)`,
              boxShadow: `0 18px 44px color-mix(in srgb, ${brandC} 16%, transparent)` }}>
          <div style={{ position: 'relative', height: 104, overflow: 'hidden' }}>
            <div className="fb2g-hero" style={{ position: 'absolute', inset: 0, backgroundImage: `url(${img})`,
                  backgroundSize: 'cover', backgroundPosition: 'center', filter: 'brightness(0.82) saturate(1.04)' }}/>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 30%, #1A1815 98%)' }}/>
            <div style={{ position: 'absolute', top: 13, left: 13, width: 38, height: 38, borderRadius: 11, background: brandC,
                  display: 'grid', placeItems: 'center', fontSize: 19, fontWeight: 800, color: '#fff', boxShadow: `0 6px 18px ${brandC}88` }}>{make[0]}</div>
          </div>
          <div style={{ padding: '2px 18px 16px' }}>
            <div style={{ fontFamily: FT.mono, fontSize: 10, letterSpacing: '0.14em', color: FT.ink3, textTransform: 'uppercase', marginBottom: 4 }}>{year}</div>
            <div style={{ fontFamily: FT.serif, fontSize: 27, color: FT.ink, letterSpacing: '-0.01em', lineHeight: 1 }}>
              {make}{model ? <span style={{ color: FT.acText }}> {model}</span> : ''}
            </div>
          </div>
        </div>

        {/* PROOFS in B order */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 14 }}>
          {/* 1 — COST PROJECTION (lead) */}
          <div className="fb2g-proof" style={{ animationDelay: '240ms', position: 'relative', borderRadius: 18,
                padding: '16px 17px', background: 'color-mix(in srgb, var(--ac) 10%, #1E1C19)',
                border: '1px solid color-mix(in srgb, var(--ac) 34%, transparent)' }}>
            {leadCosts && <LeadFlag/>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, background: 'color-mix(in srgb, var(--ac) 20%, #262320)', display: 'grid', placeItems: 'center' }}>
                <MVIcon name="dollar" size={19} color={FT.acText}/>
              </div>
              <div style={{ fontFamily: FT.mono, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: FT.ink3 }}>Your first year</div>
            </div>
            <div style={{ fontFamily: FT.serif, fontSize: 30, color: FT.ink, letterSpacing: '-0.01em', lineHeight: 1 }}>
              About <span style={{ color: FT.acText }}>€{proj.cost}</span> in scheduled service.
            </div>
            <div style={{ fontSize: 12.5, color: FT.ink2, lineHeight: 1.4, marginTop: 8 }}>That’s {proj.line} — we’ll track every euro so nothing surprises you.</div>
          </div>

          {/* 2 — RECALL CHECK (facts, never AI) */}
          <div className="fb2g-proof" style={{ animationDelay: '330ms', display: 'flex', alignItems: 'flex-start', gap: 13 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, background: `color-mix(in srgb, ${FT.green} 16%, #1E1C19)`, display: 'grid', placeItems: 'center' }}>
              <MVIcon name="shield" size={18} color={FT.green}/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: FT.ink, fontWeight: 600, lineHeight: 1.35 }}>0 open recalls on your {year} {make}{model ? ` ${model}` : ''}.</div>
              <div style={{ fontSize: 12.5, color: FT.ink3, lineHeight: 1.4, marginTop: 3 }}>We’ll alert you the moment that changes. <span style={{ fontFamily: FT.mono, fontSize: 10, letterSpacing: '0.06em' }}>· Source: NHTSA</span></div>
            </div>
          </div>

          {/* 3 — KNOWN ISSUES (AI, hedged) — hidden gracefully if unavailable */}
          {issues && (
            <div className="fb2g-proof" style={{ animationDelay: '420ms', position: 'relative', borderRadius: 18, padding: '15px 16px',
                  background: FT.card, border: `1px solid ${FT.line}` }}>
              {leadIssues && <LeadFlag/>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 11 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: `color-mix(in srgb, ${FT.amber} 16%, #262320)`, display: 'grid', placeItems: 'center' }}>
                  <MVIcon name="lightbulb" size={17} color={FT.amber}/>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: FT.ink, letterSpacing: '-0.01em' }}>3 things {issuesLabel} owners watch for</div>
                  <div style={{ fontFamily: FT.mono, fontSize: 8.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: FT.ink4, marginTop: 2 }}>Community insight · indicative</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {issues.map((it, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                    <span style={{ width: 5, height: 5, borderRadius: 3, background: FT.amber, marginTop: 7, flexShrink: 0 }}/>
                    <span style={{ fontSize: 12.5, color: FT.ink2, lineHeight: 1.4 }}>{it}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4 — COMMUNITY */}
          <div className="fb2g-proof" style={{ animationDelay: '510ms', display: 'flex', alignItems: 'center', gap: 13 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, background: `color-mix(in srgb, ${FT.blue} 16%, #1E1C19)`, display: 'grid', placeItems: 'center' }}>
              <MVIcon name="user" size={18} color={FT.blue}/>
            </div>
            <div style={{ fontSize: 13.5, color: FT.ink2, lineHeight: 1.4 }}>You’re 1 of <b style={{ color: FT.ink }}>{near} {make}</b> riders on MotoVault.</div>
          </div>
        </div>

        <div style={{ fontSize: 12.5, color: FT.ink3, fontStyle: 'italic', lineHeight: 1.45, marginBottom: 14 }}>
          Every service you log builds a history worth real money.
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 2 }}>
          <FButton label="Continue" onPress={go('06-goals')}/>
        </div>
      </div>
      <style>{`
        @keyframes fb2gRise  { from { opacity:0; transform: translateY(14px); } to { opacity:1; transform:none; } }
        @keyframes fb2gCard  { from { opacity:0; transform: translateY(18px) scale(.98); } to { opacity:1; transform:none; } }
        @keyframes fb2gProof { from { opacity:0; transform: translateY(12px); } to { opacity:1; transform:none; } }
        @keyframes fb2gHero  { from { transform: scale(1.1); } to { transform: scale(1); } }
        .fb2g-rise  { animation: fb2gRise .5s cubic-bezier(.2,.7,.2,1) both; }
        .fb2g-card  { animation: fb2gCard .55s cubic-bezier(.2,.7,.2,1) .15s both; }
        .fb2g-proof { animation: fb2gProof .5s cubic-bezier(.2,.7,.2,1) both; }
        .fb2g-hero  { animation: fb2gHero 1.6s cubic-bezier(.2,.7,.2,1) both; }
      `}</style>
    </div>
  );
};
const LeadFlag = () => (
  <div style={{ position: 'absolute', top: 13, right: 14, display: 'inline-flex', alignItems: 'center', gap: 4,
        fontFamily: FT.mono, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: FT.acText }}>
    <MVIcon name="star-fill" size={10} color={FT.acText}/>Lead
  </div>
);

// ── 08 — COMMITMENT (B) — signature pledge (more effortful than A's hold) ─────
// SAME screen / headline / bike framing as A. Only the affirmation control changes
// from a press-and-hold to a drawn signature (effort justification → stronger commit).
const F08CommitmentB = ({ go, state }) => {
  const make = state.bikeMake || 'BMW';
  const model = state.bikeModel;
  const year = state.bikeYear || (new Date().getFullYear() - 3);
  const brandC = makeColor(make);
  const img = bikeImg(make);
  const bikeName = `${year} ${make}${model ? ` ${model}` : ''}`;

  const canvasRef = React.useRef(null);
  const drawing = React.useRef(false);
  const lenRef = React.useRef(0);
  const lastPt = React.useRef(null);
  const [hasInk, setHasInk] = React.useState(false);
  const [sealed, setSealed] = React.useState(false);

  const ctxOf = () => {
    const cv = canvasRef.current; if (!cv) return null;
    const ctx = cv.getContext('2d');
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--ac').trim() || '#D4622E';
    ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    return ctx;
  };
  const pos = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e) => {
    if (sealed) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
    drawing.current = true; lastPt.current = pos(e);
  };
  const move = (e) => {
    if (!drawing.current || sealed) return;
    const ctx = ctxOf(); if (!ctx) return;
    const p = pos(e), l = lastPt.current;
    ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    lenRef.current += Math.hypot(p.x - l.x, p.y - l.y);
    lastPt.current = p;
    if (!hasInk) setHasInk(true);
  };
  const up = () => { drawing.current = false; };
  const clear = () => {
    const cv = canvasRef.current; if (cv) cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
    lenRef.current = 0; setHasInk(false); setSealed(false);
  };
  const seal = () => {
    if (lenRef.current < 120) return; // require a real signature
    setSealed(true);
    if (navigator.vibrate) { try { navigator.vibrate(28); } catch (_) {} }
    setTimeout(() => go('09-paywall')(), 1050);
  };

  // size the canvas to its box once mounted
  React.useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const r = cv.getBoundingClientRect();
    cv.width = r.width; cv.height = r.height;
  }, []);

  return (
    <div style={{ position: 'relative', height: '100%', background: FT.bg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: '-20% -20% auto -20%', height: '52%',
            background: `radial-gradient(ellipse 60% 80% at 50% 22%, ${brandC}33 0%, transparent 70%)`, filter: 'blur(30px)', pointerEvents: 'none' }}/>
      <FGrain/>
      <FHeader step={6} onBack={go('07-maintenance')} eyebrow="Make it official"/>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 28px', textAlign: 'center' }}>
        <div className="fb2c-rise" style={{ position: 'relative', width: 108, height: 108, marginBottom: 22 }}>
          <div style={{ position: 'absolute', inset: -10, borderRadius: '50%', background: `radial-gradient(circle, ${brandC}55, transparent 70%)`, filter: 'blur(10px)' }}/>
          <div style={{ position: 'relative', width: 108, height: 108, borderRadius: '50%', overflow: 'hidden',
                border: `2px solid color-mix(in srgb, ${brandC} 55%, transparent)`, boxShadow: `0 14px 38px ${brandC}55` }}>
            <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${img})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'brightness(.92) saturate(1.04)' }}/>
            <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, transparent 42%, ${FT.bg}d0)` }}/>
          </div>
          <div style={{ position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)', width: 32, height: 32,
                borderRadius: 10, background: brandC, display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 800, color: '#fff', boxShadow: `0 6px 16px ${brandC}99` }}>{make[0]}</div>
        </div>

        <div className="fb2c-rise" style={{ animationDelay: '90ms' }}>
          <FTitle size={29} style={{ textAlign: 'center' }}>I’m ready to take care<br/>of my <FAccent>{bikeName}</FAccent>.</FTitle>
        </div>
        <div className="fb2c-rise" style={{ animationDelay: '160ms', fontSize: 13.5, color: FT.ink2, lineHeight: 1.5, maxWidth: 320, marginTop: 12 }}>
          Sign your name to make the pledge — riders who do are far more likely to keep their bike in top shape.
        </div>
      </div>

      <div style={{ padding: '6px 24px 28px' }}>
        {/* signature pad */}
        <div style={{ position: 'relative', height: 132, borderRadius: 18, overflow: 'hidden',
              background: FT.card, border: `1px solid ${sealed ? 'color-mix(in srgb, var(--ac) 50%, transparent)' : FT.line}`,
              boxShadow: sealed ? '0 12px 30px color-mix(in srgb, var(--ac) 22%, transparent)' : 'none', transition: 'box-shadow .25s, border-color .25s' }}>
          <canvas ref={canvasRef} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} onPointerCancel={up}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none', cursor: 'crosshair' }}/>
          {/* signature baseline + hint */}
          <div style={{ position: 'absolute', left: 22, right: 22, bottom: 34, height: 1, background: FT.line }}/>
          <div style={{ position: 'absolute', left: 22, bottom: 14, fontFamily: FT.mono, fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: FT.ink4 }}>✕ Sign here</div>
          {!hasInk && !sealed && (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
              <span style={{ fontFamily: FT.serif, fontStyle: 'italic', fontSize: 22, color: FT.ink4 }}>Sign your name</span>
            </div>
          )}
          {hasInk && !sealed && (
            <div onClick={clear} style={{ position: 'absolute', top: 10, right: 12, fontFamily: FT.mono, fontSize: 9.5,
                  letterSpacing: '0.12em', textTransform: 'uppercase', color: FT.ink3, cursor: 'pointer',
                  background: 'rgba(0,0,0,0.25)', padding: '5px 9px', borderRadius: 8 }}>Clear</div>
          )}
          {sealed && (
            <div className="fb2c-seal" style={{ position: 'absolute', inset: 0, background: 'color-mix(in srgb, var(--ac) 14%, rgba(20,18,16,0.7))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
              <MVIcon name="check" size={20} color={FT.acText} strokeWidth={2.6}/>
              <span style={{ fontSize: 15.5, fontWeight: 700, color: FT.ink }}>Pledge sealed</span>
            </div>
          )}
        </div>

        <div style={{ marginTop: 14 }}>
          <FButton label={sealed ? 'You’re in' : 'Seal my pledge'} icon={sealed ? 'check' : 'arrow-right'}
            onPress={seal} disabled={!hasInk || sealed}/>
        </div>
        <div style={{ textAlign: 'center', marginTop: 10, fontFamily: FT.mono, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: sealed ? FT.acText : FT.ink4 }}>
          {sealed ? 'Pledged · day one' : 'Draw your signature above'}
        </div>
        {!sealed && <FSkip label="Not now" onPress={go('09-paywall')} style={{ marginTop: 8 }}/>}
      </div>
      <style>{`
        @keyframes fb2cRise { from { opacity:0; transform: translateY(14px); } to { opacity:1; transform:none; } }
        @keyframes fb2cSeal { from { opacity:0; } to { opacity:1; } }
        .fb2c-rise { animation: fb2cRise .5s cubic-bezier(.2,.7,.2,1) both; }
        .fb2c-seal { animation: fb2cSeal .25s ease both; }
      `}</style>
    </div>
  );
};

Object.assign(window, {
  F03aFrequency, F03bConcerns, F03cService, F04LBuilding, F05RevealB, F08CommitmentB,
  F_FREQUENCY, F_CONCERNS, F_LAST_SERVICE, F_PROJECTION, F_KNOWN_ISSUES, projection, knownIssues, LeadFlag,
});
