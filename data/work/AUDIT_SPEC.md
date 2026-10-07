# Reviewing audit findings (NasabNet)

Each input line is one finding flagged by an automatic consistency audit of a genealogy dataset of the
Prophet's companions. It contains the persons involved (ids, names, nasab, tribe, death year, the Turath
narrator record `turath_rawi`, and Ibn Sa'd excerpts `ibnsad`) and the edges between them
(`k`: parent = s is parent of t; spouse; sibling; muakhah; mawla = s is patron of t; each with `src`).

Rules flagged:
- R2 marriage with own parent/child/sibling — impossible; one of the edges is wrong (often a hedged
  "يقال إنها بنت … ويقال امرأة …" turned into both a child edge and a spouse edge).
- R5 father and child in different tribal groups — usually a wrong tribe on one of them, or a halif/mawla.
- R6 the person's own nasab names a different father than the linked father — usually a wrong
  resolution (e.g. linked to the grandfather or to a homonym); sometimes just a kunya vs ism difference
  (أبو أسيد = مالك بن ربيعة) → ok.
- R9 probable duplicate — two records that may be one person (same parent/spouse, same name); الكبرى
  and الصغرى are different people; different mothers usually mean different people.

## Decide, using only the given texts plus well-established, uncontroversial genealogy

For each finding output:
```json
{"fid": "F12", "verdict": "fix" | "ok" | "unsure", "why": "short Indonesian reason citing the text",
 "ops": [ … ]}
```
Allowed ops (ids must be ids that appear in the finding):
- `{"op":"merge","keep":"<id>","drop":"<id>"}` — same person; keep the richer record (prefer ids starting
  with `n`, then `s`, then `c`, then `x`).
- `{"op":"drop_edge","s":"<id>","t":"<id>","k":"parent|spouse|sibling|muakhah|mawla"}` — a wrong link.
- `{"op":"add_edge","s":"<id>","t":"<id>","k":"…","n":"note"}` — only to restore a link the texts clearly
  state between people in this finding (e.g. after dropping a mis-resolved father, if the right father is
  in the finding).
- `{"op":"set_tribe","id":"<id>","tribe":"<tribe id>"}` — tribe ids: hasyim muthalib umayyah naufal asad
  abduddar zuhrah taim makhzum adi sahm jumah amir fihr quraisy aus khazraj anshar tamim tsaqif hudzail
  ghifar aslam juhainah muzainah asyja ghathafan daus azd kalb khuzaah kinanah bajilah asad-k thayyi kindah
  hamdan sulaim hawazin abdulqais bakr madzhij himyar qudhaah lakhm khatsam asyari dhabbah bahilah ghani
  muharib persia habasyah rum. A halif/mawla keeps the tribe of their own nasab (e.g. 'Ammar bin Yasir =
  madzhij; his father Yasir also madzhij, halif of Makhzum).
- `{"op":"set_gender","id":"<id>","g":"m|f"}`.

`ok` = the finding is a false alarm (ops: []). `unsure` = cannot decide from the texts (ops: []).
Be conservative: never merge people unless the texts show they are the same person; never drop a link the
texts support. Keep `why` to one sentence.

## Output
Write a JSON array of decisions (same order as input), at most 10 decisions per file, one Write per file:
`data/work/audit_out/d_N.partK.json`. Validate each with `python3 -c "import json; json.load(open(PATH))"`.
Keep your own reasoning brief.
