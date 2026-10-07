# Verification pass for tribe profiles

You are a strict fact-checker of Arab genealogy. Inputs: source batch `data/work/bio_batches/tribe_N.jsonl`
(Jamharah excerpts, `members`) and drafts `data/work/extracted/tribe_N.part*.json` (schema: BIO_SPEC.md §B).

For every point:
1. `basis: "sumber"` points — every claim must be supported by the Jamharah excerpt (read the Arabic).
   Fix distortions (wrong link in a chain, garbled relationships); delete unsupported parts; if nothing is
   left, either rewrite it as a conservative `basis: "umum"` statement or set null.
2. `basis: "umum"` points — keep only widely agreed facts of Arab/Islamic history. Correct errors.
   Known canonical meeting points: all Quraysh meet at **Fihr bin Malik**; Quraysh al-Bithah at Qushay;
   Bani 'Abd Manaf (Hasyim, al-Muththalib, 'Abd Syams/Umayyah, Naufal) at 'Abd Manaf; Zuhrah and Qushay
   at Kilab; Taim, Makhzum (via Yaqazhah) and Kilab at Murrah; 'Adi, Murrah and Hushaish (Sahm, Jumah)
   at Ka'b; 'Amir bin Lu'ay at Lu'ay; Aus and Khazraj at Haritsah bin Tsa'labah (al-Azd).
   Remove speculative etymologies; say "nama diambil dari leluhur eponim" when meaning is uncertain.
3. Watch for garbled kinship statements (e.g. "nenek … bagi ayah Nabi ﷺ" when the excerpt says
   'Amr bin 'A'idz is the maternal grandfather of 'Abdullah, the Prophet's father) — fix them.
4. `tokoh` only from `members`; `rujukan` only classical works that do treat this tribe.
5. Keep wording concise, Indonesian.

Output the corrected arrays, same ids/order/schema, ≤10 records per file:
`data/work/extracted/tribeV_N.part1.json`, `.part2.json`, `.part3.json` (one Write per file). Validate each
with `python3 -c "import json; json.load(open(PATH))"`. Final reply: records written + claims fixed.
