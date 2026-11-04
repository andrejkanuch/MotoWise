#!/usr/bin/env python3
"""One local HTML review page per market: every composed image, its copy, the seed summary and warnings.

    python3 compose/review_page.py US --store proof/US --seed out/seed/US   # -> <store>/review.html

Local file only. Publishing it (e.g. as a claude.ai artifact for the owner) is a separate step;
it shows demo data only, no credentials.
"""

import argparse
import html
import json
from pathlib import Path

PIPE = Path(__file__).resolve().parent.parent


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cc")
    ap.add_argument("--store", type=Path)
    ap.add_argument("--seed", type=Path)
    a = ap.parse_args()
    cc = a.cc.upper()
    store = (a.store or PIPE / "out" / "store" / cc).resolve()
    seed = (a.seed or PIPE / "out" / "seed" / cc).resolve()
    man = json.loads((store / "manifest.json").read_text())
    summ = json.loads((seed / "summary.json").read_text()) if (seed / "summary.json").exists() else {}
    groups = {}
    for f in man["files"]:
        groups.setdefault(str(Path(f["file"]).parent), []).append(f)
    e = html.escape
    parts = [f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{cc} store images</title><style>
:root{{--bg:#111214;--ink:#F4F1EA;--sub:#B9B5AC;--acc:#D4622E;--line:#2b2c30}}
body{{background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,sans-serif;margin:0;padding:24px 16px}}
h1,h2{{font-family:"Barlow Condensed",system-ui;text-transform:uppercase;letter-spacing:.02em}} h2{{color:var(--acc);margin-top:40px}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}}
.wide{{grid-template-columns:repeat(auto-fill,minmax(420px,1fr))}}
figure{{margin:0;background:#18191c;border:1px solid var(--line);border-radius:10px;padding:10px}}
img{{width:100%;display:block;border-radius:6px}} figcaption{{color:var(--sub);font-size:13px;margin-top:8px}}
.warn{{color:#f2b36b}} pre{{white-space:pre-wrap;color:var(--sub);background:#18191c;padding:12px;border-radius:8px;overflow:auto}}
</style></head><body><h1>{cc} · iOS {e(man['ios_locale'])} · Play {e(man['play_locale'])}</h1>"""]
    for w in man["warnings"]:
        parts.append(f'<p class="warn">⚠ {e(w)}</p>')
    for g, files in groups.items():
        wide = files[0]["size"][0] > files[0]["size"][1]
        parts.append(f'<h2>{e(g)} · {files[0]["size"][0]}×{files[0]["size"][1]}</h2><div class="grid{" wide" if wide else ""}">')
        for f in files:
            cap = " / ".join(f["copy"].get("headline", [])) if isinstance(f.get("copy"), dict) else ""
            parts.append(f'<figure><img loading="lazy" src="{e(f["file"])}"><figcaption><b>{e(f["slot"])}</b> · {e(cap)}<br>'
                         f'{e((f.get("copy") or {}).get("sub", "") or "")}</figcaption></figure>')
        parts.append("</div>")
    if summ:
        parts.append(f"<h2>Seed summary</h2><pre>{e(json.dumps(summ, indent=1, ensure_ascii=False))}</pre>")
    parts.append("</body></html>")
    (store / "review.html").write_text("".join(parts))
    print(store / "review.html")


if __name__ == "__main__":
    main()
