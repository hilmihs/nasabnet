#!/usr/bin/env python3
"""Validate data/work/moved_out/<tribe>.json (see data/work/ROLE_LEVEL_SPEC.md): role bullets about one person,
moved from the tribe profile to that person's biography. Each needs an existing person id, a page citation and
a verbatim quote on that page. Usage: python3 scripts/check_moved.py ID [ID…]   (no args = all files)
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import check_roles  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
MOVED = ROOT / "data" / "work" / "moved_out"


def check(tid, pids):
    f = MOVED / f"{tid}.json"
    errs = []
    try:
        rows = json.loads(f.read_text())
    except Exception as e:
        return [f"{f.name}: {e}"]
    if not isinstance(rows, list):
        return [f"{f.name}: must be a JSON list"]
    for i, r in enumerate(rows):
        where = f"{f.name}[{i}]"
        if r.get("pid") not in pids:
            errs.append(f"{where}: unknown person id {r.get('pid')!r}")
        check_roles.check_item({**r, "status": "ok"}, where, errs)
    rf = ROOT / "data" / "work" / "roles_out" / f"{tid}.json"
    if rf.exists():
        errs += check_roles.check_file(rf)
    return errs


def main():
    pids = {p["id"] for p in json.loads((ROOT / "web" / "public" / "data" / "nasabnet.json").read_text())["persons"]}
    ids = sys.argv[1:] or sorted(p.stem for p in MOVED.glob("*.json"))
    errs = [e for i in ids for e in check(i, pids)]
    print("\n".join(errs) if errs else f"ALL OK ({len(ids)} files)")
    sys.exit(1 if errs else 0)


if __name__ == "__main__":
    main()
