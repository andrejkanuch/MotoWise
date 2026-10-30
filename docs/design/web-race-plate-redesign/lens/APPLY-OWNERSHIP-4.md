# Iteration 4 resume — file ownership (2026-10-30, second session)

The first round of it4 apply agents was cut off mid-edit; their partial work is committed as `986ac1c4`
(`git show --stat 986ac1c4`). Before applying a row, READ THE CURRENT CODE: if the row already landed, skip
it; if it landed half-way, finish it. Rules: BUILD-BRIEF.md + APPLY-DECISIONS-4.md (decisions win over the
reports). Paths are under `apps/web/src/` unless stated. Edit only your group's files. If a row needs a file
another group owns, list it under "owner needs" in your report.

Duration tokens are decided and named: `--mv-dur-1` 160ms, `--mv-dur-2` 200ms, `--mv-dur-3` 240ms,
`--mv-dur-4` 420ms — groups B–G map their transitions onto them even if the owner group lands them later.

## A · owner
`components/marketing/design-system.css`, `packages/design-system/src/mv-tokens.css`,
`components/marketing/hero.tsx`, `components/marketing/bike-plate.tsx`, `app/globals.css`,
`components/root-shell.tsx` (wherever it lives), `app/root-metadata.ts`, `app/[locale]/layout.tsx`,
`app/(root)/layout.tsx`, `app/[locale]/(marketing)/layout.tsx`, theme-provider + theme-toggle, the new
NextIntlClientProvider contract test, `public/images/og-image.png`, hero image files. Also the piel/admin
layouts only for moving the Plus Jakarta font to them (optimize ★4).

## B · home + chrome
`components/marketing/` home sections (features-grid incl. the OVERDRIVE, cta-section, navbar, footer,
sticky-app-bar, language-switcher, and any other home-page section component not named in C/D),
`components/cookie-consent*.tsx`, `components/chrome.css`, `components/analytics-identity.tsx`,
`components/web-vitals-reporter.tsx`, Sentry/PostHog client init files (optimize ★3),
`app/[locale]/(marketing)/page.tsx`, `app/(root)/not-found.tsx`, `app/[locale]/not-found.tsx`, error pages.

## C · features + compare
`components/marketing/feature-content-page.tsx`, `feature-screenshot.tsx`, `compare-page.tsx` and other
compare components, `app/[locale]/(marketing)/features/**`, `.../compare/**`, `.../alternatives/**`.

## D · content
`components/marketing/trackside-read.css`, blog/guides/bikes/tools/legal/about/press pages and their
components (`blog-*.tsx`, `blog-cta.ts`, `contextual-app-cta.tsx`), `lib/blog*.ts`, `lib/supabase-blog.ts`.

## E · auth + Pro
`components/auth-ui/**`, `components/auth-modal.tsx`, `app/(root)/{login,signup,welcome,get,reset-password,auth}/**`,
`app/(root)/pro/**` (incl. checkout + success), `supabase/templates/confirmation.html` (repo root).

## F · rider
`app/(root)/(community)/**`, `components/garage-ui/**`, `components/community-nav.tsx`,
`components/share-page.css`, `app/(root)/{share,ride,rider,u}/**`, `components/open-in-app-link.tsx`,
`shared-trip-view.tsx`.

## G · explore + trips
`components/explore/**`, `components/explore-search-bar.tsx`, `app/(root)/explore/**`,
`app/[locale]/(marketing)/explore/**`, `app/(root)/{trips,routes,route}/**`, `components/trip-detail/**`,
`components/gpx-download-button.tsx`, `lib/map/static-image-provider.ts`, `public/images/hero-explore*`.
