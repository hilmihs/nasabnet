#!/usr/bin/env python3
"""Look up a place's coordinates on Wikidata (for data/work/PLACES_SPEC.md). Results are cached in
data/work/geo_cache/, so repeated lookups cost nothing.

  python3 scripts/geo.py search "الطائف"            # candidates: Q-id, label, description, country, lat/lon
  python3 scripts/geo.py search "Wadi Fatimah" --lang en
  python3 scripts/geo.py get Q123                   # one item's label/description/coords
  python3 scripts/geo.py osm "وادي نخلة"            # OpenStreetMap (Nominatim) candidates: osm id (N…/W…/R…), type
  python3 scripts/geo.py get N123456                # one OSM object's coords
OSM has many Hijaz wadis/mountains/wells that Wikidata lacks; its ids go into "qid" the same way.
"""
import fcntl
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


def lookup(ids, lang="en"):
    """Wikidata Q-ids or OSM ids (N123/W123/R123) -> rows with lat/lon."""
    osm = [i for i in ids if i[:1] in "NWR" and i[1:].isdigit()]
    rows = osm_rows(call({"osm_ids": ",".join(osm), "format": "jsonv2"}, OSM + "/lookup")) if osm else []
    wd = [i for i in ids if i not in osm]
    return rows + (entities(wd, lang) if wd else [])


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
    elif cmd == "osm":
        rows = osm_search(arg)
        for r in rows:
            print(f"{r['qid']}\t{r['lat']},{r['lon']}\t{r['label']} — {r['desc']}")
        if not rows:
            print("no candidates")
    elif cmd == "get":
        for r in lookup([arg], lang):
            print(json.dumps(r, ensure_ascii=False))


if __name__ == "__main__":
    main()
