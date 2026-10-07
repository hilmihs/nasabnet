#!/usr/bin/env python3
"""Group every relation by the source record it was extracted from, for per-relation verification.

Usage: python3 scripts/build_edge_packets.py key|rest N
  key  — records touching the ~150 key companions (those with a 10-point biography)
  rest — every other record not yet verified
Output: data/work/edge_in/e_<scope>_K.jsonl, one source record per line:
  {rid, source: {label, text}, edges: [{s, t, k, n, s_name, t_name}]}
"""
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / "data" / "work"
RAW = ROOT / "data" / "raw"


def main():
    scope = sys.argv[1] if len(sys.argv) > 1 else "key"
    n_packets = int(sys.argv[2]) if len(sys.argv) > 2 else 8
    d = json.loads((ROOT / "web" / "public" / "data" / "nasabnet.json").read_text())
    P = {p["id"]: p for p in d["persons"]}
    key = set(json.loads((ROOT / "web" / "public" / "data" / "bio.json").read_text())["persons"])
    done = set()
    vf = ROOT / "data" / "edge_verified.json"
    if vf.exists():
        done = {tuple(x) for x in json.loads(vf.read_text())}
    ib = json.loads((WORK / "ibnsad_entries.json").read_text())
    by_page = defaultdict(list)
    for e in ib:
        by_page[(e["vol"], e["page"])].append(e)

    def name(pid):
        p = P[pid]
        return f"{p['ar']} — {p.get('full') or ''} [{p['lat']}]".strip()

    def source_text(src):
        t = (src or {}).get("t", "")
        m = re.search(r"ath-Thabaqat al-Kubra (\d+)/(\d+)", t)
        if m:
            entries = by_page.get((m.group(1), int(m.group(2))), [])
            return "\n\n".join(f"### {e['title']} (Ibnu Sa'd {e['vol']}/{e['page']})\n{e['text']}" for e in entries)[:5000]
        m = re.search(r"narrator/(\d+)", (src or {}).get("url", ""))
        if m:
            f = RAW / "narrators" / f"{m.group(1)}.json"
            if f.exists():
                det = json.loads(f.read_text())
                s = dict(det.get("summary", []))
                return f"full_name: {det.get('full_name')}\nالنسب: {s.get('النسب', '')}\nعلاقات الراوي: {s.get('علاقات الراوي', '')}"
        return ""

    groups = defaultdict(list)
    for e in d["edges"]:
        if (e["s"], e["t"], e["k"]) in done:
            continue
        label = (e.get("src") or {}).get("t", "")
        if not label or "Koreksi audit" in label:
            continue
        touches = e["s"] in key or e["t"] in key
        if (scope == "key") != touches:
            continue
        # two narrators can share a label ("Turath · data rawi: سلمة بن قيس"): group by the source URL too
        url = (e.get("src") or {}).get("url", "")
        groups[(label, url)].append(e)

    rows = []
    for (label, url), es in sorted(groups.items()):
        src = es[0].get("src")
        text = source_text(src)
        if not text:
            continue
        m = re.search(r"narrator/(\d+)", url)
        rows.append({
            "rid": f"{label} [rawi {m.group(1)}]" if m else label,
            "source": {"label": label, "text": text},
            "edges": [{"s": e["s"], "t": e["t"], "k": e["k"], "n": e.get("n"), "s_name": name(e["s"]), "t_name": name(e["t"])} for e in es],
        })
    out = WORK / "edge_in"
    out.mkdir(parents=True, exist_ok=True)
    size = (len(rows) + n_packets - 1) // n_packets
    for k in range(n_packets):
        with open(out / f"e_{scope}_{k + 1}.jsonl", "w") as fh:
            for r in rows[k * size : (k + 1) * size]:
                fh.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"{scope}: {len(rows)} source records, {sum(len(r['edges']) for r in rows)} relations, {n_packets} packets of ~{size}")


if __name__ == "__main__":
    main()
