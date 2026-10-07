#!/usr/bin/env python3
"""Merge extracted 10-point biographies and tribe profiles into web/public/data/bio.json.

Inputs: data/work/extracted/{bio,tribe}_*.json (see data/work/BIO_SPEC.md).
Only ids that exist in nasabnet.json are kept; empty points are dropped.
"""
import glob
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EX = ROOT / "data" / "work" / "extracted"
WEB = ROOT / "web" / "public" / "data"

PERSON_KEYS = ["identitas", "kabilah_tabaqat", "nisbah_rihlah", "laqab_profesi", "peran", "hilf", "syaraf", "catatan"]
TRIBE_KEYS = ["nama_arti", "leluhur", "titik_temu", "struktur", "wilayah", "peran_sosial", "hilf", "tokoh", "dinamika", "rujukan"]


def load(prefix):
    out = {}
    for f in sorted(glob.glob(str(EX / f"{prefix}_*.json"))):
        try:
            for r in json.loads(Path(f).read_text()):
                if isinstance(r, dict) and r.get("id"):
                    out[r["id"]] = r
        except json.JSONDecodeError as e:
            print("!! bad json", f, e)
    return out


def clean_point(v):
    if isinstance(v, dict):
        if "t" in v:
            if not (v.get("t") or "").strip():
                return None
            p = {"t": v["t"].strip()}
            if v.get("src"):
                p["src"] = [s for s in v["src"] if isinstance(s, str)]
            if v.get("basis") in ("sumber", "umum"):
                p["basis"] = v["basis"]
            return p
        d = {k: x for k, x in v.items() if x}
        return d or None
    if isinstance(v, list):
        return [x for x in v if x] or None
    if isinstance(v, str):
        return v.strip() or None
    return None


def main():
    data = json.loads((WEB / "nasabnet.json").read_text())
    pids = {p["id"] for p in data["persons"]}
    tids = {t["id"] for t in data["tribes"]}
    persons = {}
    drafts = load("bio")
    verified = load("bioV")  # fact-checked against the excerpts (data/work/VERIFY_SPEC.md)
    print(f"drafts {len(drafts)}, verified {len(verified)}")
    alias_f = ROOT / "data" / "work" / "id_alias.json"
    alias = json.loads(alias_f.read_text()) if alias_f.exists() else {}
    for pid, r in {**drafts, **verified}.items():
        pid = alias.get(pid, pid)
        if pid not in pids:
            print("!! bio for missing person", pid)
            continue
        b = {k: clean_point(r.get(k)) for k in PERSON_KEYS}
        b = {k: v for k, v in b.items() if v}
        if b:
            if pid in verified:
                b["v"] = True
            persons[pid] = b
    tribes = {}
    tdrafts, tverified = load("tribe"), load("tribeV")
    print(f"tribe drafts {len(tdrafts)}, verified {len(tverified)}")
    for tid, r in {**tdrafts, **tverified}.items():
        if tid not in tids:
            continue
        t = {k: clean_point(r.get(k)) for k in TRIBE_KEYS}
        t = {k: v for k, v in t.items() if v}
        if t:
            if tid in tverified:
                t["v"] = True
            tribes[tid] = t
    (WEB / "bio.json").write_text(json.dumps({"persons": persons, "tribes": tribes}, ensure_ascii=False, separators=(",", ":")))
    print(f"bio.json: {len(persons)} persons, {len(tribes)} tribes, {round((WEB / 'bio.json').stat().st_size / 1024)} KB")


if __name__ == "__main__":
    main()
