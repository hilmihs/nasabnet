#!/usr/bin/env python3
"""Look up companions and their current biography (for data/work/ROLE_LEVEL_SPEC.md).

  python3 scripts/person_bio.py find "REGEX"     # persons whose Latin/Arabic name matches -> id, name, tribe
  python3 scripts/person_bio.py show ID          # the person's bio points (peran, catatan, …)
"""
import json
import re
import sys
from pathlib import Path

WEB = Path(__file__).resolve().parent.parent / "web" / "public" / "data"


def main():
    persons = {p["id"]: p for p in json.loads((WEB / "nasabnet.json").read_text())["persons"]}
    bio = json.loads((WEB / "bio.json").read_text())["persons"]
    cmd, arg = sys.argv[1], sys.argv[2]
    if cmd == "find":
        rx = re.compile(arg, re.I)
        for p in persons.values():
            if rx.search(p["lat"]) or rx.search(p["ar"]):
                print(p["id"], "|", p["lat"], "|", p["ar"], "|", p.get("tribe"), "|", "bio" if p["id"] in bio else "no bio")
    elif cmd == "show":
        p = persons.get(arg)
        if not p:
            sys.exit(f"no person {arg}")
        print(p["id"], p["lat"], p["ar"], p.get("tribe"))
        print(json.dumps(bio.get(arg, {}), ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
