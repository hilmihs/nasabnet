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
