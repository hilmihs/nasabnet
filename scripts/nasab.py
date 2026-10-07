"""Arabic nasab helpers: normalisation, patrilineal-chain parsing, nisba -> tribe mapping."""
import re

DIAC = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۭـ]")


def norm(s: str) -> str:
    s = DIAC.sub("", s or "")
    s = re.sub("[إأآٱ]", "ا", s)
    s = s.replace("ى", "ي").replace("ة", "ه").replace("ؤ", "و").replace("ئ", "ي")
    s = re.sub(r"[«»\"'()\[\]{}.]", " ", s)
    s = re.sub(r"\bعبد(?=ال)", "عبد ", s)
    return re.sub(r"\s+", " ", s).strip()


HONORIFICS = re.compile(r"\s*(﵁|﵂|﵃|﵄|ﷺ|رضي الله عن(ه|ها|هما|هم)|صلى الله عليه (وآله )?وسلم|عليه السلام|عليها السلام)\s*")
ALT = re.compile(r"\s*[،,؛;]\s*(ويقال|وقيل|يقال|قيل|وهو|وهي|ويكنى|المعروف|أخو|أخت|مولى|حليف|وكان|من |الصحابي|له|لها)\b.*$")


PROPHET = re.compile(r"(سيد ولد آدم\s+)?(محمد\s+)?(رسول الله|النبي)(\s*-?\s*(ﷺ|صلى الله عليه (وآله )?وسلم)\s*-?)?")


def expand_prophet(s: str) -> str:
    """'فاطمة بنت رسول الله ﷺ' -> 'فاطمة بنت محمد بن عبد الله بن عبد المطلب'."""
    s = re.sub(r"سيد ولد آدم\s+", "", s or "")
    return PROPHET.sub("محمد بن عبد الله بن عبد المطلب", s)


def pick_name_segment(full: str) -> str:
    """Choose the segment of a Turath full_name that carries the nasab chain."""
    s = expand_prophet(full or "")
    s = HONORIFICS.sub(" ", s).strip()
    # "سعد بن أبي وقاص واسمه مالك بن أهيب" -> alias on the last link
    s = re.sub(r"(\S)\s+واسم(?:ه|ها)\s*:?\s*", r"\1: ", s)
    if "؛" in s:  # "أبو أمامة ؛ إياس بن ثعلبة"
        s = s.split("؛", 1)[1].strip()
    segs = [x.strip() for x in re.split(r"[،,]", s) if x.strip()]
    best = segs[0] if segs else ""
    if " بن " not in best and " بنت " not in best:
        for x in segs[1:]:
            if " بن " in x or " بنت " in x:
                best = x
                break
    best = re.sub(r"^(?:و?قيل|و?يقال)?\s*:?\s*(?:اسمه|اسمها)\s*:?\s*", "", best)
    best = re.sub(r"^(قال|وقال|يقال|ويقال|قيل|وقيل)\s[^:]*:\s*", "", best)
    best = re.sub(r"^(يقال|ويقال|قيل|وقيل)\s*:?\s*", "", best)
    return best.strip()


def genitive_to_nominative(name: str) -> str:
    """'أبي طالب' -> 'أبو طالب' when used as a standalone name."""
    return re.sub(r"^أبي\s", "أبو ", name.strip())


def parse_chain(full: str):
    """Return (ism, [father, grandfather, ...]) where each entry is {'ar': name, 'alias': optional}."""
    seg = pick_name_segment(full)
    seg = re.sub(r"عبد(?=ال)", "عبد ", seg)
    daughter_of = bool(re.match(r"^(ابنة|بنت)\s", seg))
    if daughter_of:
        seg = re.sub(r"^(ابنة|بنت)\s+", "", seg)
    parts = [p.strip() for p in re.split(r"\s+(?:بن|بنت|ابن|ابنة)\s+", seg) if p.strip()]
    if not parts:
        return seg, []
    out = []
    for p in parts:
        alias = None
        if ":" in p:
            p, alias = [x.strip() for x in p.split(":", 1)]
            alias = alias or None
        p = re.sub(r"\s+(و?يقال|و?قيل)\b.*$", "", p)
        p = re.sub(r"\s+(الصديق|الفاروق|ذو النورين)$", "", p)
        out.append({"ar": genitive_to_nominative(p), **({"alias": alias} if alias else {})})
    if daughter_of:  # "ابنة الحارث بن عامر" -> own name unknown
        return "", out
    return out[0]["ar"], out[1:]


# Canonical upper chains (child -> ... -> Adnan / al-Azd) used to extend short chains.
CANON = [
    "عبد المطلب هاشم عبد مناف قصي كلاب مرة كعب لؤي غالب فهر مالك النضر كنانة خزيمة مدركة إلياس مضر نزار معد عدنان",
    "أمية عبد شمس عبد مناف قصي",
    "ربيعة عبد شمس عبد مناف",
    "نوفل عبد مناف قصي",
    "المطلب عبد مناف قصي",
    "أسد عبد العزى قصي كلاب",
    "عبد الدار قصي كلاب",
    "زهرة كلاب مرة",
    "تيم مرة كعب",
    "مخزوم يقظة مرة كعب",
    "رياح عبد الله قرط رزاح عدي كعب لؤي",
    "سهم عمرو هصيص كعب لؤي",
    "جمح عمرو هصيص كعب لؤي",
    "حسل عامر لؤي غالب",
    "عامر لؤي غالب",
    "الحارث فهر مالك النضر",
    "محارب فهر مالك النضر",
    "عبد الأشهل جشم الحارث الخزرج",
    "الخزرج حارثة ثعلبة عمرو عامر حارثة امرئ القيس ثعلبة مازن الأزد",
    "الأوس حارثة ثعلبة عمرو عامر حارثة امرئ القيس ثعلبة مازن الأزد",
    "مالك الأوس حارثة",
    "النجار ثعلبة عمرو الخزرج حارثة",
    "تميم مر أد طابخة إلياس مضر",
]
CANON = [re.findall(r"عبد \S+|امرئ القيس|\S+", c) for c in CANON]


def _known_pairs():
    out = set()
    for spine in CANON:
        ns = [norm(x) for x in spine]
        out |= set(zip(ns, ns[1:]))
    return out


KNOWN_PAIRS = _known_pairs()


def _extend_once(line):
    names = [norm(x["ar"]) for x in line]
    if len(names) < 2:
        return line
    a, b = names[-2], names[-1]
    for spine in CANON:
        ns = [norm(x) for x in spine]
        for i in range(len(spine) - 2):
            if ns[i] == a and ns[i + 1] == b:
                # the link before the pair must agree too when both sides have it (homonymous pairs such as
                # "عدي بن كعب" exist outside Quraysh)
                if i > 0 and len(names) >= 3 and names[-3] != ns[i - 1] and (names[-3], a) not in KNOWN_PAIRS:
                    continue
                return line + [{"ar": t, "canon": True} for t in spine[i + 2 :]]
    return line


def extend_chain(line):
    """Append canonical ancestors when a chain ends inside a known spine (repeated: short spines chain on)."""
    for _ in range(6):
        longer = _extend_once(line)
        if len(longer) == len(line):
            break
        line = longer
    return line


# --- tribes -----------------------------------------------------------------
TRIBES = [
    # id, ar, name, group, desc, nisbas, needs_quraysh
    ("hasyim", "بنو هاشم", "Bani Hasyim", "quraisy", "Klan Nabi ﷺ dari Quraisy; keturunan Hasyim bin Abdi Manaf.", ["الهاشمي", "الهاشمية", "الطالبي", "العلوي", "العباسي", "الجعفري"], False),
    ("muthalib", "بنو المطلب", "Bani al-Muththalib", "quraisy", "Saudara klan Bani Hasyim; bersama Bani Hasyim dalam pemboikotan di Syi'ib.", ["المطلبي", "المطلبية"], False),
    ("umayyah", "بنو أمية (عبد شمس)", "Bani Umayyah / Abdu Syams", "quraisy", "Keturunan Abdu Syams bin Abdi Manaf; klan Utsman bin Affan dan Mu'awiyah.", ["الأموي", "الأموية", "العبشمي", "العبشمية"], False),
    ("naufal", "بنو نوفل", "Bani Naufal", "quraisy", "Keturunan Naufal bin Abdi Manaf.", ["النوفلي", "النوفلية"], False),
    ("asad", "بنو أسد بن عبد العزى", "Bani Asad (Quraisy)", "quraisy", "Klan Khadijah binti Khuwailid dan az-Zubair bin al-'Awwam.", ["الأسدي", "الأسدية", "الزبيري"], True),
    ("abduddar", "بنو عبد الدار", "Bani Abdid-Dar", "quraisy", "Pemegang kunci Ka'bah dan panji Quraisy.", ["العبدري", "العبدرية"], False),
    ("zuhrah", "بنو زهرة", "Bani Zuhrah", "quraisy", "Klan Aminah (ibunda Nabi ﷺ), Sa'd bin Abi Waqqash, dan Abdurrahman bin 'Auf.", ["الزهري", "الزهرية"], True),
    ("taim", "بنو تيم", "Bani Taim", "quraisy", "Klan Abu Bakar ash-Shiddiq dan Thalhah bin 'Ubaidillah.", ["التيمي", "التيمية"], True),
    ("makhzum", "بنو مخزوم", "Bani Makhzum", "quraisy", "Klan Khalid bin al-Walid dan Ummu Salamah.", ["المخزومي", "المخزومية"], False),
    ("adi", "بنو عدي", "Bani 'Adi", "quraisy", "Klan Umar bin al-Khaththab dan Sa'id bin Zaid.", ["العدوي", "العدوية", "العمري"], True),
    ("sahm", "بنو سهم", "Bani Sahm", "quraisy", "Klan 'Amr bin al-'Ash.", ["السهمي", "السهمية"], False),
    ("jumah", "بنو جمح", "Bani Jumah", "quraisy", "Klan 'Utsman bin Mazh'un dan Shafwan bin Umayyah.", ["الجمحي", "الجمحية"], False),
    ("amir", "بنو عامر بن لؤي", "Bani 'Amir bin Lu'ay", "quraisy", "Klan Saudah binti Zam'ah dan Suhail bin 'Amr.", ["العامري", "العامرية"], True),
    ("fihr", "بنو الحارث بن فهر", "Bani al-Harits bin Fihr", "quraisy", "Klan Abu 'Ubaidah bin al-Jarrah.", ["الفهري", "الفهرية"], False),
    ("quraisy", "قريش", "Quraisy (umum)", "quraisy", "Keturunan Fihr bin Malik (Quraisy); klan tidak terperinci dalam sumber.", ["القرشي", "القرشية", "القرشى"], False),
    ("aus", "الأوس", "Aus", "anshar", "Salah satu dari dua kabilah besar Anshar Madinah; keturunan al-Aus bin Haritsah.", ["الأوسي", "الأوسية", "الأشهلي", "الأشهلية", "الأشهلى", "الظفري", "الحارثي", "الحارثية"], "ansar"),
    ("khazraj", "الخزرج", "Khazraj", "anshar", "Kabilah Anshar terbesar; termasuk Bani an-Najjar (paman-paman Nabi ﷺ dari pihak ibu kakeknya).", ["الخزرجي", "الخزرجية", "النجاري", "النجارية", "الساعدي", "الساعدية", "الزرقي", "الزرقية", "السالمي", "السلمي", "السلمية", "المازني", "البياضي", "الحبلي", "العوفي"], "ansar"),
    ("anshar", "الأنصار", "Anshar (umum)", "anshar", "Penduduk Madinah yang menolong Nabi ﷺ; kabilah Aus/Khazraj tidak terperinci.", ["الأنصاري", "الأنصارية"], False),
    ("tamim", "بنو تميم", "Bani Tamim", "arab", "Kabilah Mudhar besar di Najd; banyak tokoh Basrah.", ["التميمي", "التميمية", "التميمى", "العنبري", "المنقري", "الحنظلي", "المجاشعي", "الهجيمي", "اليربوعي", "الدارمي", "السعدي"], False),
    ("tsaqif", "ثقيف", "Tsaqif", "arab", "Kabilah penduduk Tha'if.", ["الثقفي", "الثقفية"], False),
    ("hudzail", "هذيل", "Hudzail", "arab", "Kabilah Mudhar di sekitar Makkah; kabilah Abdullah bin Mas'ud.", ["الهذلي", "الهذلية"], False),
    ("ghifar", "غفار", "Ghifar", "arab", "Kabilah Kinanah; kaum Abu Dzar al-Ghifari.", ["الغفاري", "الغفارية"], False),
    ("aslam", "أسلم", "Aslam", "arab", "Kabilah dari Khuza'ah di sekitar Madinah.", ["الأسلمي", "الأسلمية"], False),
    ("juhainah", "جهينة", "Juhainah", "arab", "Kabilah Qudha'ah di barat Madinah.", ["الجهني", "الجهنية"], False),
    ("muzainah", "مزينة", "Muzainah", "arab", "Kabilah Mudhar di sekitar Madinah.", ["المزني", "المزنية"], False),
    ("asyja", "أشجع", "Asyja'", "arab", "Cabang Ghathafan.", ["الأشجعي", "الأشجعية"], False),
    ("ghathafan", "غطفان", "Ghathafan", "arab", "Kabilah Qais 'Ailan; termasuk Fazarah, 'Abs, Dzubyan.", ["الغطفاني", "الفزاري", "الفزارية", "العبسي", "العبسية", "الذبياني", "المري"], False),
    ("daus", "دوس", "Daus", "arab", "Cabang al-Azd; kaum Abu Hurairah.", ["الدوسي", "الدوسية"], False),
    ("azd", "الأزد", "al-Azd", "arab", "Kabilah Qahthan besar dari Yaman/Oman.", ["الأزدي", "الأزدية", "البارقي", "اليحمدي", "العتكي"], False),
    ("kalb", "كلب", "Kalb", "arab", "Kabilah Qudha'ah; kaum Zaid bin Haritsah.", ["الكلبي", "الكلبية"], False),
    ("khuzaah", "خزاعة", "Khuza'ah", "arab", "Kabilah sekutu Nabi ﷺ di Makkah; termasuk Bani al-Mushthaliq.", ["الخزاعي", "الخزاعية", "المصطلقي", "المصطلقية", "الكعبي"], False),
    ("kinanah", "كنانة", "Kinanah", "arab", "Induk Quraisy; termasuk Bani Laits, Dhamrah, Ad-Du'il.", ["الكناني", "الكنانية", "الليثي", "الليثية", "الضمري", "الضمرية", "الديلي", "الدؤلي"], False),
    ("bajilah", "بجيلة", "Bajilah", "arab", "Kabilah Yaman; kaum Jarir bin Abdillah.", ["البجلي", "البجلية", "الأحمسي", "الأحمسية"], False),
    ("asad-k", "بنو أسد بن خزيمة", "Bani Asad bin Khuzaimah", "arab", "Kabilah Mudhar; kabilah Zainab binti Jahsy (sekutu Bani Umayyah).", ["الأسدي", "الأسدية"], False),
    ("thayyi", "طيء", "Thayyi'", "arab", "Kabilah Qahthan; kaum 'Adi bin Hatim.", ["الطائي", "الطائية"], False),
    ("kindah", "كندة", "Kindah", "arab", "Kabilah Yaman; kaum al-Asy'ats bin Qais.", ["الكندي", "الكندية", "السكوني"], False),
    ("hamdan", "همدان", "Hamdan", "arab", "Kabilah besar Yaman.", ["الهمداني", "الهمدانية", "الخارفي"], False),
    ("sulaim", "بنو سليم", "Bani Sulaim", "arab", "Kabilah Qais 'Ailan.", ["السلمي", "السلمية", "البهزي"], False),
    ("hawazin", "هوازن", "Hawazin", "arab", "Kabilah Qais 'Ailan; termasuk Bani 'Amir bin Sha'sha'ah, Hilal, Sa'd bin Bakr (kaum Halimah).", ["الهوازني", "العامري", "العامرية", "الهلالي", "الهلالية", "الكلابي", "القشيري", "الجعدي", "السلولي", "السعدية"], False),
    ("abdulqais", "عبد القيس", "Abdul Qais", "arab", "Kabilah Rabi'ah di Bahrain.", ["العبدي", "العبدية"], False),
    ("bakr", "بكر بن وائل", "Bakr bin Wa'il", "arab", "Kabilah Rabi'ah; termasuk Syaiban, Sadus, 'Ijl, Hanifah.", ["البكري", "الشيباني", "السدوسي", "العجلي", "الحنفي", "الربعي", "الضبعي", "الذهلي", "الرقاشي"], False),
    ("madzhij", "مذحج", "Madzhij", "arab", "Kabilah Qahthan; termasuk Nakha', Ju'fi, 'Ans, Murad.", ["المذحجي", "النخعي", "الجعفي", "العنسي", "الزبيدي", "المرادي"], False),
    ("himyar", "حمير وحضرموت", "Himyar & Hadhramaut", "arab", "Kabilah-kabilah Yaman selatan.", ["الحميري", "الحضرمي", "الكلاعي", "الرعيني", "الحبراني", "الجرشي", "اليزني"], False),
    ("qudhaah", "قضاعة", "Qudha'ah", "arab", "Rumpun kabilah termasuk Bali, 'Udzrah, Judzam.", ["القضاعي", "البلوي", "العذري", "العذرية", "الجذامي", "الجذمي"], False),
    ("lakhm", "لخم", "Lakhm", "arab", "Kabilah Qahthan; kaum Tamim ad-Dari.", ["اللخمي", "الداري"], False),
    ("khatsam", "خثعم", "Khats'am", "arab", "Kabilah Yaman; kaum Asma' binti 'Umais.", ["الخثعمي", "الخثعمية"], False),
    ("asyari", "الأشعريون", "al-Asy'ariyyun", "arab", "Kabilah Yaman; kaum Abu Musa al-Asy'ari.", ["الأشعري", "الأشعرية"], False),
    ("dhabbah", "ضبة", "Dhabbah", "arab", "Kabilah Mudhar (Rabab).", ["الضبي", "الضبية"], False),
    ("bahilah", "باهلة", "Bahilah", "arab", "Kabilah Qais 'Ailan.", ["الباهلي", "الباهلية"], False),
    ("ghani", "غني", "Ghani", "arab", "Kabilah Qais 'Ailan.", ["الغنوي", "الغنوية"], False),
    ("muharib", "محارب", "Muharib", "arab", "Kabilah Qais (Muharib bin Khashafah).", ["المحاربي"], False),
    ("persia", "فارس", "Persia", "ajam", "Sahabat keturunan Persia, seperti Salman al-Farisi.", ["الفارسي", "الفارسية", "الأسواري"], False),
    ("habasyah", "الحبشة والنوبة", "Habasyah", "ajam", "Sahabat keturunan Habasyah/Nubia, seperti Bilal bin Rabah.", ["الحبشي", "الحبشية", "النوبي"], False),
    ("rum", "الروم والقبط", "Romawi & Qibthi", "ajam", "Sahabat keturunan Romawi atau Qibthi (Mesir), seperti Shuhaib ar-Rumi dan Mariyah al-Qibthiyyah.", ["الرومي", "القبطي", "القبطية"], False),
]
TRIBE_BY_ID = {t[0]: t for t in TRIBES}


def classify_tribe(nisba: str):
    """Return (tribe_id, is_client, is_ally) from a Turath 'النسب' string."""
    raw = nisba or ""
    first_clause = re.split(r"(ويقال|وقيل|وفي |قال )", raw)[0]
    items = [x.strip(" .") for x in re.split(r"[،,]", first_clause) if x.strip(" .")]
    all_items = [x.strip(" .") for x in re.split(r"[،,]", raw) if x.strip(" .")]
    words = set()
    for x in items:
        words.update(x.split())
    is_quraysh = bool(words & {"القرشي", "القرشية", "القرشى"}) or "من قريش" in raw
    is_ansar = bool(words & {"الأنصاري", "الأنصارية"})
    client = "مولاهم" in raw or "مولى" in first_clause
    ally = "حليف" in raw
    for x in items:
        w = x.split()[0] if x.split() else ""
        for tid, _ar, _n, group, _d, nis, cond in TRIBES:
            if tid in ("quraisy", "anshar") or w not in nis:
                continue
            if cond is True and not is_quraysh:
                continue
            if cond == "ansar" and not is_ansar:
                continue
            if tid == "asad-k" and is_quraysh:
                continue
            if tid == "sulaim" and is_ansar:
                continue
            if tid == "hawazin" and w in ("العامري", "العامرية") and is_quraysh:
                continue
            return tid, client, ally
    if is_quraysh:
        return "quraisy", client, ally
    if is_ansar:
        return "anshar", client, ally
    # fall back to alternative clauses ("ويقال: الأسلمي")
    for x in all_items:
        x = re.sub(r"^(ويقال|وقيل|يقال|قيل)\s*:?\s*", "", x)
        w = x.split()[0] if x.split() else ""
        for tid, _ar, _n, _g, _d, nis, cond in TRIBES:
            if w in nis and cond is False:
                return tid, client, ally
    return None, client, ally
