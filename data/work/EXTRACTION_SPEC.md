# Relation extraction spec (NasabNet)

Input: a JSONL batch file. Each line is one source record:

- Ibn Sa'd batches (`ibnsad_*.jsonl`): `{id, vol, page, title, ctx, text}` — `text` is the opening of a
  biography from *al-Tabaqat al-Kubra* (Dar Sadir ed.), `title` is the entry heading (often only the
  first name), `ctx` is the clan section the entry sits in (e.g. "ومن بني عدي بن كعب بن لؤي").
- Narrator batches (`narr_*.jsonl`): `{id, name, full, kunya, laqab, nisba, rank, rel, hints}` — data
  of one narrator from Turath's رواة database; `rel` is the "علاقات الراوي" text.

Output: a JSON **array** written to the output path you are given, one object per input record
(same order, same `id`). Skip nothing — if a record has no person or no relations, still emit it
with empty lists.

```json
{
  "id": "is1234",
  "skip": false,
  "subject": {"ar": "عمر بن الخطاب بن نفيل", "lat": "Umar bin al-Khaththab", "g": "m"},
  "father": {"ar": "الخطاب بن نفيل بن عبد العزى", "lat": "al-Khaththab bin Nufail"},
  "mother": {"ar": "حنتمة بنت هاشم بن المغيرة", "lat": "Hantamah binti Hasyim bin al-Mughirah"},
  "spouses": [
    {"ar": "زينب بنت مظعون بن حبيب", "lat": "Zainab binti Mazh'un", "note": ""},
    {"ar": "أم كلثوم بنت علي بن أبي طالب", "lat": "Ummu Kultsum binti Ali bin Abi Thalib", "note": ""},
    {"ar": "أم كلثوم بنت جرول بن مالك", "lat": "Ummu Kultsum binti Jarwal", "note": "dipisahkan karena Islam"}
  ],
  "children": [
    {"ar": "عبد الله بن عمر بن الخطاب", "lat": "Abdullah bin Umar", "g": "m", "mother": "زينب بنت مظعون بن حبيب"},
    {"ar": "حفصة بنت عمر بن الخطاب", "lat": "Hafshah binti Umar", "g": "f", "mother": "زينب بنت مظعون بن حبيب"}
  ],
  "siblings": [{"ar": "...", "lat": "...", "g": "f", "note": "seibu"}],
  "muakhah": [{"ar": "عتبان بن مالك", "lat": "'Itban bin Malik"}],
  "patron": null,
  "clients": [],
  "other": [{"rel": "paman (khal)", "ar": "سعد بن أبي وقاص", "lat": "Sa'd bin Abi Waqqash"}],
  "flags": {"badr": false, "uhud": false, "habasyah": false, "muhajir": true, "anshar": false, "aqabah": false, "fath_convert": false, "slave_concubine_mother": false},
  "kunya": "أبو حفص",
  "tribe_hint": "بنو عدي بن كعب (قريش)"
}
```

## Rules

1. **Extract only what the text states.** Do not add relatives from memory. The one exception is
   *name completion*: write every name in the fullest form the text supports, and you may append the
   obvious patronymic for children/siblings of the subject (children of عمر بن الخطاب →
   "عبد الله بن عمر بن الخطاب"). For a spouse/mother keep at most 3–4 links of nasab
   ("زينب بنت مظعون بن حبيب"), not the whole chain.
2. `subject.ar` must be the full name of the biography subject as `ism بن father بن grandfather`
   (3–4 links), built from `title` + the nasab that opens `text`. Ibn Sa'd often starts `text` with
   "ابن X بن Y" continuing the title. If the text says "واسمه"/"وهي أم ..." use the real name and put the
   kunya in `kunya`.
3. Ibn Sa'd pattern `وكان له من الولد A وB وأمهم X` ⇒ X is a **spouse** of the subject and the mother of
   A, B. Also include "أم ولد" mothers as spouses with `note: "ummu walad"` only if a name is given;
   otherwise set the child's `mother` to "أم ولد" and do not create a spouse.
4. For a woman: `تزوجها X فولدت له A` ⇒ X spouse, A child (patronymic from X). `ثم خلف عليها Y` ⇒ Y is
   another spouse. "زوج رسول الله ﷺ" ⇒ spouse `{"ar": "محمد رسول الله ﷺ", "lat": "Nabi Muhammad ﷺ"}`.
   "بنت رسول الله ﷺ" ⇒ father is the Prophet; use exactly `"محمد رسول الله ﷺ"` for him everywhere.
5. `آخى رسول الله ﷺ بينه وبين X` / `آخى بين A وB` ⇒ `muakhah` (the other party).
6. `مولى X` ⇒ `patron` = X. "حليف" (ally) is not a patron: put it in `other` with rel "halif".
7. `g` (gender) for every person: "m"/"f".
8. `lat`: Indonesian-style transliteration used in Indonesian Islamic literature:
   ث ts, ذ dz, ش sy, ص sh, ض dh, ط th, ظ zh, ع ' (omit at word start), غ gh, خ kh, ح h, ق q, و w, ي y;
   "bin" / "binti"; "Abu"/"Abi" kept as in Arabic case ("Ali bin Abi Thalib"); "Ummu" for أم; article
   "al-" kept lowercase (al-Khaththab, az-Zubair, ash-Shiddiq, sun letters assimilated); established
   spellings: Muhammad, Abu Bakar, Umar, Utsman, Ali, Aisyah, Khadijah, Fathimah, Hasan, Husain, Hafshah,
   Zainab, Ruqayyah, Ummu Kultsum, Abdullah, Abdurrahman, Ubaidillah, Ja'far, Abbas, Hamzah, Thalhah,
   az-Zubair bin al-'Awwam, Sa'd bin Abi Waqqash, Abu 'Ubaidah. Keep it short: ism + "bin/binti" + father
   (+ grandfather only when needed to disambiguate).
9. `flags`: set true only when the text says so (شهد بدرا → badr; هاجر إلى أرض الحبشة → habasyah;
   هاجر إلى المدينة / من المهاجرين → muhajir; من الأنصار or Ansari clan context → anshar; شهد العقبة →
   aqabah; أسلم يوم الفتح / من مسلمة الفتح → fath_convert).
10. `skip: true` (with empty lists) when the record is not a biography of a person (e.g. a section
    heading or a list), or when the text is only the name with nothing else.
11. Narrator records: `rel` uses forms like "أمه: X", "زوجها: X", "ابنه/ابناه/أولاده/ومن ولده: A، وB",
    "أخوه/أخته", "عمه/خاله", "ابن عمه", "جده لأمه", "مولى: X", "آخى رسول الله بينه وبين X", "صهر"/"ختن"
    (son-in-law). Map grandparents, uncles, cousins, nephews, grandchildren, in-laws to `other` with
    an Indonesian `rel` label (kakek, nenek, paman ('amm), paman (khal), bibi, sepupu, keponakan, cucu,
    menantu, mertua, ipar, halif, murid, dll.). Hedged statements ("ويقال"/"وقيل") are still extracted
    but put "riwayat lain" in `note`. Use `hints` only for flags.
12. Output must be valid JSON (UTF-8, Arabic as-is, no trailing commas). Write the file with the Write
    tool in one go; if the batch is large you may write parts `<out>.part1.json`, `<out>.part2.json`…
    each a JSON array, then finish.
