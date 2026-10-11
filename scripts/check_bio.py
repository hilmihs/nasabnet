#!/usr/bin/env python3
"""Validate biography drafts/verifications against their source batch.

  python3 scripts/check_bio.py N [N…]          # checks extracted/bio_N.part*.json
  python3 scripts/check_bio.py --v N [N…]      # checks extracted/bioV_N.part*.json

Checks: every record of data/work/bio_batches/bio_N.jsonl present once, same order, valid JSON, ≤10 records per
part file, known keys only, and each point's `src` uses only tags of that person's own excerpts (+ "Turath rawi").
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BATCH = ROOT / "data" / "work" / "bio_batches"
EX = ROOT / "data" / "work" / "extracted"
KEYS = {"id", "identitas", "kabilah_tabaqat", "nisbah_rihlah", "laqab_profesi", "peran", "hilf", "syaraf", "catatan"}
TAG = re.compile(r"^\[([^\]\n]+)\]")


def check(n, prefix):
    errs = []
    src = [json.loads(l) for l in (BATCH / f"bio_{n}.jsonl").read_text().splitlines() if l.strip()]
    parts = sorted(EX.glob(f"{prefix}_{n}.part*.json"), key=lambda p: int(p.name.split(".part")[1].split(".")[0]))
    if not parts:
        return [f"{prefix}_{n}: no part files"]
    recs = []
    for p in parts:
        try:
            arr = json.loads(p.read_text())
        except json.JSONDecodeError as e:
            errs.append(f"{p.name}: bad json {e}")
            continue
        if len(arr) > 10:
            errs.append(f"{p.name}: {len(arr)} records (>10)")
        recs += arr
    want = [r["id"] for r in src]
    got = [r.get("id") for r in recs if isinstance(r, dict)]
    if got != want:
        missing = [x for x in want if x not in got]
        extra = [x for x in got if x not in want]
        errs.append(f"{prefix}_{n}: ids differ from batch (missing {missing[:5]}, extra {extra[:5]}, order ok={sorted(got) == sorted(want)})")
    # each excerpt starts with its own citation tag on the first line: "[al-Ishabah 4/484]"
    head = lambda x: TAG.findall(x.split("\n", 1)[0]) if x else []
    allowed = {r["id"]: set(head(r["isabah"]) + head(r["ibnsad"])) | {"Turath rawi"} for r in src}
    for r in recs:
        if not isinstance(r, dict):
            continue
        bad = set(r) - KEYS - {"v"}
        if bad:
            errs.append(f"{prefix}_{n}:{r.get('id')}: unknown keys {sorted(bad)}")
        for k, v in r.items():
            if isinstance(v, dict):
                for s in v.get("src") or []:
                    if s not in allowed.get(r.get("id"), set()):
                        errs.append(f"{prefix}_{n}:{r.get('id')}.{k}: src {s!r} not among this person's excerpts")
    return errs


def main():
    args = sys.argv[1:]
    prefix = "bio"
    if args and args[0] == "--v":
        prefix, args = "bioV", args[1:]
    errs = [e for n in args for e in check(n, prefix)]
    print("\n".join(errs) if errs else f"ALL OK ({len(args)} batches)")
    sys.exit(1 if errs else 0)


if __name__ == "__main__":
    main()
