#!/usr/bin/env python3
"""Проверка целостности базы: поля карточек по словарю, существование ссылок и связи в обе стороны.

  python3 tools/check.py
"""
import re, sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
KINDS = ["problems", "approaches", "sources", "cases"]


def taxonomy():
    text = (ROOT / "taxonomy.md").read_text()
    def codes(heading):
        m = re.search(rf"^## {heading}.*?$(.*?)(?=^## |\Z)", text, re.S | re.M)
        return set(re.findall(r"^(?:- |\| )`([a-z0-9-]+)`", m.group(1), re.M)) if m else set()
    return codes("Направления"), codes("Категории проблем")


def load():
    cards, errors = {}, []
    for kind in KINDS:
        for f in sorted((ROOT / kind).glob("*.md")):
            m = re.match(r"^---\n(.*?)\n---\n", f.read_text(), re.S)
            if not m:
                errors.append(f"{kind}/{f.name}: нет шапки")
                continue
            meta = yaml.safe_load(m.group(1)) or {}
            if meta.get("id") != f.stem:
                errors.append(f"{kind}/{f.name}: id «{meta.get('id')}» не совпадает с именем файла")
            cards[(kind, f.stem)] = meta
    return cards, errors


def as_list(v):
    return v if isinstance(v, list) else ([] if v in (None, "") else [v])


def main():
    directions, categories = taxonomy()
    cards, errors = load()
    ids = {k: {i for (kk, i) in cards if kk == k} for k in KINDS}
    # Поле, на какой тип карточек ссылается, и обратное поле, которое должно ссылаться назад.
    links = {
        "problems": {"approaches": ("approaches", "solves"), "cases": ("cases", "problems")},
        "approaches": {"solves": ("problems", "approaches"), "sources": ("sources", "approaches")},
        "sources": {"approaches": ("approaches", "sources")},
        "cases": {"problems": ("problems", "cases"), "approaches": ("approaches", None)},
    }
    for (kind, cid), meta in cards.items():
        where = f"{kind}/{cid}"
        for d in as_list(meta.get("directions")):
            if d not in directions:
                errors.append(f"{where}: направления «{d}» нет в taxonomy.md")
        for c in as_list(meta.get("category")) + as_list(meta.get("categories")):
            if c not in categories:
                errors.append(f"{where}: категории «{c}» нет в taxonomy.md")
        for field, (target, back) in links[kind].items():
            for ref in as_list(meta.get(field)):
                if ref not in ids[target]:
                    # Кандидаты в подходы допустимы, пока куратор не создал карточку.
                    if kind == "sources" and target == "approaches":
                        continue
                    errors.append(f"{where}: в {field} ссылка на несуществующий {target}/{ref}")
                elif back and cid not in as_list(cards[(target, ref)].get(back)):
                    errors.append(f"{where}: {target}/{ref} не ссылается обратно в поле {back}")
    for e in errors:
        print(e)
    print(f"карточек: {len(cards)}, ошибок: {len(errors)}")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
