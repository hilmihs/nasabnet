# 10-point biography & tribe-profile spec (NasabNet)

Write **Indonesian**, concise (1–3 sentences per point), neutral, respectful (ﷺ for the Prophet, no
honorific spam otherwise). Hijri years as "13 H"; add "(± 634 M)" only if the source gives it.

## A. Person batches (`bio_*.jsonl`)

Input record: `{id, lat, ar, full, kunya, laqab, death, place, rank, isabah, ibnsad}` — `isabah` and
`ibnsad` are excerpts of al-Ishabah (Ibn Hajar) and ath-Thabaqat al-Kubra (Ibn Sa'd); each starts with a
bracketed citation like `[al-Ishabah 4/484]` / `[Ibnu Sa'd 3/265]`. `death`/`place` come from Turath's
narrator database.

**Use only these inputs.** If a point is not supported by them, set it to `null` — do not fill from
memory. Every non-null point carries `src`: the citation tag(s) of the excerpt(s) it came from (copy the
bracket text without brackets, e.g. `"al-Ishabah 4/484"`; use `"Turath rawi"` for `death`/`place`).
When sources disagree (e.g. several death years), give the main view and mention the alternative
briefly ("ada yang mengatakan …").

Output object:
```json
{
  "id": "n4677",
  "identitas": {"lahir": "13 tahun setelah Tahun Gajah", "umur": "63 tahun", "wafat": "23 H, dibunuh Abu Lu'lu'ah", "makam": "Kamar Aisyah, di samping Nabi ﷺ dan Abu Bakar", "src": ["Ibnu Sa'd 3/265"]},
  "kabilah_tabaqat": {"t": "Bani 'Adi bin Ka'b dari Quraisy; termasuk as-sabiqun al-awwalun dan Ahlu Badar.", "src": ["al-Ishabah 4/484"]},
  "nisbah_rihlah": {"t": "Makkah → hijrah ke Madinah secara terang-terangan.", "src": ["…"]},
  "laqab_profesi": {"t": "al-Faruq; pedagang dan duta Quraisy di masa jahiliah.", "src": ["…"]},
  "peran": {"t": "Masuk Islam tahun ke-6 kenabian; ikut Badar dan seluruh peperangan; khalifah kedua (13–23 H).", "src": ["…"]},
  "hilf": null,
  "syaraf": {"t": "Nasabnya tsabit dan disepakati; di masa jahiliah memegang jabatan safarah (duta) Quraisy.", "src": ["…"]},
  "catatan": null
}
```
Field meaning:
- `identitas`: birth (or age at an event), age at death, death year/cause, burial place. Any sub-field may be null.
- `kabilah_tabaqat`: clan, and the companion *tabaqah* (as-sabiqun al-awwalun, Ahlu Badar, Ahlu Bai'at ar-Ridhwan, muhajir before/after Hudaibiyah, thulaqa', shighar ash-shahabah…).
- `nisbah_rihlah`: place of origin and migrations (Makkah → Habasyah → Madinah → Syam/Kufah/Bashrah/Mesir…), where they settled/died.
- `laqab_profesi`: titles/epithets and stated occupation (pedagang, penyair, juru tulis wahyu, muazin…).
- `peran`: conversion, hijrah, battles, offices, notable events.
- `hilf`: alliance (halif) or wala' ties stated in the text; null otherwise.
- `syaraf`: status of the nasab (agreed / disputed — name disputes count) and stated standing (sayyid kaumnya, pemegang jabatan, dsb.).
- `catatan`: one short line of anything important not covered, else null.

## B. Tribe batches (`tribe_*.jsonl`)

Input record: `{id, name, ar, group, desc, members, jamharah}` — `jamharah` is an excerpt of Ibn
Hazm's *Jamharat Ansab al-'Arab* (genealogy only) with a `[Jamharat Ansab al-'Arab, hlm. N]` tag;
`members` are companions from this tribe in the dataset.

Because Jamharah covers genealogy only, you **may** use well-established general knowledge of
Islamic history for the other points, but mark each point's basis: `"basis": "sumber"` (from the
excerpt, with `src`) or `"basis": "umum"` (general knowledge, `src: []`). Keep general-knowledge points
conservative and widely agreed; prefer null to anything uncertain. `tokoh` must list only names that
appear in `members` (pick up to 8 most notable).

```json
{
  "id": "makhzum",
  "nama_arti": {"t": "…", "basis": "umum", "src": []},
  "leluhur": {"t": "Makhzum bin Yaqazhah bin Murrah bin Ka'b bin Lu'ay", "basis": "sumber", "src": ["Jamharat Ansab al-'Arab, hlm. 141"]},
  "titik_temu": {"t": "Bertemu dengan Bani Hasyim pada Murrah bin Ka'b; dengan seluruh Quraisy pada Fihr.", "basis": "sumber", "src": ["…"]},
  "struktur": {"t": "Cabang utama: Bani al-Mughirah, Bani 'Abd al-Asad, …", "basis": "sumber", "src": ["…"]},
  "wilayah": {"t": "…", "basis": "umum", "src": []},
  "peran_sosial": {"t": "…", "basis": "umum", "src": []},
  "hilf": {"t": "…", "basis": "umum", "src": []},
  "tokoh": ["Khalid bin al-Walid", "Ummu Salamah …"],
  "dinamika": {"t": "…", "basis": "umum", "src": []},
  "rujukan": ["Jamharat Ansab al-'Arab (Ibnu Hazm)", "Nasab Quraisy (Mush'ab az-Zubairi)"]
}
```
`rujukan` lists classical works that cover this tribe (titles only, from: Jamharat Ansab al-'Arab, Jamharat
an-Nasab (Ibn al-Kalbi), Nasab Quraisy, Ansab al-Asyraf, al-Muhabbar, ath-Thabaqat al-Kubra, al-Ishabah,
Nihayat al-Arab (al-Qalqasyandi)) — only those that actually treat this tribe.

## Output rules

- Output a JSON array, one object per input record, same order and ids.
- **Write at most 10 records per file**, one Write call per file: `<out>.part1.json`, `.part2.json`, …
- Validate every file with `python3 -c "import json; json.load(open(PATH))"`.
