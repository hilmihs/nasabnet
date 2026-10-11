# Biography expansion — paused after batch f3 (2026-10-11)

Narrative bios now cover 1,720 of 1,804 companions (bio.json rebuilt locally, NOT yet committed/deployed).

Done (drafted + verified):
- batches 6–40, z1–z3 (al-Ishabah / Ibnu Sa'd), released earlier as f10181a
- u1–u3: 99 companions from Usdul Ghabah (`build_bio_inputs.py usd`)
- f1–f3: companions whose entries were found by a manual search agent (data/work/FIND_SPEC.md,
  scripts/check_found.py checks every excerpt verbatim against the page)

Still to do (one agent at a time, the user's wish):
- find_f4, find_f5: search → bio_f4/bio_f5 → Draft → Verify
- find_z4: re-search 19 companions whose Usdul Ghabah entry was a heading or a namesake (results override u1–u3)
- then: build_bio → UI check → ask before commit/deploy/push

Also uncommitted: display-name disambiguation in scripts/build_dataset.py (206 names, e.g.
"Khalid bin al-Walid bin 'Uqbah"); nasabnet.json was rebuilt with it (ids/edges unchanged).

Data issues found along the way: data/work/bio_mismatch.txt (merged/duplicate nodes, group labels stored as persons,
wrong tribes, tabi'in flagged as companions, impossible Turath death years).
