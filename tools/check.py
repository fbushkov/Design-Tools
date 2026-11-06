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


def contours():
    """Категории, у которых в таблице контуров указан контур, и допустимые коды контуров."""
    text = (ROOT / "taxonomy.md").read_text()
    m = re.search(r"^## Контуры бизнеса.*?$(.*?)(?=^## |\Z)", text, re.S | re.M)
    if not m:
        return set(), {}
    block = m.group(1)
    codes = set(re.findall(r"^- `([a-z-]+)`", block, re.M))
    rows = {c: [x.strip() for x in d.split(",")] for c, d in re.findall(r"^\| `([a-z-]+)` \| ([^|]+)\|", block, re.M)}
    return codes, rows


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
    contour_codes, contour_rows = contours()
    cards, errors = load()
    for c in sorted(categories):
        if contour_codes and c not in contour_rows:
            errors.append(f"taxonomy.md: у категории «{c}» нет контура в таблице контуров")
    for c, ds in contour_rows.items():
        if c not in categories:
            errors.append(f"taxonomy.md: в таблице контуров неизвестная категория «{c}»")
        for d in ds:
            if d not in contour_codes:
                errors.append(f"taxonomy.md: у категории «{c}» неизвестный контур «{d}»")
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
        if kind == "approaches":
            fit, harm = as_list(meta.get("stages_fit")), as_list(meta.get("stages_harm"))
            for v in fit + harm:
                if v not in (1, 2, 3, 4):
                    errors.append(f"{where}: в stages_fit/stages_harm значение «{v}», нужны уровни 1–4")
            both = set(fit) & set(harm)
            if both:
                errors.append(f"{where}: уровни {sorted(both)} одновременно в stages_fit и stages_harm")
        for field, (target, back) in links[kind].items():
            for ref in as_list(meta.get(field)):
                if ref not in ids[target]:
                    # Кандидаты в подходы допустимы, пока куратор не создал карточку.
                    if kind == "sources" and target == "approaches":
                        continue
                    errors.append(f"{where}: в {field} ссылка на несуществующий {target}/{ref}")
                elif back and cid not in as_list(cards[(target, ref)].get(back)):
                    errors.append(f"{where}: {target}/{ref} не ссылается обратно в поле {back}")
    # Короткие имена нужны аналитику для ссылок в разборах, поэтому они обязательны и уникальны.
    cites = {}
    for (kind, cid), meta in cards.items():
        if kind != "sources":
            continue
        c = meta.get("cite")
        if not c:
            errors.append(f"sources/{cid}: нет поля cite")
        elif c in cites:
            errors.append(f"sources/{cid}: cite «{c}» уже занят sources/{cites[c]}")
        else:
            cites[c] = cid
    for e in errors:
        print(e)
    print(f"карточек: {len(cards)}, ошибок: {len(errors)}")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
