import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, Chip, Input, Select, SelectItem, Textarea, Accordion, AccordionItem, addToast, Tooltip, Progress } from '@heroui/react';
import {
  ArrowRight,
  ArrowLeft,
  Save,
  Plus,
  Copy,
  Check,
  AlertTriangle,
  Sparkles,
  ListChecks,
  Lightbulb,
  ClipboardList,
  PenLine,
  Building2,
  Gauge,
  HelpCircle,
  Target,
  ShieldAlert,
  BookOpen,
  TrendingUp,
  TrendingDown,
  X,
} from 'lucide-react';
import { useApp } from '../state.jsx';
import Markdown from './Markdown.jsx';
import { Panel, Segmented, Meter, Hotkey, KindIcon, EmptyState } from './ui.jsx';
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
  trajectory: '',
  intake: {},
  categories: [],
  problems: [],
  questions: [],
  approach: '',
  done: [],
  notes: {},
  savedAt: '',
};

const STEPS = [
  { key: 'situation', label: 'Ситуация', icon: PenLine },
  { key: 'problems', label: 'Проблемы и вопросы', icon: ListChecks },
  { key: 'recs', label: 'Рекомендации', icon: Lightbulb },
  { key: 'plan', label: 'Регламент', icon: ClipboardList },
];

const TYPE_LABEL = { scale: 'Масштаб', model: 'Модель', offer: 'Что продают', market: 'Рынок' };
const TYPE_HUMAN = {
  micro: 'до 15 человек',
  small: 'до 100',
  mid: 'до 1000',
  large: 'больше 1000',
  b2b: 'B2B',
  b2c: 'B2C',
  b2g: 'B2G',
  marketplace: 'маркетплейс',
  service: 'услуга',
  product: 'продукт',
  'it-product': 'ИТ-продукт',
  production: 'производство',
  retail: 'розница',
  ru: 'Россия',
  global: 'глобальный',
};

function loadDraft() {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem('dt-draft') || '{}') };
  } catch (e) {
    return EMPTY;
  }
}

export default function Analysis() {
  const { base, taxonomy, byId, citeIndex } = useApp();
  const [f, setF] = useState(loadDraft);
  const [tab, setTab] = useState(() => (loadDraft().approach ? 'plan' : 'situation'));
  useEffect(() => {
    try {
      localStorage.setItem('dt-draft', JSON.stringify(f));
    } catch (e) {}
  }, [f]);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const toggle = (k, v) => setF((s) => ({ ...s, [k]: s[k].includes(v) ? s[k].filter((x) => x !== v) : [...s[k], v] }));

  const intakeQs = useMemo(() => tableRows(base.intake).map((r) => ({ n: r[0], q: r[1], why: r[2] })), [base]);
  const required = intakeQs.filter((x) => f.mode === 'full' || Number(x.n) <= 4);
  const unanswered = required.filter((x) => !(f.intake[x.n] || '').trim());
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
  const plan = approach ? buildPlan(approach, selected, questions, f.questions, unanswered) : null;
  const planTotal = plan ? plan.steps.reduce((n, st) => n + st.items.length, 0) : 0;

  const save = useCallback(async () => {
    if (!f.situation.trim()) {
      addToast({ title: 'Нечего сохранять', description: 'Опишите ситуацию на первом шаге.', color: 'warning' });
      return;
    }
    const name = `${new Date().toISOString().slice(0, 10)}-${slug(f.title)}.md`;
    const r = await window.dt.saveAnalysis(name, toMarkdown(f, { selected, questions, approach, intakeQs, unanswered }));
    if (r.ok) set('savedAt', new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }));
    addToast({ title: r.ok ? 'Разбор сохранён' : 'Не удалось сохранить', description: r.ok ? `analyses/${name}` : r.error, color: r.ok ? 'success' : 'danger' });
  }, [f, selected, questions, approach, intakeQs, unanswered]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  const stepDone = {
    situation: !!f.situation.trim(),
    problems: selected.length > 0,
    recs: !!approach,
    plan: planTotal > 0 && f.done.length === planTotal,
  };
  const stepEnabled = { situation: true, problems: !!f.situation.trim(), recs: selected.length > 0, plan: !!approach };
  const idx = STEPS.findIndex((s) => s.key === tab);
  const next = STEPS[idx + 1];

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Шапка разбора */}
      <div className="px-8 pt-6 pb-3 flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <input
            aria-label="Название разбора"
            placeholder="Название разбора — коротко о ситуации, без названия компании"
            value={f.title}
            onChange={(e) => set('title', e.target.value)}
            className="w-full bg-transparent outline-none text-xl font-semibold tracking-tight placeholder:text-default-300"
          />
          <div className="text-xs text-default-500 mt-1 flex items-center gap-2">
            <span>Черновик сохраняется автоматически</span>
            <span className="text-default-300">·</span>
            <span>{f.savedAt ? `в библиотеку сохранён в ${f.savedAt}` : 'в библиотеку ещё не сохранён'}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="light"
            startContent={<Plus size={15} />}
            onPress={() => {
              if (!f.situation.trim() || window.confirm('Начать новый разбор? Текущий черновик будет очищен.')) {
                setF(EMPTY);
                setTab('situation');
              }
            }}
          >
            Новый
          </Button>
          <Tooltip content="Скопировать разбор в буфер как markdown" delay={300}>
            <Button
              size="sm"
              variant="flat"
              isIconOnly
              aria-label="Скопировать разбор"
              onPress={async () => {
                await navigator.clipboard.writeText(toMarkdown(f, { selected, questions, approach, intakeQs, unanswered }));
                addToast({ title: 'Разбор скопирован', color: 'success' });
              }}
            >
              <Copy size={15} />
            </Button>
          </Tooltip>
          <Button size="sm" color="primary" startContent={<Save size={15} />} onPress={save} endContent={<Hotkey>Ctrl S</Hotkey>}>
            Сохранить
          </Button>
        </div>
      </div>

      {/* Шаги */}
      <ol className="px-8 pb-4 flex items-center gap-2" aria-label="Шаги разбора">
        {STEPS.map((s, i) => {
          const active = s.key === tab;
          const done = stepDone[s.key];
          const enabled = stepEnabled[s.key];
          return (
            <li key={s.key} className="flex items-center gap-2 flex-1 min-w-0">
              <button
                onClick={() => enabled && setTab(s.key)}
                disabled={!enabled}
                aria-current={active ? 'step' : undefined}
                className={`flex items-center gap-2.5 h-10 px-3 rounded-medium w-full text-left transition-colors ${
                  active ? 'bg-content1 border border-default-200 shadow-sm' : 'border border-transparent hover:bg-default-100'
                } ${!enabled ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`size-6 rounded-full grid place-items-center text-[11px] font-semibold shrink-0 ${
                    done ? 'bg-success text-white' : active ? 'bg-primary text-primary-foreground' : 'bg-default-200 text-default-600'
                  }`}
                >
                  {done ? <Check size={13} strokeWidth={3} /> : i + 1}
                </span>
                <span className={`text-[13px] truncate ${active ? 'font-medium' : 'text-default-600'}`}>{s.label}</span>
              </button>
              {i < STEPS.length - 1 && <span className="h-px w-4 bg-default-200 shrink-0" />}
            </li>
          );
        })}
      </ol>

      <div className="flex-1 min-h-0 grid grid-cols-[1fr_300px] border-t border-default-200/70">
        <div className="overflow-auto min-h-0">
          <div className="max-w-[860px] mx-auto px-8 py-6 space-y-4">
            {tab === 'situation' && <StepSituation f={f} set={set} toggle={toggle} taxonomy={taxonomy} intakeQs={intakeQs} required={required} unanswered={unanswered} />}
            {tab === 'problems' && <StepProblems f={f} toggle={toggle} set={set} ranked={ranked} questions={questions} query={query} />}
            {tab === 'recs' && <StepRecs f={f} set={set} recs={recs} byId={byId} citeIndex={citeIndex} onChosen={() => setTab('plan')} />}
            {tab === 'plan' && approach && <StepPlan f={f} set={set} toggle={toggle} approach={approach} plan={plan} total={planTotal} />}

            <div className="flex justify-between pt-2 pb-8">
              <Button variant="light" startContent={<ArrowLeft size={15} />} isDisabled={idx === 0} onPress={() => setTab(STEPS[idx - 1].key)}>
                Назад
              </Button>
              {next && (
                <Button color="primary" endContent={<ArrowRight size={15} />} isDisabled={!stepEnabled[next.key]} onPress={() => setTab(next.key)}>
                  {next.label}
                </Button>
              )}
            </div>
          </div>
        </div>
        <Summary f={f} set={set} toggle={toggle} taxonomy={taxonomy} selected={selected} approach={approach} planTotal={planTotal} unanswered={unanswered} setTab={setTab} />
      </div>
    </div>
  );
}

/* ---------- Шаг 1 ---------- */

function StepSituation({ f, set, toggle, taxonomy, intakeQs, required, unanswered }) {
  return (
    <>
      <Panel title="Что происходит" subtitle="Словами заказчика: что болит, что уже пробовали, что считают причиной." icon={PenLine}>
        <Textarea
          aria-label="Ситуация"
          placeholder="Например: сеть сервисных центров, ввели KPI по скорости ответа и премии за план. Цифры зелёные, клиенты жалуются…"
          minRows={7}
          value={f.situation}
          onValueChange={(v) => set('situation', v)}
          variant="bordered"
        />
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-default-500">Режим разбора</span>
          <Segmented
            ariaLabel="Режим"
            allowEmpty={false}
            value={f.mode}
            onChange={(v) => set('mode', v)}
            options={[
              { value: 'quick', label: 'Быстрый', hint: 'Подготовка к первой встрече. Достаточно ответов на вопросы 1–4.' },
              { value: 'full', label: 'Полный', hint: 'Диагностика. Нужны ответы или «не знаю» по всем восьми вопросам.' },
            ]}
          />
        </div>
      </Panel>

      <Panel title="Бизнес" subtitle="Тип бизнеса из словаря: от него зависит, какие подходы уместны." icon={Building2}>
        <div className="grid grid-cols-2 gap-3">
          {['scale', 'model', 'offer', 'market'].map((k) => (
            <Select
              key={k}
              size="sm"
              variant="bordered"
              label={TYPE_LABEL[k]}
              selectedKeys={f[k] ? [f[k]] : []}
              onSelectionChange={(s) => set(k, [...s][0] || '')}
            >
              {taxonomy[k].map((o) => (
                <SelectItem key={o.id} textValue={TYPE_HUMAN[o.id] || o.id}>
                  {TYPE_HUMAN[o.id] || o.id}
                  {o.note && <span className="text-default-400"> · {o.note}</span>}
                </SelectItem>
              ))}
            </Select>
          ))}
        </div>
      </Panel>

      <Panel title="Зрелость" subtitle="По каждой оси выберите уровень. Уровень выше не значит лучше: у каждого свой кризис." icon={Gauge}>
        <div className="divide-y divide-default-100">
          {taxonomy.axes.map((ax) => {
            const v = f.maturity[ax.id];
            const g = ax.id === 'management' && v ? taxonomy.greiner[v - 1] : null;
            return (
              <div key={ax.id} className="py-3 first:pt-0 grid grid-cols-[180px_1fr] gap-4 items-start">
                <div>
                  <div className="text-[13px] font-medium">{ax.title}</div>
                  <code className="text-[11px] text-default-400">{ax.id}</code>
                </div>
                <div className="space-y-1.5">
                  <Segmented
                    ariaLabel={ax.title}
                    value={v || ''}
                    onChange={(x) => set('maturity', { ...f.maturity, [ax.id]: Number(x) || undefined })}
                    options={ax.levels.map((l, i) => ({ value: i + 1, label: String(i + 1), hint: l }))}
                  />
                  <div className="text-xs text-default-500 min-h-4">
                    {v ? ax.levels[v - 1] : 'не оценено'}
                    {g && <span className="text-default-400"> · назревает кризис {g.crisis.split(':')[0].toLowerCase()}</span>}
                  </div>
                </div>
              </div>
            );
          })}
          <div className="py-3 grid grid-cols-[180px_1fr] gap-4 items-start">
            <div>
              <div className="text-[13px] font-medium">Траектория</div>
              <div className="text-[11px] text-default-400">по Адизесу</div>
            </div>
            <div className="space-y-1.5">
              <Segmented
                ariaLabel="Траектория"
                value={f.trajectory}
                onChange={(v) => set('trajectory', v)}
                options={[
                  { value: 'growing', label: 'Растёт', hint: 'Предпринимательский дух жив: новинки дают выручку, решения быстрые.' },
                  {
                    value: 'aging',
                    label: 'Стареет',
                    hint: 'Растёт доля административных расходов, падает доля выручки от новинок, «как и кто» вытесняют «зачем и что».',
                  },
                ]}
              />
              <div className="text-xs text-default-500">
                {f.trajectory === 'aging'
                  ? 'В стареющей компании меняют систему полномочий, информации и вознаграждения, а не лидера.'
                  : f.trajectory === 'growing'
                    ? 'В растущей компании меняют стиль и роли руководителя.'
                    : 'не ясно'}
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <Panel
        title="Уточнение"
        subtitle={`Вопросы из templates/intake.md. Ответ «не знаю» допустим — он уйдёт в вопросы клиенту.`}
        icon={HelpCircle}
        actions={
          <Chip size="sm" variant="flat" color={unanswered.length ? 'warning' : 'success'}>
            {required.length - unanswered.length} из {required.length}
          </Chip>
        }
      >
        <Accordion selectionMode="multiple" isCompact variant="light" className="px-0" itemClasses={{ title: 'text-[13px]', trigger: 'py-2' }}>
          {intakeQs.map((x) => {
            const off = f.mode === 'quick' && Number(x.n) > 4;
            const ok = !!(f.intake[x.n] || '').trim();
            return (
              <AccordionItem
                key={x.n}
                aria-label={x.q}
                title={x.q}
                subtitle={<span className="text-[11px]">{off ? 'нужен в полном режиме' : x.why}</span>}
                startContent={
                  <span className={`size-5 rounded-full grid place-items-center text-[10px] font-semibold ${ok ? 'bg-success text-white' : 'bg-default-100 text-default-500'}`}>
                    {ok ? <Check size={11} strokeWidth={3} /> : x.n}
                  </span>
                }
                className={off ? 'opacity-50' : ''}
              >
                <Textarea
                  aria-label={x.q}
                  minRows={2}
                  variant="bordered"
                  placeholder="Ответ или «не знаю»"
                  value={f.intake[x.n] || ''}
                  onValueChange={(v) => set('intake', { ...f.intake, [x.n]: v })}
                />
              </AccordionItem>
            );
          })}
        </Accordion>
      </Panel>

      <Panel title="Категории, если уже понятны" subtitle="Необязательно: поднимет похожие проблемы в подборе." icon={Sparkles}>
        <div className="flex flex-wrap gap-1.5">
          {taxonomy.categories.map((c) => {
            const on = f.categories.includes(c.id);
            return (
              <Tooltip key={c.id} content={c.symptoms} delay={400} className="max-w-xs">
                <Chip
                  size="sm"
                  className="cursor-pointer h-7"
                  variant={on ? 'solid' : 'bordered'}
                  color={on ? 'primary' : 'default'}
                  onClick={() => toggle('categories', c.id)}
                >
                  {c.title}
                </Chip>
              </Tooltip>
            );
          })}
        </div>
      </Panel>
    </>
  );
}

/* ---------- Шаг 2 ---------- */

function StepProblems({ f, toggle, set, ranked, questions, query }) {
  // Основы слов из подбора -> целые слова из описания, чтобы подсказка читалась.
  const wordOf = useMemo(() => {
    const m = new Map();
    for (const w of query.toLowerCase().replace(/ё/g, 'е').split(/[^a-zа-я]+/)) if (w.length >= 4 && !m.has(w.slice(0, 5))) m.set(w.slice(0, 5), w);
    return m;
  }, [query]);
  const { openCard } = useApp();
  const max = ranked[0]?.score || 1;
  const [who, setWho] = useState('');
  const whos = [...new Set(questions.map((q) => q.who).filter(Boolean))];
  const shown = questions.filter((q) => !who || q.who === who);
  const byProblem = shown.reduce((acc, q) => ((acc[q.problem.id] ||= { p: q.problem, list: [] }).list.push(q), acc), {});
  return (
    <>
      <div>
        <h2 className="text-base font-semibold">Похожие проблемы</h2>
        <p className="text-sm text-default-500 mt-0.5">Отобраны по словам описания и выбранным категориям. Отметьте те, что похожи на ситуацию, обычно две-три.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {ranked.slice(0, 8).map(({ problem: p, score, hits }) => {
          const on = f.problems.includes(p.id);
          return (
            <div
              key={p.id}
              onClick={() => toggle('problems', p.id)}
              role="checkbox"
              aria-checked={on}
              tabIndex={0}
              onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && (e.preventDefault(), toggle('problems', p.id))}
              className={`cursor-pointer rounded-large border p-4 transition-all bg-content1 ${
                on ? 'border-primary ring-2 ring-primary-100' : 'border-default-200/70 hover:border-default-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 size-5 rounded-md border-2 grid place-items-center shrink-0 ${on ? 'bg-primary border-primary' : 'border-default-300'}`}>
                  {on && <Check size={12} strokeWidth={3} className="text-primary-foreground" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-[13.5px] leading-snug">{p.data.title}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <Meter value={score} max={max} className="w-24" />
                    <span className="text-[11px] text-default-400">совпадение</span>
                  </div>
                  <p className="text-xs text-default-500 mt-2 line-clamp-3">{firstParagraph(sections(p.body)['Как выглядит'], 260)}</p>
                  {hits.length > 0 && (
                    <div className="text-[11px] text-default-400 mt-2">
                      общие слова: {hits.slice(0, 6).map((h) => wordOf.get(h) || h).join(', ')}
                      {hits.length > 6 ? '…' : ''}
                    </div>
                  )}
                  <button
                    className="text-xs text-primary mt-2 hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      openCard(p.id);
                    }}
                  >
                    Открыть карточку
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {questions.length > 0 ? (
        <Panel
          title="Вопросы для диагностики"
          subtitle="Отметьте, что спросить. Отмеченные войдут в регламент, сгруппированные по адресату."
          icon={ListChecks}
          actions={
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="light" onPress={() => set('questions', [...new Set([...f.questions, ...shown.map((q) => q.key)])])}>
                Отметить все
              </Button>
              <Button size="sm" variant="light" onPress={() => set('questions', f.questions.filter((k) => !shown.some((q) => q.key === k)))}>
                Снять
              </Button>
            </div>
          }
        >
          {whos.length > 1 && (
            <div className="flex flex-wrap gap-1 mb-3">
              <Chip size="sm" className="cursor-pointer" variant={!who ? 'solid' : 'flat'} color={!who ? 'primary' : 'default'} onClick={() => setWho('')}>
                Все адресаты
              </Chip>
              {whos.map((w) => (
                <Chip key={w} size="sm" className="cursor-pointer" variant={who === w ? 'solid' : 'flat'} color={who === w ? 'primary' : 'default'} onClick={() => setWho(w)}>
                  {w}
                </Chip>
              ))}
            </div>
          )}
          <div className="space-y-5">
            {Object.values(byProblem).map(({ p, list }) => (
              <div key={p.id}>
                <div className="text-xs font-medium text-default-500 mb-1.5 flex items-center gap-1.5">
                  <KindIcon kind="problem" size={13} />
                  {p.data.title.split(' — ')[0]}
                </div>
                <ul className="divide-y divide-default-100 border border-default-100 rounded-medium">
                  {list.map((x) => (
                    <li key={x.key} className="flex gap-3 p-3 items-start">
                      <Checkbox size="sm" aria-label={x.q} isSelected={f.questions.includes(x.key)} onValueChange={() => toggle('questions', x.key)} className="mt-0" />
                      <div className="flex-1 min-w-0">
                        <Markdown text={x.q} card={x.problem} compact />
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                          {x.who && (
                            <Chip size="sm" variant="flat" className="h-5 text-[11px]">
                              {x.who}
                            </Chip>
                          )}
                          {x.src && <Markdown text={x.src} card={x.problem} compact className="text-[11px] text-default-500" />}
                        </div>
                        {x.hyp && <div className="text-xs text-default-500 mt-1">Проверяет: {x.hyp}</div>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Panel>
      ) : (
        <EmptyState icon={ListChecks} title="Отметьте хотя бы одну проблему" text="Тогда здесь появятся вопросы для диагностики из её карточки." />
      )}
    </>
  );
}

/* ---------- Шаг 3 ---------- */

function RecCard({ r, f, set, byId, citeIndex, onChosen }) {
  const { approach: a, refs, fit, stage } = r;
  const s = sections(a.body);
  const pro = (a.data.sources || []).map((id) => byId.get(id)?.data.cite).filter(Boolean);
  const contra = citesIn(s['Где ломается'], citeIndex)
    .map((id) => byId.get(id)?.data.cite)
    .filter(Boolean);
  const chosen = f.approach === a.id;
  const { openCard } = useApp();
  return (
    <div className={`rounded-large border bg-content1 transition-all ${chosen ? 'border-primary ring-2 ring-primary-100' : 'border-default-200/70'}`}>
      <div className="p-4 pb-2 flex items-start gap-3">
        <KindIcon kind="approach" size={17} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <button className="font-medium text-[14px] leading-snug text-left hover:text-primary" onClick={() => openCard(a.id)}>
            {a.data.title}
          </button>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {stage === 'fit' && (
              <Chip size="sm" color="success" variant="flat" className="h-5 text-[11px]">
                органично на вашей стадии
              </Chip>
            )}
            {stage === 'harm' && (
              <Chip size="sm" color="danger" variant="flat" startContent={<AlertTriangle size={11} />} className="h-5 text-[11px]">
                вредно на стадии {f.maturity.management}
              </Chip>
            )}
            {!fit.ok && (
              <Chip size="sm" color="warning" variant="flat" className="h-5 text-[11px]">
                рано: {fit.gaps.join(', ')}
              </Chip>
            )}
            <span className="text-[11px] text-default-400">
              {refs ? `рекомендуют ${refs} из выбранных проблем` : 'подходит по категории'}
            </span>
          </div>
        </div>
        <Button
          size="sm"
          color={chosen ? 'success' : 'primary'}
          variant={chosen ? 'flat' : 'solid'}
          startContent={chosen ? <Check size={14} /> : null}
          onPress={() => {
            set('approach', a.id);
            onChosen();
          }}
        >
          {chosen ? 'Выбрано' : 'Выбрать'}
        </Button>
      </div>
      <div className="px-4 pl-11 pb-3">
        <Markdown text={firstParagraph(s['Суть'], 420)} card={a} compact className="text-default-600" />
        <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
          <div>
            <div className="text-default-400 mb-1">Опора</div>
            <div className="text-default-700">{pro.join(', ') || '—'}</div>
          </div>
          <div>
            <div className="text-default-400 mb-1">Спорят и уточняют</div>
            <div className="text-default-700">{contra.filter((c) => !pro.includes(c)).join(', ') || '—'}</div>
          </div>
        </div>
      </div>
      <Accordion isCompact variant="light" selectionMode="multiple" itemClasses={{ title: 'text-xs text-default-600', trigger: 'py-1.5 px-4' }} className="px-0 border-t border-default-100">
        <AccordionItem key="when" title="Когда работает">
          <div className="px-4 pb-2">
            <Markdown text={s['Когда работает']} card={a} compact />
          </div>
        </AccordionItem>
        {s['На каких стадиях'] ? (
          <AccordionItem key="stages" title="На каких стадиях">
            <div className="px-4 pb-2">
              <Markdown text={s['На каких стадиях']} card={a} compact />
            </div>
          </AccordionItem>
        ) : null}
        <AccordionItem key="breaks" title="Где ломается">
          <div className="px-4 pb-2">
            <Markdown text={s['Где ломается']} card={a} compact />
          </div>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

function StepRecs({ f, set, recs, byId, citeIndex, onChosen }) {
  const good = recs.filter((r) => r.stage !== 'harm').slice(0, 8);
  const bad = recs.filter((r) => r.stage === 'harm');
  return (
    <>
      <div>
        <h2 className="text-base font-semibold">Рекомендации</h2>
        <p className="text-sm text-default-500 mt-0.5">
          Подходы из выбранных проблем. Выше те, на которые ссылается больше проблем и которые подходят вашей стадии. Решение за вами: у каждого видно, кто за и
          кто спорит.
        </p>
        {!f.maturity.management && (
          <p className="text-xs text-warning-600 mt-2 flex items-center gap-1.5">
            <AlertTriangle size={13} /> Уровень управления не задан — пометки «органично» и «вредно» не работают. Задайте его на шаге 1.
          </p>
        )}
      </div>
      {good.map((r) => (
        <RecCard key={r.approach.id} r={r} f={f} set={set} byId={byId} citeIndex={citeIndex} onChosen={onChosen} />
      ))}
      {bad.length > 0 && (
        <>
          <div className="pt-4 flex items-center gap-2 text-sm font-medium text-danger">
            <ShieldAlert size={16} /> Не рекомендуется на вашей стадии
          </div>
          <div className="space-y-3 opacity-80">
            {bad.map((r) => (
              <RecCard key={r.approach.id} r={r} f={f} set={set} byId={byId} citeIndex={citeIndex} onChosen={onChosen} />
            ))}
          </div>
        </>
      )}
      {!recs.length && <EmptyState icon={Lightbulb} title="Нет рекомендаций" text="Отметьте проблемы на шаге 2." />}
    </>
  );
}

/* ---------- Шаг 4 ---------- */

export function buildPlan(approach, selected, questions, checked, unanswered) {
  const s = sections(approach.body);
  const steps = [];
  if (unanswered.length)
    steps.push({ id: 'ask', title: 'Уточнить у заказчика', hint: 'Вопросы уточнения без ответа', items: unanswered.map((x) => `${x.q} _(вопрос ${x.n})_`), card: approach });
  const qs = questions.filter((q) => checked.includes(q.key));
  const useQs = qs.length ? qs : questions.slice(0, 6);
  const byWho = {};
  for (const q of useQs) (byWho[q.who || 'Без адресата'] ||= []).push(q);
  for (const [who, list] of Object.entries(byWho))
    steps.push({ id: 'q-' + who, title: `Диагностика: ${who}`, hint: 'Вопросы и проверяемые гипотезы', items: list.map((q) => `${q.q}${q.src ? ` (${q.src})` : ''}`), card: list[0].problem });
  steps.push({ id: 'tools', title: `Применить: ${approach.data.title.split(' — ')[0]}`, hint: 'Инструменты подхода', items: listItems(s['Инструменты'] || s['Суть']), card: approach });
  const risks = listItems(s['Где ломается']);
  if (risks.length) steps.push({ id: 'risks', title: 'Проверить риски', hint: 'Где подход ломается', items: risks, card: approach });
  const success = selected.map((p) => ({ p, t: sectionStarting(sections(p.body), 'Как понять') })).filter((x) => x.t);
  const maturityText = selected.map((p) => ({ p, t: sectionStarting(sections(p.body), 'Что делать') })).filter((x) => x.t);
  return { steps, success, maturityText, s };
}

function StepPlan({ f, set, toggle, approach, plan, total }) {
  const { byId, openCard } = useApp();
  const { steps, success, maturityText, s } = plan;
  const pct = total ? Math.round((f.done.length / total) * 100) : 0;
  return (
    <>
      <div className="rounded-large bg-content1 border border-default-200/70 p-5">
        <div className="text-xs text-default-500">Регламент по выбранной рекомендации</div>
        <button className="text-lg font-semibold tracking-tight text-left hover:text-primary mt-0.5" onClick={() => openCard(approach.id)}>
          {approach.data.title}
        </button>
        <div className="flex items-center gap-3 mt-3">
          <Progress aria-label="Выполнено" value={pct} size="sm" color={pct === 100 ? 'success' : 'primary'} className="flex-1" />
          <span className="text-xs text-default-500 tabular">
            {f.done.length} из {total}
          </span>
        </div>
      </div>

      <Panel title="Цель и как понять, что стало лучше" icon={Target}>
        {success.length ? success.map(({ p, t }) => <Markdown key={p.id} text={t} card={p} compact />) : <p className="text-default-500 text-sm">В выбранных проблемах критерий не описан.</p>}
      </Panel>

      <ol className="relative space-y-4 before:absolute before:left-[15px] before:top-3 before:bottom-3 before:w-px before:bg-default-200">
        {steps.map((st, i) => {
          const doneHere = st.items.filter((_, j) => f.done.includes(`${st.id}#${j}`)).length;
          const complete = doneHere === st.items.length && st.items.length > 0;
          return (
            <li key={st.id} className="relative pl-11">
              <span
                className={`absolute left-0 top-3 size-8 rounded-full grid place-items-center text-xs font-semibold border-2 bg-background ${
                  complete ? 'border-success text-success' : 'border-primary-200 text-primary'
                }`}
              >
                {complete ? <Check size={14} strokeWidth={3} /> : i + 1}
              </span>
              <div className="rounded-large bg-content1 border border-default-200/70">
                <div className="flex items-center justify-between px-5 pt-4 pb-1">
                  <div>
                    <div className="font-semibold text-[14px]">{st.title}</div>
                    <div className="text-[11px] text-default-500">{st.hint}</div>
                  </div>
                  <span className="text-xs text-default-400 tabular">
                    {doneHere}/{st.items.length}
                  </span>
                </div>
                <ul className="px-5 py-2 space-y-1">
                  {st.items.map((it, j) => {
                    const key = `${st.id}#${j}`;
                    const d = f.done.includes(key);
                    return (
                      <li key={key} className="flex gap-3 items-start py-1">
                        <Checkbox size="sm" aria-label="Выполнено" isSelected={d} onValueChange={() => toggle('done', key)} />
                        <div className={`flex-1 min-w-0 ${d ? 'opacity-45 line-through decoration-default-300' : ''}`}>
                          <Markdown text={it} card={st.card} compact />
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="px-5 pb-4">
                  <Input
                    size="sm"
                    variant="flat"
                    aria-label="Заметка к шагу"
                    placeholder="Заметка: кто, когда, что адаптировать"
                    value={f.notes[st.id] || ''}
                    onValueChange={(v) => set('notes', { ...f.notes, [st.id]: v })}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {maturityText.length > 0 && (
        <Panel title="Что делать в зависимости от зрелости" icon={Gauge}>
          {maturityText.map(({ p, t }) => (
            <Markdown key={p.id} text={t} card={p} compact />
          ))}
        </Panel>
      )}
      <Panel title="Опора" subtitle="Источники подхода. Ссылки на страницы в тексте выше открывают сам текст книги." icon={BookOpen}>
        <div className="flex flex-wrap gap-1.5">
          {(approach.data.sources || []).map((id) => (
            <Chip key={id} color="secondary" variant="flat" className="cursor-pointer" onClick={() => openCard(id)}>
              {byId.get(id)?.data.cite || id}
            </Chip>
          ))}
        </div>
      </Panel>
      {s['Как я его адаптирую'] && (
        <Panel title="Как я его адаптирую" subtitle="Раздел автора. Пока черновые вопросы." icon={PenLine}>
          <Markdown text={s['Как я его адаптирую']} card={approach} compact />
        </Panel>
      )}
    </>
  );
}

/* ---------- Сводка справа ---------- */

function Summary({ f, set, toggle, taxonomy, selected, approach, planTotal, unanswered, setTab }) {
  const { openCard } = useApp();
  const ctx = ['scale', 'model', 'offer', 'market'].filter((k) => f[k]);
  return (
    <aside className="border-l border-default-200/70 overflow-auto min-h-0 bg-content1/50">
      <div className="p-5 space-y-5 text-[13px]">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-default-400 mb-2">Сводка разбора</div>
          <div className="text-default-600 line-clamp-4">{f.situation || <span className="text-default-400">Ситуация не описана</span>}</div>
        </div>
        <div>
          <div className="text-xs text-default-500 mb-1.5">Бизнес</div>
          <div className="flex flex-wrap gap-1">
            {ctx.length ? (
              ctx.map((k) => (
                <Chip key={k} size="sm" variant="flat" className="h-6">
                  {TYPE_HUMAN[f[k]] || f[k]}
                </Chip>
              ))
            ) : (
              <span className="text-default-400 text-xs">не задан</span>
            )}
          </div>
        </div>
        <div>
          <div className="text-xs text-default-500 mb-1.5 flex items-center gap-1.5">
            Зрелость
            {f.trajectory === 'aging' && (
              <span className="text-warning-600 flex items-center gap-0.5">
                <TrendingDown size={12} /> стареет
              </span>
            )}
            {f.trajectory === 'growing' && (
              <span className="text-success-600 flex items-center gap-0.5">
                <TrendingUp size={12} /> растёт
              </span>
            )}
          </div>
          <div className="space-y-1">
            {taxonomy.axes.map((ax) => (
              <div key={ax.id} className="grid grid-cols-[1fr_auto] items-center gap-2">
                <span className="text-xs text-default-600 truncate">{ax.title}</span>
                <span className="flex gap-0.5">
                  {[1, 2, 3, 4].map((l) => (
                    <span key={l} className={`h-1.5 w-4 rounded-full ${f.maturity[ax.id] >= l ? 'bg-primary' : 'bg-default-200'}`} />
                  ))}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs text-default-500 mb-1.5">Проблемы</div>
          {selected.length ? (
            <ul className="space-y-1">
              {selected.map((p) => (
                <li key={p.id} className="flex items-start gap-1.5 group">
                  <KindIcon kind="problem" size={13} className="mt-0.5" />
                  <button className="text-left flex-1 hover:text-primary leading-snug" onClick={() => openCard(p.id)}>
                    {p.data.title.split(' — ')[0]}
                  </button>
                  <button aria-label="Убрать" className="opacity-0 group-hover:opacity-100 text-default-400" onClick={() => toggle('problems', p.id)}>
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <button className="text-xs text-primary" onClick={() => f.situation.trim() && setTab('problems')}>
              Подобрать проблемы →
            </button>
          )}
          {f.questions.length > 0 && <div className="text-xs text-default-500 mt-1.5">Вопросов отмечено: {f.questions.length}</div>}
        </div>
        <div>
          <div className="text-xs text-default-500 mb-1.5">Выбранный путь</div>
          {approach ? (
            <div className="space-y-2">
              <button className="flex items-start gap-1.5 text-left hover:text-primary leading-snug" onClick={() => openCard(approach.id)}>
                <KindIcon kind="approach" size={13} className="mt-0.5" />
                {approach.data.title.split(' — ')[0]}
              </button>
              <div className="flex items-center gap-2">
                <Progress aria-label="Регламент" size="sm" value={planTotal ? (f.done.length / planTotal) * 100 : 0} className="flex-1" />
                <span className="text-[11px] text-default-400 tabular">
                  {f.done.length}/{planTotal}
                </span>
              </div>
            </div>
          ) : (
            <span className="text-default-400 text-xs">не выбран</span>
          )}
        </div>
        {unanswered.length > 0 && (
          <div className="rounded-medium bg-warning-50 text-warning-700 text-xs p-3">
            Без ответа {unanswered.length} {unanswered.length === 1 ? 'вопрос' : 'вопроса'} уточнения — они попадут в регламент как вопросы заказчику.
          </div>
        )}
      </div>
    </aside>
  );
}

/* ---------- Экспорт ---------- */

function toMarkdown(f, { selected, questions, approach, intakeQs, unanswered }) {
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
    `trajectory: ${f.trajectory || ''}`,
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
    const { steps } = buildPlan(approach, selected, questions, f.questions, unanswered);
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
