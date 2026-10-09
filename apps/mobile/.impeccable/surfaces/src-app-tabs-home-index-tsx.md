---
version: 1
slug: "src-app-tabs-home-index-tsx"
primary_target: "src/app/(tabs)/(home)/index.tsx"
related_targets: ["src/app/(tabs)/(garage)/index.tsx","src/app/(tabs)/(profile)/index.tsx","src/app/(tabs)/(diagnose)/index.tsx","src/app/(tabs)/(garage)/add-expense.tsx","src/app/(tabs)/(garage)/add-maintenance-task.tsx"]
---

# Surface brief — MotoVault mobile app (redesign 3.25.0)

Scope: the whole mobile app, rolled out surface by surface: Home → Diagnose → Add Task / Add Expense sheets → Garage list → Profile (IA regroup) → app-wide sweep. Visitor mode: **Operate**. Platform: adaptive (one codebase; iOS idioms on iOS, Material behaviour on Android; system UI type on both).

Audience and job: a rider next to the bike, phone in one hand, often with gloves, wanting the next ride, service or spend decision in seconds and logging an expense, task or ride without friction. Constraints: logging is never paywalled; all colours from `palette`; all copy through i18n (13 locales); Maestro flows rely on visible English labels (keep them or add testIDs in the same change); no serif or italic display type anywhere (owner request).

## Direction contract

THESIS: Every bike carries a number plate, and the plate tells you whether it is ready. This refuses the category default of a dark dashboard with stat tiles and an accent, and the incumbent warm-paper editorial with its amber serif italic.

OWN-WORLD: A 5-step graphite ramp (ground, card, raised, option, line) with bone ink, exhaust copper for actions only, and a plate-state triad: bone = ready, signal yellow = due soon, red = overdue. One diagonal livery stripe is the only permitted rebellion. Condensed racing numerals (Barlow Condensed, cut from plate lettering) carry plates, figures and large titles. Native system type carries everything else. Five roles: plate, figure, title, body, label. Strict 4pt grid, tabular figures, inset grouped rows, no eyebrows, no section numbers.

STORY: Riders open the app and know immediately whether the bike is ready and what is next. One tap logs a ride, expense or task. Deeper history sits one step down.

FIRST VIEWPORT (Home): A large condensed title (the greeting, or the bike's name when there is one bike). The active bike's plate takes about the top third of the screen: a rounded plate panel whose colour is its state, with condensed numerals for distance to the next service, the task name in one line beneath, and the bike identity (number, make and model, year) on the plate's edge, the livery stripe cut diagonally through one corner. Directly under it is a 4-up action row (Ride, Expense, Task, Diagnose) at a 48pt target, the primary actions low and large. Then "Up next" as native inset rows. Tab bar: Home, Discover, Garage, Profile.

FORM: Race Plate, position 3 on the ordered list (racing number plates and tank livery). Seed key 7d21b6ea. Signature move: the bike plate, whose colour encodes readiness and is reused wherever a bike appears. Motion grammar: the plate settles in once (scale 0.98→1, opacity, 240ms exponential ease-out) and state changes cross-fade the plate's colour. Everything else uses native transitions, and Reduce Motion is respected.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved
- The Profile IA regroup lands with this redesign (sections: Account, Riding, Subscription, App settings, Support & legal, Sign out / Delete).
