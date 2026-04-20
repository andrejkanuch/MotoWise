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
  { href: '/trip-planning', title: 'Trip planning', desc: 'Turn a map into a day' },
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
        .nf-code{font-family:var(--font-geist-mono,'Geist Mono',monospace);font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--mv-ink-3);display:flex;align-items:center;gap:10px;margin-bottom:28px}
        .nf-code .dot{width:6px;height:6px;border-radius:50%;background:var(--mv-warm-500);box-shadow:0 0 16px var(--mv-warm-500);animation:nfPulse 2s ease-in-out infinite}
        @keyframes nfPulse{0%,100%{opacity:.5;transform:scale(.8)}50%{opacity:1;transform:scale(1.15)}}
        .nf-title{font-weight:400;font-size:clamp(64px,9vw,132px);line-height:.9;letter-spacing:-.03em;color:var(--mv-ink);margin:0 0 28px}
        .nf-title .stroke{font-style:italic;color:var(--mv-warm-400);position:relative}
        .nf-title .stroke::after{content:"";position:absolute;left:0;right:0;bottom:12%;height:3px;background:var(--mv-warm-500);transform-origin:left;animation:strokeIn 1.2s var(--mv-ease-expo) .4s both}
        @keyframes strokeIn{from{transform:scaleX(0)}to{transform:scaleX(1)}}
        .nf-lede{max-width:440px;font-size:17px;line-height:1.55;color:var(--mv-ink-2);margin:0 0 40px;text-wrap:pretty}
        .nf-lede em{font-style:italic;color:var(--mv-ink)}
        .nf-actions{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:56px}
        .nf-btn{display:inline-flex;align-items:center;gap:10px;padding:13px 22px;border-radius:999px;font-weight:500;font-size:14px;text-decoration:none;transition:transform .4s var(--mv-ease),background .3s,border-color .3s,color .3s;cursor:pointer;border:1px solid transparent;font-family:inherit}
        .nf-btn-primary{background:var(--mv-ink);color:oklch(.15 .02 55)}
        .nf-btn-primary:hover{transform:translateY(-1px);background:var(--mv-warm-400)}
        .nf-btn-ghost{border-color:var(--mv-line);color:var(--mv-ink-2);background:transparent}
        .nf-btn-ghost:hover{border-color:var(--mv-warm-500);color:var(--mv-ink);transform:translateY(-1px)}
        .nf-btn svg{transition:transform .4s var(--mv-ease)}
        .nf-btn:hover svg{transform:translateX(3px)}
        .nf-whereto{border-top:1px solid var(--mv-line);padding-top:28px}
        .nf-whereto-label{font-family:var(--font-geist-mono,'Geist Mono',monospace);font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--mv-ink-3);margin-bottom:18px}
        .nf-links{display:grid;grid-template-columns:1fr 1fr;gap:2px;max-width:560px}
        @media(max-width:600px){.nf-links{grid-template-columns:1fr}}
        .nf-link{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 18px;text-decoration:none;color:var(--mv-ink);background:oklch(1 0 0/.02);border:1px solid var(--mv-line);border-radius:14px;transition:background .3s,border-color .3s,transform .4s var(--mv-ease)}
        .nf-link:hover{background:oklch(1 0 0/.04);border-color:var(--mv-warm-500);transform:translateY(-2px)}
        .nf-link-title{font-size:14px;font-weight:500}
        .nf-link-desc{font-size:12px;color:var(--mv-ink-3);margin-top:4px}
        .nf-link svg{color:var(--mv-ink-3);transition:color .3s,transform .4s var(--mv-ease);flex-shrink:0}
        .nf-link:hover svg{color:var(--mv-warm-400);transform:translate(3px,-3px)}
        .nf-stage{position:relative;overflow:hidden;background:linear-gradient(150deg,oklch(.14 .02 60) 0%,oklch(.09 .008 55) 100%);border-left:1px solid var(--mv-line)}
        @media(max-width:900px){.nf-stage{border-left:0;border-bottom:1px solid var(--mv-line)}}
        .nf-glow{position:absolute;top:-20%;right:-20%;width:120%;height:80%;background:radial-gradient(ellipse at center,oklch(.76 .18 60/.25),transparent 60%);filter:blur(40px);pointer-events:none}
        .nf-topo{position:absolute;inset:0;opacity:.5}
        .nf-topo path{fill:none;stroke:var(--mv-warm-500);stroke-width:.6;opacity:.35}
        .nf-topo .topo-far{opacity:.12}
        .nf-route{position:absolute;inset:0;z-index:2}
        .nf-route .road{fill:none;stroke:var(--mv-ink);stroke-width:2.4;stroke-linecap:round;opacity:.9;stroke-dasharray:8 6;animation:roadDash 4s linear infinite}
        .nf-route .road-glow{fill:none;stroke:var(--mv-warm-400);stroke-width:8;stroke-linecap:round;opacity:.35;filter:blur(6px)}
        @keyframes roadDash{to{stroke-dashoffset:-140}}
        .nf-route .pin{fill:var(--mv-warm-500)}
        .nf-route .pin-ring{fill:none;stroke:var(--mv-warm-500);stroke-width:2;transform-origin:center;animation:pinPulse 2.2s ease-out infinite}
        @keyframes pinPulse{0%{transform:scale(.6);opacity:.9}100%{transform:scale(2.6);opacity:0}}
        .nf-compass{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:min(58%,440px);aspect-ratio:1;z-index:3;pointer-events:none;animation:compassFloat 8s ease-in-out infinite}
        @keyframes compassFloat{0%,100%{transform:translate(-50%,-50%)}50%{transform:translate(-50%,calc(-50% - 14px))}}
        .nf-compass-ring{position:absolute;inset:0;border-radius:50%;border:1px solid oklch(1 0 0/.12)}
        .nf-compass-ring.ring-2{inset:8%;border-color:oklch(1 0 0/.08)}
        .nf-compass-ring.ring-3{inset:18%;border-color:oklch(1 0 0/.05)}
        .nf-compass-ticks{position:absolute;inset:0;animation:compassSpin 60s linear infinite}
        @keyframes compassSpin{to{transform:rotate(360deg)}}
        .nf-compass-needle{position:absolute;top:50%;left:50%;width:3px;height:44%;transform-origin:50% 100%;transform:translate(-50%,-100%) rotate(0deg);animation:needleWobble 3.2s ease-in-out infinite}
        .nf-compass-needle::before,.nf-compass-needle::after{content:"";position:absolute;left:50%;width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent}
        .nf-compass-needle::before{top:0;border-bottom:50px solid var(--mv-warm-500);transform:translateX(-50%)}
        .nf-compass-needle::after{bottom:0;border-top:40px solid oklch(.4 .012 60);transform:translateX(-50%)}
        @keyframes needleWobble{0%,100%{transform:translate(-50%,-100%) rotate(-38deg)}25%{transform:translate(-50%,-100%) rotate(42deg)}50%{transform:translate(-50%,-100%) rotate(-12deg)}75%{transform:translate(-50%,-100%) rotate(58deg)}}
        .nf-compass-center{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:18px;height:18px;border-radius:50%;background:var(--mv-bg);border:2px solid var(--mv-warm-500);box-shadow:0 0 24px var(--mv-warm-500)}
        .nf-compass-label{position:absolute;font-family:var(--font-geist-mono,'Geist Mono',monospace);font-size:12px;font-weight:500;letter-spacing:.15em;color:var(--mv-ink)}
        .nf-compass-label.n{top:4%;left:50%;transform:translateX(-50%)}
        .nf-compass-label.s{bottom:4%;left:50%;transform:translateX(-50%);color:var(--mv-ink-3)}
        .nf-compass-label.e{right:4%;top:50%;transform:translateY(-50%);color:var(--mv-ink-3)}
        .nf-compass-label.w{left:4%;top:50%;transform:translateY(-50%);color:var(--mv-ink-3)}
        .nf-telemetry{position:absolute;bottom:32px;left:32px;display:flex;flex-direction:column;gap:4px;font-family:var(--font-geist-mono,'Geist Mono',monospace);font-size:11px;color:var(--mv-ink-3);z-index:4}
        .nf-telemetry-row{display:flex;gap:14px;align-items:baseline}
        .nf-telemetry-key{color:var(--mv-ink-4);text-transform:uppercase;letter-spacing:.18em;min-width:68px}
        .nf-telemetry-val{color:var(--mv-ink);font-variant-numeric:tabular-nums}
        .nf-telemetry-val.warn{color:var(--mv-warm-400)}
        .nf-stagetag{position:absolute;top:32px;right:32px;font-family:var(--font-geist-mono,'Geist Mono',monospace);font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--mv-ink-3);display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--mv-line);border-radius:999px;background:oklch(1 0 0/.02);backdrop-filter:blur(10px);z-index:4}
        .nf-stagetag::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--mv-warm-500);box-shadow:0 0 10px var(--mv-warm-500)}
      `}</style>

      <main className="nf">
        {/* LEFT: message */}
        <section className="nf-msg">
          <div className="nf-code">
            <span className="dot" />
            Error 404 &middot; Route not found
          </div>

          <h1 className="nf-title mv-serif">
            Wrong
            <br />
            <span className="stroke">turn.</span>
          </h1>

          <p className="nf-lede">
            Looks like the road you were following <em className="mv-serif">doesn&apos;t exist</em>{' '}
            anymore — maybe it was re-routed, maybe you just typed one letter wrong. Either way,
            there&apos;s plenty of open asphalt from here.
          </p>

          <div className="nf-actions">
            <Link className="nf-btn nf-btn-primary" href="/">
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
          <div className="nf-glow" />

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
              className="road-glow"
              d="M 80 720 C 160 620, 120 500, 240 460 S 380 400, 360 300 S 260 200, 340 120 L 420 100"
            />
            <path
              className="road"
              d="M 80 720 C 160 620, 120 500, 240 460 S 380 400, 360 300 S 260 200, 340 120 L 420 100"
            />
            {/* Start pin */}
            <circle className="pin" cx="80" cy="720" r="6" />
            {/* End pin (destination doesn't exist) w/ ring pulse */}
            <g transform="translate(420 100)">
              <circle className="pin-ring" r="7" />
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
            <svg className="nf-compass-ticks" viewBox="0 0 100 100">
              <g stroke="oklch(1 0 0 / 0.25)" strokeLinecap="round">
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
