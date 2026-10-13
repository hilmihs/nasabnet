#!/usr/bin/env python3
"""data/work/shapes_out/<city>.json -> data/shapes.json ({city: [{t, ar, kind, note, src, lines | lat/lon}]}) with
OSM geometry fetched (cached) and simplified; scripts/build_bio.py puts it in bio.json for the "Zaman Nabi" map."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import check_shapes  # noqa: E402
import geo  # noqa: E402
import shapes  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent


def simplify(line, tol=0.00015):
    """Douglas–Peucker on [lat, lon] (tol in degrees, ~15 m)."""
    if len(line) < 3:
        return line
    a, b = line[0], line[-1]
    dx, dy = b[0] - a[0], b[1] - a[1]
    norm = (dx * dx + dy * dy) ** 0.5
    if norm:
        dist = [abs(dy * (p[0] - a[0]) - dx * (p[1] - a[1])) / norm for p in line[1:-1]]
    else:  # closed ring (mountain outline): distance from the start point
        dist = [((p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2) ** 0.5 for p in line[1:-1]]
    i = max(range(len(dist)), key=dist.__getitem__)
    if dist[i] <= tol:
        return [a, b]
    return simplify(line[: i + 2], tol)[:-1] + simplify(line[i + 1:], tol)


def main():
    cities = sorted(p.stem for p in check_shapes.OUT.glob("*.json"))
    errs = [x for c in cities for x in check_shapes.check(c)]
    if errs:
        sys.exit("fix these first:\n" + "\n".join(errs))
    out = {}
    for c in cities:
        rows = []
        for f in json.loads((check_shapes.OUT / f"{c}.json").read_text())["features"]:
            r = {k: f[k] for k in ("t", "ar", "kind", "note") if f.get(k)}
            r["src"] = list(dict.fromkeys(f["src"]))
            if f.get("kind") in ("parit", "jalur"):
                pts = {r["qid"]: [round(r["lat"], 5), round(r["lon"], 5)] for r in geo.lookup(f["path_qids"])}
                r["lines"] = [[pts[q] for q in f["path_qids"]]]
            elif f.get("osm"):
                tol = 0.01 if c == "arabia" else 0.00015  # deserts span hundreds of km: ~1 km detail is plenty
                r["lines"] = [[[round(x, 4 if c == "arabia" else 5) for x in p] for p in simplify(l, tol)] for oid in f["osm"] for l in shapes.geometry(oid)]
            else:
                r["lat"], r["lon"] = f["lat"], f["lon"]
                if f.get("derive") or f.get("precision") == "perkiraan":
                    r["precision"], r["near"] = "perkiraan", f.get("near", "")
            rows.append(r)
        out[c] = rows
        legend = json.loads((check_shapes.OUT / f"{c}.json").read_text()).get("legend")
        if legend:
            out[f"_legend_{c}"] = [{k: x[k] for k in ("kind", "t", "ar", "note") if x.get(k)} | {"src": list(dict.fromkeys(x["src"]))} for x in legend]
    (ROOT / "data" / "shapes.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n")
    print({c: len(v) for c, v in out.items()}, round((ROOT / "data" / "shapes.json").stat().st_size / 1024), "KB")


if __name__ == "__main__":
    main()
