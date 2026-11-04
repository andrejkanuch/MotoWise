#!/usr/bin/env python3
"""Compose real captures + caption copy into store images at the exact store sizes.

    python3 compose/compose.py US                                   # captures from out/captures/US
    python3 compose/compose.py US --captures proof/captures/US --out proof/US --guides

Inputs
  captures   <dir>/<slot>.png, straight from the simulator (iPhone 1320x2868 or iPad 2064x2752)
  copy       ../copy/<ios-locale>.json (App Store) and ../copy/<play-locale>[-play].json (Play), SCHEMA.md §3
  market     out/markets-seed/<CC>.json or fixtures/markets/<CC>.json (only for the store locales)

Outputs (<out>/)
  ios/iphone-6.9/NN-<slot>.png      1320x2868  App Store iPhone "Dynamic Island (large)", the size ASC scales down from
  ios/ipad-13/NN-<slot>.png         2064x2752  required: the app sets supportsTablet true (app.config.ts)
  ios/asset-library/header.png      3840x1646  product page header asset, 21:9
  ios/asset-library/search.png      3840x2560  search results asset, 3:2 (max size)
  play/phone/NN-<slot>.png          1080x1920  9:16, Play's minimum for screenshot-format promotion eligibility
  play/feature-graphic.png          1024x500
  manifest.json                     every file with its size, slot, copy and source capture
With --guides, a *-guides.png twin of each wide asset shows the safe box used (see RUNBOOK).

Design (owner's canvas): ground #111214, headline Barlow Condensed 700 upper case with line 2 in
#D4622E, subline DM Sans #B9B5AC, the capture in a rounded phone frame. Rendered with headless
Chrome at 1x, then flattened with ImageMagick: Apple rejects any alpha channel.
"""

import argparse
import html
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
PIPE = HERE.parent
ASO_V4 = PIPE.parent
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

GROUND, ACCENT, SUB, INK = "#111214", "#D4622E", "#B9B5AC", "#F4F1EA"
FONTS = ('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700'
         '&family=DM+Sans:wght@400;500;700&display=block" rel="stylesheet">')
SLOTS = ["ride_tracking", "ride_stats", "expenses", "receipt_scan", "maintenance_reminders", "service_history",
         "garage", "trip_planning", "season_summary", "costs_overview"]

# Reference: the owner's canvas "MotoVault Store Screenshots" (claude.ai/artifact/E3jxrkkw3xixkA7vNwDDX1),
# primary slides Main/Expenses/History/Rides/Garage.dc.html: a 430x932 artboard exported at 3x.
# Every number below is the artboard's own CSS px; outputs scale the artboard with CSS zoom.
BOARD_W = 430
TPL = dict(pad_top=64, pad_x=36, gap=16, h1_size=54, h1_lh=0.96, sub_size=17, sub_lh=1.45,
           frame_left=60, frame_top=330, frame_w=310, frame_h=660, bezel=10, radius=48, inner_radius=38,
           cap_w=290, frame_bg="#050506", inner_bg="#121315", ring="#2C2D31", shadow="0 30px 80px rgba(0,0,0,0.6)")
# Per-slot phone top and capture offset, from the canvas (Main.dc.html = receipt: top 372, img -88).
# A copy file may override with slots.<slot>.layout = {"frame_top": .., "img_offset": ..}.
SLOT_LAYOUT = {}  # per-slot crops retired: every phone now shows the full screen
PHONE_TOP = 262     # below a two-line headline + two-line subline
PHONE_BOTTOM = 22   # clear margin under the phone, so the tab bar is never cut

PORTRAIT = {  # name: (W, H, max count, subdir)
    "iphone-6.9": (1290, 2796, 10, "ios/iphone-6.9"),   # the canvas's 3x export; ASC accepts it for 6.9"
    "ipad-13": (2064, 2752, 10, "ios/ipad-13"),
    "play-phone": (1080, 1920, 8, "play/phone"),
}
# Play listings whose copy file is not simply <play-locale>.json (aso-copy, 2026-11-03).
PLAY_COPY = {"MX": "es-MX-play", "CO": "es-CO", "AR": "es-AR", "PH": "en-PH"}
# Safe boxes (fraction of W/H kept clear for text + phones). Apple publishes the header/search safe
# areas only inside its design templates, not as numbers, so these are CONSERVATIVE assumptions:
# header = centre 64% x 76% (21:9 is cropped toward ~16:9 and narrower on iPhone), search = centre
# 86% x 86%. Check in ASC's product page preview before shipping (RUNBOOK step 7).
SAFE = {"header": (0.64, 0.76), "search": (0.86, 0.86), "feature": (0.84, 0.80)}

# Safety net only: the canvas sets the headline at a fixed 54px. If a localized line is wider than
# the text column, shrink that headline until it fits instead of letting it wrap into the phone.
FIT_JS = """<script>
document.fonts.ready.then(() => {
  for (const h of document.querySelectorAll('[data-fit]')) {
    const max = h.clientWidth; let s = parseFloat(getComputedStyle(h).fontSize);
    while (s > 12 && [...h.querySelectorAll('.ln')].some(l => l.scrollWidth > max + 0.5)) { s -= 1; h.style.fontSize = s + 'px'; }
  }
  document.body.dataset.ready = '1';
});
</script>"""

ACCENT_LINE2 = False  # the canvas sets both lines in ink; --accent-line2 paints line 2 copper

def base_css():
    accent = f"h1 .ln+.ln{{color:{ACCENT}}}" if ACCENT_LINE2 else ""
    return f"""*{{margin:0;padding:0;box-sizing:border-box}}
body{{background:{GROUND};position:relative;overflow:hidden;font-family:'DM Sans',system-ui,sans-serif;color:{INK}}}
h1{{font-family:'Barlow Condensed',sans-serif;font-weight:700;text-transform:uppercase;margin:0;line-height:{TPL['h1_lh']}}}
h1 .ln{{display:block;white-space:nowrap}} {accent}
p.sub{{margin:0;color:{SUB};line-height:{TPL['sub_lh']}}}
.frame{{position:absolute;box-sizing:border-box;background:{TPL['frame_bg']};box-shadow:{TPL['shadow']},0 0 0 1px {TPL['ring']}}}
.inner{{position:relative;width:100%;height:100%;background:{TPL['inner_bg']};overflow:hidden}}
.inner img{{position:absolute;left:0;height:auto;display:block}}
.guide{{position:absolute;border:6px dashed #2fd3ff;z-index:99}}"""


def esc(s):
    return html.escape(s or "")


def headline(lines, size, extra=""):
    return f'<h1 data-fit style="font-size:{size}px;{extra}">' + "".join(f'<span class="ln">{esc(l)}</span>' for l in lines) + "</h1>"


def frame(img, left, top, width, aspect, tablet=False, rot=0, img_offset=0):
    """The canvas's device frame. width = outer width in px; the capture fills the inner width.
    Proportions (bezel 10/310, radius 48/310, inner radius 38/310) scale with the width."""
    k = width / TPL["frame_w"]
    bezel, r_out, r_in = TPL["bezel"] * k, TPL["radius"] * k * (0.6 if tablet else 1), TPL["inner_radius"] * k * (0.55 if tablet else 1)
    cap_w = width - 2 * bezel
    # The whole screen, top to bottom: owner 2026-11-03 wants the tab bar visible, not a phone
    # that bleeds off the bottom of the slide.
    h = cap_w * aspect + 2 * bezel
    return (f'<div class="frame" style="left:{left}px;top:{top}px;width:{width}px;height:{h}px;padding:{bezel}px;'
            f'border-radius:{r_out}px;transform:rotate({rot}deg)"><div class="inner" style="border-radius:{r_in}px">'
            f'<img src="{img.as_uri()}" style="top:{img_offset * k}px;width:{cap_w}px"></div></div>')


def portrait_html(W, H, cap, aspect, copy, slot):
    """The canvas artboard (430 CSS px wide) zoomed to the output width. Taller/shorter outputs keep the
    same top and simply show more or less of the phone, as the canvas phone already bleeds off the bottom."""
    z = W / BOARD_W
    board_h = H / z
    tablet = aspect < 1.6
    lay = {**SLOT_LAYOUT.get(slot, {}), **(copy.get("layout") or {})}
    top = lay.get("frame_top", TPL["frame_top"])
    if tablet:  # no iPad artboard in the canvas: same text block, a wider tablet frame centred
        fw = round(BOARD_W * 0.76)
        fr = frame(cap, (BOARD_W - fw) / 2, top, fw, aspect, tablet=True)
    else:
        # Fit the full-height phone between the text block and the bottom margin, centred.
        top = lay.get("frame_top", PHONE_TOP)
        avail = board_h - top - PHONE_BOTTOM
        per_w = (1 - 2 * TPL["bezel"] / TPL["frame_w"]) * aspect + 2 * TPL["bezel"] / TPL["frame_w"]
        fw = min(TPL["frame_w"], avail / per_w)
        fr = frame(cap, (BOARD_W - fw) / 2, top, fw, aspect)
    return f"""<!doctype html><html><head><meta charset="utf-8">{FONTS}<style>{base_css()}
body{{width:{W}px;height:{H}px}}
.board{{position:relative;width:{BOARD_W}px;height:{board_h}px;overflow:hidden;zoom:{z}}}
.text{{padding:{TPL['pad_top']}px {TPL['pad_x']}px 0 {TPL['pad_x']}px;display:flex;flex-direction:column;gap:{TPL['gap']}px}}
p.sub{{font-size:{TPL['sub_size']}px}}
</style></head><body><div class="board">
<div class="text">{headline(copy['headline'], TPL['h1_size'])}<p class="sub">{esc(copy.get('sub'))}</p></div>
{fr}</div>{FIT_JS}</body></html>"""


def safe_box(W, H, kind):
    fw, fh = SAFE[kind]
    return round(W * (1 - fw) / 2), round(H * (1 - fh) / 2), round(W * fw), round(H * fh)


def guide(W, H, kind, on):
    if not on:
        return ""
    x, y, w, h = safe_box(W, H, kind)
    return f'<div class="guide" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px"></div>'


def header_html(caps, copy, guides):
    W, H = 3840, 1646
    x, y, w, h = safe_box(W, H, "header")
    pw = round(h * 0.86 / 2.17 / 1.06)  # two phones inside the safe height, rotation included
    phones = frame(caps[0][0], x + w - pw * 2 - 160, y + round(h * .10), pw, caps[0][1], rot=-4) + \
        frame(caps[1][0], x + w - pw - 40, y + round(h * .04), pw, caps[1][1], rot=4)
    return f"""<!doctype html><html><head><meta charset="utf-8">{FONTS}<style>{base_css()}
body{{width:{W}px;height:{H}px}}.text{{position:absolute;left:{x}px;top:{y}px;width:{round(w * .52)}px;height:{h}px;
display:flex;flex-direction:column;justify-content:center}}p.sub{{font-size:64px;margin-top:40px}}</style></head><body>
<div class="text">{headline(copy['headline'], 230)}{('<p class="sub">' + esc(copy['sub']) + '</p>') if copy.get('sub') else ''}</div>
{phones}{guide(W, H, 'header', guides)}{FIT_JS}</body></html>"""


def search_html(caps, copy, guides):
    W, H = 3840, 2560
    x, y, w, h = safe_box(W, H, "search")
    ptop = y + round(h * .34)
    pw = round((y + h - ptop - 100) / 2.17 / 1.05)  # the side phones sit 80 px lower; all inside the safe box
    gap = 120
    total = pw * 3 + gap * 2
    lx = x + (w - total) // 2
    phones = "".join(frame(c, lx + i * (pw + gap), ptop + (0 if i == 1 else 80), pw, a) for i, (c, a) in enumerate(caps[:3]))
    return f"""<!doctype html><html><head><meta charset="utf-8">{FONTS}<style>{base_css()}
body{{width:{W}px;height:{H}px}}.text{{position:absolute;left:{x}px;top:{y}px;width:{w}px;text-align:center}}
p.sub{{font-size:72px;margin-top:44px}}</style></head><body>
<div class="text">{headline(copy['headline'], 220)}{('<p class="sub">' + esc(copy['sub']) + '</p>') if copy.get('sub') else ''}</div>
{phones}{guide(W, H, 'search', guides)}{FIT_JS}</body></html>"""


def feature_html(cap, aspect, copy, guides):
    W, H = 2048, 1000  # rendered at 2x, downscaled to 1024x500
    x, y, w, h = safe_box(W, H, "feature")
    return f"""<!doctype html><html><head><meta charset="utf-8">{FONTS}<style>{base_css()}
body{{width:{W}px;height:{H}px}}.text{{position:absolute;left:{x}px;top:{y}px;width:{round(w * .58)}px;height:{h}px;
display:flex;flex-direction:column;justify-content:center}}</style></head><body>
<div class="text">{headline(copy['headline'], 150)}</div>
{frame(cap, x + round(w * .70), y + 40, round((h - 80) / aspect / 1.06), aspect, rot=8)}{guide(W, H, 'feature', guides)}{FIT_JS}</body></html>"""


def shoot(page_html, W, H, dst, tmp):
    page = tmp / f"{dst.stem}.html"
    page.write_text(page_html)
    raw = tmp / f"{dst.stem}.raw.png"
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files",
                    "--virtual-time-budget=10000", "--force-device-scale-factor=1", f"--window-size={W},{H}",
                    f"--screenshot={raw}", page.as_uri()], check=True, capture_output=True)
    dst.parent.mkdir(parents=True, exist_ok=True)
    # Flatten onto the ground colour and drop alpha: ASC rejects alpha, Play wants 24-bit PNG.
    subprocess.run(["magick", str(raw), "-background", GROUND, "-alpha", "remove", "-alpha", "off",
                    "-define", "png:color-type=2", str(dst)], check=True)


def resize(src, dst, W, H):
    dst.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["magick", str(src), "-filter", "Lanczos", "-resize", f"{W}x{H}!", "-alpha", "off",
                    "-define", "png:color-type=2", str(dst)], check=True)


def identify(p):
    out = subprocess.run(["magick", "identify", "-format", "%w %h %[channels]", str(p)], capture_output=True,
                         text=True, check=True).stdout.split()
    return int(out[0]), int(out[1]), out[2]


def load_market(cc):
    for d in (ASO_V4 / "markets", PIPE / "out" / "markets-seed", PIPE / "fixtures" / "markets"):
        f = d / f"{cc}.json"
        if f.exists():
            return json.loads(f.read_text())
    raise SystemExit(f"{cc}: no seed-ready market file")


def load_copy(path):
    c = json.loads(Path(path).read_text())
    missing = [s for s in c.get("order", SLOTS) if s not in c["slots"]]
    if missing:
        raise SystemExit(f"{path}: order names slots without copy: {missing}")
    return c


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cc")
    ap.add_argument("--captures", type=Path)
    ap.add_argument("--ipad-captures", type=lambda s: Path(s).resolve(), help="iPad 13\" captures; default: iPhone captures in an iPad canvas")
    ap.add_argument("--copy-ios", type=Path)
    ap.add_argument("--copy-play", type=Path)
    ap.add_argument("--out", type=Path)
    ap.add_argument("--guides", action="store_true")
    ap.add_argument("--accent-line2", action="store_true", help="paint headline line 2 copper (the canvas does not)")
    a = ap.parse_args()
    global ACCENT_LINE2
    ACCENT_LINE2 = a.accent_line2
    cc = a.cc.upper()
    m = load_market(cc)
    ios_loc, play_loc = m["store_locales"]["ios"], m["store_locales"]["play"]
    caps_dir = (a.captures or PIPE / "out" / "captures" / cc).resolve()
    out = (a.out or PIPE / "out" / "store" / cc).resolve()
    copy_dir = ASO_V4 / "copy"
    copy_ios = load_copy(a.copy_ios or copy_dir / f"{ios_loc}.json")
    play_file = a.copy_play or next(p for p in (copy_dir / f"{PLAY_COPY.get(cc, play_loc)}.json", copy_dir / f"{play_loc}.json",
                                                 copy_dir / f"{ios_loc}.json") if p.exists())
    copy_play = load_copy(play_file)
    if out.exists():
        shutil.rmtree(out)
    manifest, warnings = [], []

    def cap(slot, d=caps_dir):
        p = d / f"{slot}.png"
        if not p.exists():
            return None
        w, h, _ = identify(p)
        return p, h / w

    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        for name, (W, H, limit, sub) in PORTRAIT.items():
            copy = copy_play if name.startswith("play") else copy_ios
            order = copy.get("order_play" if name.startswith("play") else "order", SLOTS)[:limit]
            n = 0
            for slot in order:
                c = cap(slot, a.ipad_captures) if name == "ipad-13" and a.ipad_captures else cap(slot)
                if not c:
                    warnings.append(f"{name}: no capture for {slot}, slot skipped")
                    continue
                n += 1
                dst = out / sub / f"{n:02d}-{slot}.png"
                shoot(portrait_html(W, H, c[0], c[1], copy["slots"][slot], slot), W, H, dst, tmp)
                manifest.append({"file": str(dst.relative_to(out)), "size": [W, H], "slot": slot, "capture": str(c[0]),
                                 "copy": copy["slots"][slot], "locale": play_loc if name.startswith("play") else ios_loc})
            if name == "ipad-13" and not a.ipad_captures:
                warnings.append("ipad-13 shows iPhone captures in a phone frame: capture on an iPad 13\" simulator "
                                "before upload (App Review guideline 2.3.3: screenshots must show the app on that device)")
        hero = [cap(s) for s in copy_ios.get("order", SLOTS)]
        hero = [h for h in hero if h]
        if len(hero) >= 3:
            for kind, fn, W, H in (("header", header_html, 3840, 1646), ("search", search_html, 3840, 2560)):
                blk = copy_ios.get(kind) or {"headline": copy_ios["slots"][copy_ios["order"][0]]["headline"]}
                for g in ([False, True] if a.guides else [False]):
                    dst = out / "ios" / "asset-library" / f"{kind}{'-guides' if g else ''}.png"
                    shoot(fn(hero, blk, g), W, H, dst, tmp)
                    if not g:
                        manifest.append({"file": str(dst.relative_to(out)), "size": [W, H], "slot": kind, "copy": blk,
                                         "safe_box": safe_box(W, H, kind), "locale": ios_loc})
            fg = copy_play.get("feature_graphic") or {"headline": copy_play["slots"][copy_play["order"][0]]["headline"]}
            for g in ([False, True] if a.guides else [False]):
                big = tmp / f"feature{int(g)}-2x.png"
                shoot(feature_html(hero[0][0], hero[0][1], fg, g), 2048, 1000, big, tmp)
                dst = out / "play" / f"feature-graphic{'-guides' if g else ''}.png"
                resize(big, dst, 1024, 500)
                if not g:
                    manifest.append({"file": str(dst.relative_to(out)), "size": [1024, 500], "slot": "feature_graphic",
                                     "copy": fg, "locale": play_loc})
        else:
            warnings.append("fewer than 3 captures: no header/search/feature graphic")

    bad = []
    for e in manifest:
        w, h, ch = identify(out / e["file"])
        e["verified"] = {"size": [w, h], "channels": ch}
        if [w, h] != e["size"] or "a" in ch:
            bad.append(e["file"])
    (out / "manifest.json").write_text(json.dumps({"cc": cc, "ios_locale": ios_loc, "play_locale": play_loc,
                                                   "copy_ios": str(a.copy_ios or copy_dir / f'{ios_loc}.json'),
                                                   "copy_play": str(play_file), "warnings": warnings, "files": manifest},
                                                  indent=1, ensure_ascii=False))
    for w in warnings:
        print("warning:", w, file=sys.stderr)
    print(f"{cc}: {len(manifest)} images in {out}")
    if bad:
        sys.exit(f"size/alpha check failed: {bad}")


if __name__ == "__main__":
    main()
