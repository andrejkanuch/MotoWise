# MotoWise — Pre-Launch Brand Review

**Date:** March 11, 2026
**Reviewed by:** Brand Audit (AI-assisted)
**Scope:** Full landing page at localhost:3000 (English locale)

---

## Summary

**Overall assessment:** MotoWise presents a strong, modern brand identity with a cohesive dark theme, clear value proposition, and well-structured page flow. The visual design is polished for a pre-launch product, with a premium feel that matches the AI-powered positioning. However, several issues — most notably a broken hero image, inconsistent naming between codebase and public brand, and some unsubstantiated social proof claims — need resolution before launch.

**Biggest strengths:** The tagline "Learn your bike. Fix your bike." is memorable and action-oriented. The dark UI with teal/amber accents gives the brand a premium, technical feel that resonates with the motorcycle enthusiast audience. The page flow (hero → social proof → how it works → features → testimonials → CTA → FAQ → footer) follows conversion best practices.

**Most important improvements:** Fix the broken phone mockup in the hero section (your most visible asset), resolve the MotoWise vs. MotoLearn naming inconsistency, and either substantiate or soften the social proof numbers before launch.

---

## Detailed Findings

### HIGH Severity

| # | Issue | Location | Details | Suggestion |
|---|-------|----------|---------|------------|
| 1 | **Broken hero image** | Hero section (phone mockup) | The app preview image at `/images/app-preview-home.png` fails to load, showing alt text "MotoWise app home screen showing fleet health" inside a phone frame. This is the first thing visitors see. | Add the actual screenshot or a polished mockup. This is the single most impactful visual element on the page. |
| 2 | **MotoWise vs. MotoLearn naming conflict** | Codebase-wide | The public brand is "MotoWise" everywhere on the site, but the internal codebase uses "MotoLearn" (package names `@motolearn/*`, repo name, CLAUDE.md). While users won't see internal names directly, this creates risk: the page title reads "MotoWise" but the JSON-LD schema says "MotoLearn" in the `organizationDescription`. Search engines and social previews may surface the wrong name. | Audit all metadata, JSON-LD, and OG tags for any "MotoLearn" references. Standardize on "MotoWise" in all public-facing output. |
| 3 | **Unsubstantiated social proof numbers** | Social Proof Bar + CTA section | "12,000+ Active Riders", "85,000+ AI Diagnostics Run", "18,000+ Bikes Tracked" — these are prominent claims. If these are projected or aspirational numbers for a pre-launch product, they risk credibility damage if users investigate, and could create legal exposure. | If real: add a qualifier like "since beta" or "in early access." If aspirational: replace with qualifiers like "Built for thousands of riders" or show beta/waitlist numbers instead. For pre-launch, consider removing specific numbers entirely and using qualitative proof. |
| 4 | **Testimonials may be fabricated** | "What Riders Say" section | Five detailed testimonials with names, bike models, and star ratings. If these are from real beta users, great. If invented for launch, they violate FTC guidelines on endorsements and could undermine trust if discovered. | If real: add "Beta user" badges or small disclaimers. If fictional: replace with a waitlist CTA ("Join 500+ riders on the waitlist") or use a coming-soon format. Never launch with fabricated testimonials. |
| 5 | **"Download App" CTA leads nowhere** | Navbar + Hero + CTA section | The "Download Free" button links to `#cta`, and the CTA section shows App Store and Google Play buttons. For pre-launch, these likely aren't live yet. Clicking dead store links is a major conversion killer. | Replace with a waitlist/email signup form for pre-launch. Swap store badges for "Get notified when we launch" or "Join the waitlist." |

### MEDIUM Severity

| # | Issue | Location | Details | Suggestion |
|---|-------|----------|---------|------------|
| 6 | **Mobile hero text/mockup overlap** | Hero section (mobile viewport) | At 390px width, the phone mockup (set to 30% opacity on mobile) overlaps the subtitle text and CTA buttons, creating visual clutter and reducing readability. | Either hide the phone mockup entirely on mobile (`hidden md:block`) or reposition it below the text content. |
| 7 | **"Fleet health" language mismatch** | Hero image alt text | Alt text says "fleet health" — this is B2B/enterprise language, not consumer language. MotoWise targets individual riders, not fleet managers. | Change alt text to something like "MotoWise app showing your bike's diagnostics and maintenance." |
| 8 | **Inconsistent CTA language** | Throughout page | "Download Free" (hero) → "Download App" (navbar) → App Store/Google Play (CTA section). Three different framings for the same action. | Standardize on one CTA verb. For pre-launch: "Join Waitlist" everywhere. Post-launch: "Download Free" everywhere. |
| 9 | **"Built with AI" in footer** | Footer bottom bar | This is an unusual claim to make in a footer. It could either build credibility (AI is a feature) or undermine trust (implying content/site was AI-generated). Ambiguous messaging. | Either remove it or change to "Powered by AI" to clearly reference the product's AI features rather than how the site was built. |
| 10 | **FAQ mentions Supabase by name** | FAQ item #5: "Is my data safe?" | The answer mentions "Supabase with row-level security." End users don't know or care what Supabase is. This reads like developer documentation, not marketing copy. | Rewrite to focus on outcomes: "Your data is protected with enterprise-grade encryption and strict access controls. We never share your personal information or bike data with third parties." |
| 11 | **No logo — text-only brand mark** | Navbar + Footer | "MotoWise" appears as plain text in the navbar. No icon, no logomark. For a mobile app, having a recognizable visual identity is important for brand recall. | Consider adding a simple logomark (motorcycle silhouette, gear icon, or abstract "MW" mark) alongside the wordmark. |
| 12 | **Feature badge inconsistency** | Features bento grid | Badges use different formats: "< 5 sec" (AI Diagnostics), "50+ lessons" (Learning Paths), "Unlimited bikes" (Garage), "Track progress" (Progress), "Coming soon" (Community). Some are quantitative, some qualitative. | Standardize badge format — either all quantitative ("< 5 sec", "50+ lessons", "∞ bikes", "Real-time stats") or all benefit-oriented. |

### LOW Severity

| # | Issue | Location | Details | Suggestion |
|---|-------|----------|---------|------------|
| 13 | **"Admin" link visible in footer** | Footer → Company column | A link to "Admin" is publicly visible. This is an internal tool link that shouldn't be exposed to end users. | Hide it behind authentication or remove from the public footer. |
| 14 | **Language switcher is a plain select** | Navbar | The language switcher is a basic `<select>` dropdown that doesn't match the premium design language of the rest of the site. | Style it as a custom dropdown matching the navbar aesthetic, or use flag icons. |
| 15 | **Social links may be dead** | Footer → Connect column | Instagram, YouTube, X links are present. If these profiles don't exist yet, dead social links erode trust. | Only show social links that lead to active profiles. For pre-launch, consider removing until accounts are active. |
| 16 | **Star rating on Jake T.'s review is 4 stars** | Testimonials carousel | While having a mix of ratings adds authenticity, having a lower-rated testimonial with less enthusiastic language might underperform for conversion. | Keep the 4-star reviews (they add authenticity), but ensure the most visible card (first position) has the strongest endorsement. Alex R.'s 5-star review is a good lead. |
| 17 | **Copyright year hardcoded** | Footer | "© 2026 MotoWise" is hardcoded in the i18n file. | Make the year dynamic to avoid needing annual updates. |

---

## Revised Sections (Top 5 Issues)

### 1. Hero Phone Mockup (Issue #1)

**Before:** Broken image showing alt text in phone frame
**After:** Add an actual app screenshot (or a high-fidelity Figma mockup exported as PNG) to `/public/images/app-preview-home.png`. Show a real screen from the app — ideally the garage view or a diagnostic result, as these are the most visually compelling features.

### 2. Social Proof Numbers (Issue #3)

**Before:** "12,000+ Active Riders" / "85,000+ AI Diagnostics Run" / "18,000+ Bikes Tracked"
**After (pre-launch option A — waitlist):** "2,500+ riders on the waitlist" / "Built on 85,000+ data points" / "Supporting 200+ motorcycle models"
**After (pre-launch option B — remove numbers):** Replace the social proof bar with a single trust statement: "Built by riders, for riders. Launching Spring 2026."

### 3. FAQ Data Safety Answer (Issue #10)

**Before:** "MotoWise uses Supabase with row-level security to protect your data. Authentication tokens are stored securely, and we never share your personal information or bike data with third parties."
**After:** "Your data is protected with enterprise-grade encryption and strict access controls. Authentication tokens are stored using platform-native secure storage, and all communication is encrypted in transit. We never share your personal information or bike data with third parties."

### 4. Download CTAs for Pre-Launch (Issue #5)

**Before:** "Download Free" button + App Store/Google Play badges
**After:** Replace all download CTAs with a waitlist form: email input + "Join the Waitlist" button. Add a small note: "Be the first to know when MotoWise launches." Keep store badges but grey them out with "Coming soon to" labels above.

### 5. CTA Language Consistency (Issue #8)

**Before:** "Download Free" (hero) / "Download App" (navbar) / Store buttons (CTA section)
**After:** Navbar: "Join Waitlist" (outlined button) → Hero: "Join the Waitlist" (primary amber button) + "Explore Features" (secondary) → CTA section: Email signup form with "Get Early Access" button.

---

## Legal & Compliance Flags

| Flag | Location | Risk Level | Recommended Action |
|------|----------|------------|-------------------|
| **Unsubstantiated user counts** | Social proof bar, CTA header | High | Verify numbers or replace with qualifiable claims |
| **Potentially fabricated testimonials** | Testimonials section | High | Verify real users or replace with waitlist proof |
| **AI diagnostic disclaimer** | Terms of Service only | Medium | Add a visible disclaimer near AI feature descriptions: "AI suggestions are informational and don't replace professional mechanic advice" |
| **"Cancel anytime" claim** | CTA trust badges | Medium | Ensure subscription system actually supports instant cancellation before claiming this |
| **Privacy policy references email** | Privacy page | Low | Ensure privacy@motowise.app is active and monitored |
| **App Store/Google Play badges** | CTA section | Medium | Using official store badges without live listings may violate Apple/Google trademark guidelines |

---

## Voice & Tone Assessment

The overall voice is **confident, direct, and technical-but-accessible** — a good fit for the motorcycle enthusiast audience. The tagline structure ("Learn your bike. Fix your bike.") establishes an imperative, action-oriented tone that carries well throughout the page. Feature descriptions are concise and benefit-focused. The FAQ answers strike a good balance between informative and approachable (with the Supabase exception noted above).

One area to refine: the page occasionally shifts between speaking to beginners ("someone who's new to wrenching") and experienced riders ("Suspension Tuning, Electrical Systems"). Consider whether the primary launch audience is beginners who want to learn, or experienced riders who want AI diagnostics — and weight the messaging accordingly.

---

## Pre-Launch Checklist

Before going live, address these items in priority order:

1. Fix the broken hero image (immediate visual impact)
2. Decide on social proof strategy (real numbers, waitlist numbers, or no numbers)
3. Verify or replace testimonials
4. Replace download CTAs with waitlist/email capture
5. Remove "Admin" link from footer
6. Audit all metadata for MotoLearn → MotoWise naming
7. Verify all social links lead to active profiles
8. Add AI diagnostic disclaimer to feature descriptions
9. Ensure privacy@motowise.app is active
10. Test mobile layout (fix hero overlap)

---

*Report generated March 11, 2026. Review based on visual inspection of localhost:3000 (English locale) and codebase analysis.*
