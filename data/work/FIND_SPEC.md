# Finding book entries for companions the matcher missed

Input: `data/work/bio_batches/find_X.jsonl` (X = f1…f5, z4) — companions (Turath data: name, `full` nasab, kunya, laqab, tribe,
nisba, death, place, rank) for whom no entry was matched automatically in al-Ishabah, Ibnu Sa'd or Usdul Ghabah.
Often the name is spelled differently, the person is listed under a kunya, or only mentioned inside a relative's entry.

## Tools (local, offline)
```
python3 scripts/books.py search "REGEX" [--book 9767,1110,9351] [--limit N] [--width N]
python3 scripts/books.py page BOOK VOL PAGE [--next 1]
```
Books: 9767 al-Ishabah, 1110 Usdul Ghabah, 9351 Ibnu Sa'd, 23833 Sirah Ibnu Hisyam, 9783 Tarikh ath-Thabari,
9793 Jamharat Ansab, 2922 Nasab Quraisy, 12205 al-Muhabbar. Search ignores harakat/hamza variants; try the name,
"name + father", the kunya, name + nisba, and spelling variants (e.g. ة/ه, ي/ى, عمرو/عمر).

## Rules
- An entry counts only if it is clearly THIS person: father (and grandfather when given), tribe/nisba, kunya,
  death or place must agree with the record; nothing may contradict it. Namesakes are common — when unsure, skip.
- Copy the text verbatim from `books.py page` output (you may cut it down to the paragraphs about the person, keep
  whole sentences, ≤ 2000 chars per excerpt). Never paraphrase or add anything.
- At most one excerpt per field: `isabah` (book 9767), `usd` (1110), `ibnsad` (9351), `lain` (any other book).
  Each excerpt starts with its tag on the first line exactly as books.py prints it, e.g. `[Usdul Ghabah 3/120]`.

## Output
- `data/work/bio_batches/bio_X.jsonl` (same X as the input) — one line per companion you FOUND, same keys as the input plus
  `isabah`, `usd`, `ibnsad`, `lain` (empty string when none). Keep input order.
- `data/work/bio_batches/find_X.notes.json` — `{"not_found": {"id": "queries tried / why"}, "skipped": {"id": "doubt"}}`.
Validate: `python3 scripts/check_found.py X` until ALL OK. Edit nothing else.
