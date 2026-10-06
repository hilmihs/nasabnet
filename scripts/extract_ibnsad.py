#!/usr/bin/env python3
"""Cut the family paragraph of every biography in Ibn Sa'd's al-Tabaqat al-Kubra (Turath book 9351).

The opening paragraph of each entry gives the nasab, the mother, every child grouped by their
mother (i.e. the wives), plus later "آخى رسول الله ﷺ بين ..." (mu'akhah) remarks. These snippets are
the input for structured relation extraction (data/work/ibnsad_batches/*.jsonl).
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BOOK = ROOT / "data" / "raw" / "books" / "9351.json"
OUT = ROOT / "data" / "work"
TAG = re.compile(r"<[^>]+>")
VOLS = {"1", "3", "4", "8"}
SKIP_TITLES = re.compile(r"^(ذكر|تسمية|الطبقة|النساء|السيرة|طبقة|ومن|من |باب|ما )")
KEEP = re.compile(r"(آخى|تزوج|فولدت|فولد|وأمه|وأمها|وأمهم|خلف عليها|زوجها|ولدت له|من الولد|بايعت|أسلمت)")


def main():
    d = json.load(open(BOOK))
    pages = d["pages"]
    heads = d["ٙ"]["ٛ"]
    # page text with titles marked so entries can be cut at heading boundaries
    entries = []
    for i, h in enumerate(heads):
        p = pages[h["page"] - 1]
        if p["vol"] not in VOLS or h["level"] < 3:
            continue
        title = h["title"].strip()
        is_person = not SKIP_TITLES.match(title) or title.startswith("ذكر خديجة")
        nxt = heads[i + 1]["page"] if i + 1 < len(heads) else h["page"] + 3
        raw = "\n".join(pages[k]["text"] for k in range(h["page"] - 1, min(nxt + 1, h["page"] + 3, len(pages))))
        # locate the heading span by its title text, then cut until the next title span
        m = re.search(rf'<span data-type="title" id="toc-{i + 1}"', raw) or re.search(
            r'<span data-type="title"[^>]*>\s*' + re.escape(title[:20]), raw
        )
        start = m.start() if m else 0
        body = raw[start:]
        nxt_m = re.search(r'<span data-type="title"', body[10:])
        if nxt_m:
            body = body[: nxt_m.start() + 10]
        text = TAG.sub("", body)
        text = re.sub(r"«\d+»|\(\d+\)", "", text)
        paras = [x.strip() for x in text.split("\n") if x.strip()]
        if not paras:
            continue
        snippet = [paras[0]]
        # the first paragraph is often just the title; take the next one too
        if len(paras[0]) < 60 and len(paras) > 1:
            snippet.append(paras[1])
        for x in paras[len(snippet) : len(snippet) + 25]:
            if KEEP.search(x) and not x.startswith("قال: أخبرنا") or x.startswith("قالوا: آخى"):
                snippet.append(x[:700])
        s = "\n".join(snippet)[:2600]
        # clan context: last "ومن بني ..." line before this entry
        ctx_src = TAG.sub("", "\n".join(pages[k]["text"] for k in range(max(0, h["page"] - 3), h["page"])) + TAG.sub("", raw[:start]))
        ctx = re.findall(r"(?:^|\n)\s*(ومن (?:بني|حلفاء|موالي|الأنصار|قريش|الأوس|الخزرج)[^\n:]{0,80})", ctx_src)
        entries.append({
            "i": i,
            "vol": p["vol"],
            "page": p["page"],
            "pg": h["page"],
            "title": title,
            "person": is_person,
            "ctx": ctx[-1].strip() if ctx else "",
            "text": s,
        })
    OUT.mkdir(parents=True, exist_ok=True)
    people = [e for e in entries if e["person"]]
    groups = [e for e in entries if not e["person"]]
    (OUT / "ibnsad_entries.json").write_text(json.dumps(people, ensure_ascii=False, indent=0))
    (OUT / "ibnsad_sections.json").write_text(json.dumps(groups, ensure_ascii=False, indent=0))
    print(len(people), "person entries;", len(groups), "section headings;", sum(len(e["text"]) for e in people), "chars")


if __name__ == "__main__":
    main()
