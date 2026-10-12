#!/usr/bin/env python3
"""Merge cited tribe-profile files (data/work/profile_out/<id>.json) into data/tribe_profile_src.json.

Each file must pass scripts/check_profile.py. Cited points become {"t", "src"}; unsourced ones
{"t", "basis": "umum"}; dropped fields null (removed from the profile). Quotes stay in data/work only.
build_bio.py applies these over the drafted profiles. Run scripts/compile_roles.py too (roles_out was edited).
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import check_profile  # noqa: E402
from compile_roles import point  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "tribe_profile_src.json"


def main():
    ids = sorted(p.stem for p in (check_profile.WORK / "profile_out").glob("*.json"))
    errs = [e for i in ids for e in check_profile.check(i)]
    if errs:
        sys.exit("fix these first:\n" + "\n".join(errs))
    res = json.loads(OUT.read_text()) if OUT.exists() else {}
    stats = {"src": 0, "umum": 0, "dropped": 0}
    for tid in ids:
        d = json.loads((check_profile.WORK / "profile_out" / f"{tid}.json").read_text())
        entry = {}
        for k in check_profile.FIELDS:
            if k in d:
                entry[k] = point(d[k])
                stats["src" if "src" in entry[k] else "umum"] += 1
        for x in d.get("dropped") or []:
            entry[x["field"]] = None
            stats["dropped"] += 1
        res[tid] = entry
    res["_doc"] = (
        "Butir profil kabilah (asal-usul) yang semula 'umum', kini dikutip dari halaman kitab "
        "(diperiksa scripts/check_profile.py; kutipan di data/work/profile_out). null = butir dibuang. "
        "Ditimpakan ke profil oleh scripts/build_bio.py."
    )
    OUT.write_text(json.dumps(res, ensure_ascii=False, indent=2) + "\n")
    print(f"{len(ids)} tribes merged: {stats['src']} cited, {stats['umum']} umum, {stats['dropped']} dropped")


if __name__ == "__main__":
    main()
