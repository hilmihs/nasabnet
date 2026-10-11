#!/usr/bin/env python3
"""Validate cited tribe-role files (data/work/roles_out/<id>.json, see data/work/ROLES_SPEC.md).

Every src tag must parse to a page of a local book and its parallel quote must occur on that page
(or the next). Usage: python3 scripts/check_roles.py FILE [FILE…]   (no args = all files)
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import books  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "work" / "roles_out"
ROLE_KEYS = ["militer", "diplomasi", "ekonomi", "sosial"]
STATUS = {"ok", "rewritten", "new", "umum"}


def parse_tag(tag):
    """'Sirah Ibnu Hisyam 1/133' / "Jamharat Ansab al-'Arab, hlm. 15" -> (book id, vol, page)."""
    for bid, (fmt, multi) in books.TAGS.items():
        prefix = fmt.split("{")[0]
        if tag.startswith(prefix):
            rest = tag[len(prefix):]
            m = re.fullmatch(r"(\d+)/(\d+)", rest) if multi else re.fullmatch(r"(\d+)", rest)
            if m:
                return (bid, m.group(1), m.group(2)) if multi else (bid, "1", m.group(1))
    return None


def check_item(it, where, errs):
    if not isinstance(it, dict) or not (it.get("t") or "").strip():
        errs.append(f"{where}: missing text")
        return
    st = it.get("status")
    if st not in STATUS:
        errs.append(f"{where}: bad status {st!r}")
    src, quote = it.get("src") or [], it.get("quote") or []
    if st == "umum":
        if src:
            errs.append(f"{where}: status umum must not have src")
        return
    if not src:
        errs.append(f"{where}: status {st} needs src")
    if len(src) != len(quote):
        errs.append(f"{where}: src/quote length differ")
    for tag, q in zip(src, quote):
        ref = parse_tag(tag)
        if not ref:
            errs.append(f"{where}: unknown tag format {tag!r}")
            continue
        bid, vol, page = ref
        k = books.find_page(bid, vol, page)
        if k is None:
            errs.append(f"{where}: page not found {tag!r}")
            continue
        nq = books.norm(q).strip()
        if len(nq.split()) < 3:
            errs.append(f"{where}: quote too short {q!r}")
        elif not books.quote_on_page(bid, vol, page, q):
            errs.append(f"{where}: quote not on {tag}: {q[:60]!r}")


def check_file(f):
    errs = []
    try:
        d = json.loads(Path(f).read_text())
    except Exception as e:
        return [f"{f}: bad json {e}"]
    if d.get("id") != Path(f).stem:
        errs.append(f"{f}: id {d.get('id')!r} != file name")
    if d.get("lokasi"):
        check_item(d["lokasi"], f"{f}:lokasi", errs)
    for k in ROLE_KEYS:
        if not isinstance(d.get(k, []), list):
            errs.append(f"{f}:{k}: not a list")
            continue
        for i, it in enumerate(d.get(k, [])):
            check_item(it, f"{f}:{k}[{i}]", errs)
    return errs


def main():
    files = sys.argv[1:] or sorted(str(p) for p in OUT.glob("*.json"))
    errs = [e for f in files for e in check_file(f)]
    print("\n".join(errs) if errs else f"ALL OK ({len(files)} files)")
    sys.exit(1 if errs else 0)


if __name__ == "__main__":
    main()
