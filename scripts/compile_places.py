#!/usr/bin/env python3
"""Merge data/work/places_out/<id>.json (see data/work/PLACES_SPEC.md) into data/tribe_places.json
({tribe id: [{t, ar, kind, note, src, lat, lon, precision, near}]}); quotes stay in data/work.
scripts/build_bio.py adds them to each tribe profile as "tempat" (drawn on the tribe map). Files named _<city>.json
(data/work/LANDMARKS_SPEC.md) are historical landmarks of Makkah/Madinah -> data/landmarks.json (map mode "Zaman Nabi")."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import check_places  # noqa: E402
import geo  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
KEEP = ("t", "ar", "kind", "note", "src", "lat", "lon", "precision", "near", "zone")


def main():
    ids = sorted(p.stem for p in check_places.OUT.glob("*.json"))
    errs = [e for i in ids for e in check_places.check(i)]
    if errs:
        sys.exit("fix these first:\n" + "\n".join(errs))
    out, marks, n = {}, {}, 0
    for tid in ids:
        rows = []
        for p in json.loads((check_places.OUT / f"{tid}.json").read_text())["places"]:
            r = {k: p[k] for k in KEEP if p.get(k) is not None}
            r["src"] = list(dict.fromkeys(r["src"]))
            if p.get("lat") is None and p.get("zone_qid"):
                z = geo.lookup([p["zone_qid"]])[0]
                r["zone_lat"], r["zone_lon"], r["zone_km"] = z["lat"], z["lon"], p.get("zone_km", 120)
            rows.append(r)
        if tid.startswith("_"):
            marks[tid[1:]] = rows
            continue
        out[tid] = rows
        n += len(rows)
    (ROOT / "data" / "tribe_places.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n")
    (ROOT / "data" / "landmarks.json").write_text(json.dumps(marks, ensure_ascii=False, indent=1) + "\n")
    print("landmarks: " + ", ".join(f"{k} {len(v)}" for k, v in marks.items()))
    drawn = sum("lat" in r for rows in out.values() for r in rows)
    print(f"{len(out)} tribes, {n} places ({drawn} with coordinates) -> data/tribe_places.json")


if __name__ == "__main__":
    main()
