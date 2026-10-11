# Biography expansion — DONE 2026-10-11

Narrative bios now cover 1,518 companions (was 150), all drafted from al-Ishabah / Ibnu Sa'd excerpts and checked
claim by claim by a second agent (data/work/extracted/bio_N + bioV_N, batches 6–40, z1–z3; z batches override older
files in scripts/build_bio.py). 286 companions still have no matching entry in either book.

Open follow-ups (not blocking):
- data/work/bio_mismatch.txt — wrong-person excerpts found by agents, plus dataset issues to review:
  merged nodes (n6851 Wahb bin Abdullah ×3, n2947 adh-Dhahhak bin Sufyan as-Sulami/al-Kilabi),
  duplicate nodes (n6683=s1052 Hazzal, n4928=s1119 'Umair bin Sa'd, n8086/n3787), tabi'i flagged as companion (n5388),
  impossible Turath death years (n6233, n4773).
- python3 scripts/audit_bio.py — label audit (remaining flags are person names like "Aus bin …" or genealogically implied).
