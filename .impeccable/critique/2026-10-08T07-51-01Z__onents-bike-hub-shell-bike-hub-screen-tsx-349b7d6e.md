---
target: bike hub segments
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/Users/andrejmacm5/personal/MotoWise-bike-hub-ux/apps/mobile/src/components/bike-hub/shell/bike-hub-screen.tsx"
target_fingerprint: "sha256:b7c3f9e0850f515425d81b746fcc081f8f21c46874d997352b921d1ee597ef4c"
target_path: /Users/andrejmacm5/personal/MotoWise-bike-hub-ux/apps/mobile/src/components/bike-hub/shell/bike-hub-screen.tsx
timestamp: 2026-10-08T07-51-01Z
slug: onents-bike-hub-shell-bike-hub-screen-tsx-349b7d6e
---
Method: dual-agent (A: design review sub-agent · B: detector sub-agent). Detector found 0 issues because it cannot parse RN inline styles; grep evidence used instead.
Score 24/40 (Acceptable). Overview authored; Service/Costs/Bike are generic legacy content.
H1 3, H2 2 (day(s), absolute km target), H3 3 (Service delete Alert), H4 1 (two type systems, blue/amber/copper add buttons, counts 1/5/6, light tab bar), H5 3, H6 2 (unlabelled pill), H7 2, H8 2, H9 3, H10 3.
P1 legacy task card collapses at AX sizes (swipeable-task-card.tsx:111-212, ax-03).
P1 three attention counts disagree (segment-bar 1, Maintenance 5, Needs attention 6).
P1 two type systems + three accent systems (legacy system font/fontWeight, serif italic title, palette.primary500 links, amber +).
P2 light tab bar under dark hub (fixed in 6d97afa0).
P2 two vocabularies for the same task (day(s), OVERDUE pill hides priority, absolute target km).
P2 unlabelled + pill on Service/Costs/Bike; duplicate inline add buttons.
Minor: copper/duplicate hues in category charts; YoY uses status amber; PER MONTH eyebrow wraps; Details chevron expands inline; dead space at segment ends.
Grep evidence: fontSize 10-11 in segment-bar/stat + legacy; 4 icon-only 28pt Pressables without labels (expenses-section:201,230, documents-section:191,209); literal boxShadow rgba expenses-section:350.
