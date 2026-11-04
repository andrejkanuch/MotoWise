#!/usr/bin/env python3
"""Turn a market-data research profile (markets/<CC>.json) into a seed-ready draft (SCHEMA.md §1).

    python3 adapt_market.py US          # -> out/markets-seed/US.json (+ copies US-route.geojson)
    python3 adapt_market.py --all

The research profiles hold the facts (bikes, odometers, local prices, the hero road, overdue and
upcoming jobs) but not the seed details (timezone, device locale, line items, a trip, a fictional
dealer). This fills those from the per-market table below and marks every invented value in
`needs_review`, so a human signs off on the draft before gen_seed_market.py turns it into SQL.
A hand-written file in out/markets-seed/ is never overwritten without --force.
"""

import argparse
import json
import re
import sys
from datetime import date, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE.parent / "markets"
DST = HERE / "out" / "markets-seed"

# Device + app locale per market. app_language must be an app UI locale (en es de fr it pt-BR).
LOC = {
    "US": dict(lang="en", al=["en-US", "en"], loc="en_US", tz="America/New_York", region="US-NC", ios="en-US", play="en-US",
               rider=("Jake M.", "Asheville"), tax=("Sales tax 7%", 0.07, False), vendor="Blue Ridge V-Twin Service"),
    "MX": dict(lang="es", al=["es-MX", "es"], loc="es_MX", tz="America/Mazatlan", region="MX-SIN", ios="es-MX", play="es-419",
               rider=("Luis R.", "Mazatlán"), tax=("IVA 16%", 0.16, True), vendor="Motos del Pacífico"),
    "BR": dict(lang="pt-BR", al=["pt-BR"], loc="pt_BR", tz="America/Sao_Paulo", region="BR-SC", ios="pt-BR", play="pt-BR",
               rider=("Rafael S.", "Florianópolis"), tax=("Impostos incl.", 0.0, True), vendor="Serra Motos"),
    "CO": dict(lang="es", al=["es-CO", "es"], loc="es_CO", tz="America/Bogota", region="CO-CAU", ios="es-MX", play="es-419",
               rider=("Andrés G.", "Pasto"), tax=("IVA 19%", 0.19, True), vendor="Motos del Macizo"),
    "ES": dict(lang="es", al=["es-ES", "es"], loc="es_ES", tz="Europe/Madrid", region="ES-AN", ios="es-ES", play="es-ES",
               rider=("Javier L.", "Málaga"), tax=("IVA 21%", 0.21, True), vendor="Motos Serranía"),
    "PH": dict(lang="en", al=["en-PH", "en"], loc="en_PH", tz="Asia/Manila", region="PH-RIZ", ios="en-GB", play="en-US",
               rider=("Paolo D.", "Antipolo"), tax=("VAT 12%", 0.12, True), vendor="Sierra Madre Moto Works"),
    "AR": dict(lang="es", al=["es-AR", "es"], loc="es_AR", tz="America/Argentina/Buenos_Aires", region="AR-Q", ios="es-MX",
               play="es-419", rider=("Martín P.", "San Martín de los Andes"), tax=("IVA 21%", 0.21, True), vendor="Motos Lanín"),
    "FR": dict(lang="fr", al=["fr-FR", "fr"], loc="fr_FR", tz="Europe/Paris", region="FR-ARA", ios="fr-FR", play="fr-FR",
               rider=("Julien M.", "Grenoble"), tax=("TVA 20 %", 0.20, True), vendor="Alpes Moto Service"),
    "GB": dict(lang="en", al=["en-GB", "en"], loc="en_GB", tz="Europe/London", region="GB-CHE", ios="en-GB", play="en-GB",
               rider=("Tom H.", "Macclesfield"), tax=("VAT 20%", 0.20, True), vendor="Peak District Motorcycles"),
    "CA": dict(lang="en", al=["en-CA", "en"], loc="en_CA", tz="America/Halifax", region="CA-NS", ios="en-US", play="en-CA",
               rider=("Ryan C.", "Halifax"), tax=("HST 14%", 0.14, False), vendor="Cape Breton Moto"),
    "AU": dict(lang="en", al=["en-AU", "en"], loc="en_AU", tz="Australia/Melbourne", region="AU-VIC", ios="en-GB", play="en-AU",
               rider=("Matt K.", "Geelong"), tax=("GST 10%", 0.10, True), vendor="Surf Coast Motorcycles"),
    "IT": dict(lang="it", al=["it-IT", "it"], loc="it_IT", tz="Europe/Rome", region="IT-25", ios="it", play="it-IT",
               rider=("Marco B.", "Bormio"), tax=("IVA 22%", 0.22, True), vendor="Moto Valtellina"),
    "DE": dict(lang="de", al=["de-DE", "de"], loc="de_DE", tz="Europe/Berlin", region="DE-BW", ios="de-DE", play="de-DE",
               rider=("Markus W.", "Baden-Baden"), tax=("MwSt. 19 %", 0.19, True), vendor="Schwarzwald Motorrad Service"),
}

# Generic line-item labels per app language (the service amount is split across these).
LINES = {
    "en": [("Engine oil", "oil_change", .32), ("Oil filter", "oil_filter", .08), ("Air filter", "air_filter", .10), ("Labour", "general_service", .50)],
    "es": [("Aceite de motor", "oil_change", .32), ("Filtro de aceite", "oil_filter", .08), ("Filtro de aire", "air_filter", .10), ("Mano de obra", "general_service", .50)],
    "pt-BR": [("Óleo do motor", "oil_change", .32), ("Filtro de óleo", "oil_filter", .08), ("Filtro de ar", "air_filter", .10), ("Mão de obra", "general_service", .50)],
    "fr": [("Huile moteur", "oil_change", .32), ("Filtre à huile", "oil_filter", .08), ("Filtre à air", "air_filter", .10), ("Main-d'œuvre", "general_service", .50)],
    "it": [("Olio motore", "oil_change", .32), ("Filtro olio", "oil_filter", .08), ("Filtro aria", "air_filter", .10), ("Manodopera", "general_service", .50)],
    "de": [("Motoröl", "oil_change", .32), ("Ölfilter", "oil_filter", .08), ("Luftfilter", "air_filter", .10), ("Arbeitszeit", "general_service", .50)],
}
TRIP = {"en": "Weekend: {}", "es": "Fin de semana: {}", "pt-BR": "Fim de semana: {}", "fr": "Week-end : {}",
        "it": "Weekend: {}", "de": "Wochenende: {}"}
STOP = {"en": ("Start", "Lunch stop", "Overnight", "Home"), "es": ("Salida", "Comida", "Noche", "Casa"),
        "pt-BR": ("Saída", "Almoço", "Pernoite", "Casa"), "fr": ("Départ", "Déjeuner", "Étape", "Retour"),
        "it": ("Partenza", "Pranzo", "Notte", "Rientro"), "de": ("Start", "Mittagspause", "Übernachtung", "Zuhause")}


def parse_num(s):
    """'16.900 km' / '18,420 mi' / '18 600 km' / '26,70 €' / 'R$ 61,74' / '$38.160' -> float."""
    s = re.sub(r"[^\d.,]", "", str(s).replace(" ", "").replace("\xa0", "").replace(" ", ""))
    if not s:
        return None
    if "," in s and "." in s:
        dec = "," if s.rfind(",") > s.rfind(".") else "."
    elif "," in s:
        dec = "," if len(s) - s.rfind(",") - 1 == 2 else None
    elif "." in s:
        dec = "." if len(s) - s.rfind(".") - 1 == 2 else None
    else:
        dec = None
    if dec:
        whole, frac = s.rsplit(dec, 1)
        return float(re.sub(r"[.,]", "", whole) + "." + frac)
    return float(re.sub(r"[.,]", "", s))


def bike_type(make, model):
    m = model.lower()
    if any(k in m for k in ("gs", "ténéré", "tenere", "xr", "adventure")):
        return "dual_sport"
    if any(k in m for k in ("nmax", "click", "biz", "sh ", "sh1", "wave", "scooter")) or m.startswith("sh"):
        return "scooter"
    if any(k in m for k in ("glide", "road king")):
        return "touring"
    if "ninja" in m:
        return "sportbike"
    return "standard"


def lean_for(types):
    return 26 if "scooter" in types else (32 if "touring" in types else 40)


def adapt(cc, today):
    p = json.loads((SRC / f"{cc}.json").read_text())
    gj = json.loads((SRC / f"{cc}-route.geojson").read_text())
    L, g, h = LOC[cc], p["demo_garage"], p["hero_route"]
    lang = L["lang"]
    review = []
    imperial = g["units"]["distance"] == "mi"
    coords = gj["features"][0]["geometry"]["coordinates"]
    start, end = (coords[0][1], coords[0][0]), (coords[-1][1], coords[-1][0])
    mid = (coords[len(coords) // 2][1], coords[len(coords) // 2][0])

    bikes = []
    for i, b in enumerate(g["bikes"][:2]):
        bikes.append({"key": "primary" if i == 0 else "second", "make": b["make"].upper(), "model": b["model"],
                      "year": b["year"], "type": bike_type(b["make"], b["model"]), "odometer": int(parse_num(b["odometer"]))})
    review.append("bikes: type guessed from the model name; nickname, engine_cc, purchase price not set")
    exp = {e["type"]: e for e in g["expenses"]}

    fuel_label, qty = exp["fuel"]["label"].rsplit(",", 1) if "," in exp["fuel"]["label"] else (exp["fuel"]["label"], "")
    unit = "gal" if "gal" in g["units"].get("fuel_volume", "") else "L"
    fq = parse_num(qty) or (4.5 if unit == "gal" else 12)
    price = round(parse_num(exp["fuel"]["amount"]) / fq, 3)
    fill = [round(fq * 0.8, 1), round(fq * 1.15, 1)]

    svc_amt = parse_num(exp["service"]["amount"])
    tax_label, tax_rate, tax_incl = L["tax"]
    net = svc_amt if tax_incl else svc_amt / (1 + tax_rate)
    lines = [{"label": lbl, "service_type": st, "amount": round(net * share, 2)} for lbl, st, share in LINES[lang]]
    lines[-1]["amount"] = round(net - sum(x["amount"] for x in lines[:-1]), 2)
    odo0 = bikes[0]["odometer"]
    svc_odo = int(round(odo0 * 0.88, -2))
    review.append(f"service: '{exp['service']['label']}' split into generic {lang} line items; vendor '{L['vendor']}' is invented "
                  "(the research label may name a real dealer chain: keep it out of the vendor field)")

    tasks = []
    od = g["maintenance"]["overdue"]
    tasks.append({"title": od["task"], "due_date": (today - timedelta(days=12)).isoformat(), "priority": "high"})
    for u in g["maintenance"]["upcoming"][:2]:
        due = str(u.get("due", ""))
        n = parse_num(due)
        if re.search(r"\b(km|mi)\b", due) and n and n > odo0:
            tasks.append({"title": u["task"], "target_odometer": int(n), "priority": "medium"})
        else:
            tasks.append({"title": u["task"], "due_date": (today + timedelta(days=150)).isoformat(), "priority": "medium"})
            review.append(f"task '{u['task']}': due '{due}' not parsed as a future odometer, set to +150 days")

    backup = (h.get("backups") or [{"name": h["name_local"]}])[0]["name"]
    s1, s2, s3, s4 = STOP[lang]
    trip = {"title": TRIP[lang].format(re.sub(r"\s*\(.*?\)", "", backup))[:60], "description": backup,
            "start_date": (today + timedelta(days=11)).isoformat(), "end_date": (today + timedelta(days=12)).isoformat(),
            "difficulty": "moderate",
            "stops": [{"name": s1, "lat": start[0], "lng": start[1], "type": "start", "day": 0},
                      {"name": s2, "lat": mid[0], "lng": mid[1], "type": "food", "day": 0},
                      {"name": s3, "lat": end[0], "lng": end[1], "type": "overnight", "day": 0},
                      {"name": s4, "lat": start[0], "lng": start[1], "type": "end", "day": 1}]}
    review.append("trip: stops are the hero road's start/middle/end, NOT the backup road its title names; replace with real stops")

    elev = gj["features"][0]["properties"].get("elevation_srtm90m", {}) or h.get("polyline_elevation_srtm90m", {})
    types = {bikes[0]["type"]}  # the hero ride is on the primary bike
    hero = {"name": h["name_local"], "road": h.get("region", h["name_local"]),
            "date": (today - timedelta(days=17)).isoformat(), "start_time": "10:00",
            "avg_speed_kmh": 42 if "scooter" in types else 55, "max_speed_kmh": 85 if "scooter" in types else 110,
            "max_lean_deg": lean_for(types), "elevation_gain_m": elev.get("gain_m")}
    review.append("hero_ride: date, speeds and lean are defaults by the primary bike's type; check against the road")
    if (gj["features"][0]["properties"].get("length_km") or 99) < 30:
        review.append("hero_ride: the research polyline is under 30 km, so the hero ride reads as a short hop "
                      "(moving time, distance); consider extending it to a full loop")

    part = exp.get("part")
    expenses = []
    if part:
        cat = "registration" if re.search(r"rego|bollo|registration|tax", part["label"], re.I) else (
            "tires" if re.search(r"tire|tyre|llanta|pneu|reifen|pneumatic|neum", part["label"], re.I) else "parts")
        expenses.append({"category": cat, "date": (today - timedelta(days=60)).isoformat(),
                         "amount": parse_num(part["amount"]), "item": part["label"]})

    out = {
        "cc": cc, "market_name": p["market_name"], "app_language": lang,
        "store_locales": {"ios": L["ios"], "play": L["play"]},
        "device": {"apple_languages": L["al"], "apple_locale": L["loc"], "metric": not imperial},
        "measurement_system": "imperial" if imperial else "metric", "currency": g["currency"], "timezone": L["tz"],
        "region_code": L["region"],
        "rider": {"display_name": L["rider"][0], "city": L["rider"][1], "home": [round(start[0], 5), round(start[1], 5)]},
        "bikes": bikes, "hero_ride": hero, "other_rides": [],
        "season": {"rides": 55, "distance_km": 7000 if "scooter" not in types else 4500},
        "fuel": {"label": fuel_label.strip(), "unit": unit, "price_per_unit": price, "fill_size": fill,
                 "stations": {"en": ["Shell", "BP", "Caltex"], "es": ["Repsol", "Shell", "Pemex"], "pt-BR": ["Petrobras", "Ipiranga", "Shell"],
                              "fr": ["TotalEnergies", "Esso", "Intermarché"], "it": ["Eni", "Q8", "IP"], "de": ["Aral", "Shell", "Jet"]}[lang]},
        "service": {"title": exp["service"]["label"], "date": (today - timedelta(days=95)).isoformat(), "odometer": svc_odo,
                    "vendor": L["vendor"], "tax_label": tax_label, "tax_rate": tax_rate, "tax_included": tax_incl,
                    "line_items": lines},
        "service_interval": 5000 if imperial else 6000,
        "expenses": expenses, "tasks": tasks, "trip": trip,
        "needs_review": review + ["expenses: only the research items plus generated fuel; add insurance, registration, gear and mods for a believable yearly total", "rider.home is the hero road's start; other_rides is empty, so the season is filler loops "
                                  "around home (never on screen as a map)", "fuel stations are generic brand names"],
        "_source": str(SRC / f"{cc}.json"),
    }
    return out, gj


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cc", nargs="*")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--today", default=None)
    a = ap.parse_args()
    today = date.fromisoformat(a.today) if a.today else date.today()
    ccs = list(LOC) if a.all else [c.upper() for c in a.cc]
    DST.mkdir(parents=True, exist_ok=True)
    for cc in ccs:
        dst = DST / f"{cc}.json"
        if dst.exists() and not a.force and not json.loads(dst.read_text()).get("_source"):
            print(f"{cc}: {dst} is hand-written, skipped (use --force)")
            continue
        out, gj = adapt(cc, today)
        dst.write_text(json.dumps(out, indent=1, ensure_ascii=False))
        (DST / f"{cc}-route.geojson").write_text(json.dumps(gj))
        print(f"{cc}: {dst}  ({len(out['needs_review'])} items to review)")


if __name__ == "__main__":
    sys.exit(main())
