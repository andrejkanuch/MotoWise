# Design Review Progress — MotoVault Web Homepage

**Target:** `apps/web/src/app/[locale]/(marketing)/page.tsx` + all marketing components
**Domain:** Motorcycle world
**Started:** 2026-03-17

## Design Team
- Agent 1: UX/Accessibility Auditor (/critique + /audit)
- Agent 2: Motorcycle Domain Expert
- Agent 3: Lead Product Designer
- Agent 4: Design System Normalizer (/normalize)
- Agent 5: Typography Specialist (/typeset)
- Agent 6: Layout Specialist (/arrange)
- Agent 7: UX Copy Specialist (/clarify)
- Agent 8: Motion Designer (/animate)
- Agent 9: Delight Specialist (/delight)
- Agent 10: Distillation Expert (/distill)
- Agent 11: Hardening Engineer (/harden)
- Agent 12: Color Specialist (/colorize)
- Agent 13: Responsive Specialist (/adapt)
- Agent 14: Onboarding Expert (/onboard)
- Agent 15: Performance Engineer (/optimize)
- Agent 16: Polish Specialist (/polish)
- Agent 17: Design System Extractor (/extract)
- Agent 18: Bold/Overdrive Specialist (/bolder + /overdrive)

## Iteration 1: DIAGNOSE
- [x] /critique + /audit
- [x] Domain expert review
- [x] Lead designer review
- [x] Synthesis & fixes applied

## Iteration 2: SYSTEMATIZE
- [x] /normalize
- [x] /typeset
- [x] /arrange
- [x] /clarify
- [x] Synthesis & fixes applied

## Iteration 3: ENHANCE + HARDEN
- [x] /animate
- [x] /delight
- [x] /distill
- [x] /harden
- [x] /colorize
- [x] Synthesis & fixes applied

## Iteration 4: POLISH + SHIP
- [x] /adapt
- [x] /optimize
- [x] /polish
- [x] /extract
- [x] /bolder + /overdrive
- [x] Final fixes applied

## Fixes Applied

### Iteration 1 (22 fixes)
1. Fixed WCAG contrast: neutral-500→400 in social-proof, footer, testimonials
2. Fixed footer neutral-600→400 for builtWithAi text
3. CTA section: replaced jarring warm-400 bg with dark theme + warm radial glow
4. CTA section: fixed all text contrast (primary-600/700/800 → neutral-50/300/400)
5. Removed "Cancel anytime" trust badge (contradicts free waitlist)
6. Typography: hero display font-extrabold→font-bold, leading-tight→leading-[1.05]
7. Typography: all section headings font-extrabold→font-bold, reduced sizes by 1 step
8. Social proof: font-extrabold→font-bold, text-6xl→5xl, added gradient text
9. Social proof: removed border-t-2, reduced py-20→py-14, added stat dividers
10. Card differentiation: features=border/backdrop-blur, how-it-works=borderless/shadow, testimonials=gradient-bg
11. Card-lift hover reduced from translateY(-4px) to translateY(-2px)
12. Added section eyebrow labels (Features, How It Works, Testimonials, FAQ)
13. Varied vertical rhythm: features py-36/44, how-it-works py-28, testimonials py-24, faq py-24/28
14. Added focus-visible rings to: hero CTAs, navbar logo/links/CTA/hamburger, FAQ buttons, waitlist form
15. Navbar hamburger: size-10→size-11 (44px min touch target)
16. Navbar CTA: py-2→py-2.5 for better touch target
17. FAQ: added min-h-[44px] on accordion buttons
18. FAQ: added role="region" + aria-labelledby on answer panels
19. FAQ: added id on question buttons for ARIA pairing
20. Testimonials: added tabIndex, role="region", thin scrollbar, snap scrolling
21. Testimonials: responsive card width w-[min(340px,85vw)]
22. Grain overlay: z-50→z-40, opacity 0.04→0.025
23. Phone mockup: border-6→8, added ring-1 double-bezel
24. Phone float: amplitude 10px→6px, duration 4s→6s
25. Removed aria-hidden from hero display text
26. Added disabled:cursor-not-allowed on waitlist button
27. Waitlist input: focus:→focus-visible: for better keyboard UX
28. Added section connector line between social proof and how-it-works
29. Added decorative rule above FAQ section
30. Footer border-t-2→border-t

### Iteration 2 (7 fixes)
1. /normalize: FAQ section header — removed inline icon, normalized to eyebrow→h2 pattern matching all other sections
2. /normalize: FAQ decorative rule — reduced mb-20→mb-12 to fix double-spacing with header
3. /normalize: Testimonials — replaced inner `<section>` with `<div>` to fix semantic nesting
4. /arrange: Section header bottom margins — standardized mb-20→mb-16 across features, how-it-works, FAQ (testimonials already mb-16)
5. /typeset: How-it-works step numbers — font-extrabold→font-bold for consistency with Iteration 1 convention
6. /clarify: Waitlist form — internationalized all hardcoded English strings (placeholder, button, success/error messages)
7. /clarify: Added i18n keys for waitlist form in all 5 languages (en, de, es, fr, it)

### Iteration 3 (14 fixes — mostly auto-applied by linter, 2 manual)
**Auto-applied by linter:**
1. /animate: CTA ambient glow pulse (`cta-glow` on hero CTA)
2. /animate: Button loading shimmer (`btn-shimmer` on waitlist submit)
3. /animate: Success state entrance animation (`success-enter` + `check-animate`)
4. /animate: FAQ accent line draw (`faq-accent-line` with `data-open` attribute)
5. /animate: Scroll progress bar (CSS scroll-driven, added to layout)
6. /animate: Hero secondary wind layer (slower, wider streaks for depth)
7. /delight: Testimonial star stagger-fill on card hover
8. /delight: Feature icon domain-specific hover (wrench spins, book flips, scanner pulses)
9. /delight: Logo tachometer needle on hover (`logo-needle`)
10. /delight: CTA personality line ("Your bike deserves better than a spreadsheet")
11. /delight: Waitlist success tagline
12. /animate: Reduced-motion handling for all new animations
**Manual fixes:**
13. /harden: Waitlist form error handling — added optional chaining for malformed API responses
14. /distill: Removed dead `trustCancel` i18n key from 4 language files (de, es, fr, it)

### Iteration 4 (12 fixes — all auto-applied by linter)
1. /adapt: Hero CTAs — responsive padding `px-6 sm:px-10`, font `text-base sm:text-lg`
2. /adapt: Secondary CTA — responsive padding `px-6 sm:px-8 py-3.5`
3. /adapt: Footer — safe area padding `pb-[max(4rem,env(safe-area-inset-bottom))]`
4. /adapt: Footer — `to-black` → `to-neutral-950` for palette consistency
5. /adapt: Social proof — increased py-14→py-20, added top+bottom gradient rules
6. /optimize: Navbar transition — scoped to specific properties instead of `transition-all`
7. /polish: Footer links — added focus-visible rings for keyboard navigation
8. /polish: Navbar container — `max-w-6xl` → `max-w-7xl` (consistent with sections)
9. /polish: Mobile CTA — added focus-visible ring
10. /polish: UX copy refresh — tightened section titles, feature names, metadata description
11. /bolder: Hero — tachometer sweep SVG decoration (motorcycle signature moment)
12. /bolder: Social proof — bolder stats `text-6xl/7xl font-extrabold`
