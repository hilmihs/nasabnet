#!/usr/bin/env python3
"""Merge data/work/places_out/<id>.json (see data/work/PLACES_SPEC.md) into data/tribe_places.json
({tribe id: [{t, ar, kind, note, src, lat, lon, precision, near}]}); quotes stay in data/work.
scripts/build_bio.py adds them to each tribe profile as "tempat" (drawn on the tribe map)."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import check_places  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
KEEP = ("t", "ar", "kind", "note", "src", "lat", "lon", "precision", "near")


def main():
    ids = sorted(p.stem for p in check_places.OUT.glob("*.json"))
    errs = [e for i in ids for e in check_places.check(i)]
    if errs:
        sys.exit("fix these first:\n" + "\n".join(errs))
    out, n, drawn = {}, 0, 0
    for tid in ids:
        rows = []
        for p in json.loads((check_places.OUT / f"{tid}.json").read_text())["places"]:
            r = {k: p[k] for k in KEEP if p.get(k) is not None}
            r["src"] = list(dict.fromkeys(r["src"]))
            rows.append(r)
            drawn += "lat" in r
        out[tid] = rows
        n += len(rows)
    (ROOT / "data" / "tribe_places.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n")
    print(f"{len(ids)} tribes, {n} places ({drawn} with coordinates) -> data/tribe_places.json")


if __name__ == "__main__":
    main()
