# Natural features of Madinah for the "Zaman Nabi ﷺ" map (cartographic layer)

Goal: the natural frame of Madinah in the Prophet's ﷺ time drawn as a map — wadis as lines, mountains as shapes,
harrah (lava fields) as labelled areas — each cited to a book page. Nature barely changed since then; modern
roads/buildings are not drawn. "jangan sampai salah": **never cite a page you have not read; never invent a
shape or a coordinate.**

Tools: `scripts/books.py` (search/page/check; see data/work/ROLES_SPEC.md for the books — Mu'jam al-Buldan 23735,
Mu'jam ma Ista'jam 11802, Sirah 23833, Ibnu Sa'd 9351, Shahih al-Bukhari 1681), `scripts/geo.py` (points), and
```
python3 scripts/shapes.py find "REGEX"                  # named OSM ways/relations around Madinah (wadis: waterway=river)
python3 scripts/shapes.py tag natural=bare_rock --min 2 # unnamed features by tag, largest first
python3 scripts/shapes.py show W116605983               # size and extent of one OSM object
```

## Features (aim for all that the books support)
- **wadi**: Buthan, al-'Aqiq, Qanah, Mahzur, Mudzainib, Ranuna', and any other wadi of Madinah the books name.
  OSM splits a wadi into many ways with the same name (e.g. "شعيب بطحان", "وادي العقيق", "وادي قناة"): list **all**
  segment ids that belong to it (check each with `show`: it must lie in the course the book describes; leave out
  same-named ways elsewhere).
- **gunung**: Uhud, Sal', 'Air, 'Ainain (Jabal ar-Rumat), Tsaniyyat al-Wada' if it exists as a shape. Use the named
  OSM polygon/way ("جبل أحد" = W587267723 …). No named shape → give a point instead (below).
- **harrah**: Harrat Waqim (east), Harrat al-Wabarah (west), others the books name. OSM has no named outline for
  them — do NOT pick an unnamed polygon and call it a harrah. Give a point (a cited locality inside it, from geo.py)
  so the map writes the name there.
- **kebun**: palm groves / gardens the books tie to a place of that time (e.g. Bairuha', al-'Aliyah) — point only.

## Output — `data/work/shapes_out/madinah.json` (one Write)
```json
{"id": "madinah", "features": [
  {"t": "Wadi Buthan", "ar": "بطحان", "kind": "wadi", "note": "Wadi di Madinah …", "src": ["Mu'jam al-Buldan 1/446"],
   "quote": ["…"], "osm": ["W587298211", "W783591916"]},
  {"t": "Harrat Waqim", "ar": "حرة واقم", "kind": "harrah", "note": "…", "src": ["…"], "quote": ["…"],
   "osm": [], "qid": "N123", "lat": 24.46, "lon": 39.64}
]}
```
`osm` non-empty → drawn as shape; empty → `qid`/`lat`/`lon` from geo.py (copied, never estimated) and drawn as a
label. `note`: what the page says (Indonesian, terse). Validate `python3 scripts/check_shapes.py madinah` until ALL OK.
Edit nothing else. Final reply ≤120 words: features with shape / label point, and anything left out and why.

## Denah (city plan) of Madinah — file `data/work/shapes_out/madinah.json`, extra kinds
Close up, the "Zaman Nabi" map shows a plain parchment with a schematic plan of the city as the books describe it.
Add these features (same citation rules; best sources: 13086 Tarikh al-Madinah Ibnu Syabbah (earliest), 23695
Wafa' al-Wafa' (as-Samhudi, quotes Ibnu Zabalah/al-Mathari on every quarter), 1172 al-Maghanim al-Muthabah,
557 ad-Durrah ats-Tsaminah, plus Ibnu Sa'd, Sirah, Mu'jam al-Buldan):
- **kawasan** — the dwelling quarters (dar/manazil) of the clans in the Prophet's ﷺ time: Bani an-Najjar (around and
  east of the mosque), Bani Sa'idah, Bani Salimah, Bani Zuraiq, Bani 'Abdil Asyhal, Bani Zhafar, Bani Haritsah,
  Bani 'Amr bin 'Auf (Quba'), Bani Wa'il/Waqif…, and the Jewish tribes Qainuqa', an-Nadhir, Quraizhah. A point only
  (label, no outline — the books give no boundary): the point must be a cited place that the page puts in that
  quarter (a mosque of the clan, its well, its fort) with coordinates from geo.py / places_out.
- **benteng** — forts (uthum/athum) named by the books, point.
- **pasar** — the market(s) (Suq al-Madinah / Suq Bani Qainuqa'), point.
- **parit** — the Khandaq: give `"path_qids": ["…", "…", …]`, the ids (from geo.py, in order) of the cited places the
  books say the trench ran along/between (e.g. from Ratij / Syaikhain past Sal' to …). The line is drawn through
  them and labelled as approximate; at least 2 ids, each with its quote.
Keep every existing feature; only add. Validate with check_shapes.py.

## Arabia (whole peninsula) — file `data/work/shapes_out/arabia.json` (id "arabia")
Makes the "Zaman Nabi" map readable at peninsula scale. Use `--area arabia` with name queries (tag queries over the
whole peninsula are too big). Same citation rules; Mu'jam al-Buldan and Shifat Jazirat al-'Arab (12521) define most
of these. Kinds:
- **pasir** — sand deserts the books name (ad-Dahna', ar-Raml / 'Alij, al-Ahqaf, Raml Yabrin, an-Nafud if a book uses
  that name…): an OSM polygon/relation (natural=sand/desert) ONLY if the book's description (between X and Y, near Z)
  matches that modern feature; else a label point (qid/lat/lon from geo.py) — or leave out.
- **harrah** — large lava fields (Harrat Bani Sulaim, Harrat Khaibar, Harrat Laila, Harrat Rajil, Harrat an-Nar…):
  OSM shape if a named one matches, else a label point.
- **wilayah** — the regions as the books define them (al-Hijaz, Najd, Tihamah, al-Yaman, al-Yamamah, al-Bahrain,
  'Uman, Hadhramaut, asy-Syam, al-'Iraq): label point = the region's Wikidata item (geo.py), `note` = the book's
  definition (e.g. Hijaz = the mountain range dividing Tihamah and Najd).
- **laut** — seas (Bahr al-Qulzum = Red Sea, the Persian Gulf as the books name it, Bahr al-Habasyah…): label point.
- **gunung** — ranges such as as-Sarah / as-Sarawat: label point.
- **jalur** — caravan routes the books describe with stations (e.g. Makkah–Syam, Makkah–Yaman, the Hijrah route):
  `"path_qids"` = ids (geo.py) of the cited stations in order, at least 3; each station must be named on a cited page.
Also add **`"legend"`**: a list defining the map's terms, each `{"kind", "t", "ar", "note", "src", "quote"}` — kinds:
wadi, gunung, harrah, pasir, uthum, sumur, masjid, kota, desa, mata air, pasar, parit, kawasan, wilayah, laut, jalur
(as many as the books define: e.g. Mu'jam al-Buldan's definitions of الحرة, الوادي, الأطم, الرمل, السوق). Validate
`python3 scripts/check_shapes.py arabia`.
