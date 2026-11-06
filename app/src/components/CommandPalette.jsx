import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, ModalContent, ModalBody } from '@heroui/react';
import { Search, CornerDownLeft } from 'lucide-react';
import { useApp } from '../state.jsx';
import { KIND, KindIcon, Hotkey } from './ui.jsx';

// Быстрый поиск по всей базе: Ctrl+K.
export default function CommandPalette() {
  const { palette, setPalette, base, goToCard } = useApp();
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const inputRef = useRef(null);
  useEffect(() => {
    if (palette) {
      setQ('');
      setI(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [palette]);

  const results = useMemo(() => {
    if (!base?.ok) return [];
    const all = [...base.problems, ...base.approaches, ...base.sources];
    const ql = q.toLowerCase().replace(/ё/g, 'е').trim();
    if (!ql) return all.filter((c) => c.kind === 'problem').slice(0, 12);
    const words = ql.split(/\s+/);
    return all
      .map((c) => {
        const title = ((c.data.title || '') + ' ' + (c.data.cite || '') + ' ' + c.id).toLowerCase().replace(/ё/g, 'е');
        const tags = (c.data.tags || []).join(' ').toLowerCase();
        let score = 0;
        for (const w of words) {
          if (title.includes(w)) score += 3;
          else if (tags.includes(w)) score += 2;
          else if (c.body.toLowerCase().includes(w)) score += 1;
          else return null;
        }
        return { c, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 14)
      .map((x) => x.c);
  }, [q, base]);

  const choose = (c) => {
    setPalette(false);
    goToCard(c.id);
  };

  return (
    <Modal isOpen={palette} onClose={() => setPalette(false)} size="2xl" placement="top" hideCloseButton backdrop="blur" className="mt-24">
      <ModalContent>
        <ModalBody className="p-0">
          <div className="flex items-center gap-2 px-4 border-b border-default-100">
            <Search size={17} className="text-default-400" />
            <input
              ref={inputRef}
              aria-label="Поиск по базе"
              placeholder="Проблема, подход, автор или слово…"
              className="flex-1 h-12 bg-transparent outline-none text-[15px]"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setI(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setI((x) => Math.min(x + 1, results.length - 1));
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setI((x) => Math.max(x - 1, 0));
                }
                if (e.key === 'Enter' && results[i]) choose(results[i]);
              }}
            />
            <Hotkey>Esc</Hotkey>
          </div>
          <ul className="max-h-[420px] overflow-auto p-2" role="listbox">
            {!q && <li className="px-3 pt-1 pb-2 text-[11px] uppercase tracking-wide text-default-400">Проблемы</li>}
            {results.map((c, idx) => (
              <li key={c.id}>
                <button
                  onMouseEnter={() => setI(idx)}
                  onClick={() => choose(c)}
                  className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-medium ${idx === i ? 'bg-primary-50' : ''}`}
                >
                  <KindIcon kind={c.kind} size={15} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm truncate">{c.kind === 'source' ? `${c.data.cite} — ${c.data.title}` : c.data.title}</span>
                  </span>
                  <span className="text-[11px] text-default-400">{KIND[c.kind].label}</span>
                  {idx === i && <CornerDownLeft size={13} className="text-default-400" />}
                </button>
              </li>
            ))}
            {q && !results.length && <li className="px-3 py-6 text-center text-sm text-default-500">Ничего не нашлось</li>}
          </ul>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
