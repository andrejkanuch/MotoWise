// =============================================================================
// MotoVault — Onboarding flow — SCREENS B
// 05 Garage reveal (NEW) · 06 Goals · 07 Maintenance plan
// =============================================================================

// ── 05 — GARAGE REVEAL (NEW) — belief before the paywall ─────────────────────
const F05Garage = ({ go, state }) => {
  const make = state.bikeMake || 'BMW';
  const model = state.bikeModel;
  const year = state.bikeYear || (new Date().getFullYear() - 3);
  const brandC = makeColor(make);
  const dna = F_BRAND_DNA[make] || F_BRAND_DNA.__default;
  const img = bikeImg(make);
  const near = (dna.riders || 1) + 9;
  const typeLabel = { adv: 'Adventure', sport: 'Sport', cruiser: 'Cruiser' }[dna.type] || 'Tracked';

  // factual spec tiles inside the bike card
  const specs = [
    { v: dna.intervals, k: 'Service interval' },
    { v: '0',           k: 'Active recalls' },
    { v: typeLabel,     k: 'Category' },
  ];
  // forward-looking value proofs
  const proofs = [
    { icon: 'shield', c: FT.green, t: <>We checked <b style={{ color: FT.ink }}>{make}</b> recalls for your year — we'll alert you to new ones.</> },
    { icon: 'wrench', c: brandC,   t: <>Your <b style={{ color: FT.ink }}>OEM service schedule</b> is ready to load.</> },
    { icon: 'user',   c: FT.amber, t: <><b style={{ color: FT.ink }}>{near} {make}</b> riders on MotoVault.</> },
  ];

  return (
    <div style={{ position: 'relative', height: '100%', background: FT.bg, overflow: 'hidden',
                  display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '32%', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0,
              background: `radial-gradient(ellipse 90% 70% at 50% -10%, ${brandC}33 0%, transparent 62%)` }}/>
      </div>

      <FBack onPress={go('04-bike')}/>
      <ObSafeTop style={{ padding: '58px 26px 0', position: 'relative', zIndex: 2 }}>
        <div style={{ height: 44 }}/>
        <FProgress step={3} total={7}/>
      </ObSafeTop>

      <div style={{ position: 'relative', zIndex: 2, flex: 1, overflow: 'auto', padding: '20px 22px 12px',
                    display: 'flex', flexDirection: 'column' }}>
        {/* badge */}
        <div className="fg-rise" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
              padding: '5px 11px', borderRadius: 999, marginBottom: 14,
              background: 'color-mix(in srgb, var(--ac) 18%, transparent)',
              border: '1px solid color-mix(in srgb, var(--ac) 36%, transparent)' }}>
          <MVIcon name="check" size={12} color={FT.acText} strokeWidth={3}/>
          <span style={{ fontFamily: FT.mono, fontSize: 10, fontWeight: 500, letterSpacing: '0.16em',
                textTransform: 'uppercase', color: FT.acText }}>Garage unlocked</span>
        </div>

        <div className="fg-rise" style={{ animationDelay: '70ms' }}>
          <FTitle size={36} style={{ marginBottom: 16 }}>Here's what you<br/><FAccent>just unlocked.</FAccent></FTitle>
        </div>

        {/* premium bike card */}
        <div className="fg-card" style={{ position: 'relative', borderRadius: 22, overflow: 'hidden', marginBottom: 18,
              border: `1px solid color-mix(in srgb, ${brandC} 34%, transparent)`,
              background: `linear-gradient(165deg, color-mix(in srgb, ${brandC} 18%, #1E1C19) 0%, #1A1815 60%)`,
              boxShadow: `0 18px 44px color-mix(in srgb, ${brandC} 16%, transparent)` }}>
          {/* photo strip */}
          <div style={{ position: 'relative', height: 132, overflow: 'hidden' }}>
            <div className="fg-hero" style={{ position: 'absolute', inset: 0, backgroundImage: `url(${img})`,
                  backgroundSize: 'cover', backgroundPosition: 'center', filter: 'brightness(0.82) saturate(1.04)' }}/>
            <div style={{ position: 'absolute', inset: 0,
                  background: `linear-gradient(180deg, transparent 30%, #1A1815 98%)` }}/>
            <div style={{ position: 'absolute', top: 14, left: 14, width: 40, height: 40, borderRadius: 12,
                  background: brandC, display: 'grid', placeItems: 'center', fontSize: 20, fontWeight: 800, color: '#fff',
                  boxShadow: `0 6px 18px ${brandC}88` }}>{make[0]}</div>
          </div>
          {/* identity + specs */}
          <div style={{ padding: '4px 18px 18px' }}>
            <div style={{ fontFamily: FT.mono, fontSize: 10, letterSpacing: '0.14em', color: FT.ink3,
                  textTransform: 'uppercase', marginBottom: 4 }}>{year}</div>
            <div style={{ fontFamily: FT.serif, fontSize: 30, color: FT.ink, letterSpacing: '-0.01em', lineHeight: 1 }}>
              {make}{model ? <span style={{ color: FT.acText }}> {model}</span> : ''}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 16 }}>
              {specs.map((s) => (
                <div key={s.k} style={{ padding: '11px 10px', borderRadius: 13, background: 'rgba(0,0,0,0.22)',
                      border: `1px solid ${FT.line}` }}>
                  <div style={{ fontFamily: FT.mono, fontSize: 13.5, fontWeight: 600, color: brandC, lineHeight: 1.05 }}>{s.v}</div>
                  <div style={{ fontFamily: FT.mono, fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase',
                        color: FT.ink3, marginTop: 6, lineHeight: 1.3 }}>{s.k}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* value proofs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
          {proofs.map((p, i) => (
            <div key={i} className="fg-proof" style={{ animationDelay: `${260 + i * 100}ms`,
                  display: 'flex', alignItems: 'center', gap: 13 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                    background: `color-mix(in srgb, ${p.c} 16%, #1E1C19)`, display: 'grid', placeItems: 'center' }}>
                <MVIcon name={p.icon} size={18} color={p.c}/>
              </div>
              <div style={{ fontSize: 13.5, color: FT.ink2, lineHeight: 1.4 }}>{p.t}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 4 }}>
          <FButton label="Continue" onPress={go('06-goals')}/>
        </div>
      </div>
      <style>{`
        @keyframes fgRise  { from { opacity:0; transform: translateY(14px); } to { opacity:1; transform:none; } }
        @keyframes fgCard  { from { opacity:0; transform: translateY(18px) scale(.98); } to { opacity:1; transform:none; } }
        @keyframes fgProof { from { opacity:0; transform: translateY(12px); } to { opacity:1; transform:none; } }
        @keyframes fgHero  { from { transform: scale(1.1); } to { transform: scale(1); } }
        .fg-rise  { animation: fgRise .5s cubic-bezier(.2,.7,.2,1) both; }
        .fg-card  { animation: fgCard .55s cubic-bezier(.2,.7,.2,1) .15s both; }
        .fg-proof { animation: fgProof .5s cubic-bezier(.2,.7,.2,1) both; }
        .fg-hero  { animation: fgHero 1.6s cubic-bezier(.2,.7,.2,1) both; }
      `}</style>
    </div>
  );
};

// ── 06 — GOALS — "tune your dashboard" ───────────────────────────────────────
const F_GOALS = [
  { id: 'track_rides',     priority: 1, label: 'Track my rides',   sub: 'GPS tracking, stats, ride history',                 icon: 'location' },
  { id: 'manage_expenses', priority: 2, label: 'Manage expenses',  sub: 'Fuel, repairs, insurance, total cost of ownership', icon: 'dollar' },
  { id: 'discover_routes', priority: 3, label: 'Discover routes',  sub: 'Find epic roads and plan trips',                    icon: 'compass' },
  { id: 'maintain_bike',   priority: 4, label: 'Maintain my bike', sub: 'Service reminders, maintenance logs',               icon: 'wrench' },
  { id: 'just_exploring',  priority: 5, label: 'Just exploring',   sub: 'Show me everything', casual: true,                  icon: 'sparkle' },
];

const F06Goals = ({ go, state, setState }) => {
  const picked = state.goals || [];
  const make = state.bikeMake;
  const skipped = state.bikeSkipped;
  const [affirm, setAffirm] = React.useState(false);

  const toggle = (id) => setState(s => {
    const cur = s.goals || [];
    return { ...s, goals: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] };
  });
  const cont = () => {
    if (!picked.length) return;
    const primary = F_GOALS.filter(g => picked.includes(g.id)).sort((a, b) => a.priority - b.priority)[0];
    setState(s => ({ ...s, primaryGoal: primary.id }));
    setAffirm(true);
    setTimeout(() => go(skipped ? '09-paywall' : '07-maintenance')(), 680);
  };

  return (
    <div style={{ position: 'relative', height: '100%', background: FT.bg, display: 'flex', flexDirection: 'column' }}>
      <FHeader step={4} onBack={go(skipped ? '04-bike' : '05-garage')} eyebrow="Tune your dashboard"/>
      <div style={{ padding: '16px 26px 0' }}>
        <FTitle size={30}>What should MotoVault<br/><FAccent>do for your {make || 'ride'}?</FAccent></FTitle>
        <div style={{ fontSize: 14, color: FT.ink2, lineHeight: 1.45, maxWidth: 320, marginTop: 8 }}>
          Pick all that apply — we'll tailor your dashboard.
        </div>
      </div>

      <div style={{ flex: 1, padding: '20px 20px 12px', display: 'flex', flexDirection: 'column', gap: 10, overflow: 'auto' }}>
        {F_GOALS.map((g, i) => {
          const on = picked.includes(g.id);
          return (
            <div key={g.id} onClick={() => toggle(g.id)} className="fgo-in" style={{ animationDelay: `${160 + i * 70}ms`,
                  padding: '14px 16px', borderRadius: 16, minHeight: 64, cursor: 'pointer',
                  background: on ? 'color-mix(in srgb, var(--ac) 9%, #1E1C19)' : FT.card,
                  border: `1px solid ${on ? FT.acLine : FT.line}`, display: 'flex', alignItems: 'center', gap: 14,
                  transition: 'all .16s ease', WebkitTapHighlightColor: 'transparent' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                    background: on ? 'color-mix(in srgb, var(--ac) 18%, #262320)' : '#262320',
                    display: 'grid', placeItems: 'center', transition: 'background .2s' }}>
                <MVIcon name={g.icon} size={20} color={on ? FT.acText : FT.ink3}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: on ? FT.ink : FT.ink, letterSpacing: '-0.01em' }}>{g.label}</div>
                <div style={{ fontSize: 12, color: FT.ink3, lineHeight: 1.35, fontStyle: g.casual ? 'italic' : 'normal' }}>{g.sub}</div>
              </div>
              <div className={on ? 'fgo-ck' : ''} style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0,
                    background: on ? 'var(--ac)' : 'transparent', border: on ? 'none' : `1.5px solid ${FT.ink4}`,
                    display: 'grid', placeItems: 'center', transition: 'all .2s ease' }}>
                {on && <MVIcon name="check" size={13} color={FT.darkInk} strokeWidth={3}/>}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ padding: '12px 20px 30px' }}>
        {affirm && <div className="fgo-af" style={{ fontSize: 13.5, color: FT.acText, textAlign: 'center',
              marginBottom: 12, fontWeight: 600 }}>Good picks — wiring up your dashboard.</div>}
        <FButton label="Continue" onPress={cont} disabled={!picked.length}/>
        <div style={{ marginTop: 10, textAlign: 'center', fontFamily: FT.mono, fontSize: 11,
              letterSpacing: '0.1em', color: FT.ink4 }}>{picked.length} of {F_GOALS.length} picked</div>
      </div>
      <style>{`
        @keyframes fgoIn { from { opacity:0; transform: translateY(12px); } to { opacity:1; transform:none; } }
        @keyframes fgoCk { 0% { transform: scale(.4); } 60% { transform: scale(1.12); } 100% { transform: scale(1); } }
        @keyframes fgoAf { from { opacity:0; transform: translateY(-3px); } to { opacity:1; transform:none; } }
        .fgo-in { animation: fgoIn .46s cubic-bezier(.2,.7,.2,1) both; }
        .fgo-ck { animation: fgoCk .2s cubic-bezier(.2,.7,.2,1) both; }
        .fgo-af { animation: fgoAf .26s ease both; }
      `}</style>
    </div>
  );
};

// ── 07 — MAINTENANCE PLAN — swipe-to-build ───────────────────────────────────
const F_TASKS = [
  { id: 'oil',   title: 'Oil & filter change', icon: 'fuel',   interval: 'Every 10,000 km', cost: '~$120', why: 'Keeps the engine breathing easy.', imp: 'med' },
  { id: 'chain', title: 'Chain clean & lube',  icon: 'repeat', interval: 'Every 600 km',    cost: '~$15',  why: 'Cheap habit, long drivetrain life.', imp: 'low' },
  { id: 'tyres', title: 'Tyre pressure & wear', icon: 'gauge',  interval: 'Monthly',         cost: 'Free',  why: 'The two things between you and the road.', imp: 'high' },
  { id: 'brake', title: 'Brake fluid flush',   icon: 'shield', interval: 'Every 2 years',   cost: '~$80',  why: 'Spongy brakes start here.', imp: 'med' },
  { id: 'valve', title: 'Valve inspection',    icon: 'wrench',  interval: 'Major service',   cost: '~$400', why: 'The big one — we’ll warn you early.', imp: 'high' },
];
const IMP_C = { low: FT.teal, med: FT.amber, high: FT.danger };

const FMCard = ({ task, brandC, depth = 0, dragX = 0, flying = null }) => {
  const tint = depth === 0 ? 1 : 0;
  return (
    <div style={{ position: 'relative', height: '100%', borderRadius: 22, overflow: 'hidden',
          background: FT.card, border: `1px solid ${FT.line}`,
          boxShadow: depth === 0 ? '0 18px 44px rgba(0,0,0,0.4)' : 'none',
          display: 'flex', flexDirection: 'column', padding: '22px 22px 24px' }}>
      <div style={{ position: 'absolute', inset: 0,
            background: `radial-gradient(ellipse 80% 50% at 50% 0%, ${brandC}1f 0%, transparent 60%)`, opacity: tint }}/>
      {/* swipe hint overlays */}
      <div style={{ position: 'absolute', top: 20, left: 20, padding: '6px 12px', borderRadius: 10,
            border: `2px solid ${FT.green}`, color: FT.green, fontWeight: 800, fontSize: 13, letterSpacing: '0.1em',
            transform: 'rotate(-12deg)', opacity: dragX > 25 ? Math.min(1, dragX / 90) : 0, transition: flying ? 'none' : 'opacity .1s' }}>ADD</div>
      <div style={{ position: 'absolute', top: 20, right: 20, padding: '6px 12px', borderRadius: 10,
            border: `2px solid ${FT.ink3}`, color: FT.ink3, fontWeight: 800, fontSize: 13, letterSpacing: '0.1em',
            transform: 'rotate(12deg)', opacity: dragX < -25 ? Math.min(1, -dragX / 90) : 0, transition: flying ? 'none' : 'opacity .1s' }}>SKIP</div>

      <div style={{ position: 'relative', width: 56, height: 56, borderRadius: 16, marginBottom: 'auto',
            background: `color-mix(in srgb, ${brandC} 18%, #262320)`, display: 'grid', placeItems: 'center' }}>
        <MVIcon name={task.icon} size={28} color={brandC}/>
      </div>
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12, padding: '4px 9px', borderRadius: 8,
              fontFamily: FT.mono, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase',
              color: IMP_C[task.imp], background: `color-mix(in srgb, ${IMP_C[task.imp]} 14%, transparent)`,
              border: `1px solid color-mix(in srgb, ${IMP_C[task.imp]} 34%, transparent)` }}>
          <span style={{ width: 5, height: 5, borderRadius: 3, background: IMP_C[task.imp] }}/>
          {task.imp === 'high' ? 'Critical' : task.imp === 'med' ? 'OEM' : 'Routine'}
        </div>
        <div style={{ fontFamily: FT.serif, fontSize: 28, color: FT.ink, letterSpacing: '-0.01em', lineHeight: 1.05, marginBottom: 10 }}>{task.title}</div>
        <div style={{ fontSize: 13.5, color: FT.ink2, lineHeight: 1.45, marginBottom: 16 }}>{task.why}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1, padding: '10px 12px', borderRadius: 12, background: 'rgba(244,239,233,0.04)', border: `1px solid ${FT.line}` }}>
            <div style={{ fontFamily: FT.mono, fontSize: 9, letterSpacing: '0.12em', color: FT.ink3, textTransform: 'uppercase', marginBottom: 4 }}>Interval</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: FT.ink }}>{task.interval}</div>
          </div>
          <div style={{ flex: 1, padding: '10px 12px', borderRadius: 12, background: 'rgba(244,239,233,0.04)', border: `1px solid ${FT.line}` }}>
            <div style={{ fontFamily: FT.mono, fontSize: 9, letterSpacing: '0.12em', color: FT.ink3, textTransform: 'uppercase', marginBottom: 4 }}>Typical cost</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: FT.acText }}>{task.cost}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

const F07Maintenance = ({ go, state, setState, startIdx, startApproved }) => {
  const make = state.bikeMake;
  const brandC = makeColor(make);
  const label = [state.bikeModel, make].filter(Boolean).join(' · ') || 'your bike';
  const tasks = F_TASKS;
  const [idx, setIdx] = React.useState(startIdx ?? 0);
  const [approved, setApproved] = React.useState(startApproved ?? []);
  const [drag, setDrag] = React.useState(null);
  const [flying, setFlying] = React.useState(null);
  const done = idx >= tasks.length;
  const cur = tasks[idx];

  const commit = (dir) => {
    if (flying || done) return;
    setFlying(dir);
    setTimeout(() => {
      if (dir === 'right') setApproved(a => [...a, cur.id]);
      setIdx(i => i + 1); setDrag(null); setFlying(null);
    }, 300);
  };
  const onDown = (e) => { if (flying || done) return; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {} setDrag({ id: e.pointerId, sx: e.clientX, x: 0, y: 0 }); };
  const onMove = (e) => { if (!drag || drag.id !== e.pointerId) return; setDrag(d => ({ ...d, x: e.clientX - d.sx, y: 0 })); };
  const onUp = () => { if (!drag) return; if (drag.x > 85) commit('right'); else if (drag.x < -85) commit('left'); else setDrag(null); };

  const dragX = drag?.x || 0;
  const topT = flying === 'right' ? 'translate(440px,-60px) rotate(26deg)'
             : flying === 'left' ? 'translate(-440px,-60px) rotate(-26deg)'
             : `translate(${dragX}px, ${Math.abs(dragX) * 0.04}px) rotate(${dragX * 0.05}deg)`;
  const topTr = flying ? 'transform .3s cubic-bezier(.2,.7,.2,1)' : drag ? 'none' : 'transform .28s cubic-bezier(.4,0,.2,1)';

  const cont = () => { setState(s => ({ ...s, maintenance: approved })); go('08-commitment')(); };
  const skipAll = () => { setState(s => ({ ...s, maintenance: approved })); go('08-commitment')(); };

  return (
    <div style={{ position: 'relative', height: '100%', background: FT.bg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: '-15% -20% auto -20%', height: '40%',
            background: `radial-gradient(ellipse 60% 80% at 50% 18%, ${brandC}22 0%, transparent 70%)`, filter: 'blur(28px)', pointerEvents: 'none' }}/>
      <FGrain/>
      <FHeader step={5} onBack={go('06-goals')} eyebrow={done ? 'Your plan' : 'Build your plan'}/>
      <div style={{ padding: '14px 26px 0' }}>
        {done && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12, padding: '5px 11px', borderRadius: 999,
                background: 'color-mix(in srgb, var(--ac) 18%, transparent)', border: '1px solid color-mix(in srgb, var(--ac) 36%, transparent)' }}>
            <MVIcon name="check" size={12} color={FT.acText} strokeWidth={3}/>
            <span style={{ fontFamily: FT.mono, fontSize: 10, fontWeight: 500, letterSpacing: '0.16em', textTransform: 'uppercase', color: FT.acText }}>Plan ready</span>
          </div>
        )}
        <FTitle size={30}>
          {done ? <>{approved.length} task{approved.length === 1 ? '' : 's'}<br/><FAccent>on your radar.</FAccent></>
                : <>Your bike's<br/><FAccent>maintenance plan.</FAccent></>}
        </FTitle>
        <div style={{ fontSize: 13.5, color: FT.ink2, lineHeight: 1.45, maxWidth: 320, marginTop: 8 }}>
          {done ? <>Pre-loaded for <b style={{ color: FT.ink }}>{label}</b> — we'll remind you before each one's due.</>
                : <>Swipe right to add to <b style={{ color: FT.ink }}>{label}</b>, left to skip.</>}
        </div>
      </div>

      {!done ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 26px 0' }}>
            <div style={{ fontFamily: FT.mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.16em', color: FT.ink3 }}>
              {String(idx + 1).padStart(2, '0')} <span style={{ color: FT.ink4 }}>/ {String(tasks.length).padStart(2, '0')}</span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {tasks.map((_, i) => (
                <div key={i} style={{ width: i === idx ? 16 : 4, height: 4, borderRadius: 2,
                      background: i < idx ? (approved.includes(tasks[i].id) ? FT.green : FT.ink4) : i === idx ? brandC : 'rgba(244,239,233,0.12)',
                      transition: 'all .25s ease' }}/>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, position: 'relative', margin: '14px 24px 2px', display: 'grid', placeItems: 'center', minHeight: 0 }}>
            <div style={{ position: 'relative', width: '100%', height: 332 }}>
              {tasks.slice(idx + 1, idx + 3).map((task, i) => {
                const d = i + 1;
                return (
                  <div key={`b-${task.id}`} style={{ position: 'absolute', inset: 0,
                        transform: `scale(${1 - d * 0.035}) translateY(${d * 12}px)`, opacity: 1 - d * 0.2,
                        transition: 'transform .28s cubic-bezier(.4,0,.2,1), opacity .28s', zIndex: 10 - d, pointerEvents: 'none' }}>
                    <FMCard task={task} depth={d} brandC={brandC}/>
                  </div>
                );
              })}
              {cur && (
                <div key={`t-${cur.id}`} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
                      onPointerCancel={() => setDrag(null)}
                      style={{ position: 'absolute', inset: 0, transform: topT, transition: topTr, zIndex: 20,
                              touchAction: 'none', cursor: drag ? 'grabbing' : 'grab' }}>
                  <FMCard task={cur} depth={0} brandC={brandC} dragX={dragX} flying={flying}/>
                </div>
              )}
            </div>
          </div>

          <div style={{ padding: '0 28px 8px', display: 'flex', gap: 18, justifyContent: 'center', alignItems: 'center' }}>
            <button onClick={() => commit('left')} style={roundBtn(FT.ink3)}>
              <MVIcon name="close" size={22} color={FT.ink2} strokeWidth={2.5}/></button>
            <div style={{ fontFamily: FT.mono, fontSize: 10, letterSpacing: '0.16em', color: FT.ink4, textTransform: 'uppercase', textAlign: 'center', minWidth: 70 }}>Swipe<br/>or tap</div>
            <button onClick={() => commit('right')} style={roundBtn(FT.green)}>
              <MVIcon name="check" size={22} color={FT.green} strokeWidth={2.5}/></button>
          </div>
          <div style={{ padding: '0 28px 26px' }}>
            <FSkip label="Skip — I'll set this up later" onPress={skipAll} style={{ marginTop: 4 }}/>
          </div>
        </>
      ) : (
        <>
          <div style={{ flex: 1, overflow: 'auto', padding: '20px 22px 8px' }}>
            {approved.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {approved.map((id, i) => {
                  const t = tasks.find(x => x.id === id);
                  return (
                    <div key={id} className="fm-row" style={{ animationDelay: `${i * 50}ms`,
                          padding: '12px 14px', borderRadius: 14, background: FT.card, border: `1px solid ${FT.line}`,
                          display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: `color-mix(in srgb, ${brandC} 18%, #262320)`,
                            display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <MVIcon name={t.icon} size={17} color={brandC}/>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: FT.ink }}>{t.title}</div>
                        <div style={{ fontFamily: FT.mono, fontSize: 11, color: FT.ink3, letterSpacing: '0.04em', marginTop: 2 }}>{t.interval} · {t.cost}</div>
                      </div>
                      <div style={{ width: 6, height: 6, borderRadius: 3, background: IMP_C[t.imp] }}/>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: '28px 8px', textAlign: 'center', fontSize: 14, color: FT.ink3, lineHeight: 1.5 }}>
                No tasks added — you can build a plan anytime from your bike's details.
              </div>
            )}
          </div>
          <div style={{ padding: '12px 20px 30px' }}>
            <FButton label="Continue" onPress={cont}/>
          </div>
        </>
      )}
      <style>{`
        @keyframes fmRow { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform:none; } }
        .fm-row { animation: fmRow .38s cubic-bezier(.2,.7,.2,1) both; }
      `}</style>
    </div>
  );
};
const roundBtn = (c) => ({ width: 60, height: 60, borderRadius: 30, background: FT.card,
  border: `1.5px solid color-mix(in srgb, ${c} 50%, transparent)`, display: 'grid', placeItems: 'center',
  cursor: 'pointer', boxShadow: '0 6px 16px rgba(0,0,0,0.3)', WebkitTapHighlightColor: 'transparent' });

Object.assign(window, { F05Garage, F06Goals, F07Maintenance, F_GOALS, F_TASKS });
