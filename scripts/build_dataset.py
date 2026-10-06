#!/usr/bin/env python3
"""Merge Turath narrator data + extracted Ibn Sa'd / narrator relations into web/public/data/nasabnet.json.

Inputs
  data/raw/narrators_list.json, data/raw/narrators/<id>.json   (crawl_turath.py)
  data/work/ibnsad_entries.json                               (extract_ibnsad.py)
  data/work/extracted/{ibnsad,narr}_*.json                     (structured extraction, see EXTRACTION_SPEC.md)
  data/curated.json                                           (Prophet ﷺ + core family links with citations)

Pipeline
  1. register people: curated -> companion narrators -> Ibn Sa'd subjects (merged by nasab keys)
  2. resolve every relative mentioned in the extractions to a person (or create a stub)
  3. derive tribe, categories, patrilineal line; validate; write JSON
"""
import glob
import itertools
import json
import re
from collections import defaultdict
from datetime import date
from pathlib import Path

from nasab import TRIBES, classify_tribe, expand_prophet, extend_chain, norm, parse_chain, pick_name_segment

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
WORK = ROOT / "data" / "work"
OUT = ROOT / "web" / "public" / "data" / "nasabnet.json"

IBNSAD_BOOK = 9351
COMPANION_RANK = re.compile(r"(?:^|[\s،,(])(?:صحابي|صحابية)|له صحبة|له رؤية|صحبته|أم المؤمنين|أحد العشرة|احد العشرة")
FEMALE_RANK = {"صحابية", "مقبولة", "مستورة", "لا تعرف", "مجهولة", "لا يعرف حالها", "ثقة فقيهة"}


def ibnsad_src(vol, page):
    return {"t": f"Ibnu Sa'd, ath-Thabaqat al-Kubra {vol}/{page}", "url": f"https://app.turath.io/book/{IBNSAD_BOOK}?print_page={vol},{page}"}


def narr_src(nid, name):
    return {"t": f"Turath · data rawi: {name}", "url": f"https://app.turath.io/narrator/{nid}"}


# --------------------------------------------------------------------------- keys
def chain_of(text):
    ism, line = parse_chain(text)
    return ism, line


DESCRIPTOR = re.compile(r"\s+(الاكبر|الاصغر|الاوسط|الكبري|الصغري|ال\S{3,}ي|ال\S{3,}يه)$")


def clean_link(name):
    """'خالد الأكبر' -> 'خالد', 'حاطب الجمحي' -> 'حاطب' (single-word names untouched)."""
    n = norm(name)
    while " " in n and DESCRIPTOR.search(n) and not n.startswith(("عبد ", "ابو ", "ام ")) or (" " in n and re.search(r"\s(الاكبر|الاصغر|الاوسط)$", n)):
        n2 = DESCRIPTOR.sub("", n)
        if n2 == n:
            break
        n = n2
    return n


def link_names(link):
    out = [clean_link(link["ar"])]
    if link.get("alias"):
        out.append(clean_link(link["alias"]))
    return out


def keys_for(ism, line, depth):
    if not ism or len(line) < depth - 1:
        return set()
    names = [[clean_link(ism)]] + [link_names(l) for l in line[: depth - 1]]
    return {"|".join(c) for c in itertools.product(*names)}


def guess_gender(text, rank=""):
    seg = pick_name_segment(text or "")
    if re.match(r"^(أم|ام|ابنة|بنت)\s", seg) or re.match(r"^\S+(\s\S+)?\s+بنت\s", seg):
        return "f"
    if (rank or "").strip(" .") in FEMALE_RANK:
        return "f"
    return "m"


# rough fallback transliteration (only used when no extracted Latin form exists)
TR = {"ا": "a", "أ": "a", "إ": "i", "آ": "a", "ب": "b", "ت": "t", "ث": "ts", "ج": "j", "ح": "h", "خ": "kh", "د": "d", "ذ": "dz", "ر": "r", "ز": "z", "س": "s", "ش": "sy", "ص": "sh", "ض": "dh", "ط": "th", "ظ": "zh", "ع": "'", "غ": "gh", "ف": "f", "ق": "q", "ك": "k", "ل": "l", "م": "m", "ن": "n", "ه": "h", "و": "w", "ي": "y", "ى": "a", "ة": "ah", "ء": "'", "ؤ": "'", "ئ": "'"}


def translit(ar):
    words = []
    for w in norm(ar).split():
        if w == "بن":
            words.append("bin")
        elif w == "بنت":
            words.append("binti")
        else:
            t = "".join(TR.get(c, c) for c in w)
            t = re.sub(r"^al", "al-", t) if w.startswith("ال") else t
            words.append(t[:1].upper() + t[1:])
    return " ".join(words)


# --------------------------------------------------------------------------- registry
class Registry:
    def __init__(self):
        self.p = {}  # pid -> person dict
        self.k3 = defaultdict(set)
        self.k2 = defaultdict(set)
        self.alias = defaultdict(set)
        self.pool3 = defaultdict(set)  # all narrators (not yet registered)
        self.pool_rows = {}
        self.edges = {}
        self.stub_n = 0

    # people ------------------------------------------------------------
    def add(self, pid, **kw):
        base = {"id": pid, "ar": "", "lat": "", "g": "m", "cats": set(), "comp": False, "src": [], "flags": set(), "chains": [], "others": []}
        base.update(kw)
        self.p[pid] = base
        return base

    def index(self, pid, text, ism=None, line=None):
        if ism is None:
            ism, line = chain_of(text)
        if not ism:
            return
        self.p[pid]["chains"].append((ism, line))
        for k in keys_for(ism, line, 3):
            self.k3[k].add(pid)
        for k in keys_for(ism, line, 2):
            self.k2[k].add(pid)

    def add_alias(self, pid, *names):
        for n in names:
            n = norm(expand_prophet(n or ""))
            if n and len(n) > 4:
                self.alias[n].add(pid)

    def add_src(self, pid, src):
        if src and src not in self.p[pid]["src"]:
            self.p[pid]["src"].append(src)

    # resolution ----------------------------------------------------------
    def _pick(self, cands, g):
        c = [x for x in cands if not g or self.p[x]["g"] == g]
        if len(c) == 1:
            return c[0]
        comp = [x for x in c if self.p[x]["comp"] and not x.startswith("x")]
        if len(comp) == 1:
            return comp[0]
        return None

    def resolve(self, text, g=None, create=True, lat=None, src=None):
        hit = self._resolve(text, g, create, lat, src)
        if hit and lat and hit in self.p and not self.p[hit].get("mlat"):
            self.p[hit]["mlat"] = lat
        return hit

    def _resolve(self, text, g=None, create=True, lat=None, src=None):
        if not text:
            return None
        t = expand_prophet(text).strip()
        if norm(t) in ("محمد بن عبد الله بن عبد المطلب", "محمد"):
            return "nabi"
        al = self.alias.get(norm(t))
        if al:
            hit = self._pick(al, g)
            if hit:
                return hit
        ism, line = chain_of(t)
        if not ism:
            return None
        k3 = keys_for(ism, line, 3)
        k2 = keys_for(ism, line, 2)
        cands = set().union(*(self.k3.get(k, set()) for k in k3)) if k3 else set()
        hit = self._pick(cands, g) if cands else None
        if hit:
            return hit
        if k2 and (len(line) <= 1 or not cands):
            c2 = set().union(*(self.k2.get(k, set()) for k in k2))
            # a 3-link mention may only merge into a 2-link record (never two diverging 3-link chains)
            if len(line) >= 2:
                c2 = {x for x in c2 if all(len(l) <= 1 for _, l in self.p[x]["chains"])}
            hit = self._pick(c2, g) if c2 else None
            if hit:
                return hit
        # a narrator not yet registered (tabi'i child, relative…)
        if k3:
            pool = set().union(*(self.pool3.get(k, set()) for k in k3))
            pool = {x for x in pool if not g or guess_gender(self.pool_rows[x]["full_name"]) == g}
            if len(pool) == 1:
                nid = pool.pop()
                return self.register_narrator(self.pool_rows[nid], comp=False)
        if not create:
            return None
        self.stub_n += 1
        pid = f"x{self.stub_n}"
        self.add(pid, ar=re.sub(r"\s+", " ", t)[:80], lat=lat or translit(t), g=g or guess_gender(t))
        self.index(pid, t, ism, line)
        if src:
            self.add_src(pid, src)
        return pid

    def register_narrator(self, row, comp):
        pid = f"n{row['id']}"
        if pid in self.p:
            return pid
        det = {}
        f = RAW / "narrators" / f"{row['id']}.json"
        if f.exists():
            det = json.loads(f.read_text())
        s = dict(det.get("summary", []))
        rank = row.get("rank") or s.get("الرتبة عند ابن حجر", "")
        ism, line = chain_of(row["full_name"])
        name_ar = pick_name_segment(row["full_name"]).split("،")[0]
        short = row["name"]
        self.add(
            pid,
            ar=short if len(short) < len(name_ar) + 6 else name_ar,
            full=row["full_name"],
            kunya=s.get("الكنية") or None,
            laqab=s.get("اللقب") or s.get("الشهرة") or None,
            g=guess_gender(row["full_name"], rank) if not short.startswith("أم ") else "f",
            nisba=s.get("النسب") or None,
            place=s.get("بلد الإقامة") or None,
            death=row.get("death_text") or None,
            rank=(s.get("طبقة رواة التقريب") or rank or None),
            comp=comp,
            rel=s.get("علاقات الراوي") or None,
            narrator=row["id"],
        )
        self.index(pid, row["full_name"], ism, line)
        self.add_alias(pid, short)
        kun = s.get("الكنية", "").split("،")[0].strip()
        laq = (s.get("اللقب") or s.get("الشهرة") or "").split("،")[0].strip()
        if kun and laq:
            self.add_alias(pid, f"{kun} {laq}")
        if kun and line:
            self.add_alias(pid, f"{kun} بن {line[0]['ar']}")
        self.add_src(pid, narr_src(row["id"], short))
        return pid

    # edges -----------------------------------------------------------------
    def edge(self, s, t, k, src=None, n=None):
        if not s or not t or s == t:
            return
        if k in ("spouse", "sibling", "muakhah", "milk"):
            a, b = sorted([s, t])
        else:
            a, b = s, t
        key = (a, b, k)
        if key in self.edges:
            if n and not self.edges[key].get("n"):
                self.edges[key]["n"] = n
            return
        e = {"s": a, "t": b, "k": k}
        if n:
            e["n"] = n
        if src:
            e["src"] = src
        self.edges[key] = e


# --------------------------------------------------------------------------- tribes from chains
CLAN_PAIRS = {
    ("عبد المطلب", "هاشم"): "hasyim", ("هاشم", "عبد مناف"): "hasyim", ("ابو طالب", "عبد المطلب"): "hasyim",
    ("المطلب", "عبد مناف"): "muthalib",
    ("اميه", "عبد شمس"): "umayyah", ("عبد شمس", "عبد مناف"): "umayyah", ("ربيعه", "عبد شمس"): "umayyah",
    ("نوفل", "عبد مناف"): "naufal",
    ("اسد", "عبد العزي"): "asad", ("خويلد", "اسد"): "asad",
    ("عبد الدار", "قصي"): "abduddar",
    ("زهره", "كلاب"): "zuhrah", ("عبد مناف", "زهره"): "zuhrah",
    ("تيم", "مره"): "taim", ("سعد", "تيم"): "taim",
    ("مخزوم", "يقظه"): "makhzum", ("عمر", "مخزوم"): "makhzum",
    ("عدي", "كعب"): "adi", ("رزاح", "عدي"): "adi",
    ("سهم", "عمرو"): "sahm", ("سعد", "سهم"): "sahm",
    ("جمح", "عمرو"): "jumah", ("حذافه", "جمح"): "jumah",
    ("عامر", "لوي"): "amir", ("حسل", "عامر"): "amir",
    ("الحارث", "فهر"): "fihr", ("محارب", "فهر"): "fihr",
    ("النجار", "ثعلبه"): "khazraj", ("سلمه", "سعد"): "khazraj", ("زريق", "عامر"): "khazraj", ("ساعده", "كعب"): "khazraj", ("بياضه", "عامر"): "khazraj",
    ("عبد الاشهل", "جشم"): "aus", ("ظفر", "الخزرج"): "aus", ("حارثه", "الحارث"): "aus",
    ("تميم", "مر"): "tamim", ("عبد مناه", "كنانه"): "kinanah", ("ليث", "بكر"): "kinanah", ("ضمره", "بكر"): "kinanah",
    ("اسد", "خزيمه"): "asad-k", ("سليم", "منصور"): "sulaim", ("ثقيف", "منبه"): "tsaqif", ("هذيل", "مدركه"): "hudzail",
    ("غفار", "مليل"): "ghifar", ("دوس", "عدثان"): "daus", ("صعصعه", "معاويه"): "hawazin", ("هلال", "عامر"): "hawazin",
}
CLAN_SINGLE = {"النجار": "khazraj", "الخزرج": "khazraj", "الاوس": "aus", "عبد الاشهل": "aus", "ثقيف": "tsaqif", "هذيل": "hudzail", "غفار": "ghifar", "مزينه": "muzainah", "جهينه": "juhainah", "خزاعه": "khuzaah", "دوس": "daus", "اسلم بن افصي": "aslam"}
HINT_WORDS = [
    ("هاشم", "hasyim"), ("المطلب بن عبد مناف", "muthalib"), ("أمية", "umayyah"), ("عبد شمس", "umayyah"), ("نوفل", "naufal"), ("أسد بن عبد العزى", "asad"),
    ("عبد الدار", "abduddar"), ("زهرة", "zuhrah"), ("تيم", "taim"), ("مخزوم", "makhzum"), ("عدي بن كعب", "adi"), ("سهم", "sahm"), ("جمح", "jumah"),
    ("عامر بن لؤي", "amir"), ("الحارث بن فهر", "fihr"), ("النجار", "khazraj"), ("الخزرج", "khazraj"), ("الأوس", "aus"), ("عبد الأشهل", "aus"),
    ("سلمة", "khazraj"), ("ساعدة", "khazraj"), ("زريق", "khazraj"), ("ظفر", "aus"), ("عمرو بن عوف", "aus"), ("حارثة", "aus"), ("الأشهل", "aus"),
    ("تميم", "tamim"), ("ثقيف", "tsaqif"), ("هذيل", "hudzail"), ("غفار", "ghifar"), ("أسلم بن أفصى", "aslam"), ("أسلم", "aslam"), ("جهينة", "juhainah"), ("مزينة", "muzainah"),
    ("أشجع", "asyja"), ("غطفان", "ghathafan"), ("فزارة", "ghathafan"), ("عبس", "ghathafan"), ("دوس", "daus"), ("الأزد", "azd"), ("كلب", "kalb"),
    ("خزاعة", "khuzaah"), ("كنانة", "kinanah"), ("ليث", "kinanah"), ("بجيلة", "bajilah"), ("أسد بن خزيمة", "asad-k"), ("طيء", "thayyi"), ("كندة", "kindah"),
    ("همدان", "hamdan"), ("سليم", "sulaim"), ("هوازن", "hawazin"), ("عامر بن صعصعة", "hawazin"), ("عبد القيس", "abdulqais"), ("بكر بن وائل", "bakr"),
    ("مذحج", "madzhij"), ("حمير", "himyar"), ("قضاعة", "qudhaah"), ("بلي", "qudhaah"), ("لخم", "lakhm"), ("خثعم", "khatsam"), ("الأشعر", "asyari"),
    ("فارس", "persia"), ("الحبشة", "habasyah"), ("الروم", "rum"), ("قريش", "quraisy"), ("الأنصار", "anshar"),
]


def tribe_from_chain(names):
    n = [norm(x) for x in names]
    for i in range(len(n)):
        if i + 1 < len(n) and (n[i], n[i + 1]) in CLAN_PAIRS:
            return CLAN_PAIRS[(n[i], n[i + 1])]
        if n[i] in CLAN_SINGLE:
            return CLAN_SINGLE[n[i]]
    return None


def tribe_from_hint(text):
    if not text:
        return None
    # pair detection first ("بني عدي بن كعب")
    names = [x for x in re.split(r"\s+(?:بن|ابن)\s+", re.sub(r"^.*?(?:بني|بنو)\s+", "", text)) if x]
    t = tribe_from_chain([x.split("(")[0].strip() for x in names])
    if t:
        return t
    for w, tid in HINT_WORDS:
        if re.search(rf"(?:^|\s|\()(?:بني|بنو|من|حلفاء|حليف)?\s*{re.escape(w)}(?=$|[\s،,.)])", text) and (
            w in ("قريش", "الأنصار", "الأوس", "الخزرج") or re.search(rf"(?:بني|بنو|من|حلفاء|حليف)\s+{re.escape(w)}(?=$|[\s،,.)])", text)
        ):
            return tid
    return None


# --------------------------------------------------------------------------- load
def load_extracted(prefix):
    out = {}
    for f in sorted(glob.glob(str(WORK / "extracted" / f"{prefix}_*.json"))):
        try:
            arr = json.loads(Path(f).read_text())
        except json.JSONDecodeError as e:
            print("!! bad json", f, e)
            continue
        for r in arr:
            if isinstance(r, dict) and r.get("id"):
                out[r["id"]] = r
    return out


def ibnsad_full_chain(entry):
    """title + opening nasab line, e.g. 'عمر بن الخطاب' + 'ابن نفيل بن عبد العزى …'."""
    lines = entry["text"].split("\n")
    title = entry["title"]
    rest = lines[1] if len(lines) > 1 else ""
    rest = re.sub(r"^[^ابو]*?(?=(ابن|بن|بنت|وهي|وهو)\s)", "", re.sub(r"[﵀-﷿]", "", rest)).strip(" ،")
    rest = re.sub(r"^(وهي|وهو)\s+", "", rest)
    rest = re.split(r"[،.]|\sوأم|\sويكنى|\sوكان|\sتزوج|\sأسلم", rest)[0]
    if rest.startswith(("ابن ", "بن ")):
        return f"{title} بن {rest.split(' ', 1)[1]}"
    if rest.startswith("بنت "):
        return f"{title} {rest}"
    return None


def main():
    R = Registry()
    rows = json.loads((RAW / "narrators_list.json").read_text())
    by_id = {r["id"]: r for r in rows}

    # ---- 1. curated core
    cur = json.loads((ROOT / "data" / "curated.json").read_text())
    for c in cur["persons"]:
        pid = c["id"]
        R.add(pid, ar=c["ar"], lat=c["lat"], full=c.get("full"), g=c["g"], comp=c.get("comp", False), tribe=c.get("tribe"), note=c.get("note"), kunya=c.get("kunya"), laqab=c.get("laqab"), death=c.get("death"))
        R.index(pid, c.get("full") or c["ar"])
        for a in c.get("aliases", []):
            R.add_alias(pid, a)
            R.index(pid, a)
        for s in c.get("src", []):
            R.add_src(pid, s)
        if c.get("cats"):
            R.p[pid]["cats"].update(c["cats"])
        if c.get("narrator"):
            R.p[pid]["narrator"] = c["narrator"]

    # ---- 2. companion narrators
    for r in rows:
        f = RAW / "narrators" / f"{r['id']}.json"
        s = dict(json.loads(f.read_text()).get("summary", [])) if f.exists() else {}
        tab = s.get("طبقة رواة التقريب", "")
        rank = " ".join([r.get("rank") or "", s.get("الرتبة عند ابن حجر", ""), s.get("الرتبة عند الذهبي", "")])
        if COMPANION_RANK.search(tab) or COMPANION_RANK.search(rank):
            R.register_narrator(r, comp=True)
    # every other narrator is available for resolution of relatives
    for r in rows:
        if f"n{r['id']}" in R.p:
            continue
        ism, line = chain_of(r["full_name"])
        for k in keys_for(ism, line, 3):
            R.pool3[k].add(r["id"])
        R.pool_rows[r["id"]] = r

    def cur_ref(ref):
        if ref in R.p:
            return ref
        if re.fullmatch(r"n\d+", ref) and int(ref[1:]) in by_id:
            return R.register_narrator(by_id[int(ref[1:])], comp=True)
        return R.resolve(ref, create=False)

    # narrators referenced by the curated layer are companions/family even without a tabaqa label
    for key in ("ummahat", "khulafa", "asyarah", "ahlulbait", "muhajirin"):
        for ref in cur[key]:
            cur_ref(ref)
    for e in cur["edges"]:
        for ref in (e["s"], e["t"]):
            if re.fullmatch(r"n\d+", ref):
                cur_ref(ref)

    # curated persons that are also narrators: fold the narrator into the curated node
    for c in cur["persons"]:
        nid = c.get("narrator")
        if nid and f"n{nid}" in R.p:
            merge(R, f"n{nid}", c["id"])

    narr_ex = load_extracted("narr")
    ib_ex = load_extracted("ibnsad")
    ib_entries = {f"is{e['i']}": e for e in json.loads((WORK / "ibnsad_entries.json").read_text())}

    # narrator extraction: Latin names / gender / kunya for companions
    for rid, x in narr_ex.items():
        pid = rid if rid in R.p else None
        if not pid:
            continue
        sub = x.get("subject") or {}
        if sub.get("lat") and not R.p[pid]["lat"]:
            R.p[pid]["lat"] = sub["lat"]
        if sub.get("g") in ("m", "f"):
            R.p[pid]["g"] = sub["g"]
        if sub.get("ar"):
            R.index(pid, sub["ar"])
        if x.get("kunya") and not R.p[pid].get("kunya"):
            R.p[pid]["kunya"] = x["kunya"]

    # ---- 3. Ibn Sa'd subjects
    ib_pid = {}
    for rid, x in ib_ex.items():
        if x.get("skip") or not x.get("subject") or not (x["subject"] or {}).get("ar"):
            continue
        e = ib_entries.get(rid)
        if not e:
            continue
        sub = x["subject"]
        g = sub.get("g") if sub.get("g") in ("m", "f") else None
        pid = R.resolve(sub["ar"], g=g, create=False)
        full = ibnsad_full_chain(e)
        if not pid and full:
            pid = R.resolve(full, g=g, create=False)
        if not pid:
            pid = f"s{e['i']}"
            R.add(pid, ar=re.sub(r"\s+", " ", sub["ar"]), lat=sub.get("lat") or translit(sub["ar"]), g=g or guess_gender(sub["ar"]), full=full)
        P = R.p[pid]
        if not P["lat"] and sub.get("lat"):
            P["lat"] = sub["lat"]
        R.index(pid, sub["ar"])
        if full:
            R.index(pid, full)
            if not P.get("full"):
                P["full"] = full
        if x.get("kunya") and not P.get("kunya"):
            P["kunya"] = x["kunya"]
            R.add_alias(pid, x["kunya"])
        vol, page = e["vol"], e["page"]
        P["comp"] = P["comp"] or vol in ("3", "4") or (vol == "8" and page < 461)
        R.add_src(pid, ibnsad_src(vol, page))
        P.setdefault("ibnsad", []).append((vol, page, e.get("ctx", ""), x.get("tribe_hint")))
        ib_pid[rid] = pid

    # ---- 4. relations
    def apply(pid, x, src):
        P = R.p[pid]
        g = P["g"]
        fl = x.get("flags") or {}
        for k, v in fl.items():
            if v is True:
                P["flags"].add(k)
        def res(m, gender=None):
            if not m or not m.get("ar"):
                return None
            gg = m.get("g") if m.get("g") in ("m", "f") else gender
            return R.resolve(m["ar"], g=gg, lat=m.get("lat"), src=src)
        fa = res(x.get("father"), "m")
        mo = res(x.get("mother"), "f")
        R.edge(fa, pid, "parent", src)
        R.edge(mo, pid, "parent", src)
        if fa and mo:
            R.edge(fa, mo, "spouse", src)
        spouse_ids = {}
        for s in x.get("spouses") or []:
            sid = res(s, "f" if g == "m" else "m")
            if sid:
                spouse_ids[norm(s["ar"])] = sid
                R.edge(pid, sid, "spouse", src, (s.get("note") or None))
        for c in x.get("children") or []:
            cid = res(c)
            if not cid:
                continue
            R.edge(pid, cid, "parent", src)
            mother = c.get("mother")
            if mother and "أم ولد" not in mother:
                mid = spouse_ids.get(norm(mother)) or R.resolve(mother, g="f", src=src)
                if mid and mid != pid:
                    R.edge(mid, cid, "parent", src)
                    if g == "m":
                        R.edge(pid, mid, "spouse", src)
            if g == "f":
                # child's father = the spouse whose name opens the child's patronymic
                _, cl = chain_of(c["ar"])
                if cl:
                    fname = norm(cl[0]["ar"])
                    for sname, sid in spouse_ids.items():
                        if sname.split(" بن ")[0].strip() == fname or norm(R.p[sid]["ar"]).startswith(fname):
                            R.edge(sid, cid, "parent", src)
                            break
        for s in x.get("siblings") or []:
            R.edge(pid, res(s), "sibling", src, s.get("note") or None)
        for m in x.get("muakhah") or []:
            R.edge(pid, res(m), "muakhah", src)
        if x.get("patron"):
            pat = x["patron"] if isinstance(x["patron"], dict) else {"ar": x["patron"]}
            R.edge(res(pat), pid, "mawla", src)
        for c in x.get("clients") or []:
            R.edge(pid, res(c), "mawla", src)
        for o in x.get("other") or []:
            if o.get("ar"):
                P["others"].append(f"{o.get('rel', 'kerabat')}: {o.get('lat') or o['ar']}")

    for rid, x in ib_ex.items():
        if rid in ib_pid:
            e = ib_entries[rid]
            apply(ib_pid[rid], x, ibnsad_src(e["vol"], e["page"]))
    for rid, x in narr_ex.items():
        if rid in R.p:
            nid = int(rid[1:])
            apply(rid, x, narr_src(nid, by_id[nid]["name"]))

    # curated edges
    for e in cur["edges"]:
        s = cur_ref(e["s"])
        t = cur_ref(e["t"])
        if not s or not t:
            print("!! curated edge unresolved", e["s"], e["t"])
            continue
        R.edge(s, t, e["k"], e.get("src"), e.get("n"))

    finalize(R, cur)


def merge(R, src_pid, dst_pid):
    """Fold person src into dst (keys, sources, edges)."""
    if src_pid == dst_pid or src_pid not in R.p:
        return
    S, D = R.p[src_pid], R.p[dst_pid]
    for k in ("full", "kunya", "laqab", "nisba", "place", "death", "rank", "rel", "narrator"):
        if S.get(k) and not D.get(k):
            D[k] = S[k]
    D["comp"] = D["comp"] or S["comp"]
    for s in S["src"]:
        if s not in D["src"]:
            D["src"].append(s)
    for idx in (R.k3, R.k2, R.alias):
        for v in idx.values():
            if src_pid in v:
                v.discard(src_pid)
                v.add(dst_pid)
    D["chains"] += S["chains"]
    del R.p[src_pid]


def finalize(R, cur):
    P = R.p
    edges = list(R.edges.values())

    # marriages to the Prophet ﷺ: only the Ummahatul Mukminin (+ Mariyah) are asserted as edges; the other
    # women Ibn Sa'd lists (proposals, disputed or unconsummated contracts) become a note on the person
    wives_ok = set(cur["ummahat"]) | {"c-mariyah"}
    kept = []
    for e in edges:
        if e["k"] == "spouse" and "nabi" in (e["s"], e["t"]):
            other = e["t"] if e["s"] == "nabi" else e["s"]
            if other not in wives_ok:
                P[other]["others"].append("disebut dalam bab istri-istri Nabi ﷺ (dilamar / akad yang diperselisihkan, bukan Ummahatul Mukminin)")
                continue
        kept.append(e)
    edges = kept

    # parents per person
    parents = defaultdict(list)
    for e in edges:
        if e["k"] == "parent":
            parents[e["t"]].append(e["s"])

    # drop impossible parent edges: >1 father or >1 mother keeps the first, and no cycles
    keep = []
    seen_par = defaultdict(set)
    for e in edges:
        if e["k"] == "parent":
            gk = (e["t"], P[e["s"]]["g"])
            if seen_par[gk] and e["s"] not in seen_par[gk]:
                continue
            seen_par[gk].add(e["s"])
        keep.append(e)
    edges = keep
    father = {}
    for e in edges:
        if e["k"] == "parent" and P[e["s"]]["g"] == "m":
            father[e["t"]] = e["s"]

    def is_ancestor(a, b, depth=0):
        while b in father and depth < 60:
            b = father[b]
            if b == a:
                return True
            depth += 1
        return False

    bad = {(f, c) for c, f in father.items() if is_ancestor(c, f)}
    edges = [e for e in edges if not (e["k"] == "parent" and (e["s"], e["t"]) in bad)]
    for f, c in bad:
        father.pop(c, None)

    # ---- patrilineal lines
    def best_chain(pid):
        ch = [c for c in P[pid]["chains"] if c[0]]
        if not ch:
            return "", []
        return max(ch, key=lambda c: len(c[1]))

    memo = {}

    def line_of(pid, stack=()):
        if pid in memo:
            return memo[pid]
        if pid in stack:
            return []
        ism, own = best_chain(pid)
        own = [dict(x) for x in own]
        f = father.get(pid)
        if f:
            fism, _ = best_chain(f)
            fl = line_of(f, stack + (pid,))
            cand = [{"ar": fism or P[f]["ar"], "id": f}] + fl
            if len(cand) >= len(own):
                own = cand
            elif own:
                own[0]["id"] = f
        else:
            own = extend_chain(own)
        memo[pid] = own
        return own

    for pid in P:
        line_of(pid)

    # attach ids to ancestors that exist as people (match on name + father's name)
    for pid in P:
        ln = memo[pid]
        for i, l in enumerate(ln):
            if l.get("id"):
                continue
            names = [l["ar"]] + [x["ar"] for x in ln[i + 1 : i + 3]]
            if len(names) >= 3:
                k = "|".join(norm(n) for n in names[:3])
                c = R.k3.get(k, set())
                if len(c) == 1:
                    cid = next(iter(c))
                    if cid != pid and cid in P:
                        l["id"] = cid

    # ---- tribes
    for pid, X in P.items():
        if X.get("tribe"):
            continue
        t = None
        if X.get("nisba"):
            t, client, ally = classify_tribe(X["nisba"])
            if client:
                X["flags"].add("client")
        if not t:
            t = tribe_from_chain([l["ar"] for l in memo[pid]])
        if not t:
            for vol, page, ctx, hint in X.get("ibnsad", []):
                t = tribe_from_hint(ctx) or tribe_from_hint(hint)
                if t:
                    break
        X["tribe"] = t
    own_tribe = {pid for pid, X in P.items() if X.get("tribe")}
    # a father with no recorded nisba belongs to the tribe his child is recorded under (patrilineal)
    for c, f in father.items():
        if c in own_tribe and not P[f].get("tribe"):
            P[f]["tribe"] = P[c]["tribe"]
    for _ in range(6):  # then inherit downwards from fathers
        for pid, X in P.items():
            if not X.get("tribe") and pid in father and P[father[pid]].get("tribe"):
                X["tribe"] = P[father[pid]]["tribe"]

    # ---- categories
    group = {t[0]: t[3] for t in TRIBES}
    nabi_wives = {e["t"] if e["s"] == "nabi" else e["s"] for e in edges if e["k"] == "spouse" and "nabi" in (e["s"], e["t"])}
    nabi_children = {e["t"] for e in edges if e["k"] == "parent" and e["s"] == "nabi"}
    ummahat = set(cur["ummahat"])
    for pid in nabi_wives:
        if pid in ummahat or P[pid]["ar"] and any(norm(P[pid]["ar"]).startswith(norm(u)) for u in cur.get("ummahat_names", [])):
            P[pid]["cats"].add("ummahat")
    for pid in ummahat:
        if pid in P:
            P[pid]["cats"].add("ummahat")
    for pid in cur["khulafa"]:
        P[pid]["cats"].update({"khulafa", "asyarah"})
    for pid in cur["asyarah"]:
        P[pid]["cats"].add("asyarah")
    grandchildren = {e["t"] for e in edges if e["k"] == "parent" and e["s"] in nabi_children}
    for pid in {*nabi_children, *grandchildren, *(x for x in nabi_wives if "ummahat" in P[x]["cats"]), *cur["ahlulbait"]}:
        if pid in P:
            P[pid]["cats"].add("ahlulbait")
    for pid, X in P.items():
        fl = X["flags"]
        grp = group.get(X.get("tribe") or "")
        if X.get("tribe") in ("hasyim", "muthalib") and pid != "nabi":
            X["cats"].add("kerabat")
        in_vol3 = any(v == "3" for v, *_ in X.get("ibnsad", []))
        if "badr" in fl or in_vol3:
            X["cats"].add("badar")
        if X["comp"] and (grp == "anshar" or ("anshar" in fl and grp != "quraisy")):
            X["cats"].add("anshar")
        elif X["comp"] and ("muhajir" in fl or "habasyah" in fl or (grp == "quraisy" and ("badr" in fl or in_vol3))):
            if "fath_convert" not in fl:
                X["cats"].add("muhajirin")
    for pid in cur.get("muhajirin", []):
        if pid in P:
            P[pid]["cats"].add("muhajirin")

    # display names for people best known by kunya/laqab (curated)
    for ref, lat, ar in cur.get("display", []):
        if ref in P:
            P[ref]["lat"], P[ref]["ar"] = lat, ar

    # ---- output
    order = ["khulafa", "ahlulbait", "ummahat", "asyarah", "kerabat", "muhajirin", "anshar", "badar"]
    persons = []
    used = {e["s"] for e in edges} | {e["t"] for e in edges}
    for pid, X in P.items():
        if not (X["comp"] or pid in used or X.get("narrator") or pid in ("nabi",)):
            continue
        line = [{k: v for k, v in l.items() if k in ("ar", "id", "canon")} for l in memo[pid]]
        line = [l for l in line if l.get("id") in P or "id" not in l]
        note = X.get("note") or ""
        if X["others"]:
            note = (note + " " if note else "") + "Kerabat lain menurut sumber — " + "; ".join(dict.fromkeys(X["others"]))[:600]
        rec = {
            "id": pid,
            "ar": X["ar"],
            "lat": X["lat"] or X.get("mlat") or translit(X["ar"]),
            "g": X["g"],
            "cats": [c for c in order if c in X["cats"]],
            "comp": bool(X["comp"]),
            "line": line,
            "src": X["src"],
        }
        for k in ("full", "kunya", "laqab", "tribe", "death", "rank", "nisba", "place", "rel"):
            if X.get(k):
                rec[k] = X[k]
        if note:
            rec["note"] = note
        persons.append(rec)
    ids = {p["id"] for p in persons}
    edges = [e for e in edges if e["s"] in ids and e["t"] in ids]
    tribes = [{"id": t[0], "ar": t[1], "name": t[2], "group": t[3], "desc": t[4]} for t in TRIBES]
    kinds = defaultdict(int)
    for e in edges:
        kinds[e["k"]] += 1
    counts = {
        "tokoh": len(persons),
        "sahabat": sum(p["comp"] for p in persons),
        "relasi": len(edges),
        "pernikahan": kinds["spouse"],
        "orang tua–anak": kinds["parent"],
        "mu'akhah": kinds["muakhah"],
        "kabilah": len({p.get("tribe") for p in persons if p.get("tribe")}),
    }
    data = {
        "meta": {
            "generated": date.today().isoformat(),
            "source": "Dikompilasi dari basis data rawi Turath.io (api.turath.io: nasab, nisbah, kunyah, relasi keluarga, wafat) dan teks ath-Thabaqat al-Kubra Ibnu Sa'd (Turath #9351, jilid 1, 3, 4, 8: daftar istri, anak, dan mu'akhah), diekstrak terstruktur lalu dicocokkan antarsumber berdasarkan rantai nasab. Setiap tautan menyimpan rujukan halamannya.",
            "counts": counts,
        },
        "tribes": tribes,
        "persons": sorted(persons, key=lambda p: (p["id"] != "nabi", not p["comp"], p["lat"])),
        "edges": edges,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    print(json.dumps(counts, ensure_ascii=False))
    print("tribes:", {t: sum(1 for p in persons if p.get("tribe") == t) for t in sorted({p.get('tribe') for p in persons if p.get('tribe')})})
    print("no tribe:", sum(1 for p in persons if not p.get("tribe")), "stubs:", sum(1 for p in persons if p["id"].startswith("x")))
    print("size:", round(OUT.stat().st_size / 1024), "KB")


if __name__ == "__main__":
    main()
