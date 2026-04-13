# Phase 2 — Metadata Implementation Action Checklist

**Owner:** Andrej
**Estimated time:** 3-4 hours (without localization), +6 hours per locale
**Dependencies:** Phase 1 complete
**Phase status:** Ready to execute after Phase 1

---

## Apple App Store Connect

- [ ] Open App Store Connect → MotoVault → App Information
- [ ] Verify primary category is **Utilities**, secondary is **Lifestyle** (already correct)
- [ ] Open the en-US localization
- [ ] Update **Name** to: `MotoVault: Motorcycle Garage` (28 chars)
- [ ] Update **Subtitle** to: `Service, Trips & AI Mechanic` (28 chars)
- [ ] Update **Keywords** to: `moto,bike,rider,biker,maintenance,service,reminder,oil,tire,fuel,mileage,mpg,expense,trip,logbook` (99 chars)
- [ ] Paste new **Description** from `apple-metadata.md`
- [ ] Paste new **Promotional Text** from `apple-metadata.md` (the spring variant)
- [ ] Paste new **What's New** from `apple-metadata.md`
- [ ] Verify all character counts in App Store Connect (it'll show red if over)
- [ ] Save the version (do NOT submit yet — wait for screenshot review in Phase 3)

## Google Play Console

- [ ] Open Play Console → MotoVault → Grow → Store presence → Main store listing
- [ ] Update **App name** to: `MotoVault: Motorcycle Garage` (28 chars)
- [ ] Update **Short description** to: `Service log, trip planner, expense tracker & AI mechanic for motorcycle owners` (79 chars)
- [ ] Paste new **Full description** from `google-metadata.md`
- [ ] Update **What's New** field (in next release flow)
- [ ] Verify category is **Auto & Vehicles** (or **Maps & Navigation** as secondary if available)
- [ ] Save changes (Google Play reviews listing changes within 24-48 hours)

## Visual assets verification

- [ ] Confirm 4 approved screenshots are still uploaded in App Store Connect (en-US)
- [ ] Generate the pending Discover screenshot (#5) — see memory note about retake
- [ ] Upload all 5 screenshots in the correct order per `visual-assets-spec.md`:
  1. DIAGNOSE WITH AI
  2. NEVER MISS A SERVICE
  3. TRACK EVERY EXPENSE
  4. LOG EVERY RIDE
  5. DISCOVER ROUTES & GROUP RIDES
- [ ] Verify Google Play feature graphic (1024×500) is uploaded
- [ ] Verify Google Play screenshots match Apple set (translated headlines if localizing)

## Localization (if pursuing — recommended)

- [ ] en-GB: duplicate en-US, swap "tire"→"tyre", "gas"→"petrol", "color"→"colour"
- [ ] de-DE: localize name (optional), subtitle, 100-char keyword field, description, screenshots
- [ ] fr-FR: same
- [ ] it-IT: same
- [ ] es-ES: same

---

## Validation criteria

Phase 2 is complete when:
- [ ] All 4 metadata fields (name, subtitle, keywords, description) updated in App Store Connect — saved as draft
- [ ] All 3 metadata fields (title, short, full description) updated in Play Console
- [ ] All character limits validated by store consoles (no red warnings)
- [ ] Screenshots in correct order on both stores
- [ ] At least en-US and en-GB localized

## Next phase

Phase 3 — A/B testing setup. See `03-testing/action-testing.md`.
