#!/usr/bin/env python3
"""Collect reviewed audit decisions (data/work/audit_out/*.json) into data/corrections.json.

Every op keeps the finding id, rule and the reviewer's one-line reason, so each correction can be traced
back to the audit finding and its source text. Existing corrections are kept; ops for the same finding are
replaced by the newer review.
"""
import glob
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "corrections.json"


def main():
    findings = {}
    for f in sorted(glob.glob(str(ROOT / "data" / "work" / "audit_in" / "*.jsonl"))):
        for line in open(f):
            r = json.loads(line)
            findings[r["fid"]] = r
    decisions = []
    for f in sorted(glob.glob(str(ROOT / "data" / "work" / "audit_out" / "*.json"))):
        try:
            decisions += json.loads(Path(f).read_text())
        except json.JSONDecodeError as e:
            print("!! bad json", f, e)
    old = json.loads(OUT.read_text()) if OUT.exists() else []
    reviewed = {d["fid"] for d in decisions if d.get("fid")}
    ops = [o for o in old if o.get("fid") not in reviewed]
    verdicts = Counter()
    for d in decisions:
        verdicts[d.get("verdict")] += 1
        if d.get("verdict") != "fix":
            continue
        fnd = findings.get(d["fid"], {})
        valid = {p["id"] for p in fnd.get("persons", [])}
        for op in d.get("ops") or []:
            ids = [op.get(k) for k in ("keep", "drop", "s", "t", "id") if op.get(k)]
            if valid and not all(i in valid for i in ids):
                print("!! skipped op with id outside finding", d["fid"], op)
                continue
            ops.append({**op, "fid": d["fid"], "rule": fnd.get("rule"), "why": d.get("why", "")})
    OUT.write_text(json.dumps(ops, ensure_ascii=False, indent=1))
    # findings judged ok/unsure are remembered so the next audit run does not raise them again
    reviewed_path = ROOT / "data" / "audit_reviewed.json"
    reviewed_old = json.loads(reviewed_path.read_text()) if reviewed_path.exists() else []
    seen = {(r["rule"], tuple(sorted(r["ids"]))) for r in reviewed_old}
    for d in decisions:
        fnd = findings.get(d.get("fid"), {})
        if d.get("verdict") in ("ok", "unsure") and fnd:
            key = (fnd["rule"], tuple(sorted(p["id"] for p in fnd["persons"])))
            if key not in seen:
                seen.add(key)
                reviewed_old.append({"rule": key[0], "ids": list(key[1]), "verdict": d["verdict"], "why": d.get("why", "")})
    reviewed_path.write_text(json.dumps(reviewed_old, ensure_ascii=False, indent=1))
    print("verdicts:", dict(verdicts), "| ops:", dict(Counter(o["op"] for o in ops)), "->", OUT)


if __name__ == "__main__":
    main()
