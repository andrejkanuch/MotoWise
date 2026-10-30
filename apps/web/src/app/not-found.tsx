import Link from 'next/link';
import '@/components/marketing/design-system.css';
import { GoBackButton, TelemetryHeading, TelemetryPath } from '@/components/not-found-client';

// Root-level not-found.tsx has no access to the [locale] segment,
// so next-intl translations are unavailable here. Strings are hardcoded in English.
// See: https://next-intl.dev/docs/environments/error-files

const ARROW_ICON = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <line x1="7" y1="17" x2="17" y2="7" />
    <polyline points="7 7 17 7 17 17" />
  </svg>
);

const WHERE_TO_LINKS = [
  { href: '/explore', title: 'Explore routes', desc: 'Find rides by country or vibe' },
  { href: '/features/trip-planning', title: 'Trip planning', desc: 'Turn a map into a day' },
  { href: '/#features', title: 'Garage', desc: 'Every bike, every record' },
  { href: '/#features', title: 'AI diagnostics', desc: 'Describe a sound, get a clue' },
] as const;

export default function NotFound() {
  return (
    <div className="mv-marketing" style={{ minHeight: '100vh' }}>
      <style>{`
        .nf{min-height:100vh;display:grid;grid-template-columns:1.15fr 1fr;align-items:stretch;overflow:hidden;position:relative}
        @media(max-width:900px){.nf{grid-template-columns:1fr}.nf-stage{min-height:52vh;order:-1}}
        .nf-msg{padding:160px 72px 80px;display:flex;flex-direction:column;justify-content:center;position:relative;z-index:2;background:var(--mv-bg)}
        @media(max-width:900px){.nf-msg{padding:40px 28px 72px}}
        .nf-code{font-family:var(--mv-font-body);font-size:13px;font-weight:500;color:var(--mv-ink-3);margin-bottom:28px}
        .nf-title{font-family:var(--mv-font-display);font-weight:700;font-size:clamp(64px,9vw,132px);line-height:.92;letter-spacing:.002em;color:var(--mv-ink);margin:0 0 28px}
        .nf-lede{max-width:440px;font-size:17px;line-height:1.55;color:var(--mv-ink-2);margin:0 0 40px;text-wrap:pretty}
        .nf-actions{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:56px}
        .nf-btn{display:inline-flex;align-items:center;gap:10px;padding:14px 22px;border-radius:var(--mv-radius-control);font-family:var(--mv-font-body);font-weight:600;font-size:14px;cursor:pointer}
        .nf-btn-ghost{background:var(--mv-surface-2);color:var(--mv-ink);border:1px solid var(--mv-line);transition:background .25s,border-color .25s,transform .2s var(--mv-ease)}
        .nf-btn-ghost:hover{background:var(--mv-surface-3);border-color:var(--mv-line-step);transform:translateY(-1px)}
        .nf-whereto{border-top:1px solid var(--mv-line);padding-top:28px}
        .nf-whereto-label{font-family:var(--mv-font-body);font-size:13px;font-weight:500;color:var(--mv-ink-3);margin-bottom:10px}
        .nf-links{display:grid;grid-template-columns:1fr 1fr;column-gap:40px;max-width:560px}
        @media(max-width:600px){.nf-links{grid-template-columns:1fr}}
        .nf-link{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 0;text-decoration:none;color:var(--mv-ink);border-top:1px solid var(--mv-line);transition:color .2s}
        .nf-link-title{font-size:14px;font-weight:500}
        .nf-link-desc{font-size:12px;color:var(--mv-ink-3);margin-top:4px}
        .nf-link svg{color:var(--mv-ink-3);transition:color .2s,transform .4s var(--mv-ease);flex-shrink:0}
        .nf-link:hover svg{color:var(--mv-copper-text);transform:translate(3px,-3px)}
        .nf-stage{position:relative;overflow:hidden;background:var(--mv-bg-2);border-left:1px solid var(--mv-line)}
        @media(max-width:900px){.nf-stage{border-left:0;border-bottom:1px solid var(--mv-line)}}
        .nf-topo{position:absolute;inset:0}
        .nf-topo path{fill:none;stroke:var(--mv-line-step);stroke-width:.6;opacity:.35}
        .nf-topo .topo-far{opacity:.12}
        .nf-route{position:absolute;inset:0;z-index:2}
        .nf-route .road{fill:none;stroke:var(--mv-ink-3);stroke-width:2.4;stroke-linecap:round;opacity:.9;stroke-dasharray:8 6}
        .nf-route .pin{fill:var(--mv-ink-3)}
        .nf-compass{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:min(58%,440px);aspect-ratio:1;z-index:3;pointer-events:none}
        .nf-compass-ring{position:absolute;inset:0;border-radius:50%;border:1px solid var(--mv-line)}
        .nf-compass-ring.ring-2{inset:8%;border-color:var(--mv-line-2)}
        .nf-compass-ring.ring-3{inset:18%;border-color:var(--mv-line-2)}
        .nf-compass-needle{position:absolute;top:50%;left:50%;width:3px;height:44%;transform-origin:50% 100%;transform:translate(-50%,-100%) rotate(-38deg)}
        .nf-compass-needle::before,.nf-compass-needle::after{content:"";position:absolute;left:50%;width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent}
        .nf-compass-needle::before{top:0;border-bottom:50px solid var(--mv-ink-2);transform:translateX(-50%)}
        .nf-compass-needle::after{bottom:0;border-top:40px solid var(--mv-ink-4);transform:translateX(-50%)}
        .nf-compass-center{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:18px;height:18px;border-radius:50%;background:var(--mv-bg);border:2px solid var(--mv-line-step)}
        .nf-compass-label{position:absolute;font-family:var(--mv-font-display);font-size:14px;font-weight:600;color:var(--mv-ink)}
        .nf-compass-label.n{top:4%;left:50%;transform:translateX(-50%)}
        .nf-compass-label.s{bottom:4%;left:50%;transform:translateX(-50%);color:var(--mv-ink-3)}
        .nf-compass-label.e{right:4%;top:50%;transform:translateY(-50%);color:var(--mv-ink-3)}
        .nf-compass-label.w{left:4%;top:50%;transform:translateY(-50%);color:var(--mv-ink-3)}
        .nf-telemetry{position:absolute;bottom:32px;left:32px;display:flex;flex-direction:column;gap:4px;font-family:var(--mv-font-body);font-size:12px;color:var(--mv-ink-3);z-index:4}
        .nf-telemetry-row{display:flex;gap:14px;align-items:baseline}
        .nf-telemetry-key{color:var(--mv-ink-4);min-width:68px;font-weight:500}
        .nf-telemetry-val{color:var(--mv-ink);font-family:var(--mv-font-display);font-weight:600;font-variant-numeric:tabular-nums}
        .nf-telemetry-val.warn{color:var(--mv-ink-2)}
        .nf-stagetag{position:absolute;top:32px;right:32px;font-family:var(--mv-font-body);font-size:12px;font-weight:500;color:var(--mv-ink-2);display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--mv-line);border-radius:999px;background:var(--mv-surface);z-index:4}
      `}</style>

      <main className="nf">
        {/* LEFT: message */}
        <section className="nf-msg">
          <div className="nf-code">Error 404 &middot; Route not found</div>

          <h1 className="nf-title">
            Wrong
            <br />
            turn.
          </h1>

          <p className="nf-lede">
            Looks like the road you were following doesn&apos;t exist anymore — maybe it was
            re-routed, maybe you just typed one letter wrong. Either way, there&apos;s plenty of
            open asphalt from here.
          </p>

          <div className="nf-actions">
            <Link className="mv-btn mv-btn-primary" href="/">
              Take me home
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
            <GoBackButton />
          </div>

          <div className="nf-whereto">
            <div className="nf-whereto-label">Where to instead</div>
            <div className="nf-links">
              {WHERE_TO_LINKS.map((link) => (
                <Link key={link.href + link.title} className="nf-link" href={link.href}>
                  <div>
                    <div className="nf-link-title">{link.title}</div>
                    <div className="nf-link-desc">{link.desc}</div>
                  </div>
                  {ARROW_ICON}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* RIGHT: stage */}
        <section className="nf-stage">
          {/* Topographic lines */}
          <svg
            className="nf-topo"
            viewBox="0 0 600 800"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
          >
            <g className="topo-far">
              <path d="M -20 120 Q 120 60 260 100 T 620 140" />
              <path d="M -20 180 Q 140 110 280 150 T 620 200" />
              <path d="M -20 680 Q 180 600 340 650 T 640 700" />
              <path d="M -20 740 Q 180 660 340 710 T 640 760" />
            </g>
            <g>
              <path d="M -20 260 Q 160 200 300 240 T 620 300" />
              <path d="M -20 320 Q 180 270 320 300 T 640 360" />
              <path d="M -20 400 Q 200 340 340 380 T 660 440" />
              <path d="M -20 460 Q 220 400 360 440 T 680 500" />
              <path d="M -20 540 Q 220 480 380 520 T 680 580" />
              <path d="M -20 600 Q 240 540 400 580 T 700 640" />
            </g>
          </svg>

          {/* Route + pins */}
          <svg
            className="nf-route"
            viewBox="0 0 600 800"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
          >
            <path
              className="road"
              d="M 80 720 C 160 620, 120 500, 240 460 S 380 400, 360 300 S 260 200, 340 120 L 420 100"
            />
            {/* Start pin */}
            <circle className="pin" cx="80" cy="720" r="6" />
            {/* End pin (destination doesn't exist) */}
            <g transform="translate(420 100)">
              <circle className="pin" r="7" />
              <line
                x1="-14"
                y1="-14"
                x2="14"
                y2="14"
                stroke="var(--mv-ink)"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <line
                x1="14"
                y1="-14"
                x2="-14"
                y2="14"
                stroke="var(--mv-ink)"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </g>
          </svg>

          {/* Compass */}
          <div className="nf-compass" aria-hidden="true">
            <div className="nf-compass-ring" />
            <div className="nf-compass-ring ring-2" />
            <div className="nf-compass-ring ring-3" />
            <svg viewBox="0 0 100 100" aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
              <title>Compass ticks</title>
              <g stroke="var(--mv-line-step)" strokeLinecap="round">
                <line x1="50" y1="3" x2="50" y2="8" />
                <line x1="73.5" y1="9.3" x2="71" y2="13.7" />
                <line x1="90.7" y1="26.5" x2="86.3" y2="29" />
                <line x1="97" y1="50" x2="92" y2="50" />
                <line x1="90.7" y1="73.5" x2="86.3" y2="71" />
                <line x1="73.5" y1="90.7" x2="71" y2="86.3" />
                <line x1="50" y1="97" x2="50" y2="92" />
                <line x1="26.5" y1="90.7" x2="29" y2="86.3" />
                <line x1="9.3" y1="73.5" x2="13.7" y2="71" />
                <line x1="3" y1="50" x2="8" y2="50" />
                <line x1="9.3" y1="26.5" x2="13.7" y2="29" />
                <line x1="26.5" y1="9.3" x2="29" y2="13.7" />
              </g>
            </svg>
            <div className="nf-compass-label n">N</div>
            <div className="nf-compass-label e">E</div>
            <div className="nf-compass-label s">S</div>
            <div className="nf-compass-label w">W</div>
            <div className="nf-compass-needle" />
            <div className="nf-compass-center" />
          </div>

          <div className="nf-stagetag">Signal lost</div>

          <div className="nf-telemetry">
            <div className="nf-telemetry-row">
              <span className="nf-telemetry-key">Status</span>
              <span className="nf-telemetry-val warn">Rerouting&hellip;</span>
            </div>
            <div className="nf-telemetry-row">
              <span className="nf-telemetry-key">Heading</span>
              <TelemetryHeading />
            </div>
            <div className="nf-telemetry-row">
              <span className="nf-telemetry-key">Path</span>
              <TelemetryPath />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
