#!/usr/bin/env python3
"""Write data/work/profile_in/<id>.json: the tribe-profile points still marked "umum" (no page citation),
plus the "umum" lokasi/role bullets in data/work/roles_out/<id>.json, for agents following
data/work/PROFILE_SPEC.md. Usage: python3 scripts/build_profile_packets.py"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / "data" / "work"
FIELDS = ["nama_arti", "leluhur", "titik_temu", "struktur", "wilayah", "peran_sosial", "hilf", "dinamika"]


def main():
    data = json.loads((ROOT / "web" / "public" / "data" / "nasabnet.json").read_text())
    bio = json.loads((ROOT / "web" / "public" / "data" / "bio.json").read_text())["tribes"]
    out = WORK / "profile_in"
    out.mkdir(exist_ok=True)
    n = items = 0
    for t in data["tribes"]:
        prof = bio.get(t["id"], {})
        fields = {k: prof[k]["t"] for k in FIELDS if isinstance(prof.get(k), dict) and not prof[k].get("src")}
        cited = {k: {"t": prof[k]["t"], "src": prof[k]["src"]} for k in FIELDS
                 if isinstance(prof.get(k), dict) and prof[k].get("src")}
        roles_umum = []
        rf = WORK / "roles_out" / f"{t['id']}.json"
        if rf.exists():
            r = json.loads(rf.read_text())
            if (r.get("lokasi") or {}).get("status") == "umum":
                roles_umum.append("lokasi")
            for k in ("militer", "diplomasi", "ekonomi", "sosial"):
                roles_umum += [f"{k}[{i}]" for i, it in enumerate(r.get(k) or []) if it.get("status") == "umum"]
        if not fields and not roles_umum:
            continue
        rec = {"id": t["id"], "name": t["name"], "ar": t["ar"], "group": t.get("group"), "umum": fields,
               "already_cited": cited, "roles_umum": roles_umum}
        (out / f"{t['id']}.json").write_text(json.dumps(rec, ensure_ascii=False, indent=1) + "\n")
        n += 1
        items += len(fields) + len(roles_umum)
    print(f"{n} tribes, {items} umum items -> {out}")


if __name__ == "__main__":
    main()
