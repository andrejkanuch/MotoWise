# MotoVault — App Store Pre-Launch Checklist

Last updated: March 14, 2026

## App Store Connect Status

### Metadata (DONE)
- [x] App Name: MotoVault
- [x] Subtitle: AI Motorcycle Care & Learning
- [x] Description: Full description (1,635 chars)
- [x] Promotional Text: AI-powered motorcycle learning, photo diagnostics...
- [x] Keywords: motorcycle,maintenance,diagnostics,AI,bike,repair,learning,garage,moto,riding,service,mechanic
- [x] Category: Education (primary), Utilities (secondary)
- [x] Support URL: https://motovault.app/support
- [x] Marketing URL: https://motovault.app
- [x] Privacy Policy URL: https://motovault.app/privacy
- [x] Version: 1.0
- [x] Copyright: 2026 MotoVault
- [x] Bundle ID: com.motovault.app

### App Review Information (DONE)
- [x] Contact: Andrej Kanuch, +421944537983, andrejkanuch@sudolabs.io
- [x] Review Notes: Explains AI features, free tier, Pro subscription, RevenueCat, no demo account needed
- [x] Sign-in required: Unchecked (app explorable without sign-in)

### App Privacy (DONE)
- [x] Privacy Policy URL set
- [x] Data Linked to You: Usage Data, User Content, Contact Info, Purchases, Identifiers
- [x] Data Not Linked to You: Diagnostics (Crash Data, Performance Data)

### Age Rating (DONE)
- [x] 4+ in 173 countries
- [x] Regional exceptions: Brazil (AL), Korea (ALL)

### Accessibility (DONE)
- [x] VoiceOver, Dark Interface, Differentiate Without Color, Sufficient Contrast, Reduced Motion

### Content Rights (DONE)
- [x] No third-party content declared
- [x] Apple's Standard License Agreement

---

## Web App Legal Pages (DONE)

### Created/Updated Pages
- [x] `/privacy` — Expanded GDPR/CCPA-compliant Privacy Policy (11 sections)
  - Info collected, how used, third-party services, data retention, security, rights, children, international transfers, account deletion, changes, contact
- [x] `/terms` — Expanded Terms of Service (15 sections)
  - Acceptance, service description, accounts, subscriptions/IAP, AI disclaimer, IP, user content, prohibited uses, termination, liability, indemnification, governing law (Slovakia/EU), dispute resolution, modifications, contact
- [x] `/support` — Help & Support page (NEW)
  - FAQ, contact email, bug reports, feature requests
- [x] `/account-deletion` — Account Deletion instructions (NEW)
  - Step-by-step deletion guide, what gets deleted, retention policy, email alternative

### Translations (5 languages)
- [x] English (en) — complete
- [x] Spanish (es) — complete
- [x] German (de) — complete
- [x] French (fr) — complete (NEW)
- [x] Italian (it) — complete (NEW)

### Routing & Navigation
- [x] i18n routing updated: en, es, de, fr, it
- [x] Footer links: Privacy, Terms, Support, Account Deletion
- [x] Language switcher: all 5 languages

---

## Still Needs Your Attention

### Before Submitting for Review

1. **Upload Screenshots** (0 of 10)
   - iPhone 6.5" display required (1242 x 2688 or 1284 x 2778)
   - iPad screenshots if `supportsTablet: true` (your config has this)
   - Recommended: 5-6 screenshots showing key features (Garage, AI Diagnostics, Learning, Profile)

2. **Upload a Build**
   - Run `eas build --platform ios --profile production`
   - Upload to App Store Connect via Xcode or Transporter
   - Select the build in the Version page

3. **What's New Text** (for version 1.0)
   - Can be simple: "Initial release of MotoVault"

4. **Deploy Web App**
   - Ensure https://motovault.app is live with all new pages
   - Privacy, Terms, Support, Account Deletion must be accessible
   - Test all 5 language variants

5. **App Store Localization** (Optional but recommended)
   - Add localized App Store metadata (description, keywords, screenshots) for ES, DE, FR, IT
   - Can be done in App Store Connect under the language dropdown

6. **Review "Sign-in required" checkbox**
   - Currently unchecked — if the app requires sign-in for core features, check it and provide demo credentials

7. **RevenueCat / In-App Purchases**
   - Ensure IAP products are created and approved in App Store Connect
   - Test subscription flow in sandbox environment

### Post-Submission

8. **EU Digital Services Act — Trader Status**
   - Required for EU distribution — verify in App Store Connect > Business

9. **Export Compliance**
   - Your app.config.ts already sets `usesNonExemptEncryption: false` ✅

10. **Apple Sign-in (South Korea)**
    - Register server-to-server notification endpoint if distributing in South Korea

---

## URLs Reference

| Page | URL |
|------|-----|
| Home | https://motovault.app |
| Privacy Policy | https://motovault.app/privacy |
| Terms of Service | https://motovault.app/terms |
| Support | https://motovault.app/support |
| Account Deletion | https://motovault.app/account-deletion |
| App Store Connect | https://appstoreconnect.apple.com/apps/6760291360 |
