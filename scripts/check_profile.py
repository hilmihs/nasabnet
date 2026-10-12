#!/usr/bin/env python3
"""Validate cited tribe-profile files (data/work/profile_out/<id>.json, see data/work/PROFILE_SPEC.md) and the
roles_out/<id>.json files of the same tribes. Every field listed under "umum" in profile_in/<id>.json must come
back either as an item or in "dropped"; cited quotes must occur on the cited page (or the next).
Usage: python3 scripts/check_profile.py ID [ID…]   (no args = all profile_out files)
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import check_roles  # noqa: E402

WORK = Path(__file__).resolve().parent.parent / "data" / "work"
FIELDS = ["nama_arti", "leluhur", "titik_temu", "struktur", "wilayah", "peran_sosial", "hilf", "dinamika"]


def check(tid):
    errs = []
    f = WORK / "profile_out" / f"{tid}.json"
    if not f.exists():
        return [f"{tid}: profile_out/{tid}.json missing"]
    try:
        d = json.loads(f.read_text())
    except Exception as e:
        return [f"{f.name}: bad json {e}"]
    if d.get("id") != tid:
        errs.append(f"{f.name}: id {d.get('id')!r} != file name")
    want = json.loads((WORK / "profile_in" / f"{tid}.json").read_text())["umum"]
    dropped = {x.get("field") for x in d.get("dropped") or []}
    for x in d.get("dropped") or []:
        if not x.get("reason"):
            errs.append(f"{f.name}: dropped {x.get('field')} needs a reason")
    for k in d:
        if k not in FIELDS + ["id", "dropped"]:
            errs.append(f"{f.name}: unknown key {k!r}")
    for k in want:
        if k in d and k in dropped:
            errs.append(f"{f.name}:{k}: both kept and dropped")
        elif k not in d and k not in dropped:
            errs.append(f"{f.name}:{k}: missing (keep it as an item or list it in dropped)")
    for k in FIELDS:
        if k in d:
            if k not in want:
                errs.append(f"{f.name}:{k}: not an umum field of this tribe (already cited) - remove it")
            elif d[k].get("status") == "new":
                errs.append(f"{f.name}:{k}: status new not allowed here")
            check_roles.check_item(d[k], f"{f.name}:{k}", errs)
    rf = WORK / "roles_out" / f"{tid}.json"
    if rf.exists():
        errs += check_roles.check_file(rf)
    return errs


def main():
    ids = sys.argv[1:] or sorted(p.stem for p in (WORK / "profile_out").glob("*.json"))
    errs = [e for i in ids for e in check(i)]
    print("\n".join(errs) if errs else f"ALL OK ({len(ids)} tribes)")
    sys.exit(1 if errs else 0)


if __name__ == "__main__":
    main()
