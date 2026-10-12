#!/usr/bin/env python3
"""Find natural features (wadis, harrah lava fields, mountains, palm groves) on OpenStreetMap for the
"Zaman Nabi" map layer (data/work/SHAPES_SPEC.md). Answers are cached in data/work/geo_cache/.

  python3 scripts/shapes.py find "العقيق|عقيق"              # named ways/relations in the Madinah area
  python3 scripts/shapes.py tag natural=bare_rock [--min 2] # unnamed features by tag, largest first (km² / km)
  python3 scripts/shapes.py show W116605983                 # tags, size, extent of one OSM object
Options: --area madinah|makkah (default madinah).
"""
import fcntl
import hashlib
import json
import math
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import geo  # noqa: E402

OVERPASS = "https://overpass-api.de/api/interpreter"
AREAS = {"madinah": (24.25, 39.35, 24.75, 39.9), "makkah": (21.2, 39.6, 21.6, 40.1)}
KIND_TAGS = ("natural", "waterway", "landuse", "geological", "place", "landcover")


def overpass(q):
    """POST an Overpass query (cached, one at a time across processes, retried on 429/504)."""
    q = f"[out:json][timeout:90];{q}"
    f = geo.CACHE / f"ovp_{hashlib.sha1(q.encode()).hexdigest()}.json"
    if f.exists():
        return json.loads(f.read_text()).get("elements", [])
    geo.CACHE.mkdir(parents=True, exist_ok=True)
    with open(geo.CACHE / ".lock-overpass", "a+") as lk:
        fcntl.flock(lk, fcntl.LOCK_EX)
        for attempt in range(6):
            try:
                req = urllib.request.Request(OVERPASS, data=urllib.parse.urlencode({"data": q}).encode(), headers={"User-Agent": geo.UA})
                with urllib.request.urlopen(req, timeout=120) as r:
                    data = json.loads(r.read().decode())
                f.write_text(json.dumps(data, ensure_ascii=False))
                time.sleep(1)
                return data.get("elements", [])
            except Exception:
                time.sleep(5 * (attempt + 1))
    sys.exit("overpass unreachable")


def lines_of(e):
    if e["type"] == "way":
        return [[[p["lat"], p["lon"]] for p in e.get("geometry", [])]]
    return [[[p["lat"], p["lon"]] for p in m["geometry"]] for m in e.get("members", []) if m.get("geometry")]


def geometry(oid):
    """OSM id (W123 / R123) -> list of lines (each a list of [lat, lon])."""
    t, n = {"W": "way", "R": "relation"}[oid[0]], oid[1:]
    return [l for e in overpass(f"{t}({n});out geom;") for l in lines_of(e) if len(l) > 1]


def size(lines):
    """(length km, area km² if closed)"""
    km = lambda a, b: math.hypot((a[0] - b[0]) * 111.3, (a[1] - b[1]) * 111.3 * math.cos(math.radians(a[0])))
    length = sum(km(l[i], l[i + 1]) for l in lines for i in range(len(l) - 1))
    area = 0.0
    for l in lines:
        if l[0] == l[-1] and len(l) > 3:
            s = sum(l[i][1] * l[i + 1][0] - l[i + 1][1] * l[i][0] for i in range(len(l) - 1))
            area += abs(s) / 2 * 111.3 * 111.3 * math.cos(math.radians(l[0][0]))
    return round(length, 2), round(area, 2)


def row(e):
    t = e.get("tags", {})
    kind = next((f"{k}={t[k]}" for k in KIND_TAGS if k in t), "")
    oid = f"{e['type'][0].upper()}{e['id']}"
    return oid, t.get("name", ""), kind


def main():
    args = sys.argv[1:]
    area = args[args.index("--area") + 1] if "--area" in args else "madinah"
    s, w, n, e = AREAS[area]
    bbox = f"({s},{w},{n},{e})"
    cmd, arg = args[0], args[1]
    if cmd == "find":
        els = overpass(f'(way["name"~"{arg}"]{bbox};relation["name"~"{arg}"]{bbox};);out tags;')
        for el in els:
            oid, name, kind = row(el)
            if kind:
                print(oid, "|", name, "|", kind)
    elif cmd == "tag":
        k, v = arg.split("=")
        mn = float(args[args.index("--min") + 1]) if "--min" in args else 0
        els = overpass(f'(way["{k}"="{v}"]{bbox};relation["{k}"="{v}"]{bbox};);out geom;')
        out = []
        for el in els:
            oid, name, kind = row(el)
            ln, ar = size([l for l in lines_of(el) if len(l) > 1])
            if max(ln, ar) >= mn:
                out.append((ar, ln, oid, name, kind))
        for ar, ln, oid, name, kind in sorted(out, reverse=True)[:40]:
            print(f"{oid} | {name or '-'} | {kind} | {ar} km² | {ln} km")
    elif cmd == "show":
        lines = geometry(arg)
        if not lines:
            sys.exit("no geometry")
        pts = [p for l in lines for p in l]
        lat = [p[0] for p in pts]
        lon = [p[1] for p in pts]
        print(json.dumps({"id": arg, "parts": len(lines), "size_km_km2": size(lines),
                          "extent": [round(min(lat), 4), round(min(lon), 4), round(max(lat), 4), round(max(lon), 4)]}))


if __name__ == "__main__":
    main()
