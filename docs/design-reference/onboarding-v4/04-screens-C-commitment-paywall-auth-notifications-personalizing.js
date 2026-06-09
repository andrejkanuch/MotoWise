// =============================================================================
// MotoVault — Onboarding flow — SCREENS C
// 08 Commitment (NEW) · 09 Paywall (spec) · 10 Auth · 11 Notifications · 12 Personalizing
// =============================================================================

// ── 08 — COMMITMENT (NEW) — one-tap pledge tied to the user's bike ───────────
const F08Commitment = ({ go, state }) => {
  const make = state.bikeMake || 'BMW';
  const model = state.bikeModel;
  const year = state.bikeYear || (new Date().getFullYear() - 3);
  const brandC = makeColor(make);
  const img = bikeImg(make);
  const bikeName = `${year} ${make}${model ? ` ${model}` : ''}`;

  const [progress, setProgress] = React.useState(0);
  const [holding, setHolding] = React.useState(false);
  const [sealed, setSealed] = React.useState(false);
  const raf = React.useRef(0);
  const t0 = React.useRef(0);
  const HOLD = 850;

  const finish = () => {
    cancelAnimationFrame(raf.current);
    setSealed(true); setHolding(false); setProgress(1);
    if (navigator.vibrate) { try { navigator.vibrate(28); } catch (_) {} }
    setTimeout(() => go('09-paywall')(), 1000);
  };
  const start = () => {
    if (sealed) return;
    setHolding(true); t0.current = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0.current) / HOLD);
      setProgress(p);
      if (p >= 1) return finish();
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };
  const cancel = () => {
    if (sealed) return;
    cancelAnimationFrame(raf.current);
    setHolding(false); setProgress(0);
  };
  React.useEffect(() => () => cancelAnimationFrame(raf.current), []);

  return (
    <div style={{ position: 'relative', height: '100%', background: FT.bg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: '-20% -20% auto -20%', height: '55%',
            background: `radial-gradient(ellipse 60% 80% at 50% 22%, ${brandC}33 0%, transparent 70%)`,
            filter: 'blur(30px)', pointerEvents: 'none' }}/>
      <FGrain/>
      <FHeader step={6} onBack={go('07-maintenance')} eyebrow="Make it official"/>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '0 28px', textAlign: 'center' }}>
        {/* the user's bike, subtly centered */}
        <div className="fc-rise" style={{ position: 'relative', width: 128, height: 128, marginBottom: 28 }}>
          <div style={{ position: 'absolute', inset: -10, borderRadius: '50%',
                background: `radial-gradient(circle, ${brandC}55, transparent 70%)`, filter: 'blur(10px)' }}/>
          <div style={{ position: 'relative', width: 128, height: 128, borderRadius: '50%', overflow: 'hidden',
                border: `2px solid color-mix(in srgb, ${brandC} 55%, transparent)`, boxShadow: `0 14px 38px ${brandC}55` }}>
            <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${img})`,
                  backgroundSize: 'cover', backgroundPosition: 'center', filter: 'brightness(.92) saturate(1.04)' }}/>
            <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, transparent 42%, ${FT.bg}d0)` }}/>
          </div>
          <div style={{ position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)', width: 34, height: 34,
                borderRadius: 11, background: brandC, display: 'grid', placeItems: 'center', fontSize: 16, fontWeight: 800,
                color: '#fff', boxShadow: `0 6px 16px ${brandC}99` }}>{make[0]}</div>
        </div>

        <div className="fc-rise" style={{ animationDelay: '90ms' }}>
          <FTitle size={31} style={{ textAlign: 'center' }}>I'm ready to take care<br/>of my <FAccent>{bikeName}</FAccent>.</FTitle>
        </div>
        <div className="fc-rise" style={{ animationDelay: '170ms', fontSize: 14, color: FT.ink2, lineHeight: 1.5, maxWidth: 330, marginTop: 13 }}>
          Riders who commit here are far more likely to keep their bike in top shape.
        </div>
      </div>

      <div style={{ padding: '12px 24px 30px' }}>
        {/* press-and-hold pledge */}
        <div onPointerDown={start} onPointerUp={cancel} onPointerLeave={cancel} onPointerCancel={cancel}
             style={{ position: 'relative', height: 58, borderRadius: 16, overflow: 'hidden', cursor: 'pointer', userSelect: 'none',
               background: FT.card, border: `1px solid ${sealed ? 'transparent' : 'color-mix(in srgb, var(--ac) 42%, transparent)'}`,
               WebkitTapHighlightColor: 'transparent',
               boxShadow: (sealed || progress > 0) ? '0 10px 30px color-mix(in srgb, var(--ac) 26%, transparent)' : 'none',
               transition: 'box-shadow .2s ease' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${progress * 100}%`, background: 'var(--ac)',
                transition: holding ? 'none' : 'width .3s cubic-bezier(.2,.7,.2,1)' }}/>
          <div style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', color: progress > 0.45 ? FT.darkInk : FT.ink, transition: 'color .15s' }}>
            {sealed ? <>I'm in <MVIcon name="check" size={19} color={FT.darkInk} strokeWidth={2.6}/></>
                    : holding ? 'Keep holding…' : "Press & hold — I'm in"}
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: 11, fontFamily: FT.mono, fontSize: 10, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: sealed ? FT.acText : FT.ink4 }}>
          {sealed ? 'Pledged · day one' : 'Hold the button to commit'}
        </div>
        {!sealed && <FSkip label="Not now" onPress={go('09-paywall')} style={{ marginTop: 8 }}/>}
      </div>
      <style>{`
        @keyframes fcRise { from { opacity:0; transform: translateY(14px); } to { opacity:1; transform:none; } }
        .fc-rise { animation: fcRise .5s cubic-bezier(.2,.7,.2,1) both; }
      `}</style>
    </div>
  );
};

// ── 09 — PAYWALL (placeholder / spec — rendered natively by RevenueCat) ──────
const F09Paywall = ({ go }) => (
  <div style={{ position: 'relative', height: '100%', background: FT.bg2, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', inset: '-20% -20% auto -20%', height: '50%',
          background: 'radial-gradient(ellipse 70% 80% at 50% 12%, color-mix(in srgb, var(--ac) 22%, transparent) 0%, transparent 70%)',
          filter: 'blur(30px)', pointerEvents: 'none' }}/>
    <FGrain/>
    {/* RevenueCat-rendered banner */}
    <div style={{ position: 'absolute', top: 56, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 5 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 999,
            background: 'rgba(244,239,233,0.06)', border: `1px dashed ${FT.ink4}` }}>
        <div style={{ width: 6, height: 6, borderRadius: 3, background: FT.amber }}/>
        <span style={{ fontFamily: FT.mono, fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: FT.ink3 }}>Rendered natively · RevenueCat</span>
      </div>
    </div>

    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 26px' }}>
      <FEyebrow style={{ marginBottom: 14 }}>MotoVault Pro</FEyebrow>
      <FTitle size={38} style={{ marginBottom: 10 }}>Everything, <FAccent>unlimited.</FAccent></FTitle>
      <div style={{ fontSize: 14, color: FT.ink2, lineHeight: 1.45, maxWidth: 320, marginBottom: 22 }}>
        Multi-bike garage, full cost analytics, recall alerts, route planning and diagnostics.
      </div>

      {/* plan spec rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        <div style={{ padding: '16px 18px', borderRadius: 16, background: 'color-mix(in srgb, var(--ac) 10%, #1E1C19)',
              border: '1px solid color-mix(in srgb, var(--ac) 36%, transparent)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: FT.ink }}>Annual · 7-day free trial</div>
            <div style={{ fontSize: 12, color: FT.ink3, marginTop: 2 }}>$39.99 / yr — best value</div>
          </div>
          <div style={{ fontFamily: FT.mono, fontSize: 10, letterSpacing: '0.12em', color: FT.acText, textTransform: 'uppercase' }}>Save 33%</div>
        </div>
        <div style={{ padding: '16px 18px', borderRadius: 16, background: FT.card, border: `1px solid ${FT.line}`, display: 'flex', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: FT.ink }}>Monthly</div>
            <div style={{ fontSize: 12, color: FT.ink3, marginTop: 2 }}>$4.99 / mo</div>
          </div>
        </div>
      </div>

      {/* implementation spec note */}
      <div style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(244,239,233,0.03)', border: `1px dashed ${FT.line}`,
            fontFamily: FT.mono, fontSize: 11, lineHeight: 1.7, color: FT.ink3 }}>
        <div style={{ color: FT.amber, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: 9.5, marginBottom: 6 }}>Spec for engineering</div>
        offering: <b style={{ color: FT.ink2 }}>onboarding_default</b><br/>
        packages: <b style={{ color: FT.ink2 }}>$rc_annual, $rc_monthly</b><br/>
        trial: <b style={{ color: FT.ink2 }}>P7D (annual only)</b><br/>
        entitlement: <b style={{ color: FT.ink2 }}>pro</b> · paywall: <b style={{ color: FT.ink2 }}>Editorial Half-Cover</b>
      </div>
    </div>

    <div style={{ padding: '12px 20px 30px' }}>
      <FButton label="Start free trial" onPress={go('10-auth')}/>
      <FSkip label="Maybe later" onPress={go('10-auth')}/>
    </div>
  </div>
);

// ── 10 — AUTH (moved later — after first value) ──────────────────────────────
const AppleGlyph = ({ c = '#fff' }) => (
  <svg width="17" height="20" viewBox="0 0 17 20" fill={c}><path d="M14.1 10.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9s-1.8-.8-3-.8C4.7 5.4 3.3 6.3 2.5 7.7 1 10.4 2.1 14.5 3.6 16.7c.7 1.1 1.6 2.3 2.7 2.3s1.5-.7 2.8-.7 1.7.7 2.8.7 1.9-1.1 2.6-2.1c.8-1.2 1.2-2.4 1.2-2.4s-2.3-.9-2.4-3.5zM11.9 3.9c.6-.8 1-1.8.9-2.9-.9 0-2 .6-2.6 1.3-.6.7-1.1 1.7-.9 2.7 1 .1 2-.5 2.6-1.1z"/></svg>
);
const GoogleGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.8H9v3.4h4.8c-.2 1.1-.8 2-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5z"/><path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.5-1.8.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3C2.4 15.9 5.5 18 9 18z"/><path fill="#FBBC05" d="M3.9 10.7c-.2-.5-.3-1.1-.3-1.7s.1-1.2.3-1.7V5H.9C.3 6.2 0 7.5 0 9s.3 2.8.9 4l3-2.3z"/><path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6C13.5.9 11.4 0 9 0 5.5 0 2.4 2.1.9 5l3 2.3C4.6 5.1 6.6 3.6 9 3.6z"/></svg>
);

const F10Auth = ({ go, startEmail, startErr }) => {
  const [emailMode, setEmailMode] = React.useState(!!startEmail);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(!!startErr);
  const proceed = () => { setBusy(true); setTimeout(() => go('11-notifications')(), 950); };
  return (
  <div style={{ position: 'relative', height: '100%', background: FT.bg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', inset: '-20% -20% auto -20%', height: '46%',
          background: 'radial-gradient(ellipse 60% 80% at 50% 14%, color-mix(in srgb, var(--ac) 20%, transparent) 0%, transparent 70%)',
          filter: 'blur(28px)', pointerEvents: 'none' }}/>
    <FGrain/>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 26px' }}>
      {/* you're Pro — this is save & sync, not a gate */}
      <div style={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 999, marginBottom: 20,
            background: 'color-mix(in srgb, var(--ac) 16%, transparent)', border: '1px solid color-mix(in srgb, var(--ac) 38%, transparent)' }}>
        <MVIcon name="check" size={13} color={FT.acText} strokeWidth={3}/>
        <span style={{ fontFamily: FT.mono, fontSize: 10, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: FT.acText }}>You're Pro</span>
      </div>
      <FTitle size={34} style={{ marginBottom: 10 }}>Secure your<br/><FAccent>subscription.</FAccent></FTitle>
      <div style={{ fontSize: 14.5, color: FT.ink2, lineHeight: 1.45, maxWidth: 330, marginBottom: 24 }}>
        Create an account to keep your subscription and sync your bike across devices.
      </div>

      {!emailMode ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          <button onClick={proceed} style={authBtn('#fff', '#000')}>
            <AppleGlyph c="#000"/> Continue with Apple
          </button>
          <button onClick={proceed} style={authBtn(FT.card, FT.ink, FT.line)}>
            <GoogleGlyph/> Continue with Google
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '3px 0' }}>
            <div style={{ flex: 1, height: 1, background: FT.line }}/>
            <span style={{ fontFamily: FT.mono, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: FT.ink4 }}>or use email</span>
            <div style={{ flex: 1, height: 1, background: FT.line }}/>
          </div>
          <button onClick={() => setEmailMode(true)} style={authBtn('transparent', FT.ink2, FT.line)}>
            <MVIcon name="send" size={16} color={FT.ink2}/> Continue with email
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input placeholder="Email" defaultValue={startErr ? 'alex@rider.cc' : ''} style={authInput}/>
          <input placeholder="Password" type="password" style={authInput}/>
          {err && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: FT.danger, lineHeight: 1.4 }}>
              <MVIcon name="close" size={14} color={FT.danger} strokeWidth={2.5}/>
              <span>That email already has an account. <span onClick={go('s1-signin')} style={{ color: FT.acText, fontWeight: 600, cursor: 'pointer' }}>Sign in instead</span></span>
            </div>
          )}
          <FButton label="Create account" onPress={proceed}/>
          <div onClick={() => { setEmailMode(false); setErr(false); }} style={{ textAlign: 'center', fontSize: 12.5, color: FT.ink3, cursor: 'pointer', marginTop: 2 }}>← Other options</div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 22, justifyContent: 'center', fontSize: 12.5, color: FT.ink3 }}>
        <MVIcon name="shield" size={14} color={FT.green}/> Your subscription stays active either way.
      </div>
    </div>
    <div style={{ padding: '8px 26px 30px' }}>
      <FSkip label="Not now" onPress={go('11-notifications')}/>
    </div>

    {busy && (
      <div style={{ position: 'absolute', inset: 0, background: `${FT.bg}e6`, display: 'grid', placeItems: 'center', zIndex: 30 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div className="auth-spin" style={{ width: 42, height: 42, borderRadius: 21, border: `3px solid ${FT.line}`, borderTopColor: 'var(--ac)' }}/>
          <div style={{ fontSize: 13.5, color: FT.ink2 }}>Creating your account…</div>
        </div>
      </div>
    )}
    <style>{`@keyframes authSpin { to { transform: rotate(360deg); } } .auth-spin { animation: authSpin .8s linear infinite; }`}</style>
  </div>
  );
};
const authInput = { width: '100%', background: FT.card, border: `1px solid ${FT.line}`, borderRadius: 14,
  padding: '15px 16px', color: FT.ink, fontFamily: 'inherit', fontSize: 15, outline: 'none' };
const authBtn = (bg, fg, border) => ({ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
  width: '100%', padding: '15px 18px', borderRadius: 15, background: bg, color: fg,
  border: `1px solid ${border || 'transparent'}`, fontFamily: 'inherit', fontSize: 15.5, fontWeight: 600,
  letterSpacing: '-0.01em', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' });

// ── 11 — NOTIFICATIONS ───────────────────────────────────────────────────────
const F11Notifications = ({ go }) => {
  const items = [
    { i: 'wrench',   t: 'Maintenance reminders', s: "A heads-up before service is overdue", c: 'var(--ac)' },
    { i: 'gauge',    t: 'Weekly ride stats',     s: 'Your miles, time and trends every week', c: FT.blue },
    { i: 'location', t: 'New routes nearby',     s: 'Great roads discovered in your area',    c: FT.teal },
  ];
  return (
    <div style={{ position: 'relative', height: '100%', background: FT.bg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <FHeader step={7} onBack={go('10-auth')} eyebrow="Stay ahead"/>

      {/* notification-card illustration in a soft copper glow */}
      <div style={{ display: 'grid', placeItems: 'center', padding: '16px 26px 0', position: 'relative' }}>
        <div style={{ position: 'absolute', top: -4, width: 260, height: 130,
              background: 'radial-gradient(ellipse, color-mix(in srgb, var(--ac) 30%, transparent), transparent 70%)', filter: 'blur(22px)' }}/>
        <div className="fn-card" style={{ position: 'relative', width: '100%', maxWidth: 300, padding: '13px 14px', borderRadius: 18,
              background: 'rgba(40,37,33,0.92)', border: `1px solid ${FT.line}`, display: 'flex', alignItems: 'center', gap: 11,
              boxShadow: '0 18px 44px rgba(0,0,0,0.45)' }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, overflow: 'hidden', background: 'var(--ac)', flexShrink: 0 }}>
            <img src={__res('logo', 'assets/logo.png')} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: FT.ink }}>MotoVault</span>
              <span style={{ fontFamily: FT.mono, fontSize: 9.5, color: FT.ink4 }}>now</span>
            </div>
            <div style={{ fontSize: 12.5, color: FT.ink2, lineHeight: 1.35, marginTop: 2 }}>Oil change due in 200 km — book it this week.</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 26px 0' }}>
        <FTitle size={30}>Stay on top of your<br/>bike's <FAccent>health.</FAccent></FTitle>
        <div style={{ fontSize: 14, color: FT.ink2, lineHeight: 1.45, maxWidth: 320, marginTop: 8 }}>
          Get a weekly summary of your rides and a heads-up before service is due.
        </div>
      </div>

      <div style={{ flex: 1, padding: '20px 26px 12px', display: 'flex', flexDirection: 'column', gap: 18, justifyContent: 'center' }}>
        {items.map((it, i) => (
          <div key={it.t} className="fn-in" style={{ animationDelay: `${160 + i * 80}ms`, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: `color-mix(in srgb, ${it.c} 16%, #1E1C19)`,
                  display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <MVIcon name={it.i} size={19} color={it.c}/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: FT.ink, letterSpacing: '-0.01em' }}>{it.t}</div>
              <div style={{ fontSize: 12.5, color: FT.ink3, lineHeight: 1.35 }}>{it.s}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '12px 20px 30px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <FButton label="Enable Notifications" icon="bell" onPress={go('12-personalizing')}/>
        <button onClick={go('12-personalizing')} style={{ width: '100%', padding: '15px', borderRadius: 15, background: 'transparent',
              border: `1px solid ${FT.line}`, color: FT.ink2, fontFamily: 'inherit', fontSize: 15, fontWeight: 600,
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
          Maybe later
        </button>
      </div>
      <style>{`
        @keyframes fnIn { from { opacity:0; transform: translateY(12px); } to { opacity:1; transform:none; } }
        @keyframes fnCard { from { opacity:0; transform: translateY(-12px); } to { opacity:1; transform:none; } }
        .fn-in { animation: fnIn .46s cubic-bezier(.2,.7,.2,1) both; }
        .fn-card { animation: fnCard .5s cubic-bezier(.2,.7,.2,1) both; }
      `}</style>
    </div>
  );
};

// ── 12 — PERSONALIZING (loader → Home) ───────────────────────────────────────
const F12Personalizing = ({ go, state, startDone }) => {
  const make = state.bikeMake;
  const year = state.bikeYear;
  const model = state.bikeModel;
  const bikeLabel = make ? `${year} ${make}${model ? ` ${model}` : ''}` : 'your ride';
  const goalWord = { track_rides: 'rides', manage_expenses: 'expenses', discover_routes: 'routes',
    maintain_bike: 'maintenance', just_exploring: 'explorer' }[state.primaryGoal] || 'personal';
  const steps = ['Finding routes near you', 'Setting up your garage', 'Configuring your dashboard', `Your ${goalWord} dashboard is ready`];
  const [step, setStep] = React.useState(startDone ? steps.length : 0);
  const [done, setDone] = React.useState(!!startDone);

  React.useEffect(() => {
    if (startDone) return;
    const ts = [];
    steps.forEach((_, i) => ts.push(setTimeout(() => setStep(i + 1), (i + 1) * 560)));
    ts.push(setTimeout(() => setDone(true), steps.length * 560 + 320));
    return () => ts.forEach(clearTimeout);
  }, []);

  return (
    <div style={{ position: 'relative', height: '100%', background: FT.bg2, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', padding: '60px 28px', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: '-25% -25% auto -25%', height: '60%',
            background: 'radial-gradient(ellipse 60% 70% at 50% 40%, color-mix(in srgb, var(--ac) 18%, transparent) 0%, transparent 70%)',
            filter: 'blur(30px)', pointerEvents: 'none' }}/>
      <FGrain/>

      {!done ? (
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <div style={{ position: 'relative', width: 120, height: 120, marginBottom: 30, display: 'grid', placeItems: 'center' }}>
            <div className="fp-ring" style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid var(--ac)' }}/>
            <div className="fp-ring fp-ring2" style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1.5px solid color-mix(in srgb, var(--ac) 55%, transparent)' }}/>
            <div style={{ width: 62, height: 62, borderRadius: 20, background: 'color-mix(in srgb, var(--ac) 18%, #1E1C19)',
                  border: '1px solid color-mix(in srgb, var(--ac) 34%, transparent)', display: 'grid', placeItems: 'center' }}>
              <MVIcon name="sparkle" size={30} color={FT.acText}/>
            </div>
          </div>
          <FTitle size={30} style={{ textAlign: 'center', marginBottom: 8 }}>Setting up<br/><FAccent>your ride.</FAccent></FTitle>
          <div style={{ fontSize: 13, color: FT.ink3, textAlign: 'center', marginBottom: 30 }}>Tailoring MotoVault to <b style={{ color: FT.ink2 }}>{bikeLabel}</b></div>
          <div style={{ width: '100%', maxWidth: 290, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {steps.map((s, i) => {
              const sd = i < step, sa = i === step;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: sd || sa ? 1 : 0.32, transition: 'opacity .3s' }}>
                  <div style={{ width: 22, height: 22, borderRadius: 11, flexShrink: 0,
                        background: sd ? FT.green : 'transparent', border: sa ? '2px solid var(--ac)' : sd ? 'none' : `1px solid ${FT.line}`,
                        display: 'grid', placeItems: 'center', transition: 'background .3s ease' }}>
                    {sd && <MVIcon name="check" size={13} color="#0E1A10" strokeWidth={3}/>}
                    {sa && <div style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--ac)', animation: 'fpPulse 1s ease-in-out infinite' }}/>}
                  </div>
                  <div style={{ fontSize: 14, color: sd ? FT.ink2 : sa ? FT.ink : FT.ink3 }}>{s}</div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="fp-done" style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <div className="fp-pop" style={{ width: 84, height: 84, borderRadius: 26, background: 'var(--ac)', display: 'grid', placeItems: 'center',
                marginBottom: 24, boxShadow: '0 14px 40px color-mix(in srgb, var(--ac) 40%, transparent)' }}>
            <MVIcon name="check" size={40} color={FT.darkInk} strokeWidth={3}/>
          </div>
          <FEyebrow style={{ marginBottom: 14 }}>Garage ready</FEyebrow>
          <FTitle size={38} style={{ textAlign: 'center', marginBottom: 10 }}>Welcome home,<br/><FAccent>rider.</FAccent></FTitle>
          <div style={{ fontSize: 14, color: FT.ink2, lineHeight: 1.45, textAlign: 'center', maxWidth: 300, marginBottom: 30 }}>
            Your <b style={{ color: FT.ink }}>{bikeLabel}</b> is set up with a few things already waiting for you.
          </div>
          <div style={{ width: '100%', maxWidth: 320 }}>
            <FButton label="Open my garage" onPress={go('01-splash')}/>
          </div>
        </div>
      )}
      <style>{`
        @keyframes fpSpin { to { transform: rotate(360deg); } }
        @keyframes fpPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.4); } }
        @keyframes fpRing { 0% { transform: scale(.82); opacity:.85; } 70% { opacity:0; } 100% { transform: scale(1.28); opacity:0; } }
        .fp-ring { animation: fpRing 1.8s ease-out infinite; }
        .fp-ring2 { animation-delay: .6s; }
        @keyframes fpPop { 0% { opacity:0; transform: scale(.5); } 60% { transform: scale(1.1); } 100% { opacity:1; transform: scale(1); } }
        @keyframes fpDone { from { opacity:0; transform: translateY(10px); } to { opacity:1; transform:none; } }
        .fp-done { animation: fpDone .5s ease both; }
        .fp-pop  { animation: fpPop .5s cubic-bezier(.2,.7,.2,1) both; }
      `}</style>
    </div>
  );
};

Object.assign(window, { F08Commitment, F09Paywall, F10Auth, F11Notifications, F12Personalizing,
  AppleGlyph, GoogleGlyph, authBtn, authInput });
