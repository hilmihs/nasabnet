# Citing tribe roles against the classical books

Goal: every bullet in `data/tribe_roles.json` (lokasi + militer / diplomasi / ekonomi / sosial) gets a page
citation from a classical book, or is rewritten to what the book says, or is marked unsourced/dropped.
The app owner insists on correctness ("jangan sampai salah nasab"): **never cite a page you have not read.**

## Tools (local, offline — no rate limit)

```
python3 scripts/books.py list                                   # 8 books + their citation tag format
python3 scripts/books.py search "REGEX" [--book ID,ID] [--limit N] [--width N]
python3 scripts/books.py page BOOK VOL PAGE [--next 1]          # read the full page (and the next)
python3 scripts/books.py check BOOK VOL PAGE "ARABIC QUOTE"     # OK if the quote is on that page or the next
```
Search ignores harakat and hamza/ya/ta-marbuta variants — type plain consonants (`بعاث`, `حلف الفضول`,
`النقباء`). Regex works (`سعد بن (ابي )?وقاص`). Each hit prints the citation tag, e.g. `[Sirah Ibnu Hisyam 1/133]`.

Books (prefer the first ones for events; the last two for persons):
- 23833 Sirah Ibnu Hisyam — maghazi, 'Aqabah, Badar…Tabuk, delegations (wufud)
- 9783 Tarikh ath-Thabari — Riddah, futuh (Qadisiyah, Jisr, Nahawand, Yarmuk, Mesir), later events
- 9351 Ibnu Sa'd, ath-Thabaqat — sirah, wufud (vol 1), biographies
- 9793 Jamharat Ansab al-'Arab (Ibnu Hazm) — tribal lineage, dwelling, notable men
- 12205 al-Muhabbar (Ibnu Habib) — Quraisy offices, hilf, markets (aswaq al-'Arab), idols
- 2922 Nasab Quraisy (Mush'ab az-Zubairi)
- 9767 al-Ishabah, 1110 Usdul Ghabah — companion biographies

## Procedure per bullet

1. Find the passage: try at least 3 different queries (names, key Arabic terms, event name) across the
   relevant books before giving up. Read the page with `page` to understand context.
2. Supported → keep (or tighten) the Indonesian wording so it says **no more than the source**; add the
   tag to `src` and a short verbatim Arabic quote (4–15 words, copied from `page` output) to `quote`.
   Run `check` for every quote. `status: "ok"` (wording unchanged) or `"rewritten"`.
3. Source says something different → rewrite to match the source, cite it, `status: "rewritten"`.
4. Not found anywhere → if it is a widely agreed fact keep it with `status: "umum"` and no `src`;
   if doubtful, move it to `dropped` with a reason.
5. Empty categories: you MAY add up to 2 new bullets per category, only with citation + quote,
   `status: "new"`. Keep to what the book says about that tribe/clan; prefer tribe-level roles.
6. `lokasi`: cite it if a book states where the tribe lived (Jamharah, Muhabbar, Thabari); else `"umum"`.
7. Numbers and dates only when the cited text states them. Indonesian, terse, same style as now.

## Output — one file per tribe: `data/work/roles_out/<id>.json`

```json
{
  "id": "khazraj",
  "lokasi": {"t": "Yatsrib/Madinah …", "src": ["Jamharat Ansab al-'Arab, hlm. 332"], "quote": ["…"], "status": "ok"},
  "militer":   [{"t": "…", "src": ["Sirah Ibnu Hisyam 1/555"], "quote": ["…"], "status": "ok"}],
  "diplomasi": [],
  "ekonomi":   [],
  "sosial":    [],
  "dropped":   [{"t": "original bullet", "reason": "…"}]
}
```
`src` and `quote` are parallel arrays (one quote per tag). Status `"umum"` items have no src/quote.
Write each file with one Write call, then validate all of yours:

```
python3 scripts/check_roles.py data/work/roles_out/<id>.json [more files…]
```
Fix every reported problem and re-run until it prints `ALL OK`. Edit nothing else in the repo.
Final reply (≤150 words): per tribe, counts of ok / rewritten / new / umum / dropped, and anything notable.
