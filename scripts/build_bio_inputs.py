#!/usr/bin/env python3
"""Prepare source excerpts for the 10-point biographies (key companions) and tribe profiles.

Persons: the ~150 most central companions in web/public/data/nasabnet.json, each matched to its entry
in al-Ishabah (Turath #9767) and ath-Thabaqat al-Kubra (#9351); the excerpts keep the paragraphs about
birth, conversion, hijrah, battles, titles, death and burial.
Tribes: the section on the tribe's eponym in Jamharat Ansab al-'Arab (#9793) and Nasab Quraysh (#2922).

Output: data/work/bio_batches/{bio,tribe}_N.jsonl  (input for the extraction spec BIO_SPEC.md)
"""
import json
import re
import sys
from difflib import SequenceMatcher
from collections import Counter
from pathlib import Path

from build_dataset import clean_link
from nasab import classify_tribe, norm, parse_chain

ROOT = Path(__file__).resolve().parent.parent
BOOKS = ROOT / "data" / "raw" / "books"
OUT = ROOT / "data" / "work" / "bio_batches"
DATA = ROOT / "web" / "public" / "data" / "nasabnet.json"
TAG = re.compile(r"<[^>]+>")
FOOT = re.compile(r"«\d+»|\(\d+\)")
KEEP = re.compile(r"ولد|توفي|توفى|مات|قتل|استشهد|دفن|قبر|سنة|أسلم|هاجر|شهد|يكنى|كنيته|لقب|سمي|كان|نزل|سكن|خرج|تحول|أمه|حليف|مولى|آخى|استعمل|ولاه|بايع")
N_PERSONS = 150


def load_book(bid):
    d = json.loads((BOOKS / f"{bid}.json").read_text())
    return d["pages"], d["ٙ"]["ٛ"]


def entry_text(pages, heads, i, max_pages=6):
    """Text of heading i up to the next heading (by toc id)."""
    h = heads[i]
    j = next((k for k in range(i + 1, len(heads)) if heads[k]["level"] <= h["level"]), None)
    end = heads[j]["page"] if j is not None else h["page"] + 2
    raw = "\n".join(pages[k]["text"] for k in range(h["page"] - 1, min(end, h["page"] - 1 + max_pages, len(pages))))
    m = re.search(rf'id="toc-{i + 1}"', raw)
    if m:
        raw = raw[raw.rfind("<", 0, m.start()) :]
    n = re.search(rf'id="toc-{(j if j is not None else i + 1) + 1}"', raw)
    if n:
        raw = raw[: raw.rfind("<", 0, n.start())]
    return FOOT.sub("", TAG.sub("", raw)).strip()


def condense(text, limit):
    """Keep the opening paragraph and the paragraphs carrying biographical facts."""
    paras = [p.strip() for p in text.split("\n") if p.strip()]
    if not paras:
        return ""
    out = [paras[0][:900]]
    for p in paras[1:]:
        if KEEP.search(p):
            out.append(p[:600])
        if sum(len(x) for x in out) > limit:
            break
    return "\n".join(out)[:limit]


def kn(name):
    """Normalised key link: 'أبي طالب الهاشمي' and 'أبو طالب' -> 'ابو طالب'."""
    return re.sub(r"^ابي ", "ابو ", clean_link(name))


def strip_title(t):
    t = re.sub(r"\[\(?[\d٠-٩]+\)?\]|\([\d٠-٩]+\)|\[\s*\]", " ", t)  # footnote marks: "[(١)]", "(٢)", "[]"
    t = re.sub(r"^[\d٠-٩]+\s*(ز|ط|ع|خ|د)?\s*[-–:]\s*", "", t)
    return norm(re.sub(r"[:،.﵁﵂]", " ", t))


ORDINAL = re.compile(r"\b(الاولي|الاولى|الثانيه|الثالثه|الكبري|الصغري|الاكبر|الاصغر)\b")
NISBA = re.compile(r"\b(ال\S{2,}(?:ي|يه))\b")
SAME_GROUP = [{"aus", "khazraj", "anshar"}]


def compatible(a, b, groups):
    """Tribe ids that do not contradict each other (Aus/Khazraj/Anshar; any Quraisy clan with Quraisy)."""
    if not a or not b or a == b:
        return True
    if any(a in g and b in g for g in SAME_GROUP):
        return True
    return groups.get(a) == groups.get(b) == "quraisy" and "quraisy" in (a, b)


HEAD_END = re.compile(r"[:،,.؛;(\[«\n]|\s(?:ذكره|ذكرها|قال|وقال|روى|أخرجه|اخرجه|تقدم|استدركه|ويقال|يقال|وقيل|قيل|شهد|هكذا|مشهور|واسمه|واسمها|ويكنى|يكنى|وكان|كان|له|لها|وهو|وهي|أخو|أخت|وأمه|وأمها|من بني|حليف|مولى|زوج)\b")


def heading_of(text):
    """The name line of an entry: numbering and citation tag removed, cut before the first remark."""
    t = re.sub(r"^\[[^\]]*\]\s*", "", text)
    t = re.sub(r"^[\d٠-٩]+\s*(ز|ط|ع|خ|د)?\s*[-–:]\s*\[?", "", t).strip()
    t = re.sub(r"\[\(?[\d٠-٩]*\)?\]|\([\d٠-٩]+\)", " ", t)
    t = re.sub(r"\s*\n+\s*(?=(?:بن|ابن|بنت)\s)", " ", t)  # nasab continued on the next line
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r"^(ذكر|باب)\s+", "", t)  # Ibnu Sa'd section titles: "ذكر خديجة"
    m = HEAD_END.search(t, 3)
    head = t[: m.start()] if m else t[:120]
    return head.strip(" ]-"), t[len(head):].strip()


def plausible(text, p, ism, line, groups):
    """Reject an excerpt whose heading names a different person: other father/grandfather, other gender,
    other ordinal ("al-Ula" vs "ats-Tsaniyah"), a nisba of another tribe, or a heading without any text."""
    head, body = heading_of(text)
    if len(norm(body)) < 20:
        return False, "heading only"
    nh = norm(re.sub(r"\sابن\s", " بن ", head))
    full = p.get("full") or p["ar"]
    female = p.get("g") == "f" if p.get("g") in ("m", "f") else bool(re.match(r"^\S+(?:\s\S+)?\s(بنت|ابنة)\s", norm(full)))
    first = re.search(r"\s(بن|بنت)\s", nh)
    if first and not nh.startswith(("ام ", "ابو ", "ابي ")) and (first.group(1) == "بنت") != female:
        return False, "gender"
    h_ism, h_line = parse_chain(nh)
    names = {kn(ism).split()[0]} if ism else set()
    names |= {kn(x).split()[0] for x in (p["ar"], p.get("laqab") or "") if x and kn(x)}
    if p.get("kunya"):
        names.add(kn(p["kunya"]).split()[0] + " " + (kn(p["kunya"]).split()[1:2] or [""])[0])
    if h_ism and kn(h_ism) in norm(full + " " + p["ar"] + " " + (p.get("laqab") or "")):
        names = set()
    if h_ism and names and not any(kn(h_ism).startswith(x.strip()) or x.strip().startswith(kn(h_ism)) for x in names):
        return False, f"ism {h_ism}"
    def close(a, o):
        a1, o1 = (a.split() or [""])[0], (o.split() or [""])[0]
        return a == o or a in o or o in a or (len(a1) >= 4 and SequenceMatcher(None, a1, o1).ratio() >= 0.75)

    def same(a, link):
        opts = {kn(link["ar"])} | ({kn(link["alias"])} if link.get("alias") else set())
        return any(close(kn(a), o) for o in opts if o)
    # Ibnu Sa'd often names a man after his mother or his father's kunya ("سهيل بن بيضاء"); accept the
    # heading when the opening text still names the right father/grandfather
    opening = norm(body[:400])
    def mentioned(link):
        return any(o and re.search(rf"(^|\s){re.escape(o)}(\s|$)", opening) for o in {kn(link["ar"]), kn(link.get("alias") or "")})
    if h_line and line:
        if not same(h_line[0]["ar"], line[0]) and not mentioned(line[0]):
            return False, f"father {h_line[0]['ar']}"
        if len(h_line) > 2 and line[0].get("alias") and same(h_line[1]["ar"], {"ar": line[0]["alias"]}):
            h_line = [h_line[0]] + h_line[2:]  # "بنت أبي سفيان بن صخر بن حرب": the father's own name inserted
        if len(h_line) > 1 and len(line) > 1 and not same(h_line[1]["ar"], line[1]) and not mentioned(line[1]):
            return False, f"grandfather {h_line[1]['ar']}"
    o_h, o_p = ORDINAL.findall(nh), ORDINAL.findall(norm(full)[:60])
    if o_h and o_p and set(o_h) != set(o_p):
        return False, "ordinal"
    # nisbas from the original spelling: classify_tribe needs "الأنصاري" (with hamza) to tell as-Salami (Anshar) from as-Sulami
    nis = " ، ".join(re.findall(r"(ال\S{2,}(?:ي|ية|يّ|يّة))(?=\s|$|[،,.])", head))
    tid = classify_tribe(nis)[0] if nis else None
    if tid and p.get("tribe") and not compatible(tid, p["tribe"], groups):
        return False, f"tribe {tid}"
    return True, ""


def select_persons(data, more=False):
    deg = Counter()
    for e in data["edges"]:
        deg[e["s"]] += 1
        deg[e["t"]] += 1
    bonus = {"khulafa": 60, "asyarah": 40, "ummahat": 40, "ahlulbait": 30, "kerabat": 8, "badar": 4}
    score = lambda p: deg[p["id"]] + sum(bonus.get(c, 0) for c in p["cats"])
    comps = [p for p in data["persons"] if p["comp"] or p["id"] == "nabi"]
    comps.sort(key=score, reverse=True)
    comps = [p for p in comps if p["id"] != "nabi"]
    if not more:
        return comps[:N_PERSONS]
    # "more": every other companion, skipping anyone already drafted (bio_1..5 or earlier "more" runs)
    done = set()
    for f in (ROOT / "data" / "work" / "extracted").glob("bio*_*.json"):
        try:
            done |= {r.get("id") for r in json.loads(f.read_text()) if isinstance(r, dict)}
        except json.JSONDecodeError:
            pass
    for f in OUT.glob("bio_*.jsonl"):
        done |= {json.loads(l)["id"] for l in f.read_text().splitlines() if l.strip()}
    return [p for p in comps if p["id"] not in done]


def main():
    more = "more" in sys.argv[1:]
    per_batch = 40
    data = json.loads(DATA.read_text())
    tribes = data["tribes"]
    is_pages, is_heads = load_book(9767)
    sa_pages, sa_heads = load_book(9351)
    # several biographies can share one printed page (e.g. the Prophet's aunts on 8/45): keep them all
    sa_index = {}
    for i, h in enumerate(sa_heads):
        pg = sa_pages[h["page"] - 1]
        sa_index.setdefault((pg["vol"], pg["page"]), []).append(i)

    # al-Ishabah: index person headings by "ism|father"
    is_idx = {}
    for i, h in enumerate(is_heads):
        if h["level"] < 4 or not re.match(r"^[\d٠-٩]", h["title"]):
            continue
        ism, line = parse_chain(strip_title(h["title"]))
        if ism and line:
            is_idx.setdefault(f"{kn(ism)}|{kn(line[0]['ar'])}", []).append(i)

    OUT.mkdir(parents=True, exist_ok=True)
    groups = {t["id"]: t["group"] for t in tribes}
    rejected = []
    rows, missing = [], 0
    rebuild = [int(x) for x in sys.argv[2:4]] if sys.argv[1:2] == ["rebuild"] else None
    if rebuild:
        # recompute the excerpts of batches rebuild[0]..rebuild[1] (same people, same order)
        by_id = {p["id"]: p for p in data["persons"]}
        targets = {n: [json.loads(l)["id"] for l in (OUT / f"bio_{n}.jsonl").read_text().splitlines() if l.strip()] for n in range(rebuild[0], rebuild[1] + 1)}
        people = [by_id[i] for n in targets for i in targets[n] if i in by_id]
    else:
        people = select_persons(data, more)
    for p in people:
        ism, line = parse_chain(p.get("full") or p["ar"])
        isabah = ""
        if ism and line:
            fathers = [line[0]["ar"]] + ([line[0]["alias"]] if line[0].get("alias") else [])
            cands = [i for f in fathers for i in is_idx.get(f"{kn(ism)}|{kn(f)}", [])]
            if len(line) > 1:  # prefer the entry whose heading/opening names the grandfather
                gf = clean_link(line[1]["ar"])
                cands = sorted(cands, key=lambda i: gf not in norm(entry_text(is_pages, is_heads, i, 2)[:400]))
            for i in cands:
                text = entry_text(is_pages, is_heads, i)
                ok, why = plausible(text, p, ism, line, groups)
                if not ok:
                    rejected.append((p["id"], "isabah", why))
                    continue
                pg = is_pages[is_heads[i]["page"] - 1]
                isabah = f"[al-Ishabah {pg['vol']}/{pg['page']}]\n" + condense(text, 3200)
                break
        ibnsad = ""
        for s in p["src"]:
            m = re.search(r"ath-Thabaqat al-Kubra (\d+)/(\d+)", s["t"])
            if m and (m.group(1), int(m.group(2))) in sa_index:
                cands = sa_index[(m.group(1), int(m.group(2)))]
                # the entry whose heading is this person's own name (ism / kunya), not a neighbour on the same page
                names = {kn(x) for x in (ism, p.get("kunya") or "", p["ar"].split(" بن")[0].split(" بنت")[0]) if x}
                same = [i for i in cands if kn(sa_heads[i]["title"].split("،")[0].split(" بن")[0].split(" بنت")[0]) in names]
                if not same:  # headings by title/kunya ("مصعب الخير", "أبو أسيد الساعدي"): own ism inside the heading
                    same = [i for i in cands if ism and kn(ism) in norm(sa_heads[i]["title"])] if len(cands) > 1 else cands
                same = [i for i in same if plausible(entry_text(sa_pages, sa_heads, i, 10), p, ism, line, groups)[0]] if ism else same
                if not same:
                    rejected.append((p["id"], "ibnsad", "no plausible heading on the page"))
                    continue
                i = same[0]
                ibnsad = f"[Ibnu Sa'd {m.group(1)}/{m.group(2)}]\n" + condense(entry_text(sa_pages, sa_heads, i, 10), 3200)
                break
        if not isabah and not ibnsad:
            missing += 1
        rows.append({
            "id": p["id"], "lat": p["lat"], "ar": p["ar"], "full": p.get("full", ""), "kunya": p.get("kunya", ""),
            "laqab": p.get("laqab", ""), "death": p.get("death", ""), "place": p.get("place", ""), "rank": p.get("rank", ""),
            "isabah": isabah, "ibnsad": ibnsad,
        })

    # tribes: Jamharah section for the eponym (+ Nasab Quraysh for Quraysh clans)
    EPONYM = {
        "hasyim": "هاشم بن عبد مناف", "muthalib": "المطلب بن عبد مناف", "umayyah": "عبد شمس بن عبد مناف", "naufal": "نوفل بن عبد مناف",
        "asad": "عبد العزى بن قصى", "abduddar": "عبد الدار بن قصى", "zuhrah": "زهرة بن كلاب", "taim": "تيم بن مرة", "makhzum": "يقظة بن مرة",
        "adi": "عدى بن كعب", "sahm": "سهم بن عمرو", "jumah": "هصيص بن كعب", "amir": "عامر بن لؤى", "fihr": "الحارث بن فهر", "quraisy": "فهر بن مالك",
        "aus": "الأوس", "khazraj": "الخزرج", "anshar": "الأوس", "tamim": "تميم بن مر", "tsaqif": "ثقيف", "hudzail": "هذيل", "ghifar": "غفار",
        "aslam": "أسلم بن أفصى", "juhainah": "جهينة", "muzainah": "مزينة", "asyja": "أشجع", "ghathafan": "غطفان", "daus": "دوس", "azd": "الأزد",
        "kalb": "كلب بن وبرة", "khuzaah": "خزاعة", "kinanah": "كنانة بن خزيمة", "bajilah": "بجيلة", "asad-k": "أسد بن خزيمة", "thayyi": "طيئ",
        "kindah": "كندة", "hamdan": "همدان", "sulaim": "سليم بن منصور", "hawazin": "هوازن", "abdulqais": "عبد القيس", "bakr": "بكر بن وائل",
        "madzhij": "مذحج", "himyar": "حمير", "qudhaah": "قضاعة", "lakhm": "لخم", "khatsam": "خثعم", "asyari": "الأشعر", "dhabbah": "ضبة",
        "bahilah": "باهلة", "ghani": "غنى", "muharib": "محارب بن خصفة",
    }
    jp, jh = load_book(9793)
    trows = []
    for t in tribes:
        key = EPONYM.get(t["id"])
        text = ""
        if key:
            nk = norm(key)
            hits = [i for i, h in enumerate(jh) if nk in norm(h["title"])]
            hits.sort(key=lambda i: (not norm(jh[i]["title"]).startswith(("هولاء ولد " + nk, "وهولاء ولد " + nk, "ولد " + nk)), i))
            for i in hits[:2]:
                pg = jp[jh[i]["page"] - 1]
                text += f"[Jamharat Ansab al-'Arab, hlm. {pg['page']}] {jh[i]['title']}\n" + condense(entry_text(jp, jh, i, 4), 2200) + "\n"
        members = [p for p in data["persons"] if p.get("tribe") == t["id"] and p["comp"]]
        members.sort(key=lambda p: -len(p["cats"]))
        trows.append({"id": t["id"], "name": t["name"], "ar": t["ar"], "group": t["group"], "desc": t["desc"],
                      "members": [p["lat"] for p in members[:25]], "jamharah": text[:4500]})

    def dump(prefix, items, n):
        size = (len(items) + n - 1) // n
        for k in range(n):
            with open(OUT / f"{prefix}_{k + 1}.jsonl", "w") as f:
                for r in items[k * size : (k + 1) * size]:
                    f.write(json.dumps(r, ensure_ascii=False) + "\n")

    if rebuild:
        old = {}
        for n in targets:
            for l in (OUT / f"bio_{n}.jsonl").read_text().splitlines():
                if l.strip():
                    r = json.loads(l)
                    old[r["id"]] = r
        by_row = {r["id"]: r for r in rows}
        changed = [i for i in by_row if i in old and (by_row[i]["isabah"], by_row[i]["ibnsad"]) != (old[i]["isabah"], old[i]["ibnsad"])]
        print(f"rebuild {rebuild}: {len(changed)} of {len(by_row)} persons get different excerpts; rejected: {len(rejected)}")
        for x in rejected:
            print("  reject", *x)
        if "--dry" in sys.argv:
            print("changed ids:", " ".join(changed))
            return
        for n, ids in targets.items():
            keep = [by_row[i] for i in ids if i in by_row and (by_row[i]["isabah"] or by_row[i]["ibnsad"])]
            with open(OUT / f"bio_{n}.jsonl", "w") as f:
                for r in keep:
                    f.write(json.dumps(r, ensure_ascii=False) + "\n")
            print(f"  bio_{n}: {len(keep)} of {len(ids)} kept")
        return
    if more:
        # append batches after the existing ones; persons without any source text are skipped
        rows = [r for r in rows if r["isabah"] or r["ibnsad"]]
        start = max([int(p.stem.split("_")[1]) for p in OUT.glob("bio_*.jsonl")] + [0]) + 1
        if "--dry" in sys.argv:
            print(f"would write {len(rows)} persons as bio_{start}.. in batches of {per_batch}; excerpt chars {sum(len(r['isabah']) + len(r['ibnsad']) for r in rows)}")
            return
        for k in range(0, len(rows), per_batch):
            with open(OUT / f"bio_{start + k // per_batch}.jsonl", "w") as f:
                for r in rows[k : k + per_batch]:
                    f.write(json.dumps(r, ensure_ascii=False) + "\n")
        print(f"more: {len(rows)} persons with source text (skipped {missing} without) -> bio_{start}..bio_{start + (len(rows) - 1) // per_batch}")
        return
    dump("bio", rows, 5)
    dump("tribe", trows, 2)
    print(f"persons {len(rows)} (no source text: {missing}); isabah {sum(bool(r['isabah']) for r in rows)}, ibnsad {sum(bool(r['ibnsad']) for r in rows)}")
    print(f"tribes {len(trows)}; with jamharah text {sum(bool(r['jamharah']) for r in trows)}")


if __name__ == "__main__":
    main()
