#!/usr/bin/env python3
"""Validate data/work/shapes_out/<city>.json (data/work/SHAPES_SPEC.md): quotes on the cited page, every OSM id has
geometry, label points copied from geo.py. Usage: python3 scripts/check_shapes.py madinah"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import check_roles  # noqa: E402
import geo  # noqa: E402
import shapes  # noqa: E402

OUT = Path(__file__).resolve().parent.parent / "data" / "work" / "shapes_out"
KINDS = {"wadi", "gunung", "harrah", "kebun", "kawasan", "benteng", "pasar", "parit", "pasir", "wilayah", "laut", "jalur"}
LEGEND = {"wadi", "gunung", "harrah", "kebun", "kawasan", "benteng", "pasar", "parit", "pasir", "wilayah", "laut", "jalur", "uthum", "sumur", "masjid", "kota", "desa", "mata air", "lembah"}


def check(city):
    errs = []
    d = json.loads((OUT / f"{city}.json").read_text())
    s, w, n, e = shapes.AREAS[city]
    for i, f in enumerate(d.get("features") or []):
        where = f"{city}[{i}] {f.get('t')}"
        for k in ("t", "ar", "note"):
            if not (f.get(k) or "").strip():
                errs.append(f"{where}: missing {k}")
        if f.get("kind") not in KINDS:
            errs.append(f"{where}: kind must be one of {sorted(KINDS)}")
        check_roles.check_item({**f, "t": f.get("note") or "", "status": "ok"}, where, errs)
        if f.get("kind") in ("parit", "jalur"):
            ids = f.get("path_qids") or []
            if len(ids) < 2:
                errs.append(f"{where}: parit needs path_qids (at least 2)")
            for r in geo.lookup(ids) if ids else []:
                if r.get("lat") is None:
                    errs.append(f"{where}: {r['qid']} has no coordinates")
            continue
        if f.get("osm"):
            for oid in f["osm"]:
                if oid[:1] not in "WR" or not oid[1:].isdigit():
                    errs.append(f"{where}: bad osm id {oid!r} (W… or R…)")
                    continue
                pts = [p for l in shapes.geometry(oid) for p in l]
                if not pts:
                    errs.append(f"{where}: {oid} has no geometry")
                elif not any(s - 0.3 <= p[0] <= n + 0.3 and w - 0.3 <= p[1] <= e + 0.3 for p in pts):
                    errs.append(f"{where}: {oid} lies outside the {city} area")
        else:
            if f.get("lat") is None or not f.get("qid"):
                errs.append(f"{where}: no osm shape -> needs qid/lat/lon from geo.py")
                continue
            g = (geo.lookup([f["qid"]]) or [{"lat": None}])[0]
            if g["lat"] is None or abs(g["lat"] - f["lat"]) > 0.01 or abs(g["lon"] - f["lon"]) > 0.01:
                errs.append(f"{where}: lat/lon differ from {f['qid']}")
    for i, x in enumerate(d.get("legend") or []):
        where = f"{city}:legend[{i}] {x.get('kind')}"
        if x.get("kind") not in LEGEND:
            errs.append(f"{where}: kind must be one of {sorted(LEGEND)}")
        check_roles.check_item({**x, "status": "ok"}, where, errs)
    return errs


if __name__ == "__main__":
    cities = sys.argv[1:] or [p.stem for p in OUT.glob("*.json")]
    errs = [x for c in cities for x in check(c)]
    print("\n".join(errs) if errs else f"ALL OK ({len(cities)})")
    sys.exit(1 if errs else 0)
