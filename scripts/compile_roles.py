#!/usr/bin/env python3
"""Merge cited role files (data/work/roles_out/<id>.json) into data/tribe_roles.json.

Each file must pass scripts/check_roles.py. Cited items become {"t", "src"}; unsourced ones
{"t", "basis": "umum"}; quotes and dropped bullets stay in data/work only. Tribes without a
roles_out file keep their current entry. Then run scripts/build_bio.py.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import check_roles  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
ROLES = ROOT / "data" / "tribe_roles.json"
KEYS = check_roles.ROLE_KEYS


def point(it):
    t = it["t"].strip()
    if it.get("status") == "umum" or not it.get("src"):
        return {"t": t, "basis": "umum"}
    return {"t": t, "src": list(dict.fromkeys(it["src"]))}


def main():
    files = sorted(check_roles.OUT.glob("*.json"))
    errs = [e for f in files for e in check_roles.check_file(f)]
    if errs:
        sys.exit("fix these first:\n" + "\n".join(errs))
    roles = json.loads(ROLES.read_text())
    stats = {"src": 0, "umum": 0, "dropped": 0}
    for f in files:
        d = json.loads(f.read_text())
        tid = d["id"]
        if tid not in roles:
            print("!! unknown tribe", tid)
            continue
        entry = {}
        if d.get("lokasi"):
            entry["lokasi"] = point(d["lokasi"])
        for k in KEYS:
            entry[k] = [point(it) for it in d.get(k) or []]
            for p in entry[k]:
                stats["src" if "src" in p else "umum"] += 1
        stats["dropped"] += len(d.get("dropped") or [])
        roles[tid] = entry
    roles["_doc"] = (
        "Lokasi + kedudukan/peran strategis tiap kabilah. Butir {t, src} dikutip dari halaman kitab "
        "(diperiksa scripts/check_roles.py terhadap teks Arabnya, kutipan di data/work/roles_out); "
        "{t, basis: umum} = ringkasan umum tanpa halaman. Digabung ke bio.json oleh scripts/build_bio.py."
    )
    ROLES.write_text(json.dumps(roles, ensure_ascii=False, indent=2) + "\n")
    print(f"{len(files)} tribes merged: {stats['src']} cited, {stats['umum']} umum, {stats['dropped']} dropped")


if __name__ == "__main__":
    main()
