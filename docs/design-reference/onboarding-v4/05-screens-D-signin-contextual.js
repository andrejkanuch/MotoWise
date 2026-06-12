// =============================================================================
// MotoVault — Onboarding flow — SCREENS D (standalone surfaces)
// S1 Sign in (returning users) · CP Contextual account prompt (free users)
// Not part of the linear 12-step flow — entered contextually.
// =============================================================================

const { AppleGlyph, GoogleGlyph, authBtn, authInput } = window;

// ── S1 — SIGN IN (returning users) ───────────────────────────────────────────
const F_S1SignIn = ({ go, startErr }) => {
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(!!startErr);
  const proceed = () => { setBusy(true); setTimeout(() => go('12-personalizing')(), 1000); };

  return (
    <div style={{ position: 'relative', height: '100%', background: FT.bg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: '-20% -20% auto -20%', height: '46%',
            background: 'radial-gradient(ellipse 60% 80% at 50% 14%, color-mix(in srgb, var(--ac) 18%, transparent) 0%, transparent 70%)',
            filter: 'blur(28px)', pointerEvents: 'none' }}/>
      <FGrain/>
      <FBack onPress={go('02-welcome')}/>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 26px' }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, overflow: 'hidden', background: 'var(--ac)', marginBottom: 22,
              boxShadow: '0 10px 30px color-mix(in srgb, var(--ac) 30%, transparent)' }}>
          <img src={__res('logo', 'assets/logo.png')} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
        </div>
        <FTitle size={36} style={{ marginBottom: 10 }}>Welcome<br/><FAccent>back.</FAccent></FTitle>
        <div style={{ fontSize: 14.5, color: FT.ink2, lineHeight: 1.45, maxWidth: 320, marginBottom: 24 }}>
          Sign in to access your garage on this device.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 16 }}>
          <button onClick={proceed} style={authBtn('#fff', '#000')}>
            <AppleGlyph c="#000"/> Continue with Apple
          </button>
          <button onClick={proceed} style={authBtn(FT.card, FT.ink, FT.line)}>
            <GoogleGlyph/> Continue with Google
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: FT.line }}/>
          <span style={{ fontFamily: FT.mono, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: FT.ink4 }}>or continue with email</span>
          <div style={{ flex: 1, height: 1, background: FT.line }}/>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input placeholder="Email" defaultValue={startErr ? 'alex@rider.cc' : ''} style={authInput}/>
          <input placeholder="Password" type="password" style={authInput}/>
          {err && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: FT.danger, lineHeight: 1.4 }}>
              <MVIcon name="close" size={14} color={FT.danger} strokeWidth={2.5}/>
              <span>No account found. <span onClick={go('02-welcome')} style={{ color: FT.acText, fontWeight: 600, cursor: 'pointer' }}>Create one?</span></span>
            </div>
          )}
          <FButton label="Sign In" icon={null} onPress={proceed}/>
          <div style={{ textAlign: 'center', marginTop: 4 }}>
            <span style={{ fontSize: 12.5, color: FT.ink3, cursor: 'pointer', fontWeight: 500 }}>Restore purchases</span>
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 26px 30px', textAlign: 'center' }}>
        <span style={{ fontSize: 13, color: FT.ink3 }}>New here? </span>
        <span onClick={go('02-welcome')} style={{ fontSize: 13, color: FT.acText, fontWeight: 600, cursor: 'pointer' }}>Get started</span>
      </div>

      {busy && (
        <div style={{ position: 'absolute', inset: 0, background: `${FT.bg}e6`, display: 'grid', placeItems: 'center', zIndex: 30 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div className="auth-spin" style={{ width: 42, height: 42, borderRadius: 21, border: `3px solid ${FT.line}`, borderTopColor: 'var(--ac)' }}/>
            <div style={{ fontSize: 13.5, color: FT.ink2 }}>Signing you in…</div>
          </div>
        </div>
      )}
      <style>{`@keyframes authSpin { to { transform: rotate(360deg); } } .auth-spin { animation: authSpin .8s linear infinite; }`}</style>
    </div>
  );
};

// ── CP — CONTEXTUAL ACCOUNT PROMPT (free users, value-linked bottom sheet) ───
const FCPPrompt = ({ context = 'ride' }) => {
  const noun = { ride: 'ride', expense: 'expense', bike: 'bike' }[context] || 'ride';
  const verb = { ride: 'Save this ride', expense: 'Save this expense', bike: 'Save this bike' }[context] || 'Save this ride';

  return (
    <div style={{ position: 'relative', height: '100%', background: FT.bg, overflow: 'hidden' }}>
      {/* faint app underneath — there's already something worth saving */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.5 }}>
        <div style={{ padding: '62px 22px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <MVIcon name="check" size={16} color={FT.green} strokeWidth={3}/>
            <span style={{ fontFamily: FT.mono, fontSize: 11, letterSpacing: '0.14em', color: FT.ink3, textTransform: 'uppercase' }}>{verb}</span>
          </div>
          <div style={{ height: 168, borderRadius: 18, background: FT.card, border: `1px solid ${FT.line}` }}/>
          <div style={{ height: 58, borderRadius: 14, background: FT.card, border: `1px solid ${FT.line}`, marginTop: 12 }}/>
          <div style={{ height: 58, borderRadius: 14, background: FT.card, border: `1px solid ${FT.line}`, marginTop: 10 }}/>
        </div>
      </div>
      {/* scrim */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }}/>

      {/* bottom sheet */}
      <div className="cp-sheet" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, borderRadius: '26px 26px 0 0',
            background: FT.bg, borderTop: `1px solid ${FT.line}`, padding: '12px 22px 30px',
            boxShadow: '0 -24px 60px rgba(0,0,0,0.55)' }}>
        <div style={{ width: 38, height: 4, borderRadius: 2, background: FT.ink4, margin: '0 auto 20px' }}/>
        <div style={{ width: 52, height: 52, borderRadius: 16, marginBottom: 16,
              background: 'color-mix(in srgb, var(--ac) 18%, #1E1C19)', border: '1px solid color-mix(in srgb, var(--ac) 34%, transparent)',
              display: 'grid', placeItems: 'center' }}>
          <MVIcon name="bookmark" size={24} color={FT.acText}/>
        </div>
        <FTitle size={28} style={{ marginBottom: 8 }}>Save this to<br/><FAccent>your garage.</FAccent></FTitle>
        <div style={{ fontSize: 14, color: FT.ink2, lineHeight: 1.45, marginBottom: 20, maxWidth: 320 }}>
          Create a free account so your {noun} is backed up and synced across your devices.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button style={authBtn('#fff', '#000')}><AppleGlyph c="#000"/> Continue with Apple</button>
          <button style={authBtn(FT.card, FT.ink, FT.line)}><GoogleGlyph/> Continue with Google</button>
          <button style={authBtn('transparent', FT.ink2, FT.line)}><MVIcon name="send" size={16} color={FT.ink2}/> Continue with email</button>
        </div>
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <span style={{ fontSize: 13, color: FT.ink3, fontWeight: 500, cursor: 'pointer' }}>Not now</span>
        </div>
      </div>
      <style>{`
        @keyframes cpRise { from { transform: translateY(60px); opacity:.6; } to { transform: none; opacity:1; } }
        .cp-sheet { animation: cpRise .42s cubic-bezier(.2,.7,.2,1) both; }
      `}</style>
    </div>
  );
};

Object.assign(window, { F_S1SignIn, FCPPrompt });
