#!/usr/bin/env python3
"""Merge extracted 10-point biographies and tribe profiles into web/public/data/bio.json.

Inputs: data/work/extracted/{bio,tribe}_*.json (see data/work/BIO_SPEC.md),
plus data/tribe_profile_src.json (cited profile points) and data/tribe_roles.json (location + strategic roles per tribe).
Only ids that exist in nasabnet.json are kept; empty points are dropped.
"""
import glob
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EX = ROOT / "data" / "work" / "extracted"
WEB = ROOT / "web" / "public" / "data"

PERSON_KEYS = ["identitas", "kabilah_tabaqat", "nisbah_rihlah", "laqab_profesi", "peran", "hilf", "syaraf", "catatan"]
ROLE_KEYS = ["militer", "diplomasi", "ekonomi", "sosial"]
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


def role_point(v):
    """Role bullet: plain string (old format, unsourced) or {t, src} / {t, basis: umum}."""
    if isinstance(v, str):
        return {"t": v.strip(), "basis": "umum"} if v.strip() else None
    return clean_point({**v, "basis": v.get("basis") or ("sumber" if v.get("src") else "umum")})


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
    extra_f = ROOT / "data" / "bio_extra.json"  # role points moved here from tribe profiles (scripts/compile_moved.py)
    for pid, pts in (json.loads(extra_f.read_text()) if extra_f.exists() else {}).items():
        if pid not in pids:
            print("!! bio_extra for missing person", pid)
            continue
        b = persons.setdefault(pid, {})
        peran = b.get("peran") or {"t": "", "src": []}
        for x in pts:
            if x["t"] not in peran["t"]:
                peran["t"] = (peran["t"].rstrip(" .") + ". " if peran["t"] else "") + x["t"].rstrip(" .") + "."
                peran["src"] = list(dict.fromkeys((peran.get("src") or []) + x["src"]))
        b["peran"] = peran
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
    psrc_f = ROOT / "data" / "tribe_profile_src.json"  # cited "umum" profile points (scripts/compile_profile.py)
    for tid, r in (json.loads(psrc_f.read_text()) if psrc_f.exists() else {}).items():
        if tid not in tribes:
            continue
        for k, v in r.items():
            if v is None:
                tribes[tid].pop(k, None)
            else:
                tribes[tid][k] = clean_point({**v, "basis": "sumber" if v.get("src") else "umum"})
    roles = json.loads((ROOT / "data" / "tribe_roles.json").read_text())
    for tid, r in roles.items():
        if tid not in tids:
            if not tid.startswith("_"):
                print("!! roles for missing tribe", tid)
            continue
        t = tribes.setdefault(tid, {})
        if r.get("lokasi"):
            t["lokasi"] = role_point(r["lokasi"])
        peran = {k: [p for p in map(role_point, r.get(k) or []) if p] for k in ROLE_KEYS}
        peran = {k: v for k, v in peran.items() if v}
        if peran:
            t["peran"] = peran
    places_f = ROOT / "data" / "tribe_places.json"  # cited map places (scripts/compile_places.py)
    for tid, rows in (json.loads(places_f.read_text()) if places_f.exists() else {}).items():
        if tid in tids and rows:
            tribes.setdefault(tid, {})["tempat"] = rows
    (WEB / "bio.json").write_text(json.dumps({"persons": persons, "tribes": tribes}, ensure_ascii=False, separators=(",", ":")))
    print(f"bio.json: {len(persons)} persons, {len(tribes)} tribes, {round((WEB / 'bio.json').stat().st_size / 1024)} KB")


if __name__ == "__main__":
    main()
