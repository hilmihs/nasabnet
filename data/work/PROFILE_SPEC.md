# Citing the "umum" points of tribe profiles

Goal: tribe-profile points that still show the label **UMUM** (no page) get a page citation from a classical
book, or are rewritten to what the book says, or stay "umum" only when truly not found. The app owner insists
on correctness ("jangan sampai salah nasab"): **never cite a page you have not read.**

Input per tribe: `data/work/profile_in/<id>.json`
- `umum`: profile fields without a citation → `{field: current Indonesian text}`. Fields: `nama_arti` (name/meaning),
  `leluhur` (eponymous ancestor), `titik_temu` (where the line meets other clans), `struktur` (branches),
  `wilayah` (where they lived), `peran_sosial` (social standing/role), `hilf` (alliances), `dinamika` (dynamics
  with Islam / events).
- `already_cited`: profile points that already have a page — context only, do not output them.
- `roles_umum`: paths of bullets in `data/work/roles_out/<id>.json` still `"status": "umum"` (e.g. `lokasi`,
  `sosial[1]`) — cite those too (see below).

## Tools (local, offline — no rate limit)
```
python3 scripts/books.py search "REGEX" [--book ID,ID] [--limit N] [--width N]
python3 scripts/books.py page BOOK VOL PAGE [--next 1]
python3 scripts/books.py check BOOK VOL PAGE "ARABIC QUOTE"   # OK if the quote is on that page or the next
```
Search ignores harakat and hamza/ya/ta-marbuta variants — type plain consonants. Regex works. Each hit prints the
citation tag. Books: 9793 Jamharat Ansab al-'Arab (lineage, dwelling, notable men — first choice for nama/leluhur/
titik_temu/struktur), 2922 Nasab Quraisy, 12205 al-Muhabbar (Quraisy offices, hilf, markets), 23833 Sirah Ibnu
Hisyam, 9783 Tarikh ath-Thabari, 9351 Ibnu Sa'd (wufud in vol 1), 9767 al-Ishabah, 1110 Usdul Ghabah.


## Second-tier books (allowed when the books above do not have it — all are on turath.io)
Same tools, same rules (read the page, verbatim quote, `check`). `python3 scripts/books.py list` shows each tag.
919 Jamharat an-Nasab (Ibnul Kalbi) · 9773 Ansab al-Asyraf (al-Baladzuri) · 9211 al-Isytiqaq (Ibnu Duraid — name
meanings) · 31382 Nihayat al-Arab (al-Qalqasyandi — tribes, dwellings) · 6696 al-Inbah 'ala Qaba'il ar-Ruwat ·
12317 al-Ansab (as-Sam'ani) · 12212 al-Munammaq · 12288 al-Isti'ab (companions) · 23735 Mu'jam al-Buldan and 11802
Mu'jam ma Ista'jam (places — use for wilayah/lokasi) · 12521 Shifat Jazirat al-'Arab (al-Hamdani — Yemen/Najd tribes'
lands) · 12221 Futuh al-Buldan · 1514 ar-Raudh al-Unuf · 23789 al-'Iqd al-Farid · 21712 al-Kamil fi at-Tarikh ·
4445 al-Bidayah wan-Nihayah. Search a tier-2 book with `--book ID` (searching all books at once is slow).

## Procedure per point
1. Find the passage: try at least 3 different queries (eponym, "بنو X", key Arabic terms, a famous member) across
   the relevant books before giving up. Read the page with `page`.
2. Supported → keep (or tighten) the Indonesian wording so it says **no more than the source**; `src` = tag(s),
   `quote` = parallel verbatim Arabic quotes (4–15 words each, copied from `page` output). `status: "ok"` or
   `"rewritten"`. One point may need 2–3 sources (e.g. a titik_temu naming several clans: cite the lineage line
   of each). If only part is supported, rewrite to the supported part.
3. Source says something different → rewrite to match the source, cite it, `status: "rewritten"`.
4. Not found anywhere → widely agreed fact: keep with `status: "umum"` (no src/quote); doubtful or wrong: put it in
   `dropped` with a reason.
5. `nama_arti`: "Nama diambil dari leluhur eponim, X bin Y" is supported by any genealogy line naming X as
   ancestor of the clan (e.g. Jamharah "ولد كعب بن لؤي: عدي…" / "بنو عدي بن كعب"). Never cite an etymology the
   page does not give.
6. Numbers, dates, superlatives only when the cited text states them. Indonesian, terse, same style as now.

Output — `data/work/profile_out/<id>.json` (one Write per file):
```json
{
  "id": "adi",
  "nama_arti": {"t": "…", "src": ["Jamharat Ansab al-'Arab, hlm. 150"], "quote": ["…"], "status": "ok"},
  "wilayah":   {"t": "Makkah.", "status": "umum"},
  "dropped":   [{"field": "dinamika", "t": "original text", "reason": "…"}]
}
```
Every field in `umum` must appear either as a key or in `dropped`. No other fields.

## roles_umum
Edit `data/work/roles_out/<id>.json` in place (Edit tool, change only those bullets): same procedure as
`data/work/ROLES_SPEC.md` — add `src` + `quote`, set status `ok`/`rewritten`, or keep `umum`, or move to the
file's `dropped` list with a reason. Do not touch any other bullet.

## Validate
```
python3 scripts/check_profile.py ID [ID…]
```
Fix every problem until `ALL OK`. Edit no other files.
Final reply (≤150 words): per tribe, counts of cited / rewritten / still umum / dropped, and anything notable
(e.g. an existing claim the books contradict).
