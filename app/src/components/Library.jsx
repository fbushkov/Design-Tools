import { useMemo, useState } from 'react';
import { Input, Listbox, ListboxItem, Chip, ScrollShadow, Select, SelectItem } from '@heroui/react';
import { Search } from 'lucide-react';
import { useApp } from '../state.jsx';
import { KindIcon } from './CardView.jsx';

const LISTS = { problems: 'problem', approaches: 'approach', sources: 'source' };

// Список карточек одного вида с поиском и фильтром по категории.
export default function Library({ which }) {
  const { base, openCard, taxonomy } = useApp();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const items = base[which];
  const filtered = useMemo(() => {
    const ql = q.toLowerCase().replace(/ё/g, 'е');
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
      .sort((a, b) => String(a.data.title || a.id).localeCompare(String(b.data.title || b.id), 'ru'));
  }, [items, q, cat]);

  return (
    <div className="h-full flex flex-col gap-3 p-4">
      <div className="flex gap-2">
        <Input
          aria-label="Поиск"
          placeholder="Поиск по названию, тегам и тексту"
          startContent={<Search size={16} />}
          value={q}
          onValueChange={setQ}
          isClearable
          onClear={() => setQ('')}
        />
        <Select
          aria-label="Категория"
          placeholder="Все категории"
          className="max-w-xs"
          selectedKeys={cat ? [cat] : []}
          onSelectionChange={(k) => setCat([...k][0] || '')}
        >
          {taxonomy.categories.map((c) => (
            <SelectItem key={c.id}>{c.title}</SelectItem>
          ))}
        </Select>
      </div>
      <div className="text-xs text-default-500">Найдено: {filtered.length}</div>
      <ScrollShadow className="flex-1">
        <Listbox aria-label="Карточки" onAction={(id) => openCard(String(id))} variant="flat">
          {filtered.map((c) => (
            <ListboxItem
              key={c.id}
              startContent={<KindIcon kind={LISTS[which]} />}
              description={
                which === 'sources'
                  ? `${c.data.cite || ''}${c.data.read === false ? ' · не прочитан' : ''}`
                  : [].concat(c.data.category || c.data.solves || []).join(', ')
              }
              endContent={
                c.data.status && c.data.status !== 'draft' ? (
                  <Chip size="sm" color="success" variant="flat">
                    {c.data.status}
                  </Chip>
                ) : null
              }
            >
              {c.data.title || c.id}
            </ListboxItem>
          ))}
        </Listbox>
      </ScrollShadow>
    </div>
  );
}
