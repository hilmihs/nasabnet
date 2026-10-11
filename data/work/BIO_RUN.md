# Running a biography batch (bio_6 … bio_39 and later)

Working dir: /data/Downloads/04_Dev-Projects/Nasab. Source batches: `data/work/bio_batches/bio_N.jsonl`
(≈40 companions each, Arabic excerpts of al-Ishabah / Ibnu Sa'd + Turath narrator data).

## Draft (agent "extract N")
1. Read `data/work/BIO_SPEC.md` section A and "Output rules" — follow them exactly. Use only the excerpts;
   anything not in them is `null`. Short excerpts → mostly nulls; that is correct, do not pad.
2. Read the batch in chunks (`sed -n 1,10p data/work/bio_batches/bio_N.jsonl`, then 11–20, …) and write
   `data/work/extracted/bio_N.part1.json` (records 1–10), `.part2.json` (11–20), … — same order and ids,
   one Write per file, each written as soon as its 10 records are done.
3. Run `python3 scripts/check_bio.py N` and fix every problem until it prints ALL OK.

## Verify (agent "verify N", a different agent from the drafter)
1. Read `data/work/VERIFY_SPEC.md` and follow it, comparing `extracted/bio_N.part*.json` claim by claim
   with the Arabic excerpts in `bio_batches/bio_N.jsonl` (work 10 records at a time).
2. Write `data/work/extracted/bioV_N.part1.json`, `.part2.json`, … (same ids/order, ≤10 per file).
3. Run `python3 scripts/check_bio.py --v N` until ALL OK.

## Common drafting errors (verifiers keep removing these — do not write them)
- Clan/tribe labels (al-Khazraj, al-Aus, Anshar, Bani an-Najjar, Bani Salimah…) unless the excerpt or the
  `full` nasab names them; never take the clan from the mother's line.
- Years the excerpt does not give ("2 H" added to Badar), burial place when only the place of death is known,
  labels like "kibar ash-shahabah", "nasab tsabit", "paling …" superlatives.
- Remarks about the sources themselves ("Turath mencatat…", "dalam kutipan…").

(This file is read-only for agents: never edit it. A verifier deletes such errors from the biographies, not from this file.)

## "Turath rawi"
All non-excerpt input fields (`full`, `kunya`, `laqab`, `death`, `place`, `rank`) come from Turath's narrator
database, so a point taken from any of them cites `"Turath rawi"` — that is correct, not an error.

## Batches u1–u3, f1–f5, z4 — extra sources
Batches f1–f5 and z4 may also carry `lain`: an excerpt from another book (Sirah Ibnu Hisyam, Tarikh ath-Thabari, Jamharah,
Nasab Quraisy, al-Muhabbar), tagged like `[Sirah Ibnu Hisyam 1/320]`. Treat it like the others.

## Batches u1, u2, u3 — third source
Their records carry an extra excerpt `usd` from Usdul Ghabah (Ibnul Atsir), tagged like `[Usdul Ghabah 3/120]`.
Treat it exactly like `isabah`/`ibnsad`: use only what it says about this person and cite its tag in `src`.

## Excerpt about a different person
The excerpts were matched automatically; sometimes an excerpt belongs to another man/woman (different
father, tribe or story). Never use such an excerpt, and never write remarks about the sources/matching into
any point (`catatan` is shown to readers) — set the point null instead. List the affected ids with a few
words each in your final reply so the matcher can be fixed. The verifier deletes any such remark it finds.

Edit no other files. Final reply ≤80 words: records written, points set null/removed/corrected.
