# MotoVault — Cinematic Homepage Generation Prompt

Use this prompt with an AI code generator (Cursor, Claude, v0, etc.) to produce a production-ready Next.js homepage.

---

## The Prompt

```
Build a cinematic, dark-themed single-page marketing homepage for "MotoVault" — an AI-powered motorcycle learning & diagnostics platform. The page should feel like a premium automotive command center: dark, moody, high-contrast, with teal/cyan and signature orange accents against near-black backgrounds.

### TECH STACK & CONSTRAINTS
- Next.js 16 (App Router), TypeScript, Tailwind CSS 4
- Server component (no "use client" on the page itself — individual sections can be client components for animations)
- Use `next-intl` for all user-facing strings (getTranslations / useTranslations)
- Font: "Plus Jakarta Sans" for body, a condensed/impact italic display font (like "Barlow Condensed" or "Oswald") for hero headlines
- All colors via Tailwind — see palette below
- Animations: Framer Motion (scroll-triggered reveals, parallax, stagger)
- Icons: Lucide React
- Responsive: mobile-first, stunning on desktop (max-w-7xl container)

### COLOR PALETTE (Tailwind tokens)
- **Background:** #0D0F14 (near-black with slight blue undertone), cards use #14161D
- **Surface/Cards:** #1A1C25 with subtle 1px border of rgba(255,255,255,0.06)
- **Primary accent (teal/cyan):** #00E5CC (highlights, icon accents, active states, data viz)
- **Signature accent (orange):** #E8723A (CTA buttons, "hot" highlights, warning states, key emphasis words in headlines)
- **Text primary:** #FFFFFF
- **Text secondary:** #8B8FA3 (muted descriptions)
- **Text tertiary:** #4A4E63 (labels, section numbers)
- **Gradient overlays:** subtle linear-gradient from transparent to #0D0F14 on hero images
- **Glow effects:** box-shadow with rgba(0,229,204,0.15) for teal elements, rgba(232,114,58,0.2) for orange CTAs

### TYPOGRAPHY STYLE
- Hero headline: ALL CAPS, bold italic condensed font, ~72-96px on desktop. Key words in orange italic (e.g., "BEYOND THE **ASPHALT.** INTO THE **VAULT.**" where bold italic words are orange)
- Section labels: Monospace/code-style, uppercase, teal color, letter-spaced (e.g., "SECTION 01 // DIAGNOSTICS")
- Section titles: Large condensed bold, mix of white + orange italic for emphasis words (e.g., "MASTER THE *MACHINE.*" where MACHINE is orange italic)
- Body text: 16-18px, neutral-400 (#8B8FA3), 1.6 line-height

### NAVIGATION (TopAppBar / Navbar)
- Fixed/sticky, transparent on top → blurred dark on scroll
- Left: "MotoVault" logo wordmark in white, bold
- Center nav links: VAULT · SECURITY · AI DIAGNOSTICS · LEARNING PATHS · GARAGE MANAGEMENT
- Right: orange outlined CTA button "ACCESS VAULT"
- Active link has teal underline indicator
- Mobile: hamburger menu with slide-in drawer

### SECTION 1 — HERO (Full viewport height)
- Full-bleed cinematic background: a high-energy motorcycle visual (enduro bike cutting through space/motion blur with speed lines and atmospheric haze) — use a dark gradient overlay from left to right so text on the left remains readable
- Top-left: small teal pill badge "✦ SYSTEM STATUS: OPTIMAL"
- Large headline (left-aligned, occupying ~50% width):
  "BEYOND THE ASPHALT. INTO THE VAULT."
  → "ASPHALT." and "VAULT." in orange bold italic
- Subtitle below (neutral-400): "The definitive digital command center for high-performance riders. Experience the intersection of raw engine power and unbreakable digital sovereignty."
- Two CTAs side by side:
  1. Orange filled button with arrow: "INITIALIZE PROTOCOL →"
  2. Ghost/outlined button: "VIEW SPECS"
- Bottom of hero: subtle scroll indicator (animated chevron down)
- Parallax: background image moves slower than content on scroll

### SECTION 2 — PREDICTIVE INTELLIGENCE (AI Diagnostics)
- Section label: "SECTION 01 // DIAGNOSTICS"
- Title: "PREDICTIVE *INTELLIGENCE.*" (INTELLIGENCE in orange italic)
- Layout: Split — left side has a dramatic motorcycle engine/diagnostics visual (dark, moody, with teal data overlay graphics), right side has text content
- Description: "Our proprietary AI engine monitors thousands of data points per second. From combustion efficiency to suspension damping, MotoVault predicts maintenance before parts fail, ensuring your machine is always race-ready."
- Two feature callouts with teal circular icons:
  1. 🧠 "NEURAL TUNING" — "Real-time ECU remapping suggestions based on your riding chain."
  2. 📊 "WEAR ANALYSIS" — "Synthetic telemetry predictions and cost-life with 95% accuracy."
- Subtle animated data visualization in the background (particle dots or grid lines in teal at 10% opacity)

### SECTION 3 — MASTER THE MACHINE (Learning Paths)
- Section label: "SECTION 02 // TRAINING"
- Title: "MASTER THE *MACHINE.*" (MACHINE in orange italic)
- Subtitle: "Curated skill-acquisition paths designed for motorbike riders and mechanical engineers."
- Three tier cards in a horizontal row:
  1. **01 — INITIATE** (dark card, subtle border): "Foundational physics of moto control. Mastering balance, throttle modulation, and safety protocols." — "14 MODULES" with arrow
  2. **02 — PRO** (highlighted card, slightly brighter bg, orange "RECOMMENDED" badge top-right): "Advanced track dynamics. Trail braking, apex optimization, and body positioning for high-speed corners." — "18 MODULES" with arrow
  3. **03 — LEGEND** (dark card): "The elite tier. Suspension tuning for conditions, competitive race strategy, and endurance mastery." — "16 MODULES"
- Each card has a large faded number (01, 02, 03) as a watermark in the top-left
- Cards should have hover: slight scale-up + border glow in teal

### SECTION 4 — THE COMMAND CENTER (Garage Management)
- Section label: "SECTION 03 // FLEET"
- Title: "THE COMMAND *CENTER.*" (CENTER in orange italic)
- Description: "Seamlessly track multiple bikes, schedule service intervals, and manage your inventory of custom components from a single, high-fidelity interface."
- UI mockup showcase: a dark dashboard card labeled "ACTIVE HANGAR" showing:
  - Two motorcycle entries: "VORTEX-01" and "NOMAD-42" with status bars (health %, next service)
  - Teal and orange progress bars
  - Small stat chips (MI, TRK/HRS, etc.)
- Left sidebar info: "NEXT MAINTENANCE: 10 Days Rem. (Chain Adjustment)" with a blue calendar icon, and "48 Active Serialized Parts" with a green checkmark icon
- This section should feel like looking at an actual app dashboard — glassmorphism card with subtle inner shadow

### SECTION 5 — VAULT-GRADE ENCRYPTION (Security)
- Full-width section with centered layout
- Large teal lock icon at top (animated subtle pulse glow)
- Title: "VAULT-GRADE *ENCRYPTION.*" (ENCRYPTION in orange italic)
- Description: "Your telemetry is yours alone. Every data packet is protected by AES-256 military-grade encryption and decentralized storage architecture. Not even we can see your laps unless you share them."
- Three security badges in a row:
  1. 🔒 AES-256
  2. 🛡️ DECENTRALIZED STORAGE
  3. ✓ ZERO-KNOWLEDGE PROOFS
- Each badge: small card with icon + label, subtle border, teal icon accent

### SECTION 6 — FINAL CTA / SECURE YOUR LEGACY
- Dark section with centered text
- Headline: "SECURE YOUR LEGACY." in large condensed caps
- Subtitle: "Join thousands of meticulous riders who trust MotoVault with their most essential machine data. Ready to initialize?"
- Single large orange CTA button: "ACCESS YOUR VAULT"
- Subtle animated background (very faint grid or circuit-board pattern)

### FOOTER
- Dark, minimal
- Left: "MOTOVAULT" wordmark
- Center links: Privacy Protocol · Terms of Service · Administrative Panel · Support
- Right: "© 2026 MotoVault. All rights reserved."
- Thin teal top border line

### ANIMATION & INTERACTION DETAILS
- All sections fade-in + slide-up on scroll (Framer Motion `whileInView`)
- Stagger children by 100ms delay
- Hero background: subtle Ken Burns zoom effect (scale 1.0 → 1.05 over 20s)
- Section labels: typewriter-style reveal on scroll
- Cards: hover → translateY(-4px) + box-shadow glow
- CTA buttons: hover → slight scale(1.02) + glow intensify
- Smooth scroll for anchor links
- Parallax depth on hero (0.3 speed ratio)

### OVERALL MOOD & REFERENCES
Think: Tesla's website meets Razer's gaming aesthetic meets a fighter jet HUD. The language is technical, confident, and exclusive ("protocol", "initialize", "hangar", "telemetry", "command center"). Every element should feel precision-engineered. The orange accents pop against the dark cyber-military backdrop like warning indicators on a cockpit dashboard. Whitespace is generous. Typography is bold and commanding.

### FILE STRUCTURE TO GENERATE
- `app/[locale]/(marketing)/page.tsx` — main page (server component, composes sections)
- `components/marketing/navbar.tsx` — sticky nav with scroll behavior
- `components/marketing/hero-cinematic.tsx` — full-viewport hero with parallax
- `components/marketing/predictive-intelligence.tsx` — AI diagnostics section
- `components/marketing/master-the-machine.tsx` — learning paths tier cards
- `components/marketing/command-center.tsx` — garage management dashboard mockup
- `components/marketing/vault-encryption.tsx` — security section
- `components/marketing/cta-final.tsx` — final call to action
- `components/marketing/footer.tsx` — minimal dark footer

Generate complete, production-ready code for each file. No placeholders, no TODOs. Every section fully built with real content, animations, and responsive design.
```

---

*This prompt is derived from the "MotoVault: Cinematic Evolution" design in Google Stitch, combining the best elements from both generated mockups with the actual MotoVault design system tokens and codebase architecture.*
