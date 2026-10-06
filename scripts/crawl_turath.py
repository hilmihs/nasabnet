#!/usr/bin/env python3
"""Crawl narrator (rawi) data from the public Turath API (api.turath.io).

Endpoints (discovered from app.turath.io bundle):
  GET /narrators?page=N&limit=100[&q=...]  -> {count, page, data:[{id,name,full_name,death,death_text,rank}]}
  GET /narrator?id=ID                      -> {..., summary:[[label,value]], evaluations:[...], notes:[...]}

Usage:
  python3 scripts/crawl_turath.py list      # all narrators -> data/raw/narrators_list.json
  python3 scripts/crawl_turath.py details   # details for every narrator -> data/raw/narrators/<id>.json
"""
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://api.turath.io"
ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
DETAIL_DIR = RAW / "narrators"
UA = "NasabNet-research/1.0 (educational; contact: project owner)"


class Throttle:
    """Sequential polite rate limiter: adapts its interval to HTTP 429 / Retry-After."""

    def __init__(self, interval=0.25):
        self.interval = interval
        self.ok_streak = 0

    def wait(self):
        time.sleep(self.interval)

    def on_ok(self):
        self.ok_streak += 1
        if self.ok_streak >= 300 and self.interval > 0.2:
            self.interval *= 0.9
            self.ok_streak = 0

    def on_limited(self, retry_after):
        self.ok_streak = 0
        self.interval = min(self.interval * 1.3, 3.0)
        time.sleep(retry_after + 1)


THROTTLE = Throttle()


def get_json(path, params=None, retries=8):
    url = API + path + ("?" + urllib.parse.urlencode(params) if params else "")
    for attempt in range(retries):
        THROTTLE.wait()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=40) as r:
                data = json.loads(r.read().decode("utf-8"))
            THROTTLE.on_ok()
            return data
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            if e.code == 429:
                THROTTLE.on_limited(int(e.headers.get("Retry-After") or 3))
            else:
                time.sleep(2 ** attempt)
        except Exception:
            time.sleep(2 ** attempt)
    return "ERROR"


def crawl_list():
    RAW.mkdir(parents=True, exist_ok=True)
    first = get_json("/narrators", {"page": 1, "limit": 100})
    total = first["count"]
    pages = (total + 99) // 100
    out = {r["id"]: r for r in first["data"]}

    for p in range(2, pages + 1):
        res = get_json("/narrators", {"page": p, "limit": 100})
        if not isinstance(res, dict):
            raise RuntimeError(f"page {p} failed")
        for r in res["data"]:
            out[r["id"]] = r
        if p % 20 == 0:
            print(f"page {p}/{pages} -> {len(out)}", flush=True)
    data = sorted(out.values(), key=lambda r: r["id"])
    (RAW / "narrators_list.json").write_text(json.dumps(data, ensure_ascii=False))
    print(f"done: {len(data)} / {total}")


def likely_companion(r):
    rank = r.get("rank") or ""
    return any(k in rank for k in ("صحاب", "صحب", "رؤية", "أم المؤمنين", "العشرة")) or (r.get("death") or 999) <= 110


def crawl_details():
    DETAIL_DIR.mkdir(parents=True, exist_ok=True)
    rows = json.loads((RAW / "narrators_list.json").read_text())
    # companions-first ordering so the useful part of the dataset lands early
    rows.sort(key=lambda r: (not likely_companion(r), r["id"]))
    todo = [r["id"] for r in rows if not (DETAIL_DIR / f"{r['id']}.json").exists()]
    print(f"{len(todo)} to fetch ({len(rows) - len(todo)} cached)", flush=True)
    failed = []
    for n, i in enumerate(todo, 1):
        d = get_json("/narrator", {"id": i})
        if d == "ERROR" or (isinstance(d, dict) and "id" not in d):
            failed.append(i)
        elif d is not None:
            (DETAIL_DIR / f"{i}.json").write_text(json.dumps(d, ensure_ascii=False))
        if n % 250 == 0:
            print(f"{n}/{len(todo)} interval={THROTTLE.interval:.2f}s failed={len(failed)}", flush=True)
    (RAW / "failed_ids.json").write_text(json.dumps(failed))
    print(f"done, failed={len(failed)}")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "list"
    if cmd == "list":
        crawl_list()
    elif cmd == "details":
        crawl_details()
    else:
        sys.exit(__doc__)
