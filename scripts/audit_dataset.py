#!/usr/bin/env python3
"""Consistency audit of web/public/data/nasabnet.json — flags data that cannot be right.

Rules (each finding carries the edge/person ids and the source citation so it can be checked):
  R1  spouse of the same sex                      R6  father's name ≠ the father in the person's own nasab
  R2  married to own parent/child/sibling         R7  child died >110 years after the parent (impossible span)
  R3  person is their own ancestor (cycle)        R8  spouses' deaths >100 years apart
  R4  more than one father / mother               R9  probable duplicate person (same name, same parent/spouse)
  R5  father and child in different big tribes    R10 Prophet's household differs from the attested list
Writes data/work/audit_report.json and prints a summary.
"""
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from nasab import TRIBES, norm, parse_chain  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "web" / "public" / "data" / "nasabnet.json"
OUT = ROOT / "data" / "work" / "audit_report.json"
GROUP = {t[0]: t[3] for t in TRIBES}

# attested household of the Prophet ﷺ (Ibn Sa'd 1/133-134, 8/52-220)
NABI_CHILDREN = {"القاسم", "زينب", "رقية", "ام كلثوم", "فاطمة", "عبد الله", "ابراهيم"}
NABI_WIVES = {"خديجة", "سودة", "عائشة", "حفصة", "زينب", "ام سلمة", "هند", "جويرية", "ام حبيبة", "رملة", "صفية", "ميمونة", "مارية"}
DESCRIPTOR = re.compile(r"\s+(الكبري|الصغري|الكبير|الصغير|الاكبر|الاصغر|الاوسط|الوسطي)\b")


def year(s):
    m = re.search(r"(\d{1,3})\s*(?:هـ|ه|H)", s or "")
    return int(m.group(1)) if m else None


def base(name):
    n = norm(re.sub(r"\(.*?\)", " ", name or ""))
    n = re.sub(r"\s+(بن|بنت)\s.*$", "", n)
    n = re.sub(r"^ابي\s", "ابو ", n)
    n = re.sub(r"(^|\s)ال(?=\S{3,})", r"\1", n)  # الحضير ~ حضير
    return DESCRIPTOR.sub("", n).strip()


def same_name(a, b):
    """'ابو قحافه' ~ 'ابو قحافه عثمان'; 'عبد الله' ~ 'عبد الله'. Containment either way on whole words."""
    if not a or not b:
        return False
    a, b = f" {a} ", f" {b} "
    return a in b or b in a


def descriptor(name):
    m = DESCRIPTOR.search(norm(name))
    return m.group(1) if m else ""


def main():
    d = json.loads(DATA.read_text())
    P = {p["id"]: p for p in d["persons"]}
    par = defaultdict(list)
    kids = defaultdict(list)
    spouses = defaultdict(list)
    for e in d["edges"]:
        if e["k"] == "parent":
            par[e["t"]].append(e)
            kids[e["s"]].append(e["t"])
        elif e["k"] == "spouse":
            spouses[e["s"]].append(e)
            spouses[e["t"]].append(e)
    father = {c: next((e["s"] for e in es if P[e["s"]]["g"] == "m"), None) for c, es in par.items()}
    sibs = defaultdict(set)
    for f, cs in kids.items():
        for c in cs:
            sibs[c] |= set(cs) - {c}

    F = []

    def flag(rule, msg, ids, src=None):
        F.append({"rule": rule, "msg": msg, "ids": ids, "names": [P[i]["lat"] for i in ids if i in P], "src": src})

    for e in d["edges"]:
        if e["k"] != "spouse":
            continue
        a, b = P[e["s"]], P[e["t"]]
        if a["g"] == b["g"]:
            flag("R1", f"pasangan berjenis kelamin sama: {a['lat']} – {b['lat']}", [a["id"], b["id"]], e.get("src"))
        if b["id"] in kids[a["id"]] or a["id"] in kids[b["id"]] or b["id"] in sibs[a["id"]]:
            flag("R2", f"menikah dengan orang tua/anak/saudara: {a['lat']} – {b['lat']}", [a["id"], b["id"]], e.get("src"))
        ya, yb = year(a.get("death")), year(b.get("death"))
        if ya and yb and abs(ya - yb) > 100:
            flag("R8", f"selisih wafat pasangan {abs(ya - yb)} tahun: {a['lat']} ({ya} H) – {b['lat']} ({yb} H)", [a["id"], b["id"]], e.get("src"))

    for c, es in par.items():
        g = Counter(P[e["s"]]["g"] for e in es)
        if g["m"] > 1 or g["f"] > 1:
            flag("R4", f"{P[c]['lat']} punya {g['m']} ayah / {g['f']} ibu", [c] + [e["s"] for e in es])

    for c, f in father.items():
        if not f:
            continue
        # R3 cycle
        seen, x = {c}, f
        while x in father and father[x]:
            if x in seen:
                flag("R3", f"siklus keturunan di {P[c]['lat']}", [c, f])
                break
            seen.add(x)
            x = father[x]
        # R5 tribe group
        tc, tf = P[c].get("tribe"), P[f].get("tribe")
        if tc and tf and GROUP.get(tc) != GROUP.get(tf) and not P[c].get("nisba", "").count("مولى") and "حليف" not in (P[c].get("nisba") or ""):
            flag("R5", f"ayah ({P[f]['lat']}, {tf}) dan anak ({P[c]['lat']}, {tc}) beda rumpun kabilah", [c, f], next((e.get("src") for e in par[c] if e["s"] == f), None))
        # R6 father's name vs own nasab
        own = P[c].get("full") or P[c]["ar"]
        _, line = parse_chain(own)
        if line:
            named = {base(line[0]["ar"])} | ({base(line[0]["alias"])} if line[0].get("alias") else set())
            fnames = {base(P[f]["ar"]), base((P[f].get("full") or "").split(":")[0])}
            fk = P[f].get("kunya") or ""
            fnames |= {base(k) for k in re.split(r"[،,]", fk) if k.strip()}
            if not any(same_name(x, y) for x in named for y in fnames) and "محمد" not in named | fnames:
                flag("R6", f"nasab {P[c]['lat']} menyebut ayah '{line[0]['ar']}', tapi relasi ayah = {P[f]['lat']} ({P[f]['ar']})", [c, f], next((e.get("src") for e in par[c] if e["s"] == f), None))
        # R7 lifespan
        yc, yf = year(P[c].get("death")), year(P[f].get("death"))
        if yc and yf and yc - yf > 110:
            flag("R7", f"{P[c]['lat']} wafat {yc} H, {yc - yf} tahun setelah ayahnya ({yf} H)", [c, f])

    # R9 duplicates: same base name among the children of one parent, or among the spouses of one person
    def dupes(group, why):
        by = defaultdict(list)
        for x in group:
            by[(base(P[x]["ar"]), P[x]["g"])].append(x)
        for (nm, _), xs in by.items():
            if len(xs) < 2 or not nm:
                continue
            ds = [descriptor(P[x]["ar"]) for x in xs]
            # الكبرى vs الصغرى are two different people; same or missing descriptor may be one person
            if len({x for x in ds if x}) > 1:
                continue
            flag("R9", f"kemungkinan duplikat ({why}): " + " / ".join(P[x]["lat"] for x in xs), xs)

    for f, cs in kids.items():
        dupes(cs, f"anak {P[f]['lat']}")
    for s, es in spouses.items():
        dupes([e["t"] if e["s"] == s else e["s"] for e in es], f"pasangan {P[s]['lat']}")

    # R10 the Prophet's household
    for c in kids.get("nabi", []):
        if base(P[c]["ar"]).replace("ة", "ه") not in {norm(x) for x in NABI_CHILDREN} and not any(norm(x) in norm(P[c]["ar"]) for x in NABI_CHILDREN):
            flag("R10", f"anak Nabi ﷺ di luar daftar baku: {P[c]['lat']}", ["nabi", c])
    for e in spouses.get("nabi", []):
        w = e["t"] if e["s"] == "nabi" else e["s"]
        if not any(norm(x) in norm(P[w]["ar"] + " " + (P[w].get("full") or "")) for x in NABI_WIVES):
            flag("R10", f"istri Nabi ﷺ di luar daftar baku: {P[w]['lat']}", ["nabi", w])

    # de-duplicate findings (same rule + same id set), skip findings already reviewed as ok/unsure
    rp = ROOT / "data" / "audit_reviewed.json"
    reviewed = {(r["rule"], tuple(sorted(r["ids"]))): r["verdict"] for r in json.loads(rp.read_text())} if rp.exists() else {}
    uniq = {}
    for f in F:
        uniq.setdefault((f["rule"], tuple(sorted(f["ids"]))), f)
    skipped = Counter(reviewed[k] for k in uniq if k in reviewed)
    F = [f for k, f in uniq.items() if k not in reviewed]
    print("already reviewed (not re-raised):", dict(skipped))
    OUT.write_text(json.dumps(F, ensure_ascii=False, indent=1))
    c = Counter(f["rule"] for f in F)
    print("findings:", dict(sorted(c.items())), "total", len(F))
    for rule in sorted(c):
        for f in [x for x in F if x["rule"] == rule][:4]:
            print(f"  {rule}: {f['msg']}")


if __name__ == "__main__":
    main()
