# Tribe roles at tribe level — move person deeds to biographies

The app owner: "for every tribe, what was its role in society — not per person". The "Lokasi & Peran Strategis"
cards (militer / diplomasi / ekonomi / sosial in `data/work/roles_out/<id>.json`) must describe **the tribe/clan as a
group**. Bullets that are really one person's deed belong in that person's biography.

Tools: `scripts/books.py` (search/page/check — see data/work/ROLES_SPEC.md, incl. the second-tier books) and
```
python3 scripts/person_bio.py find "REGEX"   # companion id by name (Latin or Arabic)
python3 scripts/person_bio.py show ID        # that companion's current biography points
```

## Classify every bullet of militer / diplomasi / ekonomi / sosial
**Tribe-level (keep)** — the subject is the tribe/clan or its people collectively:
- an office/privilege the clan held (hijabah, siqayah, rifadah, liwa', sifarah, qubbah, a'innah, nasi'), even if
  the source names the holder — rewrite so the clan is the subject: "Bani Hasyim memegang siqayah dan rifadah
  jamaah haji (dipegang Hasyim bin 'Abdi Manaf, lalu keturunannya)";
- collective acts: the tribe fought at / defended / allied with / sent a delegation / embraced Islam / apostatised /
  settled in / traded with / worshipped an idol; a group of its men (e.g. "70 orang Bani X gugur di …");
- "Klan X" bullets that only name the clan's most famous members are weak — keep at most one such bullet per tribe.

**Person-level (move)** — one individual's deed, office or virtue (commanded an army, was envoy, gave a fatwa,
offered his house, was a poet), where the tribe as a group did nothing:
1. Find the person: `person_bio.py find`. If he/she is in the dataset, run `show` and compare with the biography.
2. If the biography already says it → just remove the bullet (put it in the roles file's `dropped` with reason
   "already in biography of <id>").
3. Otherwise add it to `data/work/moved_out/<tribe id>.json` (a JSON list, one Write per file):
   `{"pid": "n9286", "t": "Indonesian sentence about the person", "src": ["Sirah Ibnu Hisyam 1/336"], "quote": ["…"], "from": "diplomasi"}`
   keeping the citation + verbatim quote (re-check the page; the person must be clearly the same man/woman).
   Then remove the bullet from the roles file and list it in `dropped` with reason "moved to biography of <pid>".
4. Person not in the dataset (e.g. pre-Islamic ancestors, non-companions) → rewrite as tribe-level if the source
   supports a clan role, else drop with a reason.

## Refill each category with tribe-level roles
For every category left with fewer than 2 bullets, search the books (≥3 queries: "بنو X", the tribe name with
battle/delegation/market/idol/office terms, key events) and add up to 2 tribe-level bullets, `status: "new"`, with
`src` + `quote` verified by `check`. Good sources: al-Muhabbar and al-Munammaq (Quraisy offices, hilf, markets,
idols), Ibnu Sa'd vol 1 (wufud — tribal delegations), Sirah Ibnu Hisyam (maghazi, which tribes fought on which
side), Tarikh ath-Thabari / al-Kamil (Riddah, futuh: which tribes settled Kufah/Bashrah, fought at Qadisiyah…),
Ansab al-Asyraf, Nihayat al-Arab, Shifat Jazirat al-'Arab. Say no more than the page says. An empty category is
fine when nothing tribe-level is found — never pad.

## Rules
- Never cite a page you have not read. Indonesian, terse, same style. Numbers/dates only if the page states them.
- Keep `lokasi` as is. Do not touch other tribes' files or anything else in the repo.
- Validate: `python3 scripts/check_moved.py <id>` (checks moved_out/<id>.json and roles_out/<id>.json; if you moved
  nothing, write `[]` to moved_out/<id>.json). Fix until ALL OK.

Final reply (≤150 words): per tribe — kept / rewritten to tribe-level / moved to bio / dropped / new.
