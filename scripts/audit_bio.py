#!/usr/bin/env python3
"""Flag clan/battle labels in verified biographies that the person's own excerpts do not support.

  python3 scripts/audit_bio.py [N …]      # default: every bioV_N batch that has a source batch

A label (Anshar, Khazraj, Aus, Quraisy, Bani an-Najjar, Badar, Uhud, …) in the Indonesian text counts as supported
when one of its Arabic forms appears in that person's excerpts, Turath `full`/`ar`/`kunya`/`laqab`, or nisba.
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from nasab import norm  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
BATCH = ROOT / "data" / "work" / "bio_batches"
EX = ROOT / "data" / "work" / "extracted"
DATA = ROOT / "web" / "public" / "data" / "nasabnet.json"

# labels implied by the person's tribe in the dataset (Bani Hasyim → Quraisy, Khazraj → Anshar …)
IMPLIED = {"aus": {"Aus", "Anshar", "al-Aus"}, "khazraj": {"Khazraj", "Anshar"}, "anshar": {"Anshar"}}

LABELS = {
    r"\bAnshar\b": ["الانصار", "الانصاري", "انصار"],
    r"\bKhazraj\b": ["الخزرج"],
    r"\bal-Aus\b|\bAus\b": ["الاوس"],
    r"\bQuraisy\b": ["قريش", "القرشي"],
    r"\bBani an-Najjar\b": ["النجار"],
    r"\bBani Salimah\b": ["سلمه"],
    r"\bBani 'Abd al-Asyhal\b|\bAbdul Asyhal\b": ["الاشهل"],
    r"\bBadar\b|\bBadr\b": ["بدر"],
    r"\bUhud\b": ["احد"],
    r"\bKhandaq\b": ["الخندق"],
    r"\bHabasyah\b": ["الحبشه"],
    r"\bYamamah\b": ["اليمامه"],
}


def texts(rec):
    for k, v in rec.items():
        if isinstance(v, dict):
            for kk, vv in v.items():
                if isinstance(vv, str) and kk != "src":
                    yield k, vv


def audit(n, persons, groups):
    src = {json.loads(l)["id"]: json.loads(l) for l in (BATCH / f"bio_{n}.jsonl").read_text().splitlines() if l.strip()}
    out = []
    for f in sorted(EX.glob(f"bioV_{n}.part*.json")):
        for rec in json.loads(f.read_text()):
            s = src.get(rec.get("id"))
            if not s:
                continue
            p = persons.get(rec["id"], {})
            implied = IMPLIED.get(p.get("tribe"), set()) | ({"Quraisy"} if groups.get(p.get("tribe")) == "quraisy" else set())
            hay = norm(" ".join([s.get("isabah", ""), s.get("ibnsad", ""), s.get("full", ""), s.get("ar", ""), s.get("kunya", ""), s.get("laqab", ""), p.get("nisba") or ""]))
            for field, t in texts(rec):
                for rx, forms in LABELS.items():
                    for m in re.finditer(rx, t):
                        if m.group(0) in implied:
                            continue
                        if not any(x in hay for x in forms):
                            out.append((n, rec["id"], field, m.group(0), t[max(0, m.start() - 40) : m.end() + 30]))
    return out


def main():
    data = json.loads(DATA.read_text())
    persons = {p["id"]: p for p in data["persons"]}
    groups = {t["id"]: t["group"] for t in data["tribes"]}
    ns = sys.argv[1:] or sorted({p.name.split(".part")[0][5:] for p in EX.glob("bioV_*.part*.json")} & {p.stem[4:] for p in BATCH.glob("bio_*.jsonl")}, key=str)
    flags = [x for n in ns for x in audit(n, persons, groups)]
    for x in flags:
        print("\t".join(map(str, x)))
    print(f"-- {len(flags)} unsupported labels in {len(ns)} batches", file=sys.stderr)


if __name__ == "__main__":
    main()
