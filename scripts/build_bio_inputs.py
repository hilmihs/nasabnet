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
from collections import Counter
from pathlib import Path

from build_dataset import clean_link
from nasab import norm, parse_chain

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
    t = re.sub(r"^[\d٠-٩]+\s*(ز|ط|ع|خ|د)?\s*[-–:]\s*", "", t)
    return norm(re.sub(r"[:،.﵁﵂]", " ", t))


def select_persons(data):
    deg = Counter()
    for e in data["edges"]:
        deg[e["s"]] += 1
        deg[e["t"]] += 1
    bonus = {"khulafa": 60, "asyarah": 40, "ummahat": 40, "ahlulbait": 30, "kerabat": 8, "badar": 4}
    score = lambda p: deg[p["id"]] + sum(bonus.get(c, 0) for c in p["cats"])
    comps = [p for p in data["persons"] if p["comp"] or p["id"] == "nabi"]
    comps.sort(key=score, reverse=True)
    return [p for p in comps if p["id"] != "nabi"][:N_PERSONS]


def main():
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
    rows, missing = [], 0
    for p in select_persons(data):
        ism, line = parse_chain(p.get("full") or p["ar"])
        isabah = ""
        if ism and line:
            fathers = [line[0]["ar"]] + ([line[0]["alias"]] if line[0].get("alias") else [])
            cands = [i for f in fathers for i in is_idx.get(f"{kn(ism)}|{kn(f)}", [])]
            if len(line) > 1:  # prefer the entry whose heading/opening names the grandfather
                gf = clean_link(line[1]["ar"])
                cands = sorted(cands, key=lambda i: gf not in norm(entry_text(is_pages, is_heads, i, 2)[:400]))
            if cands:
                i = cands[0]
                pg = is_pages[is_heads[i]["page"] - 1]
                isabah = f"[al-Ishabah {pg['vol']}/{pg['page']}]\n" + condense(entry_text(is_pages, is_heads, i), 3200)
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
                if not same:
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

    dump("bio", rows, 5)
    dump("tribe", trows, 2)
    print(f"persons {len(rows)} (no source text: {missing}); isabah {sum(bool(r['isabah']) for r in rows)}, ibnsad {sum(bool(r['ibnsad']) for r in rows)}")
    print(f"tribes {len(trows)}; with jamharah text {sum(bool(r['jamharah']) for r in trows)}")


if __name__ == "__main__":
    main()
