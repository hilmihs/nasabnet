#!/usr/bin/env python3
"""Merge data/work/moved_out/<tribe>.json into data/bio_extra.json ({person id: [{t, src}]}), which
scripts/build_bio.py appends to each person's "peran" point. Run compile_roles.py too (roles_out was edited)."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import check_moved  # noqa: E402

ROOT = check_moved.ROOT


def main():
    pids = {p["id"] for p in json.loads((ROOT / "web" / "public" / "data" / "nasabnet.json").read_text())["persons"]}
    ids = sorted(p.stem for p in check_moved.MOVED.glob("*.json"))
    errs = [e for i in ids for e in check_moved.check(i, pids)]
    if errs:
        sys.exit("fix these first:\n" + "\n".join(errs))
    out = {}
    for tid in ids:
        for r in json.loads((check_moved.MOVED / f"{tid}.json").read_text()):
            out.setdefault(r["pid"], []).append({"t": r["t"].strip(), "src": list(dict.fromkeys(r["src"]))})
    (ROOT / "data" / "bio_extra.json").write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n")
    print(f"{sum(map(len, out.values()))} points for {len(out)} persons -> data/bio_extra.json")


if __name__ == "__main__":
    main()
