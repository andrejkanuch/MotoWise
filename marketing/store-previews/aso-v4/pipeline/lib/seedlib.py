"""Helpers for the per-market screenshot seeds.

Ported from scripts/marketing-screenshots/seed_lib.py (branch chore/marketing-screenshots,
86ddc0aa). Differences: road routing uses the public OSRM demo server instead of Mapbox (no
token needed), the hero geometry comes from the market GeoJSON, and every network call has an
--offline fallback so the generator can always produce SQL for review.
"""

import json
import math
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

OSRM = "https://router.project-osrm.org/route/v1/driving/"
OPEN_METEO = "https://api.open-meteo.com/v1/elevation"
UA = {"User-Agent": "motovault-screenshot-seed/1.0 (marketing; low volume)"}


def make_uid(ns: uuid.UUID):
    def uid(*parts):
        return str(uuid.uuid5(ns, "/".join(map(str, parts))))

    return uid


def q(v):
    """SQL literal."""
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(round(v, 6)) if isinstance(v, float) else repr(v)
    if isinstance(v, (dict, list)):
        return "'" + json.dumps(v, ensure_ascii=False).replace("'", "''") + "'::jsonb"
    return "'" + str(v).replace("'", "''") + "'"


def encode(coords):
    """Google polyline (precision 5) from [(lat, lng), ...]."""
    out, plat, plng = [], 0, 0
    for lat, lng in coords:
        ilat, ilng = int(round(lat * 1e5)), int(round(lng * 1e5))
        for d in (ilat - plat, ilng - plng):
            d = ~(d << 1) if d < 0 else d << 1
            while d >= 0x20:
                out.append(chr((0x20 | (d & 0x1F)) + 63))
                d >>= 5
            out.append(chr(d + 63))
        plat, plng = ilat, ilng
    return "".join(out)


def haversine(a, b):
    r = 6371000.0
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def bearing(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    y = math.sin(lo2 - lo1) * math.cos(la2)
    x = math.cos(la1) * math.sin(la2) - math.sin(la1) * math.cos(la2) * math.cos(lo2 - lo1)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def path_length(coords):
    return sum(haversine(a, b) for a, b in zip(coords, coords[1:]))


def simplify(coords, every_m=120):
    """Keep a point roughly every `every_m` metres along the path (plus the last point)."""
    out, acc = [coords[0]], 0.0
    for a, b in zip(coords, coords[1:]):
        acc += haversine(a, b)
        if acc >= every_m:
            out.append(b)
            acc = 0.0
    if out[-1] != coords[-1]:
        out.append(coords[-1])
    return out


def _get_json(url, retries=6):
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code not in (429, 502, 503, 504) or attempt == retries - 1:
                raise
            time.sleep(10 * (attempt + 1))
    raise RuntimeError("unreachable")


class Geo:
    """OSRM road routes + Open-Meteo DEM, cached on disk so a re-run is offline and deterministic."""

    def __init__(self, cache_dir: Path, offline=False):
        self.offline = offline
        cache_dir.mkdir(parents=True, exist_ok=True)
        self.route_path = cache_dir / "routes-cache.json"
        self.elev_path = cache_dir / "elev-cache.json"
        self.routes = json.loads(self.route_path.read_text()) if self.route_path.exists() else {}
        self.elev = json.loads(self.elev_path.read_text()) if self.elev_path.exists() else {}
        self.fallbacks = []  # human-readable notes for the summary

    def route(self, points):
        """Road geometry through [(lat, lng), ...] -> list[(lat, lng)]. Offline: a smoothed polygon."""
        key = ";".join(f"{lng:.5f},{lat:.5f}" for lat, lng in points)
        if key in self.routes:
            return [tuple(p) for p in self.routes[key]]
        if self.offline:
            self.fallbacks.append(f"route {key[:40]}…: offline, synthetic curve")
            return synthetic_path(points)
        try:
            d = _get_json(f"{OSRM}{key}?overview=full&geometries=geojson")
            assert d.get("code") == "Ok", d.get("code")
            coords = [(c[1], c[0]) for c in d["routes"][0]["geometry"]["coordinates"]]
        except Exception as e:  # noqa: BLE001 - any network failure falls back, loudly
            self.fallbacks.append(f"route {key[:40]}…: OSRM failed ({e}), synthetic curve")
            return synthetic_path(points)
        self.routes[key] = coords
        self.route_path.write_text(json.dumps(self.routes))
        time.sleep(1)  # be polite to the demo server
        return coords

    def elevations(self, name, points):
        got = self.elev.get(name, [])
        if len(got) == len(points):
            return got
        if self.offline:
            self.fallbacks.append(f"elevation {name}: offline, synthetic profile")
            return synthetic_elevation(points)
        got = []
        try:
            for i in range(0, len(points), 100):
                chunk = points[i : i + 100]
                url = (f"{OPEN_METEO}?latitude=" + ",".join(f"{p[0]:.5f}" for p in chunk)
                       + "&longitude=" + ",".join(f"{p[1]:.5f}" for p in chunk))
                got += _get_json(url)["elevation"]
                time.sleep(1.5)
        except Exception as e:  # noqa: BLE001
            self.fallbacks.append(f"elevation {name}: Open-Meteo failed ({e}), synthetic profile")
            return synthetic_elevation(points)
        self.elev[name] = got
        self.elev_path.write_text(json.dumps(self.elev))
        return got


def synthetic_path(points, per_leg=40):
    """Gently curved path through the via points, for --offline dry runs only."""
    out = []
    for (la1, lo1), (la2, lo2) in zip(points, points[1:]):
        for i in range(per_leg):
            t = i / per_leg
            bend = math.sin(t * math.pi) * 0.004 * math.sin(t * 9)
            out.append((la1 + (la2 - la1) * t + bend, lo1 + (lo2 - lo1) * t - bend))
    out.append(points[-1])
    return out


def synthetic_elevation(points, base=600.0):
    return [round(base + 250 * math.sin(i / 37) + 90 * math.sin(i / 7.3), 1) for i in range(len(points))]


def smooth(values, half=3):
    out = []
    for i in range(len(values)):
        win = values[max(0, i - half) : i + half + 1]
        out.append(sum(win) / len(win))
    return out


def gain_loss(elev):
    g = sum(max(0.0, b - a) for a, b in zip(elev, elev[1:]))
    lo = sum(max(0.0, a - b) for a, b in zip(elev, elev[1:]))
    return round(g), round(lo)


def rollup_backfill_sql(repo_root: Path, user_id):
    """Repo backfill 00137 scoped to one user: rebuilds ride_rollups + ride_records from its rides.

    00137 has 11 `status = 'completed'` filters; every one gets a user_id guard. The assert fails
    loudly if the migration text ever changes shape, rather than rebuilding every user's rollups.
    """
    backfill = (repo_root / "supabase/migrations/00137_backfill_rollups_records.sql").read_text()
    n_r = backfill.count("WHERE r.status = 'completed'")
    n_plain = backfill.count("WHERE status = 'completed'")
    backfill = backfill.replace("WHERE r.status = 'completed'", f"WHERE r.user_id = {q(user_id)} AND r.status = 'completed'")
    backfill = backfill.replace("WHERE status = 'completed'", f"WHERE user_id = {q(user_id)} AND status = 'completed'")
    assert (n_r, n_plain) == (10, 1) and backfill.count(q(user_id)) == 11, (n_r, n_plain)
    return [f"DELETE FROM ride_rollups WHERE user_id = {q(user_id)};",
            f"DELETE FROM ride_records WHERE user_id = {q(user_id)};",
            backfill]
