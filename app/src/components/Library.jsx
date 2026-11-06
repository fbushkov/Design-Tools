import { useEffect, useMemo, useRef, useState } from 'react';
import { Input, ScrollShadow, Select, SelectItem } from '@heroui/react';
import { Search } from 'lucide-react';
import { useApp } from '../state.jsx';
import { KIND, KindIcon, EmptyState } from './ui.jsx';
import CardView from './CardView.jsx';

const KIND_OF = { problems: 'problem', approaches: 'approach', sources: 'source' };
const HINT = {
  problems: 'С чем приходят клиенты: симптомы, причины, вопросы для диагностики и что делать.',
  approaches: 'Методы и инструменты: суть, когда работают, на каких стадиях, где ломаются.',
  sources: 'Прочитанные книги и статьи: ключевые идеи со страницами, цитаты, что спорно.',
};

// Справочник: список слева, карточка справа.
export default function Library({ which }) {
  const { base, taxonomy, selected, setSelected } = useApp();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const detailRef = useRef(null);
  const kind = KIND_OF[which];
  const items = base[which];

  const filtered = useMemo(() => {
    const ql = q.toLowerCase().replace(/ё/g, 'е').trim();
    return items
      .filter((c) => {
        if (cat) {
          const cats = [].concat(c.data.category || c.data.categories || c.data.solves || []);
          if (!cats.includes(cat)) return false;
        }
        if (!ql) return true;
        const hay = (c.id + ' ' + (c.data.title || '') + ' ' + (c.data.cite || '') + ' ' + (c.data.tags || []).join(' ') + ' ' + c.body)
          .toLowerCase()
          .replace(/ё/g, 'е');
        return ql.split(/\s+/).every((w) => hay.includes(w));
      })
      .sort((a, b) =>
        which === 'sources'
          ? String(a.data.cite || a.id).localeCompare(String(b.data.cite || b.id), 'ru')
          : String(a.data.title || a.id).localeCompare(String(b.data.title || b.id), 'ru')
      );
  }, [items, q, cat, which]);

  const selId = selected[which] && items.some((c) => c.id === selected[which]) ? selected[which] : filtered[0]?.id;
  const current = items.find((c) => c.id === selId);
  useEffect(() => {
    detailRef.current?.scrollTo({ top: 0 });
  }, [selId]);

  const usedCats = useMemo(() => {
    const set = new Set(items.flatMap((c) => [].concat(c.data.category || c.data.categories || c.data.solves || [])));
    return taxonomy.categories.filter((c) => set.has(c.id));
  }, [items, taxonomy]);

  return (
    <div className="h-full grid grid-cols-[360px_1fr] min-h-0">
      <aside className="border-r border-default-200/70 flex flex-col min-h-0">
        <div className="px-5 pt-6 pb-3 space-y-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{KIND[kind].plural}</h1>
            <p className="text-xs text-default-500 mt-0.5">{HINT[which]}</p>
          </div>
          <Input
            aria-label="Поиск"
            size="sm"
            placeholder="Название, тег или слово из текста"
            startContent={<Search size={15} className="text-default-400" />}
            value={q}
            onValueChange={setQ}
            isClearable
            onClear={() => setQ('')}
          />
          <Select
            aria-label="Категория"
            size="sm"
            placeholder="Все категории"
            selectedKeys={cat ? [cat] : []}
            onSelectionChange={(k) => setCat([...k][0] || '')}
          >
            {usedCats.map((c) => (
              <SelectItem key={c.id}>{c.title}</SelectItem>
            ))}
          </Select>
          <div className="text-[11px] text-default-400">
            {filtered.length} из {items.length}
          </div>
        </div>
        <ScrollShadow className="flex-1 px-2 pb-3">
          <ul className="space-y-0.5" role="listbox" aria-label={KIND[kind].plural}>
            {filtered.map((c) => {
              const on = c.id === selId;
              const sub =
                which === 'sources'
                  ? `${[].concat(c.data.authors || []).slice(0, 2).join(', ')}${c.data.year ? ' · ' + c.data.year : ''}`
                  : [].concat(c.data.category || c.data.solves || [])
                      .map((x) => taxonomy.categories.find((t) => t.id === x)?.title || x)
                      .slice(0, 2)
                      .join(', ');
              return (
                <li key={c.id}>
                  <button
                    role="option"
                    aria-selected={on}
                    onClick={() => setSelected((s) => ({ ...s, [which]: c.id }))}
                    className={`w-full text-left flex gap-2.5 px-3 py-2 rounded-medium transition-colors ${
                      on ? 'bg-primary-50 text-foreground' : 'hover:bg-default-100'
                    }`}
                  >
                    <KindIcon kind={kind} size={15} className="mt-0.5" />
                    <span className="min-w-0">
                      <span className={`block text-[13px] leading-snug ${on ? 'font-medium' : ''}`}>
                        {which === 'sources' ? c.data.cite || c.id : c.data.title || c.id}
                      </span>
                      <span className="block text-[11px] text-default-500 truncate mt-0.5">
                        {which === 'sources' ? c.data.title : sub}
                        {which === 'sources' && sub ? '' : ''}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {!filtered.length && <EmptyState icon={Search} title="Ничего не найдено" text="Измените запрос или снимите фильтр категории." />}
        </ScrollShadow>
      </aside>
      <div ref={detailRef} className="overflow-auto min-h-0 bg-content1">
        <div className="px-10 py-8">{current ? <CardView card={current} /> : <EmptyState title="Выберите карточку слева" />}</div>
      </div>
    </div>
  );
}
