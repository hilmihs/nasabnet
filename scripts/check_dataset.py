#!/usr/bin/env python3
"""Sanity checks on web/public/data/nasabnet.json against well-attested family links.

Each check names people by an Arabic prefix of their `ar`/`full` name (normalised) so the test does not
depend on internal ids. Prints PASS/FAIL per fact plus duplicate-person warnings.
"""
import json
import sys
from collections import defaultdict, deque
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from nasab import expand_prophet, norm  # noqa: E402

DATA = Path(__file__).resolve().parent.parent / "web" / "public" / "data" / "nasabnet.json"

FACTS = [
    ("spouse", "nabi", "خديجه بنت خويلد"),
    ("spouse", "nabi", "عايشه بنت ابي بكر"),
    ("spouse", "nabi", "حفصه بنت عمر"),
    ("spouse", "علي بن ابي طالب", "فاطمه بنت محمد"),
    ("spouse", "عثمان بن عفان", "رقيه بنت محمد"),
    ("spouse", "عثمان بن عفان", "ام كلثوم بنت محمد"),
    ("spouse", "عمر بن الخطاب", "ام كلثوم بنت علي"),
    ("spouse", "الزبير بن العوام", "اسماء بنت ابي بكر"),
    ("spouse", "عمر بن الخطاب", "زينب بنت مظعون"),
    ("parent", "عمر بن الخطاب", "حفصه بنت عمر"),
    ("parent", "عمر بن الخطاب", "عبد الله بن عمر"),
    ("parent", "علي بن ابي طالب", "الحسن بن علي"),
    ("parent", "علي بن ابي طالب", "الحسين بن علي"),
    ("parent", "فاطمه بنت محمد", "الحسن بن علي"),
    ("parent", "nabi", "فاطمه بنت محمد"),
    ("parent", "الزبير بن العوام", "عبد الله بن الزبير"),
    ("parent", "صفيه بنت عبد المطلب", "الزبير بن العوام"),
    ("parent", "ام رومان", "عايشه بنت ابي بكر"),
]
PATHS = [("علي بن ابي طالب", "عمر بن الخطاب"), ("عثمان بن عفان", "nabi"), ("الزبير بن العوام", "nabi"), ("طلحه بن عبيد الله", "عايشه بنت ابي بكر")]


def main():
    d = json.loads(DATA.read_text())
    persons = d["persons"]
    names = {p["id"]: [norm(expand_prophet(p["ar"])), norm(expand_prophet(p.get("full", "")))] for p in persons}

    def find(q):
        if q == "nabi":
            return ["nabi"]
        q = norm(q)
        hits = [pid for pid, ns in names.items() if any(n.startswith(q) for n in ns)]
        return hits

    adj = defaultdict(set)
    rel = set()
    for e in d["edges"]:
        adj[e["s"]].add(e["t"])
        adj[e["t"]].add(e["s"])
        rel.add((e["k"], e["s"], e["t"]))
        if e["k"] == "spouse":
            rel.add((e["k"], e["t"], e["s"]))

    ok = 0
    for k, a, b in FACTS:
        A, B = find(a), find(b)
        good = any((k, x, y) in rel for x in A for y in B)
        ok += good
        dup = " (dup: %s/%s)" % (len(A), len(B)) if len(A) > 1 or len(B) > 1 else ""
        print("PASS" if good else "FAIL", k, a, "→", b, "" if A and B else f"[missing {'A' if not A else 'B'}]", dup)

    for a, b in PATHS:
        A, B = find(a), find(b)
        found = None
        for s in A:
            prev = {s: None}
            q = deque([s])
            while q:
                x = q.popleft()
                if x in B:
                    found = x
                    break
                for y in adj[x]:
                    if y not in prev:
                        prev[y] = x
                        q.append(y)
            if found:
                n, cur = 0, found
                while prev[cur]:
                    cur, n = prev[cur], n + 1
                print("PATH", a, "↔", b, n, "langkah")
                break
        if not found:
            print("NOPATH", a, "↔", b)

    # likely duplicates: same normalised 3-link name
    seen = defaultdict(list)
    for p in persons:
        k = " ".join(norm(p.get("full") or p["ar"]).split()[:5])
        seen[k].append(p["id"])
    dups = {k: v for k, v in seen.items() if len(v) > 1 and len(k.split()) >= 5}
    print(f"\n{ok}/{len(FACTS)} facts; possible duplicates: {len(dups)}")
    for k, v in list(dups.items())[:15]:
        print("  DUP", k, v)


if __name__ == "__main__":
    main()
