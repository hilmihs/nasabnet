#!/usr/bin/env python3
"""Search and read the classical books stored in data/raw/books/<id>.json (Turath books-v3 dumps).

  python3 scripts/books.py list
  python3 scripts/books.py search REGEX [--book ID[,ID]] [--limit N] [--width N]
  python3 scripts/books.py page BOOK VOL PAGE [--next N]
  python3 scripts/books.py check BOOK VOL PAGE "QUOTE"   # exit 0 if QUOTE is on that page (or the next one)

Matching ignores harakat/tatweel and alif/ya/ta-marbuta variants, so search plain consonants, e.g.
  search "حلف الفضول" --book 23833
Every hit prints its citation tag ("Sirah Ibnu Hisyam 1/134"), which is what goes into "src".
Download another book: curl -o data/raw/books/ID.json https://files.turath.io/books-v3/ID.json
"""
import json
import re
import sys
from functools import lru_cache
from pathlib import Path

BOOKS = Path(__file__).resolve().parent.parent / "data" / "raw" / "books"

# id -> (citation tag format, multi-volume?)
TAGS = {
    "9767": ("al-Ishabah {v}/{p}", True),
    "9351": ("Ibnu Sa'd {v}/{p}", True),
    "1110": ("Usdul Ghabah {v}/{p}", True),
    "23833": ("Sirah Ibnu Hisyam {v}/{p}", True),
    "9783": ("Tarikh ath-Thabari {v}/{p}", True),
    "9793": ("Jamharat Ansab al-'Arab, hlm. {p}", False),
    "2922": ("Nasab Quraisy, hlm. {p}", False),
    "12205": ("al-Muhabbar, hlm. {p}", False),
    # second tier: use when the books above do not have it
    "919": ("Jamharat an-Nasab Ibnul Kalbi, hlm. {p}", False),
    "9773": ("Ansab al-Asyraf {v}/{p}", True),
    "9211": ("al-Isytiqaq, hlm. {p}", False),
    "31382": ("Nihayat al-Arab al-Qalqasyandi, hlm. {p}", False),
    "6696": ("al-Inbah 'ala Qaba'il ar-Ruwat, hlm. {p}", False),
    "12317": ("al-Ansab as-Sam'ani {v}/{p}", True),
    "12212": ("al-Munammaq, hlm. {p}", False),
    "12288": ("al-Isti'ab {v}/{p}", True),
    "23735": ("Mu'jam al-Buldan {v}/{p}", True),
    "11802": ("Mu'jam ma Ista'jam {v}/{p}", True),
    "12521": ("Shifat Jazirat al-'Arab, hlm. {p}", False),
    "12221": ("Futuh al-Buldan, hlm. {p}", False),
    "1514": ("ar-Raudh al-Unuf {v}/{p}", True),
    "23789": ("al-'Iqd al-Farid {v}/{p}", True),
    "21712": ("al-Kamil fi at-Tarikh {v}/{p}", True),
    "4445": ("al-Bidayah wan-Nihayah {v}/{p}", True),
    "1681": ("Shahih al-Bukhari {v}/{p}", True),
    "1727": ("Shahih Muslim {v}/{p}", True),
    # topography of Madinah
    "13086": ("Tarikh al-Madinah Ibnu Syabbah {v}/{p}", True),
    "23695": ("Wafa' al-Wafa' {v}/{p}", True),
    "1172": ("al-Maghanim al-Muthabah {v}/{p}", True),
    "557": ("ad-Durrah ats-Tsaminah, hlm. {p}", False),
    # modern / gazetteer identifications of classical places
    "9777": ("Mu'jam al-Ma'alim al-Jughrafiyyah (al-Biladi), hlm. {p}", False),
    "12402": ("Mu'jam Qaba'il al-'Arab (Kahhalah) {v}/{p}", True),
    "122": ("al-Amakin (al-Hazimi), hlm. {p}", False),
    "30144": ("Bilad al-'Arab (al-Ashfahani), hlm. {p}", False),
}

TAG = re.compile(r"<[^>]+>")
FOOT = re.compile(r"«\d+»|\(\d+\)")
DIAC = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۭـ]")


def norm(s: str) -> str:
    s = DIAC.sub("", s)
    s = re.sub("[إأآٱ]", "ا", s).replace("ى", "ي").replace("ة", "ه").replace("ؤ", "و").replace("ئ", "ي")
    return re.sub(r"\s+", " ", s)


def norm_map(s: str):
    """norm() plus, for each output char, its index in the original string."""
    out, idx, prev_space = [], [], False
    for i, c in enumerate(s):
        if DIAC.match(c):
            continue
        c = norm(c) if not c.isspace() else " "
        if c == " ":
            if prev_space:
                continue
            prev_space = True
        else:
            prev_space = False
        out.append(c)
        idx.append(i)
    return "".join(out), idx


def clean(s: str) -> str:
    return re.sub(r"\s+", " ", FOOT.sub("", TAG.sub("", s))).strip()


@lru_cache(maxsize=None)
def load(bid: str):
    d = json.loads((BOOKS / f"{bid}.json").read_text())
    pages = [(str(p.get("vol") or "1"), p.get("page"), clean(p["text"])) for p in d["pages"]]
    return d["ً"].get("ٍ", bid), pages, [norm(t) for _, _, t in pages]


def tag(bid, vol, page):
    fmt, _ = TAGS.get(bid, (f"Turath {bid} {{v}}/{{p}}", True))
    return fmt.format(v=vol, p=page)


def books():
    return sorted(p.stem for p in BOOKS.glob("*.json"))


def cmd_search(args):
    pat, ids, limit, width = args[0], books(), 30, 160
    i = 1
    while i < len(args):
        if args[i] == "--book":
            ids = args[i + 1].split(",")
        elif args[i] == "--limit":
            limit = int(args[i + 1])
        elif args[i] == "--width":
            width = int(args[i + 1])
        i += 2
    rx = re.compile(norm(pat))
    n = 0
    for bid in ids:
        _, pages, normed = load(bid)
        for (vol, page, text), nt in zip(pages, normed):
            hits = list(rx.finditer(nt))
            if not hits:
                continue
            _, idx = norm_map(text)
            for m in hits:
                s0, e0 = idx[min(m.start(), len(idx) - 1)], idx[min(m.end(), len(idx)) - 1] + 1
                a, b = max(0, s0 - width), min(len(text), e0 + width)
                print(f"[{tag(bid, vol, page)}] (book {bid} vol {vol} page {page}) …{text[a:b]}…")
                n += 1
                if n >= limit:
                    print(f"-- limit {limit} reached; narrow the pattern or use --book")
                    return
    print(f"-- {n} hits")


def find_pages(bid, vol, page):
    """All indexes printed as vol/page — some dumps repeat a page number (e.g. Usdul Ghabah)."""
    _, pages, _ = load(bid)
    return [k for k, (v, p, _) in enumerate(pages) if v == str(vol) and str(p) == str(page)]


def find_page(bid, vol, page):
    ks = find_pages(bid, vol, page)
    return ks[0] if ks else None


def quote_on_page(bid, vol, page, quote):
    """True if the quote occurs on any page printed as vol/page, or on the page after it."""
    _, _, normed = load(bid)
    q = norm(quote).strip()
    return any(q in " ".join(normed[k : k + 2]) for k in find_pages(bid, vol, page))


def cmd_page(args):
    bid, vol, page = args[:3]
    nxt = int(args[4]) if len(args) > 4 and args[3] == "--next" else 0
    _, pages, _ = load(bid)
    ks = find_pages(bid, vol, page)
    if not ks:
        sys.exit(f"page not found: book {bid} vol {vol} page {page}")
    # some dumps split one printed page into several entries (e.g. hadith collections): print whole pages
    end = ks[-1] + 1
    for _ in range(nxt + 1):
        while end < len(pages) and pages[end][:2] == pages[end - 1][:2]:
            end += 1
        if _ < nxt and end < len(pages):
            end += 1
    for j in range(ks[0], min(end, len(pages))):
        v, p, t = pages[j]
        print(f"=== [{tag(bid, v, p)}] ===\n{t}\n")


def cmd_check(args):
    bid, vol, page, quote = args[:4]
    _, pages, normed = load(bid)
    k = find_page(bid, vol, page)
    if k is None:
        print("NOPAGE")
        sys.exit(2)
    ok = quote_on_page(bid, vol, page, quote)
    print("OK" if ok else "MISSING")
    sys.exit(0 if ok else 1)


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        print(__doc__)
        return
    c, rest = sys.argv[1], sys.argv[2:]
    if c == "list":
        for bid in books():
            name, pages, _ = load(bid)
            print(f"{bid}\t{len(pages)} hlm\t{name}\ttag: {tag(bid, 'V', 'P')}")
    elif c == "search":
        cmd_search(rest)
    elif c == "page":
        cmd_page(rest)
    elif c == "check":
        cmd_check(rest)
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
