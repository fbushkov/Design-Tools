import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  Chip,
  Input,
  Select,
  SelectItem,
  Tabs,
  Tab,
  Textarea,
  RadioGroup,
  Radio,
  Accordion,
  AccordionItem,
  Divider,
  addToast,
} from '@heroui/react';
import { Search, ListChecks, Lightbulb, ClipboardList, Save, RotateCcw, ArrowRight, AlertTriangle, Check } from 'lucide-react';
import { useApp } from '../state.jsx';
import Markdown from './Markdown.jsx';
import { sections, sectionStarting, tableRows, listItems, firstParagraph, scoreProblems, rankApproaches, citesIn, slug } from '../lib/base.js';

const EMPTY = {
  title: '',
  situation: '',
  mode: 'quick',
  scale: '',
  model: '',
  offer: '',
  market: '',
  maturity: {},
  intake: {},
  categories: [],
  problems: [],
  questions: [],
  approach: '',
  done: [],
  notes: {},
};

function loadDraft() {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem('dt-draft') || '{}') };
  } catch (e) {
    return EMPTY;
  }
}

export default function Analysis() {
  const { base, taxonomy, byId, citeIndex, openCard } = useApp();
  const [f, setF] = useState(loadDraft);
  const [tab, setTab] = useState('situation');
  useEffect(() => {
    try {
      localStorage.setItem('dt-draft', JSON.stringify(f));
    } catch (e) {}
  }, [f]);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const toggle = (k, v) => setF((s) => ({ ...s, [k]: s[k].includes(v) ? s[k].filter((x) => x !== v) : [...s[k], v] }));

  const intakeQs = useMemo(() => tableRows(base.intake).map((r) => ({ n: r[0], q: r[1], why: r[2] })), [base]);
  const query = [f.title, f.situation, ...Object.values(f.intake)].join(' ');
  const ranked = useMemo(() => scoreProblems(base.problems, query, f.categories), [base, query, f.categories]);
  const selected = f.problems.map((id) => byId.get(id)).filter(Boolean);
  const recs = useMemo(() => rankApproaches(base, selected, query, f.maturity), [base, selected, query, f.maturity]);
  const approach = byId.get(f.approach);

  const questions = useMemo(
    () =>
      selected.flatMap((p) =>
        tableRows(sectionStarting(sections(p.body), 'Вопросы для диагностики')).map((r, i) => ({
          key: `${p.id}#${i}`,
          problem: p,
          q: r[0],
          who: r[1] || '',
          hyp: r[2] || '',
          src: r[3] || '',
        }))
      ),
    [selected]
  );

  const unanswered = intakeQs.filter((x) => !(f.intake[x.n] || '').trim() && (f.mode === 'full' || Number(x.n) <= 4));

  async function save() {
    const name = `${new Date().toISOString().slice(0, 10)}-${slug(f.title)}.md`;
    const content = toMarkdown(f, { selected, questions, approach, intakeQs, byId });
    const r = await window.dt.saveAnalysis(name, content);
    addToast({ title: r.ok ? 'Разбор сохранён' : 'Не сохранено', description: r.ok ? r.file : r.error, color: r.ok ? 'success' : 'danger' });
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 pt-4">
        <Input
          aria-label="Название разбора"
          placeholder="Коротко о ситуации, без названия компании"
          value={f.title}
          onValueChange={(v) => set('title', v)}
          className="max-w-xl"
          size="lg"
          variant="underlined"
        />
        <div className="flex gap-2">
          <Button variant="light" startContent={<RotateCcw size={16} />} onPress={() => setF(EMPTY)}>
            Новый
          </Button>
          <Button color="primary" startContent={<Save size={16} />} onPress={save} isDisabled={!f.situation.trim()}>
            Сохранить разбор
          </Button>
        </div>
      </div>
      <Tabs aria-label="Шаги разбора" selectedKey={tab} onSelectionChange={setTab} className="px-4 pt-2" color="primary" variant="underlined">
        <Tab key="situation" title={<Step icon={Search} n="1" label="Ситуация" />} />
        <Tab key="problems" title={<Step icon={ListChecks} n="2" label={`Проблемы и вопросы${selected.length ? ` · ${selected.length}` : ''}`} />} />
        <Tab key="recs" title={<Step icon={Lightbulb} n="3" label="Рекомендации" />} />
        <Tab key="plan" title={<Step icon={ClipboardList} n="4" label="Регламент" />} isDisabled={!approach} />
      </Tabs>
      <div className="flex-1 overflow-auto p-4">
        {tab === 'situation' && (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4">
            <div className="space-y-3">
              <Textarea
                label="Ситуация словами заказчика"
                placeholder="Что происходит, что болит, что уже пробовали…"
                minRows={8}
                value={f.situation}
                onValueChange={(v) => set('situation', v)}
              />
              <RadioGroup orientation="horizontal" label="Режим" value={f.mode} onValueChange={(v) => set('mode', v)}>
                <Radio value="quick" description="подготовка к встрече, вопросы 1–4">
                  Быстрый
                </Radio>
                <Radio value="full" description="диагностика, все 8 вопросов">
                  Полный
                </Radio>
              </RadioGroup>
              <Accordion variant="splitted" selectionMode="multiple" defaultExpandedKeys={['intake']}>
                <AccordionItem key="intake" title="Уточнение ситуации (templates/intake.md)" subtitle={`Без ответа: ${unanswered.length}`}>
                  <div className="space-y-2">
                    {intakeQs.map((x) => (
                      <Textarea
                        key={x.n}
                        minRows={1}
                        label={`${x.n}. ${x.q}`}
                        description={x.why}
                        placeholder="Ответ или «не знаю»"
                        value={f.intake[x.n] || ''}
                        onValueChange={(v) => set('intake', { ...f.intake, [x.n]: v })}
                        isDisabled={f.mode === 'quick' && Number(x.n) > 4}
                      />
                    ))}
                  </div>
                </AccordionItem>
              </Accordion>
            </div>
            <Card shadow="sm">
              <CardHeader className="font-medium">Контекст</CardHeader>
              <CardBody className="space-y-3">
                {['scale', 'model', 'offer', 'market'].map((k) => (
                  <Select
                    key={k}
                    size="sm"
                    label={{ scale: 'Масштаб', model: 'Модель', offer: 'Предложение', market: 'Рынок' }[k]}
                    selectedKeys={f[k] ? [f[k]] : []}
                    onSelectionChange={(s) => set(k, [...s][0] || '')}
                  >
                    {taxonomy[k].map((o) => (
                      <SelectItem key={o.id} description={o.note}>
                        {o.id}
                      </SelectItem>
                    ))}
                  </Select>
                ))}
                <Divider />
                <div className="text-sm font-medium">Зрелость</div>
                {taxonomy.axes.map((ax) => (
                  <Select
                    key={ax.id}
                    size="sm"
                    label={ax.title}
                    selectedKeys={f.maturity[ax.id] ? [String(f.maturity[ax.id])] : []}
                    onSelectionChange={(s) => set('maturity', { ...f.maturity, [ax.id]: Number([...s][0]) || undefined })}
                  >
                    {ax.levels.map((l, i) => (
                      <SelectItem key={String(i + 1)} description={ax.id === 'management' ? taxonomy.greiner[i]?.crisis : undefined}>
                        {`${i + 1} — ${l}`}
                      </SelectItem>
                    ))}
                  </Select>
                ))}
                <Divider />
                <div className="text-sm font-medium">Категории, если уже понятны</div>
                <div className="flex flex-wrap gap-1.5">
                  {taxonomy.categories.map((c) => (
                    <Chip
                      key={c.id}
                      size="sm"
                      className="cursor-pointer"
                      variant={f.categories.includes(c.id) ? 'solid' : 'bordered'}
                      color={f.categories.includes(c.id) ? 'primary' : 'default'}
                      onClick={() => toggle('categories', c.id)}
                    >
                      {c.title}
                    </Chip>
                  ))}
                </div>
              </CardBody>
            </Card>
            <div className="xl:col-span-2">
              <Button color="primary" endContent={<ArrowRight size={16} />} onPress={() => setTab('problems')} isDisabled={!f.situation.trim()}>
                Подобрать проблемы
              </Button>
            </div>
          </div>
        )}

        {tab === 'problems' && (
          <div className="space-y-4">
            <p className="text-sm text-default-500">
              Совпадение по словам описания и выбранным категориям. Отметьте проблемы, которые похожи на ситуацию: обычно их две-три.
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {ranked.slice(0, 8).map(({ problem: p, score }) => {
                const on = f.problems.includes(p.id);
                return (
                  <Card key={p.id} shadow="sm" className={on ? 'border-2 border-primary' : ''}>
                    <CardHeader className="flex justify-between gap-2">
                      <Checkbox isSelected={on} onValueChange={() => toggle('problems', p.id)}>
                        <span className="font-medium">{p.data.title}</span>
                      </Checkbox>
                      <Chip size="sm" variant="flat">
                        {score.toFixed(1)}
                      </Chip>
                    </CardHeader>
                    <CardBody className="pt-0">
                      <Markdown text={firstParagraph(sections(p.body)['Как выглядит'], 360)} card={p} compact />
                      <Button size="sm" variant="light" className="self-start" onPress={() => openCard(p.id)}>
                        Открыть карточку
                      </Button>
                    </CardBody>
                  </Card>
                );
              })}
            </div>
            {questions.length > 0 && (
              <Card shadow="sm">
                <CardHeader className="font-medium">Вопросы для диагностики · отмечено {f.questions.length} из {questions.length}</CardHeader>
                <CardBody className="space-y-2">
                  {questions.map((x) => (
                    <div key={x.key} className="flex gap-2 items-start">
                      <Checkbox isSelected={f.questions.includes(x.key)} onValueChange={() => toggle('questions', x.key)} className="mt-0.5" />
                      <div className="flex-1">
                        <Markdown text={`**${x.q}** — ${x.who}. _${x.hyp}_ ${x.src ? `(${x.src})` : ''}`} card={x.problem} compact />
                      </div>
                    </div>
                  ))}
                </CardBody>
              </Card>
            )}
            <Button color="primary" endContent={<ArrowRight size={16} />} onPress={() => setTab('recs')} isDisabled={!selected.length}>
              К рекомендациям
            </Button>
          </div>
        )}

        {tab === 'recs' && (
          <div className="space-y-3">
            <p className="text-sm text-default-500">
              Подходы из выбранных проблем. Выше те, на которые ссылается больше проблем и чьи условия совпадают с описанием. Решение за вами.
            </p>
            {recs.slice(0, 10).map(({ approach: a, refs, fit, stage }) => {
              const s = sections(a.body);
              const pro = (a.data.sources || []).map((id) => byId.get(id)?.data.cite).filter(Boolean);
              const contra = citesIn(s['Где ломается'], citeIndex)
                .map((id) => byId.get(id)?.data.cite)
                .filter(Boolean);
              const chosen = f.approach === a.id;
              return (
                <Card key={a.id} shadow="sm" className={chosen ? 'border-2 border-primary' : ''}>
                  <CardHeader className="flex justify-between gap-3">
                    <div>
                      <div className="font-medium">{a.data.title}</div>
                      <div className="text-xs text-default-500">
                        упоминают проблем: {refs} · опора: {pro.join(', ') || '—'}
                      </div>
                    </div>
                    <div className="flex gap-2 items-center">
                      {stage === 'harm' && (
                        <Chip size="sm" color="danger" variant="flat" startContent={<AlertTriangle size={12} />}>
                          вредно на стадии {f.maturity.management}
                        </Chip>
                      )}
                      {stage === 'fit' && (
                        <Chip size="sm" color="success" variant="flat">
                          органично на стадии {f.maturity.management}
                        </Chip>
                      )}
                      {!fit.ok && (
                        <Chip size="sm" color="warning" variant="flat" startContent={<AlertTriangle size={12} />}>
                          рано: {fit.gaps.join(', ')}
                        </Chip>
                      )}
                      <Button
                        size="sm"
                        color={chosen ? 'success' : 'primary'}
                        variant={chosen ? 'solid' : 'flat'}
                        startContent={chosen ? <Check size={14} /> : null}
                        onPress={() => {
                          set('approach', a.id);
                          setTab('plan');
                        }}
                      >
                        {chosen ? 'Выбрано' : 'Выбрать и собрать регламент'}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardBody className="pt-0 space-y-2">
                    <Markdown text={firstParagraph(s['Суть'], 500)} card={a} compact />
                    <Accordion isCompact>
                      <AccordionItem key="when" title="Когда работает">
                        <Markdown text={s['Когда работает']} card={a} compact />
                      </AccordionItem>
                      {s['На каких стадиях'] ? (
                        <AccordionItem key="stages" title="На каких стадиях">
                          <Markdown text={s['На каких стадиях']} card={a} compact />
                        </AccordionItem>
                      ) : null}
                      <AccordionItem key="breaks" title={`Где ломается и кто спорит${contra.length ? ': ' + contra.join(', ') : ''}`}>
                        <Markdown text={s['Где ломается']} card={a} compact />
                      </AccordionItem>
                    </Accordion>
                  </CardBody>
                </Card>
              );
            })}
            {!recs.length && <p className="text-default-500">Сначала отметьте проблемы на шаге 2.</p>}
          </div>
        )}

        {tab === 'plan' && approach && <Plan f={f} set={set} toggle={toggle} approach={approach} selected={selected} questions={questions} unanswered={unanswered} />}
      </div>
    </div>
  );
}

function Step({ icon: I, n, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <I size={16} />
      <span>
        {n}. {label}
      </span>
    </div>
  );
}

export function buildPlan(approach, selected, questions, checked, unanswered) {
  const s = sections(approach.body);
  const steps = [];
  if (unanswered.length)
    steps.push({ id: 'ask', title: 'Уточнить у заказчика', items: unanswered.map((x) => `${x.n}. ${x.q}`), card: approach });
  const qs = questions.filter((q) => checked.includes(q.key));
  const useQs = qs.length ? qs : questions.slice(0, 6);
  const byWho = {};
  for (const q of useQs) (byWho[q.who || 'Без адресата'] ||= []).push(q);
  for (const [who, list] of Object.entries(byWho))
    steps.push({ id: 'q-' + who, title: `Диагностика: ${who}`, items: list.map((q) => `${q.q}${q.src ? ` (${q.src})` : ''}`), card: list[0].problem });
  steps.push({ id: 'tools', title: `Применить: ${approach.data.title.split(' — ')[0]}`, items: listItems(s['Инструменты'] || s['Суть']), card: approach });
  const risks = listItems(s['Где ломается']);
  if (risks.length) steps.push({ id: 'risks', title: 'Проверить риски', items: risks, card: approach });
  const success = selected.map((p) => ({ p, t: sectionStarting(sections(p.body), 'Как понять') })).filter((x) => x.t);
  const maturityText = selected.map((p) => ({ p, t: sectionStarting(sections(p.body), 'Что делать') })).filter((x) => x.t);
  return { steps, success, maturityText, s };
}

function Plan({ f, set, toggle, approach, selected, questions, unanswered }) {
  const { byId, openCard } = useApp();
  const { steps, success, maturityText, s } = buildPlan(approach, selected, questions, f.questions, unanswered);
  const total = steps.reduce((n, st) => n + st.items.length, 0);
  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-default-500">Регламент по выбранной рекомендации</div>
          <h2 className="text-xl font-semibold cursor-pointer hover:underline" onClick={() => openCard(approach.id)}>
            {approach.data.title}
          </h2>
        </div>
        <Chip color="primary" variant="flat">
          выполнено {f.done.length} из {total}
        </Chip>
      </div>
      <Card shadow="sm">
        <CardHeader className="font-medium">Цель и как понять, что стало лучше</CardHeader>
        <CardBody className="pt-0">
          {success.length ? success.map(({ p, t }) => <Markdown key={p.id} text={t} card={p} compact />) : <p className="text-default-500 text-sm">В выбранных проблемах критерий не описан.</p>}
        </CardBody>
      </Card>
      {steps.map((st, i) => (
        <Card key={st.id} shadow="sm">
          <CardHeader className="font-medium">
            Шаг {i + 1}. {st.title}
          </CardHeader>
          <CardBody className="pt-0 space-y-2">
            {st.items.map((it, j) => {
              const key = `${st.id}#${j}`;
              return (
                <div key={key} className="flex gap-2 items-start">
                  <Checkbox isSelected={f.done.includes(key)} onValueChange={() => toggle('done', key)} className="mt-0.5" />
                  <div className={'flex-1 ' + (f.done.includes(key) ? 'opacity-50 line-through' : '')}>
                    <Markdown text={it} card={st.card} compact />
                  </div>
                </div>
              );
            })}
            <Textarea
              size="sm"
              minRows={1}
              placeholder="Заметка к шагу: кто, когда, что адаптировать"
              value={f.notes[st.id] || ''}
              onValueChange={(v) => set('notes', { ...f.notes, [st.id]: v })}
            />
          </CardBody>
        </Card>
      ))}
      {maturityText.length > 0 && (
        <Card shadow="sm">
          <CardHeader className="font-medium">Что делать в зависимости от зрелости</CardHeader>
          <CardBody className="pt-0">
            {maturityText.map(({ p, t }) => (
              <Markdown key={p.id} text={t} card={p} compact />
            ))}
          </CardBody>
        </Card>
      )}
      <Card shadow="sm">
        <CardHeader className="font-medium">Опора</CardHeader>
        <CardBody className="pt-0 flex flex-row flex-wrap gap-1.5">
          {(approach.data.sources || []).map((id) => (
            <Chip key={id} color="secondary" variant="flat" className="cursor-pointer" onClick={() => openCard(id)}>
              {byId.get(id)?.data.cite || id}
            </Chip>
          ))}
        </CardBody>
      </Card>
      {s['Как я его адаптирую'] && (
        <Card shadow="sm">
          <CardHeader className="font-medium">Как я его адаптирую</CardHeader>
          <CardBody className="pt-0">
            <Markdown text={s['Как я его адаптирую']} card={approach} compact />
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function toMarkdown(f, { selected, questions, approach, intakeQs }) {
  const date = new Date().toISOString().slice(0, 10);
  const cats = [...new Set(selected.flatMap((p) => [].concat(p.data.category || [])).concat(f.categories))];
  const fm = [
    '---',
    `date: ${date}`,
    `mode: ${f.mode}`,
    `scale: ${f.scale || ''}`,
    `model: ${f.model || ''}`,
    `offer: ${f.offer || ''}`,
    `market: ${f.market || ''}`,
    `maturity: { ${Object.entries(f.maturity)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ')} }`,
    `categories: [${cats.join(', ')}]`,
    `problems: [${f.problems.join(', ')}]`,
    `approach: ${f.approach || ''}`,
    'real: true',
    'outcome:',
    'case:',
    'tool: design-tools-app',
    '---',
    '',
  ].join('\n');
  const out = [fm, `# ${f.title || 'Разбор'}`, '', '## Ситуация', '', f.situation, '', '## Уточнение', ''];
  for (const x of intakeQs) out.push(`${x.n}. **${x.q}** ${f.intake[x.n] ? f.intake[x.n] : '_нет ответа_'}`);
  out.push('', '## Проблемы', '');
  for (const p of selected) out.push(`- \`${p.id}\` — ${p.data.title}`);
  out.push('', '## Вопросы для диагностики', '');
  for (const q of questions.filter((q) => f.questions.includes(q.key))) out.push(`- ${q.q} — ${q.who}. ${q.src ? `(${q.src})` : ''}`);
  if (approach) {
    const { steps } = buildPlan(approach, selected, questions, f.questions, []);
    out.push('', '## Выбранный путь', '', `\`${approach.id}\` — ${approach.data.title}`, '', '## Регламент', '');
    steps.forEach((st, i) => {
      out.push(`### Шаг ${i + 1}. ${st.title}`, '');
      st.items.forEach((it, j) => out.push(`- [${f.done.includes(`${st.id}#${j}`) ? 'x' : ' '}] ${it}`));
      if (f.notes[st.id]) out.push('', `Заметка: ${f.notes[st.id]}`);
      out.push('');
    });
  }
  return out.join('\n');
}
