#!/usr/bin/env python3
"""Fold per-relation verification results (data/work/edge_out/*.json) into the dataset corrections.

- relations judged `wrong` become `drop_edge` ops in data/corrections.json (rule "EV", with the reason);
- every relation that was in a verified packet is listed in data/edge_verified.json (so later stages skip it);
- relations listed in data/edge_keep.json (reviewed by hand) are never dropped;
- `unsure` ones are kept in data/edge_unsure.json for a human look.
"""
import glob
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / "data" / "work"


def norm_key(s, t, k):
    return (min(s, t), max(s, t), k) if k in ("spouse", "sibling", "muakhah", "milk") else (s, t, k)


def main():
    packets = {}
    for f in sorted(glob.glob(str(WORK / "edge_in" / "*.jsonl"))):
        for line in open(f):
            r = json.loads(line)
            packets[r["rid"]] = r
    results = []
    for f in sorted(glob.glob(str(WORK / "edge_out" / "*.json"))):
        try:
            results += json.loads(Path(f).read_text())
        except json.JSONDecodeError as e:
            print("!! bad json", f, e)

    corr_path = ROOT / "data" / "corrections.json"
    ops = json.loads(corr_path.read_text()) if corr_path.exists() else []
    have = {(o.get("op"), *norm_key(o.get("s", ""), o.get("t", ""), o.get("k", ""))) for o in ops}
    ver_path = ROOT / "data" / "edge_verified.json"
    verified = {tuple(x) for x in json.loads(ver_path.read_text())} if ver_path.exists() else set()
    uns_path = ROOT / "data" / "edge_unsure.json"
    unsure = json.loads(uns_path.read_text()) if uns_path.exists() else []

    # relations a verifier flagged but a human review kept (true fact, only the cited page is indirect)
    keep_path = ROOT / "data" / "edge_keep.json"
    keep = {norm_key(o["s"], o["t"], o["k"]) for o in json.loads(keep_path.read_text())} if keep_path.exists() else set()

    stats = Counter()
    for r in results:
        pk = packets.get(r.get("rid"))
        if not pk:
            continue
        valid = {norm_key(e["s"], e["t"], e["k"]) for e in pk["edges"]}
        verified |= {(e["s"], e["t"], e["k"]) for e in pk["edges"]}
        stats["ok"] += int(r.get("ok") or 0)
        for i in r.get("issues") or []:
            key = norm_key(i.get("s", ""), i.get("t", ""), i.get("k", ""))
            if key not in valid:
                stats["skipped"] += 1
                continue
            stats[i.get("verdict")] += 1
            if key in keep:
                stats["kept"] += 1
                continue
            if i.get("verdict") == "wrong" and ("drop_edge", *key) not in have:
                ops.append({"op": "drop_edge", "s": i["s"], "t": i["t"], "k": i["k"], "rule": "EV", "fid": r["rid"], "why": i.get("why", "")})
                have.add(("drop_edge", *key))
            elif i.get("verdict") == "unsure":
                unsure.append({**i, "rid": r["rid"]})
    corr_path.write_text(json.dumps(ops, ensure_ascii=False, indent=1))
    ver_path.write_text(json.dumps(sorted(verified), ensure_ascii=False))
    uns_path.write_text(json.dumps(unsure, ensure_ascii=False, indent=1))
    print("relations:", dict(stats), "| verified total", len(verified), "| drop ops", sum(1 for o in ops if o.get("rule") == "EV"))


if __name__ == "__main__":
    main()
