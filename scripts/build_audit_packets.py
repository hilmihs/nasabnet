#!/usr/bin/env python3
"""Turn data/work/audit_report.json into review packets with the source text behind every flagged link.

Each packet line: {fid, rule, msg, persons:[…details, source texts], edges:[…between them]}.
Output: data/work/audit_in/a_N.jsonl
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / "data" / "work"
RAW = ROOT / "data" / "raw"
import sys

N_PACKETS = int(sys.argv[2]) if len(sys.argv) > 2 else 6
ROUND = sys.argv[1] if len(sys.argv) > 1 else "R1"


def main():
    d = json.loads((ROOT / "web" / "public" / "data" / "nasabnet.json").read_text())
    P = {p["id"]: p for p in d["persons"]}
    findings = json.loads((WORK / "audit_report.json").read_text())
    ib = json.loads((WORK / "ibnsad_entries.json").read_text())
    by_page = {}
    for e in ib:
        by_page.setdefault((e["vol"], e["page"]), []).append(e)

    def ibnsad_texts(p):
        out = []
        for s in p["src"]:
            m = re.search(r"ath-Thabaqat al-Kubra (\d+)/(\d+)", s["t"])
            if m:
                for e in by_page.get((m.group(1), int(m.group(2))), []):
                    out.append(f"[Ibnu Sa'd {e['vol']}/{e['page']} — {e['title']}] {e['text'][:1100]}")
        return out[:3]

    def narrator_rel(p):
        m = re.fullmatch(r"n(\d+)", p["id"])
        if not m:
            return None
        f = RAW / "narrators" / f"{m.group(1)}.json"
        if not f.exists():
            return None
        det = json.loads(f.read_text())
        s = dict(det.get("summary", []))
        return {"full_name": det.get("full_name"), "nasab": s.get("النسب"), "relations": s.get("علاقات الراوي")}

    def person(pid):
        p = P[pid]
        return {
            "id": pid, "lat": p["lat"], "ar": p["ar"], "full": p.get("full"), "g": p["g"], "tribe": p.get("tribe"),
            "nisba": p.get("nisba"), "death": p.get("death"), "comp": p["comp"],
            "turath_rawi": narrator_rel(p), "ibnsad": ibnsad_texts(p),
        }

    rows = []
    for i, f in enumerate(findings):
        ids = [x for x in f["ids"] if x in P]
        edges = [e for e in d["edges"] if e["s"] in ids and e["t"] in ids]
        rows.append({"fid": f"{ROUND}-F{i + 1}", "rule": f["rule"], "msg": f["msg"], "persons": [person(x) for x in ids], "edges": edges})

    out = WORK / "audit_in"
    out.mkdir(parents=True, exist_ok=True)
    size = (len(rows) + N_PACKETS - 1) // N_PACKETS
    for k in range(N_PACKETS):
        with open(out / f"a_{k + 1}.jsonl", "w") as fh:
            for r in rows[k * size : (k + 1) * size]:
                fh.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(len(rows), "findings in", N_PACKETS, "packets of", size)


if __name__ == "__main__":
    main()
