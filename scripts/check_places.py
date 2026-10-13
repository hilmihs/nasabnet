#!/usr/bin/env python3
"""Validate data/work/places_out/<id>.json (see data/work/PLACES_SPEC.md): quotes on the cited page, coordinates
equal to the Wikidata item's (scripts/geo.py) and inside the region.
Usage: python3 scripts/check_places.py ID [ID…]   (no args = all files)"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import check_roles  # noqa: E402
import geo  # noqa: E402

OUT = Path(__file__).resolve().parent.parent / "data" / "work" / "places_out"
KINDS = {"kota", "desa", "lembah", "gunung", "mata air", "sumur", "masjid", "harrah", "daerah", "distrik", "benteng", "pasar", "rumah"}


def check(tid):
    f = OUT / f"{tid}.json"
    try:
        d = json.loads(f.read_text())
    except Exception as e:
        return [f"{f.name}: {e}"]
    errs = []
    if d.get("id") != tid:
        errs.append(f"{f.name}: id mismatch")
    for i, p in enumerate(d.get("places") or []):
        w = f"{f.name}[{i}] {p.get('t')}"
        for k in ("t", "ar", "note"):
            if not (p.get(k) or "").strip():
                errs.append(f"{w}: missing {k}")
        if p.get("kind") not in KINDS:
            errs.append(f"{w}: kind must be one of {sorted(KINDS)}")
        check_roles.check_item({**p, "t": p.get("note") or "", "status": "ok"}, w, errs)
        if p.get("lat") is None:
            if p.get("lon") is not None or p.get("qid") or p.get("derive"):
                errs.append(f"{w}: lat null but lon/qid set")
            if p.get("zone_qid"):
                # region-only place: drawn as a wide translucent zone, never a pin
                if not (p.get("zone") or "").strip():
                    errs.append(f"{w}: zone_qid needs zone (region name shown to readers)")
                g = (geo.lookup([p["zone_qid"]]) or [{"lat": None}])[0]
                if g.get("lat") is None:
                    errs.append(f"{w}: zone_qid {p['zone_qid']} has no coordinates")
            continue
        if p.get("precision") not in ("tepat", "perkiraan"):
            errs.append(f"{w}: precision must be tepat or perkiraan")
        if p.get("precision") == "perkiraan" and not p.get("near"):
            errs.append(f"{w}: perkiraan needs near")
        if not (0 <= p["lat"] <= 45 and 20 <= p["lon"] <= 65):
            errs.append(f"{w}: coordinates outside the region")
        if p.get("derive"):
            # approximate point computed from the book's own description (geo.py between/offset)
            if p.get("precision") != "perkiraan":
                errs.append(f"{w}: a derived point must be precision perkiraan")
            try:
                lat, lon = geo.derive(p["derive"])
            except SystemExit as e:
                errs.append(f"{w}: derive: {e}")
                continue
            if abs(lat - p["lat"]) > 0.01 or abs(lon - p["lon"]) > 0.01:
                errs.append(f"{w}: lat/lon differ from the derive result ({lat},{lon})")
            continue
        if not p.get("qid"):
            errs.append(f"{w}: coordinates need the qid they came from")
            continue
        g = (geo.lookup([p["qid"]]) or [{"lat": None, "lon": None}])[0]
        if g["lat"] is None or abs(g["lat"] - p["lat"]) > 0.01 or abs(g["lon"] - p["lon"]) > 0.01:
            errs.append(f"{w}: lat/lon differ from {p['qid']} ({g['lat']},{g['lon']})")
    return errs


def main():
    ids = sys.argv[1:] or sorted(p.stem for p in OUT.glob("*.json"))
    errs = [e for i in ids for e in check(i)]
    print("\n".join(errs) if errs else f"ALL OK ({len(ids)} tribes)")
    sys.exit(1 if errs else 0)


if __name__ == "__main__":
    main()
