# MotoVault — Metadata Update Submission Guide

**Generated:** 2026-04-11
**Goal:** Roll out the optimized metadata to both stores with minimum risk and maximum learning.

---

## Strategy: Metadata-only update vs. binary update

You have two options for pushing the new metadata:

### Option A — Metadata-only update (RECOMMENDED for first refresh)

**Apple:** Some metadata fields (Promotional Text, Keywords) can be updated at any time WITHOUT a new binary submission. Other fields (Name, Subtitle, Description, Screenshots) require submitting a new app version, but you can submit "metadata only" without uploading a new build by reusing the current build.

**Google Play:** Title, short description, full description, screenshots, and feature graphic can be updated WITHOUT a new APK/AAB. Just edit the store listing and submit for review.

**Apple steps for metadata-only refresh:**
1. App Store Connect → MotoVault → **+ Version or Platform**
2. Enter version number `1.X.Y` (one patch above current)
3. In the new version, leave the build the same as the current live build
4. Update Name, Subtitle, Keywords, Description, Screenshots
5. **What's New** field — required for new version
6. Click **Submit for Review**

**Google Play steps:**
1. Play Console → MotoVault → **Grow** → **Store presence** → **Main store listing**
2. Edit fields, save
3. Click **Send X changes for review** at the top
4. No build update needed

### Option B — Bundle metadata refresh into the next feature release

If you have a feature release in flight, fold the metadata changes into it. Single submission, single review cycle.

**RECOMMENDATION:** Use Option A first, ship the refresh on its own. Cleaner attribution for ASO impact measurement.

---

## Apple submission timeline (typical)

| Step | Duration |
|---|---|
| Submit | 0 |
| In Review | 24-48 hours |
| Pending Developer Release | depends on your toggle |
| Ready for Sale | 1-4 hours after release |
| Indexed in search | 24-48 hours after live |
| Conversion data flowing | 3-7 days after live |

**Recommended release toggle:** **Manual release** for the refresh — gives you control over the launch hour to align with marketing.

## Google Play submission timeline (typical)

| Step | Duration |
|---|---|
| Submit | 0 |
| In Review | 24-72 hours (longer for store listing changes than for binary releases) |
| Live | Immediately upon approval |
| Indexed in search | 12-24 hours |

---

## Rejection recovery playbook

### If Apple rejects:

**Common reasons for metadata rejections (and fixes):**

| Reason | Fix |
|---|---|
| 2.3.7 Inaccurate metadata (says feature you don't have) | Verify every claim in description matches actual app |
| 2.3.10 Other apps mentioned | Remove ANY competitor names or platform mentions |
| 4.5.3 App Name keyword stuffing | Reduce keywords in name; "MotoVault: Motorcycle Garage" should pass |
| 3.1.2 Subscription terms missing | Add the auto-renewal disclosure (already included) |
| 5.1.1 Privacy policy missing/inadequate | Verify https://motovault.app/privacy returns 200 |

**Process:**
1. Read the rejection in Resolution Center
2. If you disagree, reply in Resolution Center with evidence (don't appeal externally first)
3. If they're right, fix the issue and resubmit (no need for new build)
4. Average resolution time: 24-48 hours

### If Google rejects:

**Common reasons:**

| Reason | Fix |
|---|---|
| Repetitive or irrelevant keywords | Reduce density (already audited at <5%) |
| Misleading content (e.g., "AI mechanic" claim) | Verify the AI feature works as described |
| Restricted content | Verify Data Safety section matches actual data collection |

**Process:** Edit the listing, resubmit. No appeal needed for first rejections.

---

## Post-launch verification (Day 1-7 after going live)

### Day 1
- [ ] Verify new name shows on Apple App Store search
- [ ] Verify new name shows on Google Play search
- [ ] Verify new screenshots show in correct order
- [ ] Spot-check 5 keywords from the new keyword field — confirm app appears in results

### Day 3
- [ ] Pull baseline conversion rate from App Store Connect (pre-refresh)
- [ ] Pull current conversion rate (post-refresh)
- [ ] Note any immediate movement

### Day 7
- [ ] Compare keyword rankings vs. pre-refresh
- [ ] Compare impressions vs. pre-refresh (should INCREASE if keyword work is effective)
- [ ] Compare conversion rate (should stay flat or improve)
- [ ] Document findings in `05-optimization/ongoing-tasks.md`

---

## Rollback plan

If conversion rate DROPS by >15% in the first 7 days:

1. Identify which change is most likely the culprit (screenshot 1 reorder is highest-risk)
2. Submit a metadata-only revert of that single field
3. Keep all other changes in place
4. Do NOT revert everything at once — you'll lose all learning

If you're not sure what caused the drop, run an Apple PPO test with the old version as a treatment to isolate the variable.
