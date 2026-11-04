#!/usr/bin/env python3
"""Per-market screenshot demo seed: markets/<CC>.json + <CC>-route.geojson -> seed.sql + teardown.sql.

    python3 gen_seed_market.py US --user-id <uuid>            # real run (after the account exists)
    python3 gen_seed_market.py US --fixtures --offline        # dry run on the stub fixture, no network
    python3 gen_seed_market.py US --validate                  # schema check only, no SQL

Writes into out/seed/<CC>/: seed.sql, teardown.sql, ids.json (what the capture flows need),
summary.json (what the screens should show, for review). It NEVER connects to a database:
applying the SQL is an owner-approved step (RUNBOOK.md).

Data contracts carried over from scripts/marketing-screenshots/gen_seed_us.py and checked
against supabase/migrations on origin/main (00131, 00154, 00166, 00170, 00180, 00181, 00192):
- users.measurement_system/currency are set BEFORE the bikes go in: the BEFORE INSERT trigger
  (00180) copies measurement_system into motorcycles.distance_unit.
- current_mileage, target_mileage, completed_mileage and odometer_readings.value are RAW values
  in the bike's unit (mi or km). target_mileage is an ABSOLUTE odometer reading.
- ride distance_m, speeds (m/s) and elevation (m) are always metric; the app converts.
- maintenance_tasks: total_amount is set and cost stays NULL; parts_cost/labor_cost/tax_amount
  carry the breakdown. There is NO trigger creating the linked maintenance expense, so it is
  written here the way ExpensesService.createFromTask does (category maintenance, same total,
  maintenance_task_id).
- expenses.amount is DECIMAL(10,2) with CHECK amount <= 99,999.99 (00036), purchase_price
  <= 999,999.99 (00052). High-denomination currencies (COP, ARS) break these; the generator
  fails rather than writing rows Postgres would reject.
- currency must be in chk_users_currency / chk_expenses_currency (00131): no PHP.
- ride_rollups / ride_records are rebuilt for this user only from 00137 (see seedlib).

The account is dedicated to screenshots, so the seed first deletes EVERY row the user owns in
the seeded tables. A guard at the top refuses to run unless the users row with --user-id has
the expected screenshots+<cc>@ email, so a wrong id can never wipe a real rider.
"""

import argparse
import json
import math
import random
import re
import sys
import uuid
from datetime import date, datetime, time, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / "lib"))
from seedlib import (  # noqa: E402
    Geo, bearing, encode, gain_loss, haversine, make_uid, path_length, q, rollup_backfill_sql, simplify, smooth,
)

REPO = HERE.parents[3]
ASO_V4 = HERE.parent
NS = uuid.UUID("7d1c2a4e-0b7f-4f0e-9a51-5c3f0aa4e2b1")  # aso-v4 seeds; distinct from the US seed's namespace
PLACEHOLDER_USER = "00000000-0000-4000-8000-000000000000"
EMAIL_PATTERN = "screenshots+{cc}@motovault.app"

ALLOWED_CURRENCIES = {"USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "INR", "BRL", "MXN", "SEK", "NOK", "DKK",
                      "PLN", "TRY", "RSD", "CZK", "HUF", "RON", "BGN", "COP", "ARS", "CLP", "PEN"}  # 00131
APP_LANGUAGES = {"en", "es", "de", "fr", "it", "pt-BR", "pl", "ja", "hi", "th", "id", "tr", "sk"}  # SUPPORTED_LOCALES
EXPENSE_CATEGORIES = {"fuel", "maintenance", "parts", "tires", "gear", "accessories", "modifications", "insurance",
                      "registration", "taxes_fees", "tolls", "parking", "training", "other"}  # 00154
SERVICE_TYPES = {"oil_change", "oil_filter", "brake_fluid", "transmission_oil", "final_drive", "coolant",
                 "valve_clearance", "air_filter", "spark_plug", "fork_oil", "chain", "tire", "brake_pads", "belt",
                 "battery", "general_service", "other"}  # 00170
BIKE_TYPES = {"cruiser", "sportbike", "standard", "touring", "dual_sport", "dirt_bike", "scooter", "other"}
WAYPOINT_TYPES = {"start", "end", "fuel", "food", "scenic", "overnight", "photo", "mechanical", "ferry",
                  "pass_summit", "rally_point"}  # 00072
DIFFICULTIES = {"easy", "moderate", "challenging", "expert"}
EXPENSE_MAX, PURCHASE_MAX = 99999.99, 999999.99  # live on prod today (00036, 00052)
# --assume-currency-fix: branch fix/expense-currency-limits (11ef82d7) migrations 00194/00195 raise both
# caps to MONEY_AMOUNT_MAX and add PHP. Seeds generated with the flag carry a precondition that
# refuses to run until those constraints are live on the target database.
MONEY_AMOUNT_MAX = 99999999.99
CURRENCY_FIX_CURRENCIES = {"PHP"}
CURRENCY_FIX = False
MI = 1609.344
L_PER_GAL = 3.78541
G = 9.81

# Per-user tables the seed owns. Children first. Every DELETE is scoped by user_id (or the
# user's own rides), so nothing outside the dedicated account is touched.
WIPE = [
    "DELETE FROM ride_waypoints WHERE ride_id IN (SELECT id FROM rides WHERE user_id = {u});",
    "DELETE FROM ride_rollups WHERE user_id = {u};",
    "DELETE FROM ride_records WHERE user_id = {u};",
    "DELETE FROM trip_waypoints WHERE trip_id IN (SELECT id FROM trips WHERE organiser_user_id = {u});",
    "DELETE FROM trip_participants WHERE trip_id IN (SELECT id FROM trips WHERE organiser_user_id = {u});",
    "DELETE FROM trips WHERE organiser_user_id = {u};",
    "DELETE FROM rides WHERE user_id = {u};",
    "DELETE FROM receipt_scans WHERE user_id = {u};",
    "DELETE FROM maintenance_task_line_items WHERE user_id = {u};",
    "DELETE FROM expenses WHERE user_id = {u};",
    "DELETE FROM maintenance_tasks WHERE user_id = {u};",
    "DELETE FROM odometer_readings WHERE user_id = {u};",
    "DELETE FROM recall_acknowledgements WHERE motorcycle_id IN (SELECT id FROM motorcycles WHERE user_id = {u});",
    "DELETE FROM diagnostics WHERE motorcycle_id IN (SELECT id FROM motorcycles WHERE user_id = {u});",
    "DELETE FROM notes WHERE motorcycle_id IN (SELECT id FROM motorcycles WHERE user_id = {u});",
    "DELETE FROM documents WHERE motorcycle_id IN (SELECT id FROM motorcycles WHERE user_id = {u});",
    "DELETE FROM share_links WHERE motorcycle_id IN (SELECT id FROM motorcycles WHERE user_id = {u});",
    "DELETE FROM motorcycles WHERE user_id = {u};",
]


class SchemaError(Exception):
    pass


def expense_max():
    return MONEY_AMOUNT_MAX if CURRENCY_FIX else EXPENSE_MAX


def purchase_max():
    return MONEY_AMOUNT_MAX if CURRENCY_FIX else PURCHASE_MAX


# Refuses the seed unless 00194 is live: PHP in the users allowlist and the raised amount cap.
CURRENCY_FIX_PRECONDITION = (
    "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_currency' "
    "AND pg_get_constraintdef(oid) LIKE '%PHP%') OR NOT EXISTS (SELECT 1 FROM pg_constraint "
    "WHERE conname = 'expenses_amount_check' AND pg_get_constraintdef(oid) LIKE '%99999999.99%') THEN "
    "RAISE EXCEPTION 'aso-v4 seed: generated with --assume-currency-fix, but migrations 00194/00195 "
    "(branch fix/expense-currency-limits) are not live here'; END IF; END $$;")


# ------------------------------------------------------------------ loading + validation
def load_market(cc, src_dir):
    mpath, rpath = src_dir / f"{cc}.json", src_dir / f"{cc}-route.geojson"
    if not mpath.exists():
        raise SchemaError(f"{mpath} not found")
    if not rpath.exists():
        raise SchemaError(f"{rpath} not found")
    return json.loads(mpath.read_text()), json.loads(rpath.read_text()), mpath, rpath


def route_coords(gj):
    """GeoJSON -> [(lat, lng, ele|None)]."""
    feats = gj["features"] if gj.get("type") == "FeatureCollection" else [gj]
    lines = []
    for f in feats:
        g = f["geometry"]
        if g["type"] == "LineString":
            lines.append(g["coordinates"])
        elif g["type"] == "MultiLineString":
            lines.extend(g["coordinates"])
    if not lines:
        raise SchemaError("route: no LineString geometry")
    out = []
    for line in lines:
        for c in line:
            out.append((float(c[1]), float(c[0]), float(c[2]) if len(c) > 2 and c[2] is not None else None))
    return out


def validate(m, gj):
    errs = []

    def need(path, cond, msg):
        if not cond:
            errs.append(f"{path}: {msg}")

    for k in ("cc", "app_language", "store_locales", "device", "measurement_system", "currency", "timezone",
              "rider", "bikes", "hero_ride", "fuel", "service", "trip"):
        need(k, k in m, "required")
    if errs:
        return errs
    need("app_language", m["app_language"] in APP_LANGUAGES, f"{m['app_language']!r} is not an app UI locale")
    need("measurement_system", m["measurement_system"] in ("metric", "imperial"), "metric | imperial")
    allowed = ALLOWED_CURRENCIES | (CURRENCY_FIX_CURRENCIES if CURRENCY_FIX else set())
    need("currency", m["currency"] in allowed,
         f"{m['currency']} is not in chk_users_currency (00131); "
         + ("" if CURRENCY_FIX else "00194 adds PHP: rerun with --assume-currency-fix once it is live"))
    try:
        ZoneInfo(m["timezone"])
    except Exception:  # noqa: BLE001
        errs.append(f"timezone: unknown {m['timezone']!r}")
    for k in ("display_name", "city", "home"):
        need(f"rider.{k}", k in m["rider"], "required")
    need("bikes", 1 <= len(m["bikes"]) <= 3, "1-3 bikes")
    keys = set()
    for i, b in enumerate(m["bikes"]):
        for k in ("key", "make", "model", "year", "odometer"):
            need(f"bikes[{i}].{k}", k in b, "required")
        need(f"bikes[{i}].type", b.get("type", "other") in BIKE_TYPES, f"one of {sorted(BIKE_TYPES)}")
        need(f"bikes[{i}].key", b.get("key") not in keys, "duplicate key")
        keys.add(b.get("key"))
        if b.get("purchase_price") is not None:
            need(f"bikes[{i}].purchase_price", b["purchase_price"] <= purchase_max(),
                 f"{b['purchase_price']} > {purchase_max()} (motorcycles CHECK, "
                 + ("00194)" if CURRENCY_FIX else "00052; 00194 raises it: --assume-currency-fix)"))
    h = m["hero_ride"]
    for k in ("name", "road", "date", "avg_speed_kmh", "max_speed_kmh", "max_lean_deg"):
        need(f"hero_ride.{k}", k in h, "required")
    f = m["fuel"]
    for k in ("label", "unit", "price_per_unit", "stations"):
        need(f"fuel.{k}", k in f, "required")
    need("fuel.unit", f.get("unit") in ("gal", "L"), "gal | L")
    s = m["service"]
    for k in ("title", "date", "odometer", "vendor", "tax_label", "tax_rate", "line_items"):
        need(f"service.{k}", k in s, "required")
    for i, li in enumerate(s.get("line_items", [])):
        need(f"service.line_items[{i}].service_type", li.get("service_type") in SERVICE_TYPES,
             f"{li.get('service_type')!r} not in the 00170 CHECK")
    for i, e in enumerate(m.get("expenses", [])):
        need(f"expenses[{i}].category", e.get("category") in EXPENSE_CATEGORIES, f"{e.get('category')!r}")
        need(f"expenses[{i}].amount", 0 < e.get("amount", 0) <= expense_max(),
             f"{e.get('amount')} outside (0, {expense_max()}] (expenses CHECK, "
             + ("00194)" if CURRENCY_FIX else "00036; 00194 raises it: --assume-currency-fix)"))
    t = m["trip"]
    for k in ("title", "start_date", "end_date", "stops"):
        need(f"trip.{k}", k in t, "required")
    need("trip.difficulty", t.get("difficulty", "moderate") in DIFFICULTIES, f"one of {sorted(DIFFICULTIES)}")
    for i, st in enumerate(t.get("stops", [])):
        need(f"trip.stops[{i}].type", st.get("type") in WAYPOINT_TYPES, f"{st.get('type')!r}")
    try:
        pts = route_coords(gj)
        need("route", len(pts) >= 20, f"only {len(pts)} points; densify to ~250 m")
        if len(pts) >= 2:
            gaps = [haversine(a[:2], b[:2]) for a, b in zip(pts, pts[1:])]
            need("route", max(gaps) < 3000, f"a {max(gaps):.0f} m gap between points: densify along the road")
            home = m["rider"].get("home")
            if home:
                d = haversine(home, pts[0][:2]) / 1000
                if d > 600:
                    errs.append(f"route: starts {d:.0f} km from rider.home (warning only if intended)")
    except SchemaError as e:
        errs.append(str(e))
    return errs


# ------------------------------------------------------------------ generation
class Seed:
    def __init__(self, m, gj, user_id, email, today, geo, rng):
        self.m, self.gj, self.user, self.email, self.today, self.geo, self.rng = m, gj, user_id, email, today, geo, rng
        self.cc = m["cc"].upper()
        self.uid = make_uid(uuid.uuid5(NS, self.cc))
        self.tz = ZoneInfo(m["timezone"])
        self.imperial = m["measurement_system"] == "imperial"
        self.unit = "mi" if self.imperial else "km"
        self.cur = m["currency"]
        self.sql = []
        self.summary = {"cc": self.cc, "email": email, "user_id": user_id, "notes": []}
        self.ids = {"cc": self.cc, "email": email, "user_id": user_id, "bikes": {}}
        self.rides = []
        self.expense_rows = []

    # -- helpers
    def U(self):
        return q(self.user)

    def km_to_unit(self, km):
        return km * 1000 / MI if self.imperial else km

    def unit_to_km(self, v):
        return v * MI / 1000 if self.imperial else v

    def ts(self, day, hh=11, mm=0):
        return datetime.combine(day, time(hh, mm), self.tz).isoformat()

    def money(self, v):
        return round(float(v), 2)

    # -- sections
    def guard_and_user(self):
        u = self.U()
        self.sql += [
            "BEGIN;",
            *([CURRENCY_FIX_PRECONDITION] if CURRENCY_FIX else []),
            "-- Guard: only the dedicated screenshot account, never a real rider.",
            "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = " + u + " AND email = " + q(self.email)
            + ") THEN RAISE EXCEPTION 'aso-v4 seed: users row " + self.user + " with email " + self.email
            + " not found; create the account first (RUNBOOK step 3)'; END IF; END $$;",
            f"DO $$ BEGIN IF {q(self.email)} NOT LIKE 'screenshots+%@motovault.app' THEN RAISE EXCEPTION "
            "'aso-v4 seed: refusing a non-screenshot email'; END IF; END $$;",
        ]
        self.sql += [w.format(u=u) for w in WIPE]
        r = self.m["rider"]
        self.sql.append(
            f"UPDATE users SET measurement_system = {q(self.m['measurement_system'])}, currency = {q(self.cur)}, "
            f"display_name = {q(r['display_name'])}, city = {q(r['city'])}, "
            f"onboarding_completed_at = COALESCE(onboarding_completed_at, {q(self.ts(self.today - timedelta(days=200)))}), "
            # Analytics off on the account itself, so nothing server-side treats it as consented.
            "preferences = COALESCE(preferences, '{}'::jsonb) || jsonb_build_object('privacy', "
            "COALESCE(preferences->'privacy', '{}'::jsonb) || '{\"analyticsEnabled\": false}'::jsonb) "
            # The app routes on preferences.onboardingCompleted (isServerOnboardingComplete),
            # not onboarding_completed_at; without it a signed-in demo account stays in onboarding.
            "|| '{\"onboardingCompleted\": true}'::jsonb "
            f"WHERE id = {u};"
        )
        self.sql += self.no_signup_event()

    def no_signup_event(self):
        """Pre-claim the signup sweep (00174/00183) so it never emits a PostHog signup for this account.
        The sweep claims users older than 10 minutes with no signup_event_log row; this row makes it
        skip the account. Also written standalone as account.sql, to run right after creation."""
        return [f"INSERT INTO signup_event_log (user_id) VALUES ({self.U()}) ON CONFLICT (user_id) DO NOTHING;"]

    def account_sql(self):
        u = self.U()
        return "\n".join([
            "BEGIN;",
            "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = " + u + " AND email = " + q(self.email)
            + ") THEN RAISE EXCEPTION 'aso-v4 account: users row not found'; END IF; END $$;",
            *self.no_signup_event(),
            "UPDATE users SET preferences = COALESCE(preferences, '{}'::jsonb) || jsonb_build_object('privacy', "
            "COALESCE(preferences->'privacy', '{}'::jsonb) || '{\"analyticsEnabled\": false}'::jsonb) "
            "|| '{\"onboardingCompleted\": true}'::jsonb, "
            f"onboarding_completed_at = COALESCE(onboarding_completed_at, now()) WHERE id = {u};",
            "COMMIT;", ""])

    def bikes(self):
        season_km = self.m.get("season", {}).get("distance_km", 9000)
        shares = self.bike_shares()
        for i, b in enumerate(self.m["bikes"]):
            bid = self.uid("bike", b["key"])
            odo = int(b["odometer"])
            jan1 = int(b.get("odometer_jan1", round(odo - self.km_to_unit(season_km * shares[i]))))
            jan1 = max(0, jan1)
            # The garage lists newest first: the primary bike gets the latest created_at.
            created = b.get("created_at", f"{date(self.today.year, 4, 2) - timedelta(days=i)} 09:00:00+00")
            self.sql.append(
                "INSERT INTO motorcycles (id,user_id,make,model,year,nickname,variant,is_primary,type,current_mileage,"
                "mileage_unit,distance_unit,engine_cc,purchase_date,purchase_price,created_at) VALUES ("
                + ",".join(q(x) for x in (bid, self.user, b["make"], b["model"], b["year"], b.get("nickname"),
                                          b.get("variant"), i == 0))
                + f",{q(b.get('type', 'other'))}::motorcycle_type,{odo},{q(self.unit)},{q(self.unit)},"
                f"{q(b.get('engine_cc'))},{q(b.get('purchase_date'))},{q(b.get('purchase_price'))},{q(created)});"
            )
            self.reading(bid, jan1, date(self.today.year, 1, 1))
            self.ids["bikes"][b["key"]] = {"id": bid, "odometer": odo, "unit": self.unit,
                                          "label": b.get("nickname") or f"{b['make']} {b['model']}"}
            b["_id"], b["_jan1"] = bid, jan1
        self.primary = self.m["bikes"][0]

    def bike_shares(self):
        n = len(self.m["bikes"])
        return [1.0] if n == 1 else ([0.8, 0.2] if n == 2 else [0.7, 0.2, 0.1])

    def reading(self, bid, value, day):
        self.sql.append(
            f"INSERT INTO odometer_readings (user_id,motorcycle_id,value,recorded_at,source) VALUES "
            f"({self.U()},{q(bid)},{int(value)},{q(self.ts(day, 9))},'manual');"
        )

    def task_completed(self, key, bid, title, day, odo, items, vendor, tax=None, source="user"):
        """A completed job + its line items + the linked maintenance expense (createFromTask mirror)."""
        tid = self.uid("task", key)
        total = parts = labor = None
        if items:
            labor = self.money(sum(a["amount"] for a in items if a["service_type"] == "general_service"))
            parts = self.money(sum(a["amount"] for a in items if a["service_type"] != "general_service"))
            total = self.money(parts + labor + (tax["amount"] if tax and not tax["included"] else 0))
        done = self.ts(day)
        self.sql.append(
            "INSERT INTO maintenance_tasks (id,user_id,motorcycle_id,title,status,priority,source,completed_at,"
            "completed_mileage,due_date,parts_cost,labor_cost,tax_amount,tax_rate,total_amount,currency,notes,created_at) "
            "VALUES (" + ",".join(q(x) for x in (
                tid, self.user, bid, title, "completed", "medium", source, done, int(odo), day.isoformat(), parts, labor,
                tax["amount"] if tax else None, tax["rate"] if tax else None, total, self.cur, vendor, done)) + ");"
        )
        for i, li in enumerate(items):
            self.sql.append(
                "INSERT INTO maintenance_task_line_items (task_id,user_id,service_type,label,part_ref,quantity,unit_price,"
                f"line_total,sort_order) VALUES ({q(tid)},{self.U()},{q(li['service_type'])},{q(li['label'])},"
                f"{q(li.get('part_ref'))},1,{li['amount']},{li['amount']},{i});"
            )
        if total:
            self.expense(f"svc-{key}", bid, day, total, "maintenance", None, title, task_id=tid)
        self.reading(bid, odo, day)
        return tid, total

    def expense(self, key, bid, day, amount, category, item, desc, task_id=None):
        amount = self.money(amount)
        if not 0 < amount <= expense_max():
            raise SchemaError(f"expense {key}: {amount} {self.cur} is outside the expenses CHECK (0, {expense_max()}]"
                              + ("" if CURRENCY_FIX else "; 00194 raises it: --assume-currency-fix"))
        self.sql.append(
            "INSERT INTO expenses (id,user_id,motorcycle_id,amount,category,date,item_name,description,maintenance_task_id,"
            "currency) VALUES (" + ",".join(q(x) for x in (self.uid("exp", key), self.user, bid, amount, category,
                                                             day.isoformat(), item, desc, task_id, self.cur)) + ");"
        )
        self.expense_rows.append((bid, day, amount, category))

    def services(self):
        s, bid = self.m["service"], self.primary["_id"]
        items = [dict(li, amount=self.money(li["amount"])) for li in s["line_items"]]
        base = sum(li["amount"] for li in items)
        included = bool(s.get("tax_included"))
        tax_amt = self.money(base - base / (1 + s["tax_rate"]) if included else base * s["tax_rate"])
        tax = {"amount": tax_amt, "rate": s["tax_rate"], "included": included, "label": s["tax_label"]}
        sday = date.fromisoformat(s["date"])
        tid, total = self.task_completed("service-main", bid, s["title"], sday, s["odometer"], items, s["vendor"], tax)
        self.ids["service_task_id"] = tid
        self.summary["service"] = {"title": s["title"], "total": total, "tax": tax_amt, "lines": len(items)}
        self.scan_payload = {
            "type": "maintenance", "amount": total, "currency": self.cur, "date": s["date"], "vendor": s["vendor"],
            "itemName": s["title"], "category": "maintenance",
            # The review card checks parts + labor + tax <= total, so with tax included in the
            # line prices the breakdown is the net (pre-tax) share of each.
            "partsCost": self.money(sum(li["amount"] for li in items if li["service_type"] != "general_service")
                                    / ((1 + s["tax_rate"]) if included else 1)),
            "laborCost": self.money(total - tax_amt - self.money(sum(li["amount"] for li in items if li["service_type"] != "general_service")
                                    / ((1 + s["tax_rate"]) if included else 1))) if included else
                         self.money(sum(li["amount"] for li in items if li["service_type"] == "general_service")),
            "taxAmount": tax_amt, "taxRate": s["tax_rate"],
            "lineItems": [{"label": li["label"], "serviceType": li["service_type"], "partRef": li.get("part_ref"),
                           "quantity": 1, "unitPrice": li["amount"], "lineTotal": li["amount"]} for li in items],
            "odometerValue": s["odometer"], "odometerUnit": self.unit, "fuelLitres": None, "vinOrPlate": None,
            "partsNeeded": [],
            "fieldConfidence": {"amount": 0.97, "currency": 0.99, "date": 0.96, "vendor": 0.93, "category": 0.9,
                                "odometer": 0.88},
            "legibilityNote": None, "needsCheck": [],
        }
        # Breakdown must not exceed the total, or the review card disables Save (#320 shows why).
        bd = self.scan_payload["partsCost"] + self.scan_payload["laborCost"] + tax_amt
        assert round(bd, 2) <= round(total, 2) + 0.001, (bd, total)

        # Older history: given, or generated back from the main service every service_interval.
        hist = self.m.get("history_services")
        if hist is None:
            iv = self.m.get("service_interval", 6000 if not self.imperial else 5000)
            hist, odo, day = [], s["odometer"] - iv, sday
            while odo > iv * 0.6 and len(hist) < 4:
                day = day - timedelta(days=int(330 * self.rng.uniform(0.8, 1.1)))
                # "20,000-mile service" -> "15,000-mile service"; titles without a number are reused as-is.
                grouped = f"{int(round(odo, -3)):,}".replace(",", "." if self.decimal_comma() else ",")
                title = re.sub(r"\d[\d.,]*", grouped, s["title"], count=1)
                hist.append({"title": title, "date": day.isoformat(), "odometer": int(odo),
                             "amount": self.money(total * self.rng.uniform(0.75, 0.95))})
                odo -= iv
            self.summary["notes"].append("history_services generated from service_interval: review titles")
        for i, h in enumerate(hist):
            hid = self.uid("task", f"hist-{i}")
            day = date.fromisoformat(h["date"])
            done = self.ts(day)
            amt = self.money(h["amount"]) if h.get("amount") else None
            self.sql.append(
                "INSERT INTO maintenance_tasks (id,user_id,motorcycle_id,title,status,priority,source,completed_at,"
                "completed_mileage,due_date,total_amount,currency,notes,created_at) VALUES ("
                + ",".join(q(x) for x in (hid, self.user, bid, h["title"], "completed", "medium", "user", done,
                                          int(h["odometer"]), h["date"], amt, self.cur, h.get("vendor", s["vendor"]), done)) + ");"
            )
            if amt:
                self.expense(f"hist-{i}", bid, day, amt, "maintenance", None, h["title"], task_id=hid)
            self.reading(bid, h["odometer"], day)

    def receipt_scan(self):
        """A success-but-unreviewed scan: the review card opens from it via scan-receipt?resumeScanId=…
        with no AI call and no quota spent at capture time. Saving it in the app would create a second
        service record, so the capture flow never taps Save."""
        sid = self.uid("scan", "service-main")
        s = self.m["service"]
        self.sql.append(
            "INSERT INTO receipt_scans (id,user_id,status,extraction_payload,storage_path,is_onboarding,consumed_month,"
            f"created_at) VALUES ({q(sid)},{self.U()},'success',{q(self.scan_payload)},NULL,false,"
            f"{q(date.fromisoformat(s['date']).replace(day=1).isoformat())},{q(self.ts(self.today - timedelta(days=1), 18))});"
        )
        self.ids["scan_id"] = sid
        self.summary["notes"].append("receipt scan has storage_path NULL: the review card shows no photo thumbnail "
                                     "unless the receipt image is uploaded to the receipts bucket (RUNBOOK 4b)")

    def reminders(self):
        tasks = self.m.get("tasks")
        p = self.primary
        if tasks is None:
            iv = self.m.get("service_interval", 6000 if not self.imperial else 5000)
            nxt = self.m["service"]["odometer"] + iv
            tasks = [{"title": self.m["service"]["title"], "target_odometer": nxt, "priority": "medium"}]
            self.summary["notes"].append("tasks generated: add an overdue one in the market file")
        self.ids["tasks"] = []
        for i, t in enumerate(tasks):
            bkey = t.get("bike", p["key"])
            bid = self.ids["bikes"][bkey]["id"]
            tid = self.uid("task", f"rem-{i}")
            self.sql.append(
                "INSERT INTO maintenance_tasks (id,user_id,motorcycle_id,title,status,priority,source,due_date,"
                "target_mileage,currency,remind_7d,created_at) VALUES ("
                + ",".join(q(x) for x in (tid, self.user, bid, t["title"], "pending", t.get("priority", "medium"), "user",
                                          t.get("due_date"), t.get("target_odometer"), self.cur, True,
                                          self.ts(self.today - timedelta(days=40), 9))) + ");"
            )
            self.ids["tasks"].append({"id": tid, "title": t["title"]})

    def fixed_expenses(self):
        for i, e in enumerate(self.m.get("expenses", [])):
            bid = self.ids["bikes"][e.get("bike", self.primary["key"])]["id"]
            self.expense(f"fix-{i}", bid, date.fromisoformat(e["date"]), e["amount"], e["category"], e.get("item"),
                         e.get("vendor"))

    # -- rides
    def add_ride(self, key, bid, name, start, coords, dist_m, avg_mps, gain, loss, max_mps, lean=None, wps=None):
        moving = int(round(dist_m / avg_mps))
        r = dict(id=self.uid("ride", key), bike=bid, name=name, start=start, end=start + timedelta(seconds=moving),
                 dist_m=int(round(dist_m)), avg=avg_mps, max=max_mps, gain=gain, loss=loss, lean=lean,
                 poly=encode(simplify(coords, 120)) if coords else None, wps=wps)
        self.rides.append(r)
        return r

    def hero(self):
        h = self.m["hero_ride"]
        raw = route_coords(self.gj)
        coords = [(a, b) for a, b, _ in raw]
        pts = simplify(coords, 230)
        if len(pts) > 1500:
            pts = pts[:: math.ceil(len(pts) / 1500)] + [pts[-1]]
        if all(e is not None for _, _, e in raw):
            # Resample z onto the simplified points by nearest original index.
            j, ele = 0, []
            for p in pts:
                while j < len(raw) - 1 and (raw[j][0], raw[j][1]) != p:
                    j += 1
                ele.append(raw[j][2])
            src = "geojson z"
        else:
            cached = f"hero-{self.cc}" in self.geo.elev
            n_fb = len(self.geo.fallbacks)
            ele = self.geo.elevations(f"hero-{self.cc}", pts)
            src = "synthetic (DEM unavailable)" if len(self.geo.fallbacks) > n_fb else (
                "Open-Meteo DEM" + (" (cache)" if cached else ""))
        ele = [round(v, 1) for v in smooth(ele, 3)]
        gain, loss = gain_loss(ele)
        if h.get("elevation_gain_m"):
            f = h["elevation_gain_m"] / max(gain, 1)
            gain, loss = h["elevation_gain_m"], round(loss * f)
        dist = path_length(coords)  # the full road geometry; the 230 m resample cuts corners
        avg = h["avg_speed_kmh"] / 3.6
        vmax = h["max_speed_kmh"] / 3.6
        lean_cap = float(h["max_lean_deg"])

        # Speed + lean from road curvature: tight turns are slow and leaned over, straights run
        # near vmax. The profile is then scaled so the moving average equals the market file,
        # and lean is normalised so its 99th percentile is max_lean_deg.
        n = len(pts)
        hdg = [bearing(pts[i], pts[i + 1]) for i in range(n - 1)] + [0.0]
        # Curvature from the DENSE road geometry (+-100 m around each kept point): the 230 m
        # resample would read every hairpin as a gentle bend.
        dense_hdg = [bearing(coords[j], coords[j + 1]) for j in range(len(coords) - 1)]
        dense_cum = [0.0]
        for a_, b_ in zip(coords, coords[1:]):
            dense_cum.append(dense_cum[-1] + haversine(a_, b_))
        where, j = [], 0
        for p in pts:
            while j < len(coords) - 1 and coords[j] != p:
                j += 1
            where.append(j)
        radius, turn = [], []
        for i in range(n):
            c = min(where[i], len(dense_hdg) - 1)
            lo_, hi_ = c, c
            while lo_ > 0 and dense_cum[c] - dense_cum[lo_] < 100:
                lo_ -= 1
            while hi_ < len(dense_hdg) - 1 and dense_cum[hi_] - dense_cum[c] < 100:
                hi_ += 1
            steps = [(dense_hdg[k_] - dense_hdg[k_ - 1] + 540) % 360 - 180 for k_ in range(lo_ + 1, hi_ + 1)]
            dh = sum(steps)  # signed: which way the bike leans
            span = max(dense_cum[hi_] - dense_cum[lo_], 1.0)
            radius.append(span / max(math.radians(sum(abs(x) for x in steps)), 1e-3))  # abs: S-bends don't cancel
            turn.append(dh)
        rad_s = radius
        # Road-router geometry rounds off hairpins, so absolute physics under-reads them. Use the
        # radius relative to this road instead: the straightest 30% runs at vmax, tighter bends
        # scale with sqrt(radius) like a constant-lean corner.
        r_ref = sorted(rad_s)[int(0.7 * (n - 1))]
        v_curve = smooth([vmax * min(1.0, math.sqrt(r / r_ref)) for r in rad_s], 2)
        noise, base = 0.0, []
        for v in v_curve:
            noise = 0.85 * noise + 0.15 * self.rng.gauss(0, 0.08)
            base.append(max(3.0, v * (0.95 + noise)))
        seg_len = [haversine(pts[i - 1], pts[i]) for i in range(1, n)]
        moving_s = dist / avg
        speeds = base
        for _ in range(8):  # scale to the target average, clip at vmax, repeat until stable
            seg_t = [d / ((speeds[i] + speeds[i + 1]) / 2) for i, d in enumerate(seg_len)]
            k = sum(seg_t) / (moving_s * path_length(pts) / dist)
            speeds = [min(vmax, s * k) for s in speeds]
        seg_t = [d / ((speeds[i] + speeds[i + 1]) / 2) for i, d in enumerate(seg_len)]
        seg_t = [t * moving_s / sum(seg_t) for t in seg_t]
        raw_lean = [math.degrees(math.atan(speeds[i] ** 2 / (G * max(rad_s[i], 5.0)))) for i in range(n)]
        p99 = sorted(raw_lean)[int(0.99 * (n - 1))] or 1.0
        lean = [min(lean_cap, l * lean_cap / p99) * (1 if turn[i] >= 0 else -1) for i, l in enumerate(raw_lean)]
        day = date.fromisoformat(h["date"])
        hh, mm = map(int, h.get("start_time", "09:30").split(":"))
        start = datetime.combine(day, time(hh, mm), self.tz)
        wps, el = [], 0.0
        for i, p in enumerate(pts):
            if i:
                el += seg_t[i - 1]
            wps.append((start + timedelta(seconds=el), p[0], p[1], ele[i], round(speeds[i], 2), round(hdg[i], 1),
                        round(lean[i], 1)))
        max_lean = max(abs(x) for x in lean)
        r = self.add_ride("hero", self.primary["_id"], h["name"], start, coords, dist, avg, gain, loss,
                          round(max(speeds), 2), round(max_lean, 1), wps)
        self.ids["hero_ride_id"] = r["id"]
        self.summary["hero"] = {
            "name": h["name"], "road": h["road"], "km": round(dist / 1000, 1), "mi": round(dist / MI, 1),
            "moving_min": round((r["end"] - r["start"]).total_seconds() / 60), "avg_kmh": h["avg_speed_kmh"],
            "max_kmh": round(max(speeds) * 3.6), "gain_m": gain, "max_lean": round(max_lean, 1),
            "waypoints": len(wps), "elevation_source": src}

    def other_rides(self):
        taken = {date.fromisoformat(self.m["hero_ride"]["date"])}
        named = []
        home = tuple(self.m["rider"]["home"])
        for i, o in enumerate(self.m.get("other_rides", [])):
            day = date.fromisoformat(o["date"])
            taken.add(day)
            if o.get("waypoints"):
                coords = self.geo.route([tuple(p) for p in o["waypoints"]])
                dist = path_length(coords)
            else:
                dist = o["distance_km"] * 1000
                coords = self.loop_near(home, dist, seed=i)
            avg = o.get("avg_speed_kmh", 55) / 3.6
            gain = o.get("elevation_gain_m", int(dist / 1000 * 9))
            bid = self.ids["bikes"][o.get("bike", self.primary["key"])]["id"]
            start = datetime.combine(day, time(*map(int, o.get("start_time", "09:00").split(":"))), self.tz)
            self.add_ride(f"named-{i}", bid, o["name"], start, coords, dist, avg, gain, gain,
                          round(avg * self.rng.uniform(1.6, 1.9), 2))
            named.append((o["name"], coords, dist, avg, gain / max(dist / 1000, 1)))
        self.fill_season(named, taken, home)

    def loop_near(self, home, dist_m, seed=0):
        """Closed loop of roughly dist_m around home: used when a ride has no waypoints. Not on real roads,
        so such rides should never be the one on screen (the hero ride always is)."""
        r = dist_m / (2 * math.pi) / 111000
        rng = random.Random(seed)
        ph = rng.uniform(0, math.pi)
        pts = []
        for i in range(121):
            a = 2 * math.pi * i / 120
            w = 1 + 0.18 * math.sin(3 * a + ph) + 0.07 * math.sin(7 * a)
            pts.append((home[0] + r * w * math.sin(a), home[1] + r * w * (1 - math.cos(a)) / math.cos(math.radians(home[0]))))
        return pts

    def fill_season(self, named, taken, home):
        season = self.m.get("season", {})
        n_total = season.get("rides", 60)
        km_total = season.get("distance_km", 9000)
        have_km = sum(r["dist_m"] for r in self.rides) / 1000
        n = max(0, n_total - len(self.rides))
        if n == 0:
            return
        remaining = max(km_total - have_km, n * 25)
        southern = home[0] < 0
        start = date(self.today.year, 1, 2)
        end = min(self.today - timedelta(days=2), date.fromisoformat(self.m["hero_ride"]["date"]) + timedelta(days=20))
        winter = (6, 7, 8) if southern else (1, 2, 12)
        days = []
        while len(days) < n:
            d = start + timedelta(days=self.rng.randrange((end - start).days + 1))
            if d in taken or d in days or (d.month in winter and self.rng.random() < 0.55):
                continue
            days.append(d)
        days.sort()
        weights = [self.rng.uniform(0.5, 1.6) for _ in range(n)]
        scale = remaining / sum(weights)
        templates = named or [("Ride", None, 120000, 55 / 3.6, 9)]
        shares = self.bike_shares()
        bikes = [b["_id"] for b in self.m["bikes"]]
        for i, d in enumerate(days):
            name, coords, base_dist, avg, gpk = templates[i % len(templates)]
            km = weights[i] * scale
            bid = self.rng.choices(bikes, weights=shares)[0]
            hh = self.rng.choice([8, 9, 10, 15, 16]) if d.weekday() >= 5 else self.rng.choice([7, 17, 18])
            start_dt = datetime.combine(d, time(hh, self.rng.choice([0, 10, 20, 30, 40, 50])), self.tz)
            c = coords if coords and abs(km * 1000 - base_dist) / base_dist < 0.5 else self.loop_near(home, km * 1000, seed=100 + i)
            g = int(km * gpk * self.rng.uniform(0.85, 1.15))
            a = avg * self.rng.uniform(0.94, 1.05)
            self.add_ride(f"fill-{i}", bid, name, start_dt, c, km * 1000, a, g, g, round(a * self.rng.uniform(1.6, 1.9), 2))
        self.summary["notes"].append(f"{n} filler rides reuse the named ride titles to reach the season totals")

    def fuel(self):
        f = self.m["fuel"]
        cons_l_100 = {"touring": 5.6, "cruiser": 5.4, "dual_sport": 5.0, "sportbike": 6.0, "scooter": 3.0}
        for b in self.m["bikes"]:
            rides = [r for r in self.rides if r["bike"] == b["_id"]]
            km = sum(r["dist_m"] for r in rides) / 1000
            litres = km * cons_l_100.get(b.get("type"), 4.8) / 100
            fill_lo, fill_hi = f.get("fill_size", [3.8, 5.4] if f["unit"] == "gal" else [12, 17])
            per = (fill_lo + fill_hi) / 2 * (L_PER_GAL if f["unit"] == "gal" else 1)
            n = max(3, min(45, round(litres / per)))
            ride_days = sorted({r["start"].date() for r in rides}) or [self.today]
            pick = sorted(set(ride_days[round(i * (len(ride_days) - 1) / max(n - 1, 1))] for i in range(n)))
            # The hero ride day gets a fill-up at a station on the route, for the expenses screen.
            for i, day in enumerate(pick):
                qty = round(self.rng.uniform(fill_lo, fill_hi), 1)
                price = f["price_per_unit"] * self.rng.uniform(0.96, 1.04)
                amt = self.money(qty * price)
                label = f"{f['label']} · {self.fmt_qty(qty)} {f['unit']}"
                self.expense(f"fuel-{b['key']}-{i}", b["_id"], day, amt, "fuel", label, self.rng.choice(f["stations"]))

    def last_year_mirror(self):
        """Last year's running costs, so the dashboard's year-over-year delta is plausible
        (otherwise this year reads as +1,800% against one old service). Mirrors this year's
        fuel and fixed expenses one year back at ~92% of the amount; maintenance already has
        its own history."""
        this_year = self.today.year
        rows = [r for r in list(self.expense_rows) if r[1].year == this_year and r[3] != "maintenance"]
        for i, (bid, day, amount, category) in enumerate(rows):
            try:
                prev = day.replace(year=this_year - 1)
            except ValueError:
                prev = day.replace(year=this_year - 1, day=28)
            amt = self.money(amount * self.rng.uniform(0.86, 0.98))
            self.expense(f"prev-{i}", bid, prev, amt, category, None, None)

    def decimal_comma(self):
        return self.m["app_language"] in {"es", "de", "fr", "it", "pt-BR"} or self.m.get("device", {}).get(
            "apple_locale", "").split("_")[-1] in {"ES", "FR", "IT", "DE", "BR", "AR", "CO"}

    def fmt_qty(self, v):
        s = f"{v:.1f}"
        return s.replace(".", ",") if self.decimal_comma() else s

    def odometer_on_rides(self):
        """Readings at the hero ride so the odometer chart has a recent point."""
        for b in self.m["bikes"]:
            self.reading(b["_id"], b["odometer"], self.today - timedelta(days=2))

    def write_rides(self):
        region = self.m.get("region_code", self.cc)
        for r in self.rides:
            self.sql.append(
                "INSERT INTO rides (id,user_id,motorcycle_id,status,started_at,ended_at,paused_duration_s,"
                "auto_paused_duration_s,distance_m,max_speed_mps,avg_speed_mps,max_lean_angle,elevation_gain,elevation_loss,"
                "route_polyline,mileage_applied,region,name,created_at) VALUES ("
                + ",".join(q(x) for x in (r["id"], self.user, r["bike"], "completed", r["start"].isoformat(),
                                          r["end"].isoformat(), 0, 0, r["dist_m"], r["max"], round(r["avg"], 4), r["lean"],
                                          r["gain"], r["loss"], r["poly"], True, region, r["name"], r["end"].isoformat()))
                + ");"
            )
            if r["wps"]:
                for i in range(0, len(r["wps"]), 500):
                    vals = ",".join(
                        f"({q(r['id'])},{q(t.isoformat())},{la:.6f},{lo:.6f},{al},{sp},{hd},{ln},5)"
                        for t, la, lo, al, sp, hd, ln in r["wps"][i : i + 500])
                    self.sql.append("INSERT INTO ride_waypoints (ride_id,recorded_at,latitude,longitude,altitude,speed_mps,"
                                    f"heading,lean_angle,accuracy) VALUES {vals};")
        km = sum(r["dist_m"] for r in self.rides) / 1000
        self.summary["season"] = {"rides": len(self.rides), "km": round(km), "mi": round(km * 1000 / MI)}

    def trip(self):
        t = self.m["trip"]
        tid = self.uid("trip", "main")
        stops = t["stops"]
        legs = [(s["lat"], s["lng"]) for s in stops]
        coords = self.geo.route(legs)
        dist = path_length(coords)
        days = (date.fromisoformat(t["end_date"]) - date.fromisoformat(t["start_date"])).days + 1
        self.sql.append(
            "INSERT INTO trips (id,organiser_user_id,title,description,difficulty,start_date,end_date,status,visibility,"
            "max_riders,day_count,distance_m,polyline,country_code,city,start_lat,start_lng,surface_type,created_at) VALUES ("
            + ",".join(q(x) for x in (tid, self.user, t["title"], t.get("description", ""), t.get("difficulty", "moderate"),
                                      t["start_date"], t["end_date"], t.get("status", "draft")))
            + f",'private'::content_visibility,{t.get('max_riders', 4)},{days},{int(dist)},{q(encode(simplify(coords, 150)))},"
            f"{q(self.cc)},{q(self.m['rider']['city'])},{stops[0]['lat']},{stops[0]['lng']},'paved',"
            f"{q(self.ts(self.today - timedelta(days=6), 20))});"
        )
        for i, s in enumerate(stops):
            self.sql.append(
                "INSERT INTO trip_waypoints (trip_id,sort_order,day_index,type,name,notes,lat,lng) VALUES ("
                + ",".join(q(x) for x in (tid, i, s.get("day", 0), s["type"], s["name"], s.get("notes"), s["lat"], s["lng"]))
                + ");")
        self.sql.append(
            f"INSERT INTO trip_participants (trip_id,user_id,role,status,bike_id) VALUES ({q(tid)},{self.U()},'organizer',"
            f"'going',{q(self.primary['_id'])});")
        self.ids["trip_id"] = tid
        self.summary["trip"] = {"title": t["title"], "km": round(dist / 1000), "days": days, "stops": len(stops)}

    def costs_summary(self):
        y = self.today.year
        p = self.primary["_id"]
        this = [a for b, d, a, c in self.expense_rows if b == p and d.year == y]
        by_cat = {}
        for b, d, a, c in self.expense_rows:
            if b == p and d.year == y:
                by_cat[c] = round(by_cat.get(c, 0) + a, 2)
        alltime = sum(a for b, d, a, c in self.expense_rows if b == p)
        self.summary["primary_costs"] = {
            "year_total": round(sum(this), 2), "by_category": dict(sorted(by_cat.items(), key=lambda kv: -kv[1])),
            "all_time": round(alltime, 2),
            f"per_{self.unit}": round(alltime / max(self.primary["odometer"], 1), 3), "currency": self.cur}
        self.ids["expense_year_total"] = round(sum(this), 2)

    def build(self, repo_root):
        self.guard_and_user()
        self.bikes()
        self.services()
        self.receipt_scan()
        self.reminders()
        self.fixed_expenses()
        self.hero()
        self.other_rides()
        self.fuel()
        self.last_year_mirror()
        self.odometer_on_rides()
        self.write_rides()
        self.trip()
        self.sql += rollup_backfill_sql(repo_root, self.user)
        self.sql.append("COMMIT;")
        self.costs_summary()
        self.summary["geo_fallbacks"] = self.geo.fallbacks
        self.summary["sql_statements"] = len(self.sql)

    def teardown(self):
        u = self.U()
        return "\n".join([
            "-- aso-v4 teardown for " + self.email + ": removes every seeded row. The auth user itself is deleted",
            "-- separately with the Auth Admin API (RUNBOOK step 9), which cascades the users row.",
            "-- NEVER remove a demo account through the app's delete-account flow: the API's",
            "-- UsersService.cancelSubscription calls RevenueCat (DELETE subscriber) on that path.",
            "BEGIN;",
            "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = " + u + " AND email = " + q(self.email)
            + ") THEN RAISE EXCEPTION 'aso-v4 teardown: account not found'; END IF; END $$;",
            *[w.format(u=u) for w in WIPE],
            f"UPDATE users SET onboarding_completed_at = NULL WHERE id = {u};",
            "COMMIT;", ""])


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("cc")
    ap.add_argument("--user-id", default=PLACEHOLDER_USER, help="auth/users id of the market account")
    ap.add_argument("--email", help=f"default {EMAIL_PATTERN}")
    ap.add_argument("--fixtures", action="store_true", help="read pipeline/fixtures/markets instead of ../markets")
    ap.add_argument("--markets-dir", type=Path)
    ap.add_argument("--out", type=Path)
    ap.add_argument("--offline", action="store_true", help="no OSRM/Open-Meteo calls (cache, else synthetic)")
    ap.add_argument("--validate", action="store_true")
    ap.add_argument("--today", default=None, help="YYYY-MM-DD the data is relative to (default: today)")
    ap.add_argument("--assume-currency-fix", action="store_true",
                    help="allow PHP and amounts up to 99,999,999.99 (migrations 00194/00195, branch "
                         "fix/expense-currency-limits). The SQL then refuses to run until those are live")
    a = ap.parse_args()
    global CURRENCY_FIX
    CURRENCY_FIX = a.assume_currency_fix
    cc = a.cc.upper()
    src = a.markets_dir or (HERE / "fixtures" / "markets" if a.fixtures else ASO_V4 / "markets")
    try:
        m, gj, mpath, rpath = load_market(cc, src)
    except SchemaError as e:
        sys.exit(f"{cc}: {e}")
    errs = validate(m, gj)
    hard = [e for e in errs if "warning only" not in e]
    for e in errs:
        print(f"{cc}: {e}", file=sys.stderr)
    if a.validate or hard:
        sys.exit(1 if hard else 0)
    email = a.email or EMAIL_PATTERN.format(cc=cc.lower())
    out = a.out or HERE / "out" / "seed" / cc
    out.mkdir(parents=True, exist_ok=True)
    today = date.fromisoformat(a.today) if a.today else date.today()
    seed = Seed(m, gj, a.user_id, email, today, Geo(out / "cache", offline=a.offline), random.Random(f"aso-v4/{cc}"))
    try:
        seed.build(REPO)
    except SchemaError as e:
        sys.exit(f"{cc}: {e}")
    if CURRENCY_FIX:
        seed.summary["notes"].insert(0, "generated with --assume-currency-fix: apply only after 00194 + 00195 are live")
    if a.user_id == PLACEHOLDER_USER:
        seed.summary["notes"].insert(0, "PLACEHOLDER user id: this SQL fails its own guard until regenerated with --user-id")
    seed.summary["source"] = {"market": str(mpath), "route": str(rpath)}
    (out / "seed.sql").write_text("\n".join(seed.sql) + "\n")
    (out / "teardown.sql").write_text(seed.teardown())
    (out / "account.sql").write_text(seed.account_sql())
    (out / "ids.json").write_text(json.dumps(seed.ids, indent=1, ensure_ascii=False))
    (out / "summary.json").write_text(json.dumps(seed.summary, indent=1, ensure_ascii=False, default=str))
    print(json.dumps(seed.summary, indent=1, ensure_ascii=False, default=str))
    print(f"\n{cc}: wrote {out}/seed.sql ({(out / 'seed.sql').stat().st_size // 1024} KB), teardown.sql, ids.json, summary.json")


if __name__ == "__main__":
    main()
