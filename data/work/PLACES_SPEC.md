# Tribe places for the map (detailed location points)

Goal: for each tribe, the places the classical books say it lived in / owned / camped at — towns, wadis, mountains,
water sources (miyah), districts (khiththah) in Kufah/Bashrah/Fusthath, later settlements — each a clickable point
on a map, with a page citation. "jangan sampai salah": **never cite a page you have not read; never guess a
coordinate.**

Tools:
```
python3 scripts/books.py search "REGEX" [--book ID,ID]   # see ROLES_SPEC.md for the books; tier-2 incl. 23735
python3 scripts/books.py page BOOK VOL PAGE               #   Mu'jam al-Buldan, 11802 Mu'jam ma Ista'jam,
python3 scripts/books.py check BOOK VOL PAGE "QUOTE"      #   12521 Shifat Jazirat al-'Arab, 12221 Futuh al-Buldan
python3 scripts/geo.py search "ARABIC NAME"               # Wikidata candidates with coordinates
python3 scripts/geo.py search "Latin name" --lang en
python3 scripts/geo.py get Q123
python3 scripts/geo.py osm "ARABIC NAME"                  # OpenStreetMap: many Hijaz/Najd wadis, mountains, wells
python3 scripts/geo.py get N1237963654                    #   that Wikidata lacks; OSM ids (N…/W…/R…) go in "qid"
```
Context per tribe: `data/work/profile_in/<id>.json` and `web/public/data/bio.json` → tribes.<id> (wilayah, lokasi).

## Procedure per tribe
1. Collect places: search phrases like `ديار بني X`, `منازل X`, `بلاد X`, `ماء لبني X`, `لبني X`, `خطة بني X`,
   `نزلت X`, and the tribe name in Mu'jam al-Buldan / Mu'jam ma Ista'jam / Shifat Jazirat al-'Arab / Jamharah /
   Nihayat al-Arab / Futuh al-Buldan. Read each page. Keep places the page ties to THIS tribe (not a namesake tribe).
   Aim for 3–12 places per tribe (big nomadic tribes more; Quraisy clans may have only Makkah + their quarter / a
   few later towns — fine).
2. Each place: `note` in Indonesian, terse, says only what the page says ("Mata air milik Bani X", "Diyar Bani X
   di Najd", "Bani X turun di Kufah setelah futuh"). `src` + verbatim `quote` (4–25 words) like the other specs.
3. Coordinates: look the place up with geo.py — Wikidata (`search`, Arabic then Latin) and OpenStreetMap (`osm`).
   OSM often returns several same-named wadis (e.g. وادي نخلة in Yemen AND in Hijaz): pick only the one in the
   region the book describes, otherwise none. Accept a candidate only when it is
   clearly the same place: right region (Hijaz/Najd/Yaman/Tihamah/Syam/Iraq…), description fits (wadi, mountain,
   village, oasis), consistent with what the book says (e.g. distance/direction from Makkah, Madinah, Thaif).
   - match → `qid`, `lat`, `lon` copied from geo.py, `precision: "tepat"`.
   - no exact match, but the page places it at/near a known locality (e.g. "بين مكة والطائف", "قرب المدينة", "من
     أعمال اليمامة") → coordinates of that locality from geo.py, `qid` of that locality, `precision: "perkiraan"`,
     `near: "<Latin name of that locality>"`.
   - "perkiraan" only to a concrete locality (town, village, wadi, well) the page names — never to the centre point of
     a large region (a mountain range, province, country, "Najd", "as-Sarah", "wilayah Damaskus"): such a point can
     be hundreds of km off. In that case leave lat/lon null.
   - neither → `lat`/`lon` null (the place is listed in the profile but not drawn). Never estimate by yourself.
4. Persia / Rum / Habasyah: their lands/cities as the books name them (al-Mada'in, Aksum…), same rules.

## Output — `data/work/places_out/<id>.json` (one Write per file)
```json
{"id": "tsaqif", "places": [
  {"t": "ath-Tha'if (Wadi Wajj)", "ar": "الطائف", "kind": "kota", "note": "Wadi Wajj, negeri Tsaqif; 12 farsakh dari Makkah",
   "src": ["Mu'jam al-Buldan 4/9"], "quote": ["والطائف: هو وادي وج وهو بلاد ثقيف"],
   "qid": "Q182640", "lat": 21.2667, "lon": 40.4167, "precision": "tepat"}
]}
```
`kind` ∈ kota, desa, lembah, gunung, mata air, sumur, masjid, harrah, daerah, distrik, benteng, pasar, rumah. Validate:
`python3 scripts/check_places.py <id>` until ALL OK. Edit nothing else.
Final reply (≤120 words): per tribe, places (with coords / approximate / none) and anything notable.

## Fill pass (places_out files that already exist)
For every place with `lat: null` or `precision: "perkiraan"`: try `geo.py osm` (Arabic name, then with وادي/جبل/
ماء/بئر prefix variants) and `geo.py search` again. If a clearly matching object is found, set `qid` (OSM or
Wikidata id), `lat`, `lon` from the tool output, `precision: "tepat"`, remove `near`. Change nothing else in the
place (text, note, src, quote stay). Re-run check_places.py.

## Specify pass — pin down places now stacked on a city point
Many places sit on a city's centre point as "perkiraan" (Makkah = the Ka'bah, Madinah = Masjid Nabawi, Bashrah,
Kufah, Tha'if, ar-Rabadzah) because the first pass only knew "in Makkah". For each such place:
1. Read the cited page again and search the books for the place's own entry (Mu'jam al-Buldan, Mu'jam ma Ista'jam,
   Akhbar-type passages in Ibnu Sa'd / Sirah) for where it lies: quarter (al-'Aliyah, as-Safilah, Ajyad, al-Ma'la,
   al-Hajun), neighbouring mountain/wadi, direction and distance from the mosque.
2. Look it up with `geo.py osm` / `geo.py search`: historical mosques, wells, mountains, passes and districts often
   carry the old name (مسجد بني حارثة, بئر طوى, شعب علي, ثنية كداء, جبل سلع, السنح…). Accept only a clear match that
   agrees with the book's description.
3. Found → `qid`, `lat`, `lon` from the tool, `precision: "tepat"`, remove `near`; if the book only gives the quarter
   and OSM has that quarter/mountain → `perkiraan` with `near` = that quarter (closer than the city centre).
   Not found → leave it as it is. Never move a point by your own estimate.
Change only coordinate fields; text/note/src/quote stay.
