#!/usr/bin/env python3
"""Validate finder output data/work/bio_batches/bio_fN.jsonl (see data/work/FIND_SPEC.md): every excerpt's tag must
name a real page and every paragraph of the excerpt must occur verbatim on that page (or the next one)."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import books  # noqa: E402
from check_roles import parse_tag  # noqa: E402

BATCH = Path(__file__).resolve().parent.parent / "data" / "work" / "bio_batches"
FIELD_BOOK = {"isabah": "9767", "usd": "1110", "ibnsad": "9351"}


def check(n):
    errs = []
    src = [json.loads(l) for l in (BATCH / f"find_{n}.jsonl").read_text().splitlines() if l.strip()]
    order = [r["id"] for r in src]
    f = BATCH / f"bio_{n}.jsonl"
    if not f.exists():
        return [f"bio_{n}.jsonl missing"]
    rows = [json.loads(l) for l in f.read_text().splitlines() if l.strip()]
    ids = [r.get("id") for r in rows]
    if any(i not in order for i in ids) or ids != sorted(ids, key=order.index):
        errs.append("ids not from the input batch or not in input order")
    for r in rows:
        if not any(r.get(k) for k in ("isabah", "usd", "ibnsad", "lain")):
            errs.append(f"{r.get('id')}: no excerpt (leave it out instead)")
        for k in ("isabah", "usd", "ibnsad", "lain"):
            x = r.get(k) or ""
            if not x:
                continue
            head, _, body = x.partition("\n")
            ref = parse_tag(head.strip("[] "))
            if not head.startswith("[") or not ref:
                errs.append(f"{r['id']}.{k}: bad tag line {head[:40]!r}")
                continue
            bid, vol, page = ref
            if k in FIELD_BOOK and bid != FIELD_BOOK[k]:
                errs.append(f"{r['id']}.{k}: tag is from book {bid}")
            if not books.find_pages(bid, vol, page):
                errs.append(f"{r['id']}.{k}: page not found {head}")
                continue
            for para in [p.strip() for p in body.split("\n") if len(p.strip()) >= 20]:
                if not books.quote_on_page(bid, vol, page, para[:400]):
                    errs.append(f"{r['id']}.{k}: text not on {head}: {para[:50]!r}")
                    break
    notes = BATCH / f"find_{n}.notes.json"
    if not notes.exists():
        errs.append(f"find_{n}.notes.json missing")
    return errs


if __name__ == "__main__":
    errs = [e for n in sys.argv[1:] for e in check(n)]
    print("\n".join(errs) if errs else f"ALL OK ({len(sys.argv) - 1} batches)")
    sys.exit(1 if errs else 0)
