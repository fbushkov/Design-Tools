import { useMemo, useState } from 'react';
import { Accordion, AccordionItem, Chip, Select, SelectItem } from '@heroui/react';
import { Layers, AlertTriangle, Compass, Wrench, Target } from 'lucide-react';
import { useApp } from '../state.jsx';
import Markdown from './Markdown.jsx';
import { sections, sectionStarting, listItems, maturityFit } from '../lib/base.js';

// Карта: стадия зрелости -> направление -> проблема -> подход (авторы, годы) -> инструменты -> результат.
export default function MapView() {
  const { base, taxonomy, byId, openCard } = useApp();
  const [stage, setStage] = useState('2');
  const lvl = Number(stage);
  const g = taxonomy.greiner.find((x) => x.level === lvl);
  const axis = taxonomy.axes.find((a) => a.id === 'management');

  const tree = useMemo(() => {
    const fits = (p) => {
      const m = p.data.maturity?.management;
      if (!m) return true;
      const arr = [].concat(m).map(Number);
      return arr.length === 2 ? lvl >= arr[0] && lvl <= arr[1] : arr.includes(lvl);
    };
    const byDir = {};
    for (const p of base.problems.filter(fits)) {
      const dir = [].concat(p.data.directions || ['без направления'])[0];
      (byDir[dir] ||= []).push(p);
    }
    return byDir;
  }, [base, lvl]);

  const dirTitle = (id) => taxonomy.directions.find((d) => d.id === id)?.title || id;

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <div className="flex items-end gap-4 flex-wrap">
        <Select
          label="Стадия зрелости управления"
          className="max-w-md"
          selectedKeys={[stage]}
          onSelectionChange={(k) => setStage([...k][0] || '1')}
          startContent={<Layers size={16} />}
        >
          {(axis?.levels || []).map((l, i) => (
            <SelectItem key={String(i + 1)} description={taxonomy.greiner[i]?.phase}>
              {`${i + 1} — ${l}`}
            </SelectItem>
          ))}
        </Select>
        {g && (
          <div className="text-sm text-default-600 max-w-2xl">
            <Markdown text={`**Фаза по Грейнеру:** ${g.phase}. **Назревает:** ${g.crisis}`} card={byId.get('greiner-1972-evolution-revolution')} compact />
          </div>
        )}
      </div>
      <p className="text-xs text-default-500">
        Проблемы отобраны по полю зрелости управления в карточке; карточки без него показаны на всех стадиях. Пометка «рано» — подход требует
        зрелости выше выбранной.
      </p>
      {Object.entries(tree).map(([dir, problems]) => (
        <section key={dir} className="space-y-2">
          <h2 className="text-lg font-semibold">{dirTitle(dir)}</h2>
          <Accordion variant="splitted" selectionMode="multiple">
            {problems.map((p) => {
              const ps = sections(p.body);
              const result = sectionStarting(ps, 'Как понять');
              const approaches = (p.data.approaches || []).map((id) => byId.get(id)).filter(Boolean);
              return (
                <AccordionItem
                  key={p.id}
                  title={p.data.title}
                  startContent={<AlertTriangle size={18} className="text-danger" />}
                  subtitle={`подходов: ${approaches.length}`}
                >
                  <div className="space-y-3">
                    <Accordion isCompact selectionMode="multiple">
                      {approaches.map((a) => {
                        const as = sections(a.body);
                        const fit = maturityFit(a, { management: lvl });
                        const authors = (a.data.sources || [])
                          .map((id) => byId.get(id))
                          .filter(Boolean)
                          .map((s) => s.data.cite)
                          .join(', ');
                        return (
                          <AccordionItem
                            key={a.id}
                            startContent={<Compass size={16} className="text-primary" />}
                            title={
                              <span className="flex items-center gap-2">
                                {a.data.title}
                                {!fit.ok && (
                                  <Chip size="sm" color="warning" variant="flat">
                                    рано
                                  </Chip>
                                )}
                              </span>
                            }
                            subtitle={authors}
                          >
                            <div className="pl-2 space-y-2">
                              <div className="flex items-center gap-1.5 text-sm font-medium">
                                <Wrench size={14} /> Инструменты
                              </div>
                              <ul className="md text-sm">
                                {listItems(as['Инструменты'] || '').map((t, i) => (
                                  <li key={i}>
                                    <Markdown text={t} card={a} compact />
                                  </li>
                                ))}
                              </ul>
                              <a className="text-primary text-sm cursor-pointer" onClick={() => openCard(a.id)}>
                                Открыть подход
                              </a>
                            </div>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                    {result && (
                      <div>
                        <div className="flex items-center gap-1.5 text-sm font-medium">
                          <Target size={14} /> Бизнес-результат: как понять, что стало лучше
                        </div>
                        <Markdown text={result} card={p} compact />
                      </div>
                    )}
                    <a className="text-primary text-sm cursor-pointer" onClick={() => openCard(p.id)}>
                      Открыть проблему
                    </a>
                  </div>
                </AccordionItem>
              );
            })}
          </Accordion>
        </section>
      ))}
    </div>
  );
}
