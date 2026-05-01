# Per-Region Route Reference Files

Each region file in this directory contains pre-researched routes with verified GPS coordinates for that region. Files are kept under ~25k tokens so a single `Read` call returns the whole file.

## Format per route

```
### Route Title
Meta: COUNTRY | REGION | City | Nd | XXXkm | difficulty | surface | XXXXm↑ | pick:yes/no
Start: lat, lng
Description: ...
Waypoints:
N. [type | dX | period] Name (lat, lng) — Notes
```

- `dX` = day_index (0-based)
- `sort_order` = position number in Waypoints list (globally sequential — never restarts per day)
- Multi-day: last waypoint of each day except the final must be type `overnight`

## Region files

- `japan.md` — JP (6 routes, all in DB as of 2026-04)
- `australia.md` — AU (5 routes, all in DB as of 2026-04)
- `india.md` — IN (4 routes, all in DB as of 2026-04)
- `south-america.md` — AR / CL / BO (4 routes, all in DB as of 2026-04)
- `morocco.md` — MA (4 routes, all in DB as of 2026-04)
- `thailand.md` — TH (3 routes)
- `south-africa.md` — ZA (4 routes)
- `new-zealand.md` — NZ (4 routes)
