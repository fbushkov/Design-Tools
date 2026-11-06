import { useMemo, useState } from 'react';
import { Accordion, AccordionItem, Chip } from '@heroui/react';
import { Wrench, Target, ArrowRight } from 'lucide-react';
import { useApp } from '../state.jsx';
import Markdown from './Markdown.jsx';
import { PageHeader, Segmented, KindIcon } from './ui.jsx';
import { sections, sectionStarting, listItems, maturityFit, stageFit } from '../lib/base.js';

// Карта: стадия зрелости → контур → проблема → подход (авторы) → инструменты → результат.
export default function MapView() {
  const { base, taxonomy, byId, openCard } = useApp();
  const [stage, setStage] = useState(2);
  const [groupBy, setGroupBy] = useState(taxonomy.contours.length ? 'contour' : 'direction');
  const lvl = Number(stage);
  const g = taxonomy.greiner.find((x) => x.level === lvl);
  const axis = taxonomy.axes.find((a) => a.id === 'management');

  const groups = useMemo(() => {
    const fits = (p) => {
      const m = p.data.maturity?.management;
      if (!m) return true;
      const arr = [].concat(m).map(Number);
      return arr.length === 2 ? lvl >= arr[0] && lvl <= arr[1] : arr.includes(lvl);
    };
    const out = {};
    for (const p of base.problems.filter(fits)) {
      const cat = [].concat(p.data.category || [])[0];
      const key = groupBy === 'contour' ? (taxonomy.categoryContours[cat] || ['—'])[0] : [].concat(p.data.directions || ['—'])[0];
      (out[key] ||= []).push(p);
    }
    const order = groupBy === 'contour' ? taxonomy.contours.map((c) => c.id) : taxonomy.directions.map((d) => d.id);
    return Object.entries(out).sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
  }, [base, lvl, groupBy, taxonomy]);

  const groupTitle = (id) => (groupBy === 'contour' ? taxonomy.contours.find((d) => d.id === id) : taxonomy.directions.find((d) => d.id === id));

  return (
    <div className="h-full overflow-auto">
      <PageHeader
        title="Карта"
        description="Стадия зрелости управления → контур бизнеса → проблема → подход и его авторы → инструменты → бизнес-результат."
        actions={
          <Segmented
            ariaLabel="Группировка"
            allowEmpty={false}
            value={groupBy}
            onChange={setGroupBy}
            options={[
              { value: 'contour', label: 'Контуры бизнеса' },
              { value: 'direction', label: 'Направления работы' },
            ]}
          />
        }
      />
      <div className="px-8 pb-10 space-y-6 max-w-[1100px]">
        <div className="rounded-large bg-content1 border border-default-200/70 p-5 grid grid-cols-[auto_1fr] gap-6 items-start">
          <div className="space-y-2">
            <div className="text-xs text-default-500">Стадия управления</div>
            <Segmented
              ariaLabel="Стадия"
              size="md"
              allowEmpty={false}
              value={stage}
              onChange={(v) => setStage(Number(v))}
              options={(axis?.levels || []).map((l, i) => ({ value: i + 1, label: String(i + 1), hint: l }))}
            />
          </div>
          <div className="text-sm space-y-1">
            <div className="font-medium">{axis?.levels[lvl - 1]}</div>
            {g && (
              <Markdown
                text={`Фаза по Грейнеру — ${g.phase}. Назревает кризис: ${g.crisis}`}
                card={byId.get('greiner-1972-evolution-revolution')}
                compact
                className="text-default-600"
              />
            )}
            <div className="flex flex-wrap gap-3 text-[11px] text-default-400 pt-1">
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-success" /> органично на стадии
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-danger" /> вредно на стадии
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-warning" /> рано по зрелости
              </span>
            </div>
          </div>
        </div>

        {groups.map(([key, problems]) => {
          const t = groupTitle(key);
          return (
            <section key={key} className="space-y-2">
              <div className="flex items-baseline gap-2">
                <h2 className="text-[15px] font-semibold capitalize-first">{t?.title || key}</h2>
                <span className="text-xs text-default-400">{problems.length}</span>
                {t?.note && <span className="text-xs text-default-500 truncate">{t.note.split(':').slice(1).join(':')}</span>}
              </div>
              <Accordion variant="splitted" selectionMode="multiple" className="px-0" itemClasses={{ base: 'shadow-none border border-default-200/70', title: 'text-[14px] font-medium' }}>
                {problems.map((p) => {
                  const ps = sections(p.body);
                  const result = sectionStarting(ps, 'Как понять');
                  const approaches = (p.data.approaches || [])
                    .map((id) => byId.get(id))
                    .filter(Boolean)
                    .map((a) => ({ a, st: stageFit(a, lvl), fit: maturityFit(a, { management: lvl }) }))
                    .sort((x, y) => (x.st === 'harm') - (y.st === 'harm') || (y.st === 'fit') - (x.st === 'fit'));
                  const harm = approaches.filter((x) => x.st === 'harm').length;
                  const fit = approaches.filter((x) => x.st === 'fit').length;
                  return (
                    <AccordionItem
                      key={p.id}
                      aria-label={p.data.title}
                      title={p.data.title}
                      startContent={<KindIcon kind="problem" size={17} />}
                      subtitle={
                        <span className="text-[11px]">
                          подходов {approaches.length}
                          {fit ? ` · органично ${fit}` : ''}
                          {harm ? ` · вредно ${harm}` : ''}
                        </span>
                      }
                    >
                      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 pb-2">
                        <ul className="divide-y divide-default-100">
                          {approaches.map(({ a, st, fit: mf }) => {
                            const tools = listItems(sections(a.body)['Инструменты'] || '').slice(0, 3);
                            const authors = (a.data.sources || [])
                              .map((id) => byId.get(id)?.data.cite)
                              .filter(Boolean)
                              .slice(0, 4)
                              .join(', ');
                            return (
                              <li key={a.id} className="py-2.5">
                                <div className="flex items-start gap-2">
                                  <span
                                    className={`mt-1.5 size-2 rounded-full shrink-0 ${
                                      st === 'harm' ? 'bg-danger' : st === 'fit' ? 'bg-success' : !mf.ok ? 'bg-warning' : 'bg-default-300'
                                    }`}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <button className="text-[13.5px] font-medium text-left hover:text-primary leading-snug" onClick={() => openCard(a.id)}>
                                      {a.data.title}
                                    </button>
                                    {authors && <div className="text-[11px] text-default-500 mt-0.5">{authors}</div>}
                                    {tools.length > 0 && (
                                      <div className="mt-1.5 flex gap-1.5 items-start text-xs text-default-600">
                                        <Wrench size={12} className="mt-0.5 shrink-0 text-default-400" />
                                        <Markdown text={tools.map((x) => x.split(/[.:—]/)[0]).join(' · ')} card={a} compact className="text-xs" />
                                      </div>
                                    )}
                                  </div>
                                  {st === 'harm' && (
                                    <Chip size="sm" color="danger" variant="flat" className="h-5 text-[11px]">
                                      вредно
                                    </Chip>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                        <div className="space-y-3">
                          {result && (
                            <div className="rounded-medium bg-success-50/60 p-3">
                              <div className="flex items-center gap-1.5 text-xs font-medium text-success-700 mb-1">
                                <Target size={13} /> Бизнес-результат
                              </div>
                              <Markdown text={result} card={p} compact className="text-xs" />
                            </div>
                          )}
                          <button className="text-xs text-primary flex items-center gap-1" onClick={() => openCard(p.id)}>
                            Открыть проблему <ArrowRight size={12} />
                          </button>
                        </div>
                      </div>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </section>
          );
        })}
      </div>
    </div>
  );
}
