# Lens scope — files in the Trackside redesign (apps/web/src unless noted)

Marketing (localized, next-intl; strings in apps/web/messages/en.json via .impeccable/tools/add-web-i18n-keys.py):
- app/[locale]/(marketing)/**/page.tsx, layout.tsx, error.tsx, not-found.tsx; app/not-found.tsx, app/error.tsx
- components/marketing/*.tsx, design-system.css (shared; owner-only — report, do not edit), trackside-read.css
- components/cookie-consent.tsx, components/theme-toggle.tsx, components/contextual-app-cta.tsx
Root-only routes (English in place):
- app/explore/**, components/explore/**, components/explore-search-bar.tsx
- app/trips/**, app/route/**, app/routes/**, app/ride/**, app/share/**, app/rider/**, app/u/**, app/t/**, components/trip-detail/**, components/shared-trip-view.tsx, components/share-page.css, components/gpx-download-button.tsx
- app/login, app/signup, app/forgot-password, app/reset-password, components/auth-ui/**, components/auth-modal.tsx, app/welcome/**, app/get/**
- app/pro/** (pro.css), app/(community)/** (garage.css, garage-view.css), components/garage-ui/**, components/community-nav.tsx
Tokens: packages/design-system/src/mv-tokens.css (owner-only). Theme: providers/theme-provider.tsx, lib/theme-init-script.ts.
Out of scope: app/admin/**, app/builder/**, components/admin/**, components/builder/**, lib/**, hooks/**, GraphQL, tests.
