// =============================================================================
// MotoVault — Onboarding flow — SCREENS A
// 01 Splash · 02 Welcome · 03 Experience · 04 Bike (the hero unlock)
// =============================================================================

// ── 01 — SPLASH ──────────────────────────────────────────────────────────────
const F01Splash = ({ go }) => {
  React.useEffect(() => {
    const id = setTimeout(() => go('02-welcome')(), 2400);
    return () => clearTimeout(id);
  }, []);
  return (
    <div style={{ position: 'relative', height: '100%', background: FT.bg2,
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', inset: '-30% -30% auto -30%', height: '70%',
        background: 'radial-gradient(ellipse 60% 70% at 50% 40%, color-mix(in srgb, var(--ac) 22%, transparent) 0%, transparent 70%)',
        filter: 'blur(30px)', pointerEvents: 'none',
      }}/>
      <FGrain/>
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className="fsplash-ring" style={{ position: 'relative', width: 120, height: 120, marginBottom: 30 }}>
          <svg viewBox="0 0 120 120" width="120" height="120" style={{ position: 'absolute', inset: 0 }}>
            <circle cx="60" cy="60" r="56" fill="none" stroke={FT.line} strokeWidth="1.5"/>
            <circle className="fsplash-arc" cx="60" cy="60" r="56" fill="none"
                    stroke="var(--ac)" strokeWidth="2.5" strokeLinecap="round"
                    strokeDasharray="352" strokeDashoffset="352"
                    transform="rotate(-90 60 60)"/>
          </svg>
          <div className="fsplash-mark" style={{
            position: 'absolute', inset: 18, borderRadius: 26, overflow: 'hidden',
            background: 'var(--ac)', display: 'grid', placeItems: 'center',
            boxShadow: '0 12px 40px color-mix(in srgb, var(--ac) 40%, transparent)',
          }}>
            <img src={__res('logo', 'assets/logo.png')} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
          </div>
        </div>
        <div className="fsplash-word" style={{ fontWeight: 700, fontSize: 22, letterSpacing: '-0.02em',
                      color: FT.ink, marginBottom: 14 }}>MotoVault</div>
        <FTitle size={26} style={{ textAlign: 'center' }}>
          Every bike has<br/>a <FAccent>story.</FAccent>
        </FTitle>
      </div>
      <style>{`
        @keyframes fsArc  { to { stroke-dashoffset: 0; } }
        @keyframes fsPop  { 0% { opacity:0; transform: scale(0.7); } 60% { transform: scale(1.06); } 100% { opacity:1; transform: scale(1); } }
        @keyframes fsRise { from { opacity:0; transform: translateY(10px); } to { opacity:1; transform:none; } }
        .fsplash-arc  { animation: fsArc 1.2s cubic-bezier(.4,0,.2,1) .15s both; }
        .fsplash-mark { animation: fsPop .6s cubic-bezier(.2,.7,.2,1) .1s both; }
        .fsplash-word { animation: fsRise .5s ease .5s both; }
        .fsplash-ring + .fsplash-word + * { animation: fsRise .5s ease .7s both; }
      `}</style>
    </div>
  );
};

// ── 02 — WELCOME (hero) ────────────────────────────────────────────────────────
const F_WELCOME_HEADS = {
  'Your rides. Your bike. Your journey.': <>Your rides.<br/>Your bike.<br/><FAccent>Your journey.</FAccent></>,
  'Every ride, remembered.':              <>Every ride,<br/><FAccent>remembered.</FAccent></>,
  'The garage in your pocket.':           <>The garage in<br/>your <FAccent>pocket.</FAccent></>,
};
const F02Welcome = ({ go }) => {
  const headKey = fcfg('welcomeHeadline', 'Your rides. Your bike. Your journey.');
  const head = F_WELCOME_HEADS[headKey] || F_WELCOME_HEADS['Your rides. Your bike. Your journey.'];
  return (
  <div style={{ position: 'relative', height: '100%', background: FT.bg2, overflow: 'hidden' }}>
    <div className="fhero-zoom" style={{
      position: 'absolute', inset: 0,
      backgroundImage: `url(${__res('heroRider', 'assets/hero-rider.jpg')})`,
      backgroundSize: 'cover', backgroundPosition: '58% center',
      filter: 'saturate(0.9) contrast(1.06) brightness(0.7)',
    }}/>
    <div style={{ position: 'absolute', inset: 0,
      background: 'radial-gradient(ellipse 100% 55% at 78% 12%, color-mix(in srgb, var(--ac) 26%, transparent) 0%, transparent 60%)',
      mixBlendMode: 'screen' }}/>
    <div style={{ position: 'absolute', inset: 0,
      background: `linear-gradient(180deg, ${FT.bg2}E6 0%, ${FT.bg2}20 24%, ${FT.bg2}33 48%, ${FT.bg2}F2 84%, ${FT.bg2} 100%)` }}/>
    <FGrain opacity={0.06}/>

    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column',
                  padding: '60px 26px 40px' }}>
      <div className="fw-fade" style={{ display: 'flex', alignItems: 'center', gap: 10, animationDelay: '150ms' }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, overflow: 'hidden', background: 'var(--ac)' }}>
          <img src={__res('logo', 'assets/logo.png')} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
        </div>
        <div style={{ fontWeight: 600, fontSize: 15, color: '#fff', letterSpacing: '-0.01em' }}>MotoVault</div>
      </div>

      <div style={{ marginTop: 'auto' }}>
        <div className="fw-up" style={{ animationDelay: '250ms', marginBottom: 16 }}>
          <FEyebrow color={FT.acText}>The rider's companion</FEyebrow>
        </div>
        <div className="fw-up" style={{ animationDelay: '350ms' }}>
          <FTitle size={50} style={{ color: '#fff', marginBottom: 18, textShadow: '0 2px 20px rgba(0,0,0,0.4)' }}>
            {head}
          </FTitle>
        </div>
        <div className="fw-up" style={{ animationDelay: '500ms', fontSize: 16, lineHeight: 1.45,
                      color: 'rgba(255,255,255,0.8)', maxWidth: 330, marginBottom: 28 }}>
          Track rides, manage expenses, discover routes — all in one place.
        </div>
        <div className="fw-up" style={{ animationDelay: '680ms' }}>
          <FButton label="Let's get started" onPress={go('03-experience')}/>
        </div>
      </div>
    </div>
    <style>{`
      @keyframes fwZoom { from { transform: scale(1); } to { transform: scale(1.06); } }
      @keyframes fwFade { from { opacity:0; } to { opacity:1; } }
      @keyframes fwUp   { from { opacity:0; transform: translateY(20px); } to { opacity:1; transform:none; } }
      .fhero-zoom { animation: fwZoom 14s ease-out infinite alternate; }
      .fw-fade { animation: fwFade .5s ease both; }
      .fw-up   { animation: fwUp .55s cubic-bezier(.2,.7,.2,1) both; }
      @media (prefers-reduced-motion: reduce) { .fhero-zoom { animation: none; } }
    `}</style>
  </div>
  );
};

// ── 03 — EXPERIENCE ────────────────────────────────────────────────────────────
const F_EXPERIENCE = [
  { id: 'starter',  title: 'Just getting started', tenure: '0–6 months', icon: 'sparkle', accent: 'oklch(0.72 0.13 78)',
    preview: "We'll keep it simple — gear basics, first-ride checklists, gentle reminders.", affirm: "Welcome to the ride — we've got you." },
  { id: 'middle',   title: 'A few years in the saddle', tenure: '1–5 yrs', icon: 'gauge', accent: 'var(--ac)',
    preview: "You're ready to optimize — track miles, log service, plan that next trip.", affirm: "Nice — let's level up your garage." },
  { id: 'seasoned', title: 'Seasoned rider', tenure: '10+ yrs', icon: 'medal', accent: 'oklch(0.58 0.17 32)', badge: 'Power mode',
    preview: 'Everything at your fingertips. Multi-bike, fleet expenses, detailed history.', affirm: 'Respect — let’s set you up fast.' },
];

const F03Experience = ({ go, state, setState }) => {
  const picked = state.experience;
  const [pending, setPending] = React.useState(null);
  const [exiting, setExiting] = React.useState(false);

  const choose = (o) => {
    if (pending) return;
    setPending(o.id);
    setState(s => ({ ...s, experience: o.id }));
    setTimeout(() => setExiting(true), 1000);
    setTimeout(() => go('04-bike')(), 1180);
  };

  const activeId = pending || picked;
  const roadAccent = (F_EXPERIENCE.find(o => o.id === activeId) || {}).accent || 'var(--ac)';

  return (
    <div style={{ position: 'relative', height: '100%', background: FT.bg,
                  display: 'flex', flexDirection: 'column', overflow: 'hidden',
                  opacity: exiting ? 0 : 1, transform: exiting ? 'translateY(-8px)' : 'none',
                  transition: 'opacity .2s ease, transform .2s ease' }}>
      <div className="fxp-glow" style={{
        position: 'absolute', inset: '-15% -20% auto -20%', height: '46%',
        background: `radial-gradient(ellipse 60% 80% at 50% 18%, color-mix(in srgb, ${roadAccent} 26%, transparent) 0%, transparent 70%)`,
        filter: 'blur(26px)', pointerEvents: 'none', transition: 'background .5s ease' }}/>
      {/* perspective road lines, tinted to the selected card's accent */}
      <div className="fxp-road" style={{ '--ra': roadAccent }}>
        <div className="fxp-road-lane"/>
      </div>
      <FGrain/>

      <FHeader step={1} onBack={go('02-welcome')} eyebrow="Tell us about you"/>
      <div style={{ padding: '18px 26px 0' }}>
        <FTitle size={36}>How long have you<br/><FAccent>been riding?</FAccent></FTitle>
        <div style={{ fontSize: 14, color: FT.ink2, lineHeight: 1.5, maxWidth: 320, marginTop: 12 }}>
          No wrong answer. We'll meet you exactly where you are.
        </div>
      </div>

      <div style={{ flex: 1, padding: '22px 20px 26px', display: 'flex', flexDirection: 'column',
                    gap: 11, justifyContent: 'center' }}>
        {F_EXPERIENCE.map((o, i) => {
          const active = picked === o.id;
          const isPicked = pending === o.id;
          const dim = pending && !isPicked;
          return (
            <div key={o.id} onClick={() => choose(o)} className="fxp-card" style={{
              animationDelay: `${260 + i * 90}ms`,
              padding: '15px 16px', borderRadius: 18,
              background: active ? `color-mix(in srgb, ${o.accent} 12%, #1E1C19)` : FT.card,
              border: `1px solid ${active ? `color-mix(in srgb, ${o.accent} 45%, transparent)` : FT.line}`,
              cursor: 'pointer', transition: 'all .22s ease, opacity .3s ease',
              transform: isPicked ? 'scale(0.985)' : 'scale(1)', opacity: dim ? 0.4 : 1,
              boxShadow: active ? `0 12px 30px color-mix(in srgb, ${o.accent} 18%, transparent)` : 'none',
              WebkitTapHighlightColor: 'transparent',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 46, height: 46, borderRadius: 14, flexShrink: 0,
                  background: active ? o.accent : `color-mix(in srgb, ${o.accent} 12%, #262320)`,
                  display: 'grid', placeItems: 'center', transition: 'background .22s ease' }}>
                  <MVIcon name={o.icon} size={22} color={active ? FT.darkInk : o.accent}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: FT.ink, letterSpacing: '-0.012em' }}>{o.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <span style={{ fontFamily: FT.mono, fontSize: 10, fontWeight: 500, letterSpacing: '0.14em',
                                textTransform: 'uppercase', color: active ? o.accent : FT.ink3 }}>{o.tenure}</span>
                    {o.badge && (
                      <span style={{ fontFamily: FT.mono, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.16em',
                        textTransform: 'uppercase', padding: '2px 7px', borderRadius: 999, whiteSpace: 'nowrap',
                        background: `color-mix(in srgb, ${o.accent} 18%, transparent)`,
                        color: o.accent, border: `1px solid color-mix(in srgb, ${o.accent} 40%, transparent)` }}>{o.badge}</span>
                    )}
                  </div>
                </div>
                {active && (
                  <div className="fxp-check" style={{ width: 26, height: 26, borderRadius: 13, background: o.accent,
                                display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <MVIcon name="check" size={14} color={FT.darkInk} strokeWidth={3}/>
                  </div>
                )}
              </div>
              <div style={{ fontSize: 12.5, lineHeight: 1.45, fontStyle: 'italic', marginTop: 10, paddingLeft: 60,
                            color: active ? FT.ink2 : FT.ink3 }}>{o.preview}</div>
              {isPicked && (
                <div className="fxp-affirm" style={{ marginTop: 10, paddingLeft: 60, fontSize: 13,
                              color: o.accent, fontWeight: 600 }}>{o.affirm}</div>
              )}
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes fxpIn { from { opacity:0; transform: translateY(16px); } to { opacity:1; transform:none; } }
        @keyframes fxpCk { 0% { opacity:0; transform: scale(.4); } 60% { transform: scale(1.15); } 100% { opacity:1; transform: scale(1); } }
        @keyframes fxpAf { from { opacity:0; transform: translateY(-3px); } to { opacity:1; transform:none; } }
        @keyframes fxpGlow { 0%,100% { opacity:.85; transform: translateX(-2%); } 50% { opacity:1; transform: translateX(2%); } }
        @keyframes fxpRoad { from { background-position: 0 0; } to { background-position: 0 46px; } }
        .fxp-card  { animation: fxpIn .5s cubic-bezier(.2,.7,.2,1) both; }
        .fxp-check { animation: fxpCk .28s cubic-bezier(.2,.7,.2,1) both; }
        .fxp-affirm{ animation: fxpAf .26s ease both; }
        .fxp-glow  { animation: fxpGlow 3.6s ease-in-out infinite; }
        .fxp-road {
          position: absolute; left: 50%; bottom: 0; width: 240%; height: 52%;
          transform: translateX(-50%) perspective(300px) rotateX(64deg);
          transform-origin: bottom center; pointer-events: none; opacity: .42;
          background-image: repeating-linear-gradient(to top, transparent 0 42px,
            color-mix(in srgb, var(--ra) 55%, transparent) 42px 46px);
          -webkit-mask-image: radial-gradient(ellipse 55% 100% at 50% 100%, #000 8%, transparent 72%);
                  mask-image: radial-gradient(ellipse 55% 100% at 50% 100%, #000 8%, transparent 72%);
          animation: fxpRoad 1.15s linear infinite; transition: opacity .4s ease;
        }
        .fxp-road-lane {
          position: absolute; left: 50%; bottom: 0; transform: translateX(-50%);
          width: 5px; height: 100%;
          background: repeating-linear-gradient(to top, transparent 0 30px,
            color-mix(in srgb, var(--ra) 80%, transparent) 30px 56px);
        }
        @media (prefers-reduced-motion: reduce) { .fxp-road { animation: none; } }
      `}</style>
    </div>
  );
};

// ── 04 — BIKE (search-first unlock) ──────────────────────────────────────────
const F04Bike = ({ go, state, setState }) => {
  const currentYear = new Date().getFullYear();
  const defaultYear = currentYear - 3;
  const year = state.bikeYear ?? defaultYear;
  const make = state.bikeMake;
  const model = state.bikeModel;
  const [q, setQ] = React.useState('');
  const [partial, setPartial] = React.useState(false);

  const brandC = makeColor(make);
  const dna = make ? (F_BRAND_DNA[make] || F_BRAND_DNA.__default) : null;
  const models = F_MODELS[make] || [];
  const matches = q.trim()
    ? F_ALL_MAKES.filter(m => m.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6)
    : [];

  const popTier = !dna ? null
    : dna.rank === 1 ? 'Most popular'
    : dna.rank <= 3 ? 'Top 3 in your area'
    : dna.rank <= 8 ? 'Popular pick' : null;
  // local community size + catalogue depth for social proof
  const near = (dna?.riders || 1) + 9;
  const modelsCount = (F_MODELS[make] || []).length;
  const rankBadge = (m) => { const r = F_BRAND_DNA[m]?.rank; return (r && r <= 3) ? `#${r}` : null; };

  const pickMake = (m) => { setState(s => ({ ...s, bikeMake: m, bikeModel: null })); setQ(''); };
  const reset = () => setState(s => ({ ...s, bikeMake: null, bikeModel: null }));
  const addBike = () => { setState(s => ({ ...s, bikeYear: year, bikeSkipped: false })); go('05-garage')(); };
  const skip = () => { setState(s => ({ ...s, bikeSkipped: true, bikeMake: null, bikeModel: null })); go('06-goals')(); };
  const setYear = (y) => setState(s => ({ ...s, bikeYear: y }));

  return (
    <div style={{ position: 'relative', height: '100%', background: FT.bg,
                  display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {make && (
        <div key={make} className="fbk-flood" style={{
          position: 'absolute', inset: '-20% -20% 35% -20%',
          background: `radial-gradient(ellipse 72% 60% at 50% 26%, ${brandC}38 0%, ${brandC}12 36%, transparent 72%)`,
          filter: 'blur(30px)', pointerEvents: 'none' }}/>
      )}
      <FGrain/>
      <FHeader step={2} onBack={go('03-experience')} eyebrow="Unlock your garage"/>

      <div style={{ padding: '16px 26px 0' }}>
        <FTitle size={32}>
          {make ? <>Say hello to your<br/><FAccent>{make}.</FAccent></>
                : <>Let's find<br/><FAccent>your bike.</FAccent></>}
        </FTitle>
        <div style={{ fontSize: 13.5, color: FT.ink2, lineHeight: 1.45, maxWidth: 330, marginTop: 8 }}>
          {make ? dna.tagline
                : "Unlock your bike's real service data, specs, recalls and history."}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '20px 20px 12px', position: 'relative' }}>
        {!make ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {/* search */}
            <div className="fbk-in">
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', top: '50%', left: 16, transform: 'translateY(-50%)' }}>
                  <MVIcon name="search" size={17} color={FT.ink3}/>
                </div>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Start typing your bike — e.g. ‘Yamaha MT-07’"
                  style={{ width: '100%', background: FT.card, border: `1px solid ${FT.line}`, borderRadius: 15,
                           padding: '15px 16px 15px 44px', color: FT.ink, fontFamily: 'inherit', fontSize: 14.5, outline: 'none' }}/>
              </div>
              {/* incentive teaser — pull before the reward */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 11, paddingLeft: 4,
                    fontFamily: FT.mono, fontSize: 10.5, letterSpacing: '0.07em', color: FT.ink3 }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: FT.green,
                      boxShadow: `0 0 7px ${FT.green}`, flexShrink: 0 }}/>
                12,400 riders on MotoVault &middot; live recall checks
              </div>
            </div>

            {q.trim() ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {matches.length === 0 && <div style={{ fontSize: 13, color: FT.ink3, padding: 8 }}>No matches — try another spelling.</div>}
                {matches.map(m => (
                  <div key={m} onClick={() => pickMake(m)} style={{ padding: '13px 14px', borderRadius: 14,
                        background: FT.card, border: `1px solid ${FT.line}`, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: F_MAKE_COLORS[m] || 'var(--ac)',
                          display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 800, color: '#fff' }}>{m[0]}</div>
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: FT.ink }}>{m}</div>
                    {F_BRAND_DNA[m]?.riders && (
                      <div style={{ marginLeft: 'auto', fontFamily: FT.mono, fontSize: 11, color: FT.ink3, letterSpacing: '0.06em' }}>
                        {F_BRAND_DNA[m].riders}k riders
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="fbk-in" style={{ animationDelay: '60ms' }}>
                <FEyebrow style={{ marginBottom: 12 }}>Popular makes</FEyebrow>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                  {F_POPULAR_MAKES.map((m, i) => {
                    const rb = rankBadge(m);
                    return (
                    <div key={m} onClick={() => pickMake(m)} className="fbk-tile" style={{ animationDelay: `${i * 40}ms`,
                          position: 'relative', padding: '14px 14px', borderRadius: 15, background: FT.card, border: `1px solid ${FT.line}`,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 11, WebkitTapHighlightColor: 'transparent' }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: F_MAKE_COLORS[m] || 'var(--ac)',
                            display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{m[0]}</div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: FT.ink, letterSpacing: '-0.01em', lineHeight: 1.1 }}>{m}</div>
                      {rb && (
                        <div style={{ position: 'absolute', top: 8, right: 9, fontFamily: FT.mono, fontSize: 9,
                              fontWeight: 600, letterSpacing: '0.06em', color: FT.acText,
                              background: 'color-mix(in srgb, var(--ac) 16%, transparent)',
                              border: '1px solid color-mix(in srgb, var(--ac) 30%, transparent)',
                              padding: '1px 5px', borderRadius: 6 }}>{rb}</div>
                      )}
                    </div>
                    );
                  })}
                </div>

                {/* compact year — model stays optional */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14,
                      background: FT.card, border: `1px solid ${FT.line}`, borderRadius: 14, padding: '10px 14px' }}>
                  <FEyebrow style={{ flex: 1 }}>Model year</FEyebrow>
                  <div onClick={() => setYear(Math.max(1970, year - 1))} style={stepBtnSm}>
                    <MVIcon name="chevron-left" size={15} color={FT.ink2} strokeWidth={2.4}/></div>
                  <div style={{ minWidth: 56, textAlign: 'center', fontFamily: FT.mono, fontSize: 19, fontWeight: 600,
                        letterSpacing: '0.06em', color: FT.acText }}>{year}</div>
                  <div onClick={() => setYear(Math.min(currentYear + 1, year + 1))} style={stepBtnSm}>
                    <MVIcon name="chevron-right" size={15} color={FT.ink2} strokeWidth={2.4}/></div>
                </div>
              </div>
            )}
          </div>
        ) : (
          // ── make picked: brand takeover ──
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div key={`mk-${make}`} className="fbk-brand" style={{ display: 'flex', alignItems: 'center', gap: 16,
                  padding: '18px', borderRadius: 18, background: `color-mix(in srgb, ${brandC} 12%, #1E1C19)`,
                  border: `1px solid color-mix(in srgb, ${brandC} 32%, transparent)` }}>
              <div style={{ width: 60, height: 60, borderRadius: 16, background: brandC, flexShrink: 0,
                    display: 'grid', placeItems: 'center', fontSize: 30, fontWeight: 800, color: '#fff',
                    boxShadow: `0 8px 24px ${brandC}66` }}>{make[0]}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {popTier && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 5,
                        fontFamily: FT.mono, fontSize: 9.5, fontWeight: 500, letterSpacing: '0.13em',
                        textTransform: 'uppercase', color: brandC }}>
                    <MVIcon name="star-fill" size={10} color={brandC}/>{popTier} &middot; {near} riders
                  </div>
                )}
                <div style={{ fontFamily: FT.serif, fontSize: 27, color: FT.ink, letterSpacing: '-0.01em', lineHeight: 1 }}>{make}</div>
                <div style={{ fontSize: 12.5, color: FT.ink2, lineHeight: 1.35, marginTop: 4, fontStyle: 'italic' }}>{dna.tagline}</div>
              </div>
            </div>

            {/* Loaded for you — instant value, before any ask */}
            <div className="fbk-in">
              <FEyebrow style={{ marginBottom: 10 }} color={FT.acText}>Loaded for you</FEyebrow>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {[
                  { v: dna.intervals,        k: 'Service interval' },
                  { v: `${near}`,            k: 'Riders on this' },
                  { v: `${modelsCount || '\u2014'}`, k: 'Models tracked' },
                ].map((t) => (
                  <div key={t.k} style={{ padding: '12px 11px', borderRadius: 14, background: FT.card, border: `1px solid ${FT.line}` }}>
                    <div style={{ fontFamily: FT.mono, fontSize: 14.5, fontWeight: 600, color: FT.acText,
                          letterSpacing: '0.01em', lineHeight: 1.05 }}>{t.v}</div>
                    <div style={{ fontFamily: FT.mono, fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase',
                          color: FT.ink3, marginTop: 6, lineHeight: 1.3 }}>{t.k}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 11, paddingLeft: 2,
                    fontSize: 12.5, color: FT.ink2, lineHeight: 1.4 }}>
                <MVIcon name="user" size={14} color={brandC}/>
                <span>Welcome to <b style={{ color: FT.ink }}>{near} {make.toUpperCase()}</b> riders on MotoVault.</span>
              </div>
              <div onClick={reset} style={{ fontSize: 12, color: FT.ink3, cursor: 'pointer', marginTop: 12,
                    textDecoration: 'underline', textUnderlineOffset: 3, width: 'fit-content' }}>Choose a different make</div>
            </div>

            {/* Year stepper — one-tap, pre-filled */}
            <div className="fbk-in">
              <FEyebrow style={{ marginBottom: 10 }}>Model year</FEyebrow>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: FT.card,
                    border: `1px solid ${FT.line}`, borderRadius: 16, padding: '12px 16px' }}>
                <div onClick={() => setYear(Math.max(1970, year - 1))} style={stepBtn}>
                  <MVIcon name="chevron-left" size={18} color={FT.ink2} strokeWidth={2.4}/></div>
                <div style={{ flex: 1, textAlign: 'center', fontFamily: FT.mono, fontSize: 30, fontWeight: 600,
                      letterSpacing: '0.08em', color: FT.acText }}>{year}</div>
                <div onClick={() => setYear(Math.min(currentYear + 1, year + 1))} style={stepBtn}>
                  <MVIcon name="chevron-right" size={18} color={FT.ink2} strokeWidth={2.4}/></div>
              </div>
            </div>

            {/* Model — optional chips */}
            <div className="fbk-in" style={{ animationDelay: '60ms' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
                <FEyebrow>Model</FEyebrow>
                <span style={{ fontSize: 11, color: FT.ink4 }}>optional</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {models.map(m => {
                  const on = model === m;
                  return (
                    <div key={m} onClick={() => setState(s => ({ ...s, bikeModel: on ? null : m }))} style={{
                      padding: '9px 14px', borderRadius: 999, cursor: 'pointer', fontSize: 13.5, fontWeight: 600,
                      background: on ? 'var(--ac)' : FT.card, color: on ? FT.darkInk : FT.ink2,
                      border: `1px solid ${on ? 'transparent' : FT.line}`, transition: 'all .15s ease',
                      WebkitTapHighlightColor: 'transparent' }}>{m}</div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* sticky actions */}
      <div style={{ padding: '12px 20px 30px',
            background: `linear-gradient(180deg, transparent, ${FT.bg} 26%)` }}>
        {/* lightweight partial-capture — make-level still creates a bike */}
        {!make && partial && (
          <div className="fbk-in" style={{ marginBottom: 12, padding: '14px', borderRadius: 16,
                background: FT.card, border: `1px solid ${FT.line}` }}>
            <div style={{ fontSize: 12.5, color: FT.ink2, lineHeight: 1.4, marginBottom: 10 }}>
              Just your make is enough to start — you can fill in the rest later.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {F_POPULAR_MAKES.slice(0, 4).map(m => (
                <div key={m} onClick={() => pickMake(m)} style={{ display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 12px', borderRadius: 999, background: FT.card2, border: `1px solid ${FT.line}`,
                      cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
                  <div style={{ width: 20, height: 20, borderRadius: 6, background: F_MAKE_COLORS[m] || 'var(--ac)',
                        display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 800, color: '#fff' }}>{m[0]}</div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: FT.ink }}>{m}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <FButton label={fcfg('bikeCta', 'Add to my garage')} icon="arrow-right"
          onPress={make ? addBike : undefined} disabled={!make}/>
        {!make && <FSkip label="Not sure of the details?" onPress={() => setPartial(p => !p)}/>}
      </div>

      <style>{`
        @keyframes fbkIn    { from { opacity:0; transform: translateY(12px); } to { opacity:1; transform:none; } }
        @keyframes fbkTile  { from { opacity:0; transform: translateY(10px) scale(.98); } to { opacity:1; transform:none; } }
        @keyframes fbkBrand { from { opacity:0; transform: scale(.96); } to { opacity:1; transform:none; } }
        @keyframes fbkFlood { from { opacity:0; } to { opacity:1; } }
        .fbk-in    { animation: fbkIn .42s cubic-bezier(.2,.7,.2,1) both; }
        .fbk-tile  { animation: fbkTile .4s cubic-bezier(.2,.7,.2,1) both; }
        .fbk-brand { animation: fbkBrand .4s cubic-bezier(.2,.7,.2,1) both; }
        .fbk-flood { animation: fbkFlood .6s ease both; }
      `}</style>
    </div>
  );
};
const stepBtn = { width: 40, height: 40, borderRadius: 12, background: 'rgba(244,239,233,0.05)',
  border: `1px solid ${FT.line}`, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0,
  WebkitTapHighlightColor: 'transparent' };
const stepBtnSm = { width: 30, height: 30, borderRadius: 9, background: 'rgba(244,239,233,0.05)',
  border: `1px solid ${FT.line}`, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0,
  WebkitTapHighlightColor: 'transparent' };

Object.assign(window, { F01Splash, F02Welcome, F03Experience, F04Bike, F_EXPERIENCE });
