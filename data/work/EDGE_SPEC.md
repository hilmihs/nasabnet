# Per-relation verification (NasabNet)

Each input line is one **source record** — an Ibn Sa'd biography page (`### title (Ibnu Sa'd v/p)` + text) or a
Turath narrator record (`full_name`, `النسب`, `علاقات الراوي`) — with every relation the dataset derived from it:
`{s, t, k, n, s_name, t_name}`; `k`: parent = **s is the parent of t**; spouse; sibling; muakhah (Prophet-made
brotherhood); mawla = s is the patron of t; milk = milk-sibling. `s_name`/`t_name` show the dataset person each
side was resolved to (Arabic short name — full nasab [Latin]).

For **every relation** decide against the Arabic text:
- `ok` — the text states this relation between these two people.
- `wrong` — one of:
  - the text does not state it (invented / over-read);
  - wrong type or direction (e.g. text says sister, dataset says wife; text says X's son, dataset has X as son);
  - wrong person: the text means someone else, and the resolved person (see the full nasab in `s_name`/`t_name`)
    is a different individual — e.g. a namesake from another tribe or generation.
- `unsure` — the text is ambiguous or hedged in a way you cannot settle (state why).

A relation is still `ok` when the text gives it as a hedged report ("ويقال/وقيل") — but if the text gives two
mutually exclusive versions, mark the less-supported one `unsure`.
Implied relations are ok: "وكان له من الولد A وأمها X" ⇒ X is the subject's wife and A's mother; the subject's
father/mother from his nasab line; "تزوجها X … ثم خلف عليها Y" ⇒ both are her husbands.

## Output
One object per input record (same order), listing only problem relations:
```json
{"rid": "<rid>", "ok": 7, "issues": [
  {"s": "x1", "t": "n2", "k": "spouse", "verdict": "wrong", "why": "teks: X adalah saudari, bukan istri"},
  {"s": "n3", "t": "s4", "k": "parent", "verdict": "unsure", "why": "dua riwayat bertentangan tentang ayahnya"}
]}
```
`ok` = number of relations in the record judged ok. `why` in short Indonesian. Write files of at most 10
records, one Write per file, at the output path you are given; validate each with
`python3 -c "import json; json.load(open(PATH))"`. Keep your own reasoning brief.
