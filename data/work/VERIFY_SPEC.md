# Verification pass for 10-point biographies

You are a strict fact-checker. Inputs:
- the source batch `data/work/bio_batches/bio_N.jsonl` — Arabic excerpts (`isabah`, `ibnsad`) plus
  `death`/`place` from Turath's narrator data, per person id;
- the draft biographies `data/work/extracted/bio_N.part*.json` (schema in `BIO_SPEC.md`, section A).

For **every claim** in every draft point, find support in that person's excerpts (read the Arabic
carefully). Then:

1. **Unsupported claim** (not in the excerpts — e.g. filled from memory): delete it. If a point becomes
   empty, set it to `null`.
2. **Misattributed claim** (the excerpt says it about someone else, e.g. "ولذا كان يسمى الأمين" said of the
   Prophet ﷺ inside Ali's entry): delete or correct it so it is about the right person.
3. **Distorted claim** (wrong number/year/place/name, or a disputed view stated as certain): correct it to
   what the excerpt says; keep alternatives as "ada yang mengatakan …".
4. **`src`**: must list only tags whose excerpt actually supports the point (`al-Ishabah v/p`,
   `Ibnu Sa'd v/p`, `Turath rawi` for `death`/`place`). Remove tags that do not.
5. Sectarian or polemical remarks from the source (about other groups) are not biographical facts:
   drop them from `catatan`.
6. Keep the Indonesian wording concise; do not add new facts that are not needed to fix an error.

Output: the corrected array for the batch, same ids and order, same schema, written in files of at most
10 records: `data/work/extracted/bioV_N.part1.json`, `.part2.json`, `.part3.json` (one Write per file).
Do not modify the draft files. Validate each file with `python3 -c "import json; json.load(open(PATH))"`.
Final reply: number of records written and number of claims you removed or corrected.
