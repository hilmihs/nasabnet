#!/usr/bin/env python3
"""Look up a place's coordinates on Wikidata (for data/work/PLACES_SPEC.md). Results are cached in
data/work/geo_cache/, so repeated lookups cost nothing.

  python3 scripts/geo.py search "الطائف"            # candidates: Q-id, label, description, country, lat/lon
  python3 scripts/geo.py search "Wadi Fatimah" --lang en
  python3 scripts/geo.py get Q123                   # one item's label/description/coords
  python3 scripts/geo.py osm "وادي نخلة"            # OpenStreetMap (Nominatim) candidates: osm id (N…/W…/R…), type
  python3 scripts/geo.py get N123456                # one OSM object's coords
OSM has many Hijaz wadis/mountains/wells that Wikidata lacks; its ids go into "qid" the same way.

Approximate points derived from a book's own description (data/work/PLACES_SPEC.md, "Derived points"):
  python3 scripts/geo.py between Q182640 Q5806 [0.5]     # point at fraction f from the first to the second place
  python3 scripts/geo.py offset Q5806 NE 12 farsakh       # distance + direction from a place (mil/farsakh/barid/marhalah/km)
  python3 scripts/geo.py offset Q5806 Q182640 3 mil       # ... in the direction of another place
  python3 scripts/geo.py thurayya "الصمان"               # al-Thurayya gazetteer of classical toponyms (ids TH:…)
"""
import fcntl
import math
import hashlib
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

CACHE = Path(__file__).resolve().parent.parent / "data" / "work" / "geo_cache"
API = "https://www.wikidata.org/w/api.php"
OSM = "https://nominatim.openstreetmap.org"
# Middle East + Horn of Africa + Anatolia/Iran
COUNTRIES = "sa,ye,om,ae,qa,bh,kw,iq,jo,sy,ps,il,lb,eg,ir,er,et,dj,so,sd,tr"
UA = "NasabNet-research/1.0 (educational genealogy project; https://nasabnet.vercel.app)"
MIN_GAP = 1.0


def call(params, api=API):
    key = hashlib.sha1(json.dumps([api, params] if api != API else params, sort_keys=True).encode()).hexdigest()
    f = CACHE / f"{key}.json"
    if f.exists():
        return json.loads(f.read_text())
    url = api + "?" + urllib.parse.urlencode(params if api != API else {**params, "format": "json"})
    CACHE.mkdir(parents=True, exist_ok=True)
    # one request at a time across all processes, >= MIN_GAP s apart (Wikidata answers 429 to bursts)
    with open(CACHE / (".lock" if api == API else ".lock-osm"), "a+") as lk:
        fcntl.flock(lk, fcntl.LOCK_EX)
        for attempt in range(8):
            lk.seek(0)
            last = float(lk.read().strip() or 0)
            time.sleep(max(0.0, last + MIN_GAP - time.time()))
            try:
                req = urllib.request.Request(url, headers={"User-Agent": UA})
                with urllib.request.urlopen(req, timeout=30) as r:
                    data = json.loads(r.read().decode())
                f.write_text(json.dumps(data, ensure_ascii=False))
                return data
            except urllib.error.HTTPError as e:
                wait = int(e.headers.get("Retry-After") or 5) if e.code == 429 else 2 ** attempt
                time.sleep(wait)
            except Exception:
                time.sleep(2 ** attempt)
            finally:
                lk.seek(0)
                lk.truncate()
                lk.write(str(time.time()))
                lk.flush()
    sys.exit("wikidata unreachable")


def entities(qids, lang):
    d = call({"action": "wbgetentities", "ids": "|".join(qids), "props": "labels|descriptions|claims",
              "languages": f"{lang}|en|ar"})
    out = []
    for q in qids:
        e = d.get("entities", {}).get(q, {})
        c = (e.get("claims") or {}).get("P625") or []
        v = c[0]["mainsnak"].get("datavalue", {}).get("value") if c else None
        country = (e.get("claims") or {}).get("P17") or []
        cq = country[0]["mainsnak"].get("datavalue", {}).get("value", {}).get("id") if country else ""
        lab = lambda k: next((e.get(k, {}).get(l, {}).get("value") for l in (lang, "en", "ar") if e.get(k, {}).get(l)), "")
        out.append({"qid": q, "label": lab("labels"), "desc": lab("descriptions"), "country": cq,
                    "lat": round(v["latitude"], 4) if v else None, "lon": round(v["longitude"], 4) if v else None})
    return out


def osm_rows(rows):
    out = []
    for r in rows if isinstance(rows, list) else []:
        oid = f"{r['osm_type'][0].upper()}{r['osm_id']}"
        out.append({"qid": oid, "label": r.get("name") or "", "desc": f"{r.get('category', r.get('class', ''))}/{r.get('type', '')} — {r.get('display_name', '')}",
                    "country": "", "lat": round(float(r["lat"]), 4), "lon": round(float(r["lon"]), 4)})
    return out


def osm_search(q):
    return osm_rows(call({"q": q, "format": "jsonv2", "limit": 10, "accept-language": "ar,en", "countrycodes": COUNTRIES},
                         OSM + "/search"))


THURAYYA = Path(__file__).resolve().parent.parent / "data" / "raw" / "thurayya.geojson"
# download: curl -o data/raw/thurayya.geojson https://raw.githubusercontent.com/althurayya/althurayya.github.io/master/master/places.geojson


def _thurayya():
    rows = {}
    for f in json.loads(THURAYYA.read_text())["features"]:
        c = f["properties"].get("cornuData", {})
        rows["TH:" + c["cornu_URI"]] = {"qid": "TH:" + c["cornu_URI"], "label": c.get("toponym_arabic", ""),
                                       "desc": f"{c.get('toponym_translit', '')} — {c.get('region_spelled', '')} ({c.get('top_type_hom', '')}, {c.get('coord_certainty', '')})",
                                       "other": c.get("toponym_arabic_other", ""), "country": "",
                                       "lat": round(float(c["coord_lat"]), 4), "lon": round(float(c["coord_lon"]), 4)}
    return rows


def thurayya_search(q):
    import re
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from books import norm
    nq = norm(q).strip()
    return [r for r in _thurayya().values() if any(norm(x).strip() == nq or nq in norm(x) for x in [r["label"], *r["other"].split(",")] if x)]


def lookup(ids, lang="en"):
    """Wikidata Q-ids or OSM ids (N123/W123/R123) -> rows with lat/lon."""
    th = [i for i in ids if i.startswith("TH:")]
    ids = [i for i in ids if i not in th]
    thr = [_thurayya()[i] for i in th if i in _thurayya()] if th else []
    osm = [i for i in ids if i[:1] in "NWR" and i[1:].isdigit()]
    rows = osm_rows(call({"osm_ids": ",".join(osm), "format": "jsonv2"}, OSM + "/lookup")) if osm else []
    wd = [i for i in ids if i not in osm]
    return thr + rows + (entities(wd, lang) if wd else [])


UNITS_KM = {"km": 1.0, "mil": 1.9, "farsakh": 5.7, "barid": 22.8, "marhalah": 40.0}
COMPASS = {"N": 0, "NE": 45, "E": 90, "SE": 135, "S": 180, "SW": 225, "W": 270, "NW": 315}


def _pt(qid):
    r = (lookup([qid]) or [{}])[0]
    if r.get("lat") is None:
        raise SystemExit(f"{qid}: no coordinates")
    return r["lat"], r["lon"]


def _bearing(a, b):
    y = math.sin(math.radians(b[1] - a[1])) * math.cos(math.radians(b[0]))
    x = math.cos(math.radians(a[0])) * math.sin(math.radians(b[0])) - math.sin(math.radians(a[0])) * math.cos(math.radians(b[0])) * math.cos(math.radians(b[1] - a[1]))
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def derive(spec):
    """{"method": "between", "refs": [q1, q2], "frac": 0.5} or
    {"method": "offset", "ref": q, "toward": q2 | "dir": "NE", "dist": 3, "unit": "mil"} -> (lat, lon)"""
    if spec.get("method") == "between":
        a, b = (_pt(q) for q in spec["refs"])
        f = float(spec.get("frac", 0.5))
        return round(a[0] + (b[0] - a[0]) * f, 4), round(a[1] + (b[1] - a[1]) * f, 4)
    if spec.get("method") == "offset":
        a = _pt(spec["ref"])
        brg = _bearing(a, _pt(spec["toward"])) if spec.get("toward") else COMPASS[spec["dir"]]
        d = float(spec["dist"]) * UNITS_KM[spec.get("unit", "km")]
        lat = a[0] + d / 111.32 * math.cos(math.radians(brg))
        lon = a[1] + d / (111.32 * math.cos(math.radians(a[0]))) * math.sin(math.radians(brg))
        return round(lat, 4), round(lon, 4)
    raise SystemExit(f"bad derive spec {spec}")


def main():
    cmd, arg = sys.argv[1], sys.argv[2]
    lang = sys.argv[sys.argv.index("--lang") + 1] if "--lang" in sys.argv else "ar"
    if cmd == "search":
        d = call({"action": "wbsearchentities", "search": arg, "language": lang, "uselang": lang, "limit": 12, "type": "item"})
        qids = [x["id"] for x in d.get("search", [])]
        rows = entities(qids, lang) if qids else []
        for r in rows:
            if r["lat"] is not None:
                print(f"{r['qid']}\t{r['lat']},{r['lon']}\t{r['label']} — {r['desc']} [{r['country']}]")
        if not any(r["lat"] is not None for r in rows):
            print("no candidates with coordinates")
    elif cmd == "thurayya":
        rows = thurayya_search(arg)
        for r in rows:
            print(f"{r['qid']}\t{r['lat']},{r['lon']}\t{r['label']} — {r['desc']}")
        if not rows:
            print("no candidates")
    elif cmd == "osm":
        rows = osm_search(arg)
        for r in rows:
            print(f"{r['qid']}\t{r['lat']},{r['lon']}\t{r['label']} — {r['desc']}")
        if not rows:
            print("no candidates")
    elif cmd == "between":
        spec = {"method": "between", "refs": [sys.argv[2], sys.argv[3]], "frac": float(sys.argv[4]) if len(sys.argv) > 4 else 0.5}
        lat, lon = derive(spec)
        print(json.dumps({"derive": spec, "lat": lat, "lon": lon}, ensure_ascii=False))
    elif cmd == "offset":
        ref, how, dist, unit = sys.argv[2], sys.argv[3], sys.argv[4], (sys.argv[5] if len(sys.argv) > 5 else "km")
        spec = {"method": "offset", "ref": ref, ("dir" if how.upper() in COMPASS else "toward"): how.upper() if how.upper() in COMPASS else how, "dist": float(dist), "unit": unit}
        lat, lon = derive(spec)
        print(json.dumps({"derive": spec, "lat": lat, "lon": lon}, ensure_ascii=False))
    elif cmd == "get":
        for r in lookup([arg], lang):
            print(json.dumps(r, ensure_ascii=False))


if __name__ == "__main__":
    main()
