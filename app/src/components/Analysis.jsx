import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, Chip, Input, Select, SelectItem, Textarea, Accordion, AccordionItem, addToast, Tooltip, Progress, Switch } from '@heroui/react';
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
  Pencil,
  Trash2,
  Wand2,
  RotateCcw,
  FlaskConical,
} from 'lucide-react';
import { useApp } from '../state.jsx';
import Markdown from './Markdown.jsx';
import { Panel, Segmented, Meter, Hotkey, KindIcon, EmptyState, Help, FieldLabel } from './ui.jsx';
import { sections, sectionStarting, tableRows, listItems, firstParagraph, scoreProblems, rankApproaches, citesIn, slug } from '../lib/base.js';

const EMPTY = {
  title: '',
  situation: '',
  mode: 'quick',
  scale: '',
  model: [],
  offer: '',
  market: '',
  maturity: {},
  trajectory: '',
  intake: {},
  categories: [],
  problems: [],
  questions: [],
  approach: '',
  plan: null,
  real: true,
  file: '',
  outcome: '',
  savedAt: '',
  planStash: {}, // регламенты по другим подходам: при смене подхода правки не теряются
  savedSig: '', // отпечаток содержимого на момент последнего сохранения в библиотеку
};

// Черновик всегда собирается одинаково, чтобы отпечатки совпадали.
export const makeDraft = (obj) => {
  const d = { ...EMPTY, ...obj };
  // В старых разборах модель — одна строка; теперь можно выбрать несколько.
  if (!Array.isArray(d.model)) d.model = d.model ? [d.model] : [];
  return d;
};
// Отпечаток содержимого разбора без служебных полей.
export const sigOf = (f) => JSON.stringify({ ...f, savedAt: '', savedSig: '', file: '' });
export const hasContent = (f) => !!(f.situation || '').trim();
// Есть ли в черновике работа, которой нет в файле библиотеки.
export const isDirty = (f) => hasContent(f) && sigOf(f) !== f.savedSig;
export function readDraft() {
  try {
    return makeDraft(JSON.parse(localStorage.getItem('dt-draft') || '{}'));
  } catch (e) {
    return makeDraft({});
  }
}

const STEPS = [
  { key: 'situation', label: 'Ситуация', icon: PenLine },
  { key: 'problems', label: 'Проблемы и вопросы', icon: ListChecks },
  { key: 'recs', label: 'Рекомендации', icon: Lightbulb },
  { key: 'plan', label: 'Регламент', icon: ClipboardList },
];

const TYPE_LABEL = { scale: 'Масштаб', model: 'Модель', offer: 'Что продают', market: 'Рынок' };
// Как значения словаря называются в интерфейсе и что они значат.
const TYPE_INFO = {
  micro: ['До 15 человек', 'Все знают всех, решения принимает один человек'],
  small: ['До 100 человек', 'Появляются отделы и первые руководители'],
  mid: ['До 1000 человек', 'Несколько уровней управления, регламенты, отдельные функции'],
  large: ['Больше 1000 человек', 'Корпорация: подразделения, центр и филиалы'],
  b2b: ['B2B — компаниям', 'Клиент — другая компания. Покупают несколько человек, сделка долгая'],
  b2c: ['B2C — частным людям', 'Клиент — человек, покупает для себя. Много клиентов, небольшой чек'],
  b2g: ['B2G — государству', 'Клиент — госорган или госкомпания. Закупки по конкурсу и регламенту'],
  b2b2c: ['B2B2C — через партнёров', 'Продаёт компании-партнёру, а пользуется конечный клиент: банк и страховая, производитель и сеть'],
  marketplace: ['Маркетплейс, площадка', 'Сводит продавцов и покупателей, зарабатывает на комиссии'],
  internal: ['Внутренний заказчик', 'Служба внутри компании работает на другие подразделения: ИТ, HR, общий центр обслуживания'],
  service: ['Услуга', 'Результат создаётся вместе с клиентом в момент оказания: ремонт, обучение, консалтинг'],
  product: ['Товар', 'Свой физический продукт под своей маркой'],
  'it-product': ['ИТ-продукт', 'Программа, приложение или цифровой сервис'],
  production: ['Производство', 'Изготовление серийно или под заказ для других компаний'],
  retail: ['Розница', 'Перепродажа чужих товаров конечному покупателю'],
  ru: ['Россия', 'Учитывается российская специфика: к разбору подключается справка о местных условиях'],
  global: ['Другие страны', 'Западный или международный рынок, российская справка не применяется'],
};
const TYPE_HELP = {
  scale: 'Сколько человек работает в компании. От масштаба зависит, какие подходы уместны: что работает на 30 человек, ломается на 1000.',
  model: 'Кому компания продаёт. Если клиентов несколько типов, отметьте все.',
  offer: 'Что именно получает клиент. От этого зависят подходы: приёмы для разработки ПО не подходят сервису и производству.',
  market: 'Где работает компания. Для России к разбору добавляются местные условия: неформальные практики, право, особенности управления.',
};
const typeName = (id) => TYPE_INFO[id]?.[0] || id;
const AXIS_HELP = {
  management: 'Как принимаются решения и кто их принимает: от «всё решает собственник» до согласованной работы центра и подразделений. Стадии — по Грейнеру и Адизесу.',
  process: 'Насколько работа описана и повторяема: от «каждый делает по-своему» до процессов, которые сами себя улучшают.',
  product: 'Как решают, что делать для клиента: от «делаем, что просят» до проверки гипотез и решений по данным.',
  data: 'Чем подкрепляются решения: от ощущений до показателей, которым доверяют и по которым действуют.',
  ai: 'Как команда использует ИИ: от личных экспериментов до встроенных в работу инструментов с проверкой результата.',
  integration: 'Насколько люди и подразделения доверяют друг другу и работают как одно целое.',
};

const loadDraft = readDraft;

export default function Analysis() {
  const { base, taxonomy, byId, citeIndex, reload, ask } = useApp();
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
  const recs = useMemo(() => rankApproaches(base, selected, query, f.maturity, { offer: f.offer }), [base, selected, query, f.maturity, f.offer]);
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
          src: (r[3] || '').replace(/\s*\(вопрос выведен [^)]*\)/g, ''),
        }))
      ),
    [selected]
  );
  // Регламент хранится в самом разборе и редактируется; из базы собирается при выборе подхода.
  // При смене подхода прежний регламент откладывается и возвращается, если подход выбрать снова.
  useEffect(() => {
    if (!approach || f.plan?.approach === approach.id) return;
    const prev = f.plan;
    const touched = prev && planTouched(prev);
    const stash = { ...(f.planStash || {}) };
    if (touched) stash[prev.approach] = prev;
    const restored = stash[approach.id];
    delete stash[approach.id];
    setF((s) => ({ ...s, planStash: stash, plan: restored || planFromBase(approach, selected, questions, f.questions, unanswered) }));
    if (touched)
      addToast({
        title: 'Прежний регламент отложен',
        description: `Правки по подходу «${byId.get(prev.approach)?.data.title?.split(' — ')[0] || prev.approach}» сохранены и вернутся, если выбрать его снова.`,
        color: 'default',
      });
    else if (restored) addToast({ title: 'Регламент возвращён', description: 'Открыт регламент с вашими прежними правками.', color: 'default' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approach?.id]);
  const plan = f.plan?.approach === approach?.id ? f.plan : null;
  const planTotal = plan ? plan.steps.reduce((n, st) => n + st.items.length, 0) : 0;
  const planDone = plan ? plan.steps.reduce((n, st) => n + st.items.filter((i) => i.done).length, 0) : 0;

  const save = useCallback(async () => {
    if (!f.situation.trim()) {
      addToast({ title: 'Нечего сохранять', description: 'Опишите ситуацию на первом шаге.', color: 'warning' });
      return;
    }
    const name = f.file || `${new Date().toISOString().slice(0, 10)}-${slug(f.title)}.md`;
    const stamp = { savedSig: sigOf(f), savedAt: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) };
    // В файл состояние пишется уже с отпечатком: при «Продолжить» разбор откроется как сохранённый.
    const r = await window.dt.saveAnalysis(name, toMarkdown({ ...f, ...stamp, file: f.file || name }, { selected, questions, approach, intakeQs }), !!f.file);
    if (r.ok) {
      // Если за время записи разбор успели поправить, отпечаток не совпадёт и статус останется «не сохранено».
      setF((s) => ({ ...s, file: r.name, ...stamp }));
      reload(); // чтобы разбор сразу появился в «Моих разборах»
    }
    addToast({ title: r.ok ? 'Разбор сохранён' : 'Не удалось сохранить', description: r.ok ? `analyses/${r.name}` : r.error, color: r.ok ? 'success' : 'danger' });
  }, [f, selected, questions, approach, intakeQs, reload]);

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

  const dirty = useMemo(() => isDirty(f), [f]);

  const stepDone = {
    situation: !!f.situation.trim(),
    problems: selected.length > 0,
    recs: !!approach,
    plan: planTotal > 0 && planDone === planTotal,
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
            className="w-full bg-transparent outline-none text-xl font-semibold tracking-tight placeholder:text-default-300 rounded-medium -mx-2 px-2 py-0.5 hover:bg-default-100 focus:bg-default-100 transition-colors"
          />
          <div className="text-xs text-default-500 mt-1 flex items-center gap-2 min-w-0">
            {dirty ? (
              <Tooltip content="Черновик хранится на этом компьютере и не пропадёт при закрытии. В библиотеку и в GitHub он попадёт после «Сохранить»." delay={300} className="max-w-xs">
                <span className="flex items-center gap-1.5 text-warning-600 font-medium whitespace-nowrap">
                  <span className="size-1.5 rounded-full bg-warning" />
                  {f.file ? 'Есть несохранённые изменения' : 'В библиотеку ещё не сохранён'}
                </span>
              </Tooltip>
            ) : (
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                {f.file && <Check size={12} className="text-success" />}
                {f.file ? `Сохранён в библиотеке${f.savedAt ? ' в ' + f.savedAt : ''}` : 'Новый разбор'}
              </span>
            )}
            {f.file && (
              <>
                <span className="text-default-300">·</span>
                <code className="text-[11px] truncate min-w-0" title={f.file}>
                  {f.file}
                </code>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Tooltip content="Тестовые разборы отмечены в списке и не превращаются в кейсы" delay={300} className="max-w-xs">
            <div>
              <Switch size="sm" isSelected={f.real === false} onValueChange={(v) => set('real', !v)} thumbIcon={<FlaskConical size={10} />}>
                <span className="text-xs text-default-600">Тестовый</span>
              </Switch>
            </div>
          </Tooltip>
          <Button
            size="sm"
            variant="light"
            startContent={<Plus size={15} />}
            onPress={async () => {
              if (dirty && !(await ask({ title: 'Начать новый разбор?', text: 'В текущем разборе есть изменения, которых нет в библиотеке. Они пропадут.', action: 'Начать новый', danger: true }))) return;
              setF(EMPTY);
              setTab('situation');
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
                await navigator.clipboard.writeText(toMarkdown(f, { selected, questions, approach, intakeQs }, { forClient: true }));
                addToast({ title: 'Разбор скопирован', color: 'success' });
              }}
            >
              <Copy size={15} />
            </Button>
          </Tooltip>
          <Tooltip content={dirty ? 'Сохранить в библиотеку · Ctrl+S' : 'Всё сохранено · Ctrl+S'} delay={300}>
            <Button size="sm" color="primary" variant={dirty ? 'solid' : 'flat'} startContent={<Save size={15} />} onPress={save}>
              {dirty ? 'Сохранить' : 'Сохранено'}
            </Button>
          </Tooltip>
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
                  active ? 'bg-primary-50' : 'hover:bg-default-100'
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
            {tab === 'plan' && approach && plan && (
              <StepPlan
                f={f}
                set={set}
                approach={approach}
                plan={plan}
                total={planTotal}
                done={planDone}
                rebuild={() => set('plan', planFromBase(approach, selected, questions, f.questions, unanswered))}
                aiContext={() => aiContext(f, { approach, selected, questions, intakeQs, contextRu: base.contextRu })}
              />
            )}

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
        <Summary f={f} set={set} toggle={toggle} taxonomy={taxonomy} selected={selected} approach={approach} planTotal={planTotal} planDone={planDone} unanswered={unanswered} setTab={setTab} />
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
          <span className="flex items-center gap-1.5 text-[13px] font-medium">
            Режим разбора
            <Help label="Что такое режим разбора">
              <p><b>Быстрый</b> — подготовка к первой встрече: достаточно ответов на вопросы 1–4 в «Уточнении».</p>
              <p><b>Полный</b> — диагностика: нужны ответы или «не знаю» по всем восьми вопросам.</p>
            </Help>
          </span>
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
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          {['scale', 'model', 'offer', 'market'].map((k) => {
            const multi = k === 'model';
            return (
              <div key={k}>
                <FieldLabel help={TYPE_HELP[k]} note={multi ? 'можно несколько' : undefined}>
                  {TYPE_LABEL[k]}
                </FieldLabel>
                <Select
                  aria-label={TYPE_LABEL[k]}
                  size="md"
                  variant="bordered"
                  placeholder="Не выбрано"
                  selectionMode={multi ? 'multiple' : 'single'}
                  selectedKeys={multi ? f.model : f[k] ? [f[k]] : []}
                  onSelectionChange={(s) => set(k, multi ? [...s] : [...s][0] || '')}
                  renderValue={(items) => items.map((i) => typeName(i.key).split(' — ')[0]).join(', ')}
                  listboxProps={{ itemClasses: { base: 'py-2' } }}
                  scrollShadowProps={{ isEnabled: false }}
                  classNames={{ listboxWrapper: 'max-h-[420px]' }}
                >
                  {taxonomy[k].map((o) => (
                    <SelectItem key={o.id} textValue={typeName(o.id)} description={TYPE_INFO[o.id]?.[1]} classNames={{ description: 'whitespace-normal text-default-500 leading-snug', title: 'font-medium' }}>
                      {typeName(o.id)}
                    </SelectItem>
                  ))}
                </Select>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Зрелость" subtitle="По каждой оси выберите уровень. Уровень выше не значит лучше: у каждого свой кризис." icon={Gauge}>
        <div className="divide-y divide-default-100">
          {taxonomy.axes.map((ax) => {
            const v = f.maturity[ax.id];
            const g = ax.id === 'management' && v ? taxonomy.greiner[v - 1] : null;
            return (
              <div key={ax.id} className="py-3 first:pt-0 grid grid-cols-[180px_1fr] gap-4 items-start">
                <div className="flex items-center gap-1.5 pt-1">
                  <div className="text-[13px] font-medium first-letter:uppercase">{ax.title}</div>
                  {AXIS_HELP[ax.id] && <Help label={`Что такое «${ax.title}»`}>{AXIS_HELP[ax.id]}</Help>}
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
            <div className="flex items-center gap-1.5 pt-1">
              <div className="text-[13px] font-medium">Траектория</div>
              <Help label="Что такое траектория">
                <p>Компания растёт или стареет — по Адизесу. От этого зависит, что менять: в растущей — стиль и роли руководителя, в стареющей — систему полномочий, информации и вознаграждения.</p>
                <p>Признаки старения: растёт доля административных расходов, падает доля выручки от новинок, вопросы «как и кто» вытесняют «зачем и что».</p>
              </Help>
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
        subtitle="Ответ «не знаю» допустим — такой вопрос уйдёт в регламент как вопрос заказчику."
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
                subtitle={<span className="text-[11px]">{off ? 'нужен в полном режиме' : x.why.replace(/`/g, '')}</span>}
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
  const [showAll, setShowAll] = useState(false);
  // Выбранные показываем всегда, даже если они ниже порога подбора.
  const visible = showAll ? ranked : ranked.filter((x, i) => i < 6 || f.problems.includes(x.problem.id));
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
        {visible.map(({ problem: p, score, hits }) => {
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

      {ranked.length > visible.length || showAll ? (
        <div className="flex justify-center">
          <Button size="sm" variant="light" onPress={() => setShowAll(!showAll)}>
            {showAll ? 'Показать только похожие' : `Показать все проблемы (${ranked.length})`}
          </Button>
        </div>
      ) : null}

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

function RecCard({ r, f, set, byId, citeIndex, onChosen, lead }) {
  const { approach: a, refs, fit, stage, itOnly } = r;
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
            {itOnly && f.offer !== 'it-product' && (
              <Chip size="sm" variant="flat" className="h-5 text-[11px]">
                для ИТ-разработки
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
          variant={chosen || !lead ? 'flat' : 'solid'}
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
            <div className="text-default-700" title={pro.length > 6 ? pro.join(', ') : undefined}>
              {pro.slice(0, 6).join(', ') || '—'}
              {pro.length > 6 && <span className="text-default-400"> и ещё {pro.length - 6}</span>}
            </div>
          </div>
          <div>
            <div className="text-default-400 mb-1">Спорят и уточняют</div>
            <div className="text-default-700">{contra.filter((c) => !pro.includes(c)).join(', ') || '—'}</div>
          </div>
        </div>
      </div>
      <Accordion isCompact variant="light" itemClasses={{ title: 'text-xs text-default-600', trigger: 'py-2 px-4' }} className="px-0 border-t border-default-100">
        <AccordionItem key="more" aria-label="Подробнее" title="Подробнее: когда работает, на каких стадиях, где ломается">
          <div className="px-4 pb-3 space-y-3">
            {[
              ['Когда работает', s['Когда работает']],
              ['На каких стадиях', s['На каких стадиях']],
              ['Где ломается', s['Где ломается']],
            ]
              .filter(([, t]) => t)
              .map(([h, t]) => (
                <div key={h}>
                  <div className="text-[11px] font-medium uppercase tracking-wider text-default-400 mb-1">{h}</div>
                  <Markdown text={t} card={a} compact />
                </div>
              ))}
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
      {good.map((r, i) => (
        <RecCard key={r.approach.id} r={r} f={f} set={set} byId={byId} citeIndex={citeIndex} onChosen={onChosen} lead={!f.approach && i === 0} />
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

/* ---------- Шаг 4: регламент ---------- */

const uid = () => Math.random().toString(36).slice(2, 9);

// Адресаты вопросов сводятся в несколько групп, чтобы регламент оставался читаемым.
const WHO_GROUPS = [
  { title: 'Данные и документы', re: /данн|запис|журнал|график|документ|подшивк|истори|аналитик|отчёт|отчет|выгрузк|метрик/i },
  { title: 'Клиенты', re: /клиент|покупател|пользовател/i },
  { title: 'Сотрудники и команды', re: /сотрудник|команд|исполнит|участник|групп|мастер|оператор|инженер|работник|анонимно|старожил|функци|маркетинг|сервис|служб|проектиру/i },
  { title: 'Руководители среднего звена', re: /руководител[а-я]* (участк|отдел|команд|процесс|пилот|внедрен|разработ)|зам|мидл|среднего звена|продакт/i },
  { title: 'Собственник и первые лица', re: /собственник|основател|директор|первое лицо|руководств|руководител/i },
];
// Порядок в регламенте: от тех, кто заказал изменения, к данным.
const WHO_ORDER = ['Собственник и первые лица', 'Руководители среднего звена', 'Сотрудники и команды', 'Клиенты', 'Данные и документы', 'Прочее'];
const whoGroup = (who) => (WHO_GROUPS.find((g) => g.re.test(who || '')) || { title: 'Прочее' }).title;

// Черновик регламента из карточек базы: подход + выбранные проблемы + отмеченные вопросы.
export function planFromBase(approach, selected, questions, checked, unanswered) {
  const s = sections(approach.body);
  const steps = [];
  const mk = (title, hint, card, texts) => ({ id: uid(), title, hint, card, note: '', items: texts.map((text) => ({ id: uid(), text, done: false })) });
  if (unanswered.length) steps.push(mk('Уточнить у заказчика', 'Вопросы уточнения без ответа', approach.id, unanswered.map((x) => x.q)));
  const qs = questions.filter((q) => checked.includes(q.key));
  const useQs = qs.length ? qs : questions.slice(0, 6);
  const byGroup = {};
  for (const q of useQs) (byGroup[whoGroup(q.who)] ||= []).push(q);
  for (const g of WHO_ORDER)
    if (byGroup[g])
      steps.push(
        mk(`Диагностика: ${g.toLowerCase()}`, 'Вопросы и проверяемые гипотезы', byGroup[g][0].problem.id, byGroup[g].map((q) => `${q.q}${q.who ? ` — _${q.who}_` : ''}${q.src ? ` (${q.src})` : ''}`))
      );
  const tools = listItems(s['Инструменты'] || '').filter((t) => !/шаблона пока нет/i.test(t));
  const useEssence = tools.length < 2;
  const apply = useEssence ? [...tools, ...(s['Суть'] || '').split(/\n\s*\n/).map((x) => x.trim()).filter((x) => x && !x.startsWith('|'))] : tools;
  steps.push(
    mk(
      `Применить: ${approach.data.title.split(' — ')[0]}`,
      useEssence ? 'Инструменты в карточке ещё не описаны — шаги собраны из раздела «Суть», уточните их' : 'Инструменты подхода',
      approach.id,
      apply
    )
  );
  const risks = listItems(s['Где ломается']);
  if (risks.length) steps.push(mk('Проверить риски', 'Где подход ломается', approach.id, risks));
  return { approach: approach.id, source: 'base', summary: '', steps };
}

// Есть ли в регламенте ручная работа: отметки, заметки, свои или изменённые пункты, черновик ИИ.
export function planTouched(plan) {
  return plan.source === 'ai' || plan.edited || plan.steps.some((st) => st.note || st.items.some((i) => i.done));
}

function planFromAI(approach, data, model) {
  const mk = (title, hint, texts) => ({ id: uid(), title, hint, card: approach.id, note: '', items: texts.map((text) => ({ id: uid(), text, done: false })) });
  const steps = [];
  if (data.questions_to_client?.length) steps.push(mk('Уточнить у заказчика', 'Предложено ИИ', data.questions_to_client));
  for (const st of data.steps || []) steps.push(mk(st.title, st.why, st.items || []));
  if (data.risks?.length) steps.push(mk('Риски', 'Предложено ИИ', data.risks));
  return { approach: approach.id, source: 'ai', model, summary: data.summary || '', steps };
}

// Контекст для модели: только то, что есть в базе и в разборе.
function aiContext(f, { approach, selected, questions, intakeQs, contextRu }) {
  return {
    situation: f.situation,
    scale: f.scale,
    model: [].concat(f.model || []).join(', '),
    offer: f.offer,
    market: f.market,
    maturity: Object.entries(f.maturity)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k} ${v}`)
      .join(', '),
    trajectory: f.trajectory === 'aging' ? 'стареет' : f.trajectory === 'growing' ? 'растёт' : '',
    intake: intakeQs.map((x) => `${x.q}: ${f.intake[x.n] || 'нет ответа'}`).join('\n'),
    approach: `# ${approach.data.title}\n\n${approach.body}`,
    problems: selected.map((p) => `# ${p.data.title}\n\n${p.body}`),
    questions: questions
      .filter((q) => f.questions.includes(q.key))
      .map((q) => `- ${q.q} (${q.who})`)
      .join('\n'),
    contextRu: f.market === 'ru' ? contextRu : '',
  };
}

// Строка пункта: отметка, текст с правкой по щелчку, удаление.
function PlanItem({ item, card, onChange, onDelete }) {
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState(item.text);
  useEffect(() => setText(item.text), [item.text]);
  const commit = () => {
    setEdit(false);
    if (text.trim() && text !== item.text) onChange({ ...item, text: text.trim() });
    else setText(item.text);
  };
  return (
    <li className="group flex gap-3 items-start py-1.5 -mx-2 px-2 rounded-medium hover:bg-default-50">
      <Checkbox size="sm" aria-label="Выполнено" isSelected={item.done} onValueChange={(v) => onChange({ ...item, done: v })} className="mt-px" />
      <div className="flex-1 min-w-0">
        {edit ? (
          <Textarea
            autoFocus
            minRows={1}
            size="sm"
            variant="bordered"
            aria-label="Текст пункта"
            value={text}
            onValueChange={setText}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                commit();
              }
              if (e.key === 'Escape') {
                setText(item.text);
                setEdit(false);
              }
            }}
          />
        ) : (
          <div className={item.done ? 'opacity-45 line-through decoration-default-300' : ''} onDoubleClick={() => setEdit(true)}>
            <Markdown text={item.text} card={card} compact />
          </div>
        )}
      </div>
      {!edit && (
        <div className="flex opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <IconButtonSm label="Изменить" icon={Pencil} onPress={() => setEdit(true)} />
          <IconButtonSm label="Удалить пункт" icon={Trash2} onPress={onDelete} />
        </div>
      )}
    </li>
  );
}

function IconButtonSm({ label, icon: I, onPress }) {
  return (
    <Tooltip content={label} delay={400}>
      <Button isIconOnly size="sm" variant="light" aria-label={label} className="min-w-7 w-7 h-7" onPress={onPress}>
        <I size={14} className="text-default-500" />
      </Button>
    </Tooltip>
  );
}

function AddLine({ placeholder, onAdd }) {
  const [v, setV] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (v.trim()) {
          onAdd(v.trim());
          setV('');
        }
      }}
    >
      <Input
        size="sm"
        variant="underlined"
        aria-label={placeholder}
        placeholder={placeholder}
        value={v}
        onValueChange={setV}
        startContent={<Plus size={14} className="text-default-400" />}
        classNames={{ inputWrapper: 'shadow-none' }}
      />
    </form>
  );
}

function StepPlan({ f, set, approach, plan, total, done, rebuild, aiContext }) {
  const { openCard, setView, byId, ask } = useApp();
  const [ai, setAi] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    window.dt.ai.config().then(setAi);
  }, []);
  const active = ai?.providers.find((p) => p.id === ai.active);
  const pct = total ? Math.round((done / total) * 100) : 0;
  const s = sections(approach.body);

  const setPlan = (fn) => set('plan', { ...fn(plan), edited: true });
  const setStep = (id, fn) => setPlan((p) => ({ ...p, steps: p.steps.map((st) => (st.id === id ? fn(st) : st)) }));
  const touched = planTouched(plan);

  const runAI = async () => {
    if (touched && !(await ask({ title: 'Заменить регламент черновиком от ИИ?', text: 'Отметки, заметки и ваши правки в текущем регламенте пропадут.', action: 'Заменить', danger: true }))) return;
    setBusy(true);
    const r = await window.dt.ai.plan(aiContext());
    setBusy(false);
    if (!r.ok) {
      addToast({ title: 'ИИ не смог собрать регламент', description: r.error, color: 'danger' });
      return;
    }
    set('plan', planFromAI(approach, r.plan, r.model));
    addToast({ title: 'Черновик от ИИ готов', description: 'Проверьте каждый пункт и ссылки на страницы.', color: 'success' });
  };

  return (
    <>
      <div className="rounded-large bg-content1 border border-default-200/70 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs text-default-500">
              Регламент по выбранной рекомендации ·{' '}
              {plan.source === 'ai' ? `черновик ИИ (${plan.model || 'модель'}), проверьте` : 'собран из карточек базы'}
            </div>
            <button className="text-lg font-semibold tracking-tight text-left hover:text-primary mt-0.5" onClick={() => openCard(approach.id)}>
              {approach.data.title}
            </button>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Tooltip content="Собрать заново из карточек базы" delay={300}>
              <Button
                size="sm"
                variant="light"
                startContent={<RotateCcw size={14} />}
                onPress={async () => (!touched || (await ask({ title: 'Собрать регламент заново?', text: 'Регламент будет собран из карточек базы. Отметки, заметки и ваши правки пропадут.', action: 'Собрать заново', danger: true }))) && rebuild()}
              >
                Из базы
              </Button>
            </Tooltip>
            <Tooltip
              content={active ? `Собрать черновик с помощью ${active.name}` : 'Модель не подключена — Настройки → ИИ-помощник'}
              delay={300}
              className="max-w-xs"
            >
              <span>
                <Button
                  size="sm"
                  variant="flat"
                  color="primary"
                  startContent={!busy && <Wand2 size={14} />}
                  isLoading={busy}
                  isDisabled={!active}
                  onPress={runAI}
                >
                  Черновик с ИИ
                </Button>
              </span>
            </Tooltip>
          </div>
        </div>
        {plan.summary && <p className="text-sm text-default-600 mt-3">{plan.summary}</p>}
        <div className="flex items-center gap-3 mt-4">
          <Progress aria-label="Выполнено" value={pct} size="sm" color={pct === 100 ? 'success' : 'primary'} className="flex-1" />
          <span className="text-xs text-default-500 tabular">
            {done} из {total}
          </span>
        </div>
        <p className="text-[11px] text-default-400 mt-2">Двойной щелчок по пункту — изменить. Пункты, шаги и заметки можно добавлять вручную.</p>
      </div>

      <PlanGoals f={f} />

      <ol className="relative space-y-4 before:absolute before:left-[15px] before:top-3 before:bottom-3 before:w-px before:bg-default-200">
        {plan.steps.map((st, i) => {
          const doneHere = st.items.filter((x) => x.done).length;
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
              <div className="group/step rounded-large bg-content1 border border-default-200/70">
                <div className="flex items-start justify-between gap-2 px-5 pt-4 pb-1">
                  <div className="min-w-0 flex-1">
                    <input
                      aria-label="Название шага"
                      className="w-full bg-transparent outline-none font-semibold text-[14px] rounded focus:bg-default-50 -mx-1 px-1"
                      value={st.title}
                      onChange={(e) => setStep(st.id, (x) => ({ ...x, title: e.target.value }))}
                    />
                    {st.hint && <div className="text-[11px] text-default-500">{st.hint}</div>}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-default-400 tabular mr-1">
                      {doneHere}/{st.items.length}
                    </span>
                    <span className="opacity-0 group-hover/step:opacity-100 transition-opacity">
                      <IconButtonSm
                        label="Удалить шаг"
                        icon={Trash2}
                        onPress={async () => (await ask({ title: 'Удалить шаг?', text: `Шаг «${st.title}» и его пункты будут удалены из регламента.`, action: 'Удалить', danger: true })) && setPlan((p) => ({ ...p, steps: p.steps.filter((x) => x.id !== st.id) }))}
                      />
                    </span>
                  </div>
                </div>
                <ul className="px-5 py-1">
                  {st.items.map((it) => (
                    <PlanItem
                      key={it.id}
                      item={it}
                      card={byId.get(st.card)}
                      onChange={(n) => setStep(st.id, (x) => ({ ...x, items: x.items.map((y) => (y.id === it.id ? n : y)) }))}
                      onDelete={() => setStep(st.id, (x) => ({ ...x, items: x.items.filter((y) => y.id !== it.id) }))}
                    />
                  ))}
                </ul>
                <div className="px-5 pb-4 space-y-2">
                  <AddLine placeholder="Добавить пункт и нажать Enter" onAdd={(text) => setStep(st.id, (x) => ({ ...x, items: [...x.items, { id: uid(), text, done: false }] }))} />
                  <Input
                    size="sm"
                    variant="flat"
                    aria-label="Заметка к шагу"
                    placeholder="Заметка: кто, когда, что адаптировать"
                    value={st.note || ''}
                    onValueChange={(v) => setStep(st.id, (x) => ({ ...x, note: v }))}
                  />
                </div>
              </div>
            </li>
          );
        })}
        <li className="relative pl-11">
          <span className="absolute left-0 top-1 size-8 rounded-full grid place-items-center border-2 border-dashed border-default-300 bg-background text-default-400">
            <Plus size={14} />
          </span>
          <AddLine
            placeholder="Добавить шаг: название и Enter"
            onAdd={(title) => setPlan((p) => ({ ...p, steps: [...p.steps, { id: uid(), title, hint: 'Добавлено вручную', card: approach.id, note: '', items: [] }] }))}
          />
        </li>
      </ol>

      <Panel title="Опора" subtitle="Источники подхода. Ссылки на страницы в пунктах выше открывают сам текст книги." icon={BookOpen}>
        <div className="flex flex-wrap gap-1.5">
          {(approach.data.sources || []).map((id) => (
            <Chip key={id} color="secondary" variant="flat" className="cursor-pointer" onClick={() => openCard(id)}>
              {byId.get(id)?.data.cite || id}
            </Chip>
          ))}
        </div>
      </Panel>
      {s['Как я его адаптирую'] && (
        <Panel title="Как я его адаптирую" subtitle="Раздел автора в карточке подхода. Пока черновые вопросы." icon={PenLine}>
          <Markdown text={s['Как я его адаптирую']} card={approach} compact />
        </Panel>
      )}
      {!ai?.providers.length && (
        <p className="text-xs text-default-500">
          ИИ не подключён — регламент заполняется вручную.{' '}
          <button className="text-primary" onClick={() => setView('settings')}>
            Подключить модель
          </button>
        </p>
      )}
    </>
  );
}

function PlanGoals({ f }) {
  const { byId } = useApp();
  const selected = f.problems.map((id) => byId.get(id)).filter(Boolean);
  const success = selected.map((p) => ({ p, t: sectionStarting(sections(p.body), 'Как понять') })).filter((x) => x.t);
  const maturityText = selected.map((p) => ({ p, t: sectionStarting(sections(p.body), 'Что делать') })).filter((x) => x.t);
  return (
    <>
      <Panel title="Цель и как понять, что стало лучше" icon={Target}>
        {success.length ? success.map(({ p, t }) => <Markdown key={p.id} text={t} card={p} compact />) : <p className="text-default-500 text-sm">В выбранных проблемах критерий не описан.</p>}
      </Panel>
      {maturityText.length > 0 && (
        <Accordion variant="splitted" className="px-0" itemClasses={{ base: 'shadow-none border border-default-200/70', title: 'text-[0.95rem] font-semibold' }}>
          <AccordionItem key="m" title="Что делать в зависимости от зрелости" startContent={<Gauge size={17} className="text-default-400" />}>
            {maturityText.map(({ p, t }) => (
              <Markdown key={p.id} text={t} card={p} compact />
            ))}
          </AccordionItem>
        </Accordion>
      )}
    </>
  );
}

/* ---------- Сводка справа ---------- */

function Summary({ f, set, toggle, taxonomy, selected, approach, planTotal, planDone, unanswered, setTab }) {
  const { openCard } = useApp();
  const ctx = ['scale', 'model', 'offer', 'market'].flatMap((k) => [].concat(f[k] || []));
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
              ctx.map((id) => (
                <Chip key={id} size="sm" variant="flat" className="h-6">
                  {typeName(id).split(' — ')[0]}
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
                <Progress aria-label="Регламент" size="sm" value={planTotal ? (planDone / planTotal) * 100 : 0} className="flex-1" />
                <span className="text-[11px] text-default-400 tabular">
                  {planDone}/{planTotal}
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

// Состояние разбора прячется в комментарий в конце файла, чтобы разбор можно было продолжить.
export const STATE_RE = /<!-- dt-state:([A-Za-z0-9+/=]+) -->/;
const encodeState = (f) => btoa(unescape(encodeURIComponent(JSON.stringify({ ...f, savedAt: '' }))));
export const decodeState = (s) => JSON.parse(decodeURIComponent(escape(atob(s))));

function toMarkdown(f, { selected, questions, approach, intakeQs }, { forClient } = {}) {
  const date = new Date().toISOString().slice(0, 10);
  const cats = [...new Set(selected.flatMap((p) => [].concat(p.data.category || [])).concat(f.categories))];
  const out = [];
  if (!forClient) {
    out.push(
      '---',
      `date: ${date}`,
      `mode: ${f.mode}`,
      `scale: ${f.scale || ''}`,
      `model: [${[].concat(f.model || []).join(', ')}]`,
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
      `real: ${f.real === false ? 'false' : 'true'}`,
      `outcome: ${f.outcome ? JSON.stringify(f.outcome) : ''}`,
      'case:',
      'tool: design-tools-app',
      '---',
      ''
    );
  }
  out.push(`# ${f.title || 'Разбор'}`, '', '## Ситуация', '', f.situation, '', '## Уточнение', '');
  for (const x of intakeQs) out.push(`${x.n}. **${x.q}** ${f.intake[x.n] ? f.intake[x.n] : '_нет ответа_'}`);
  out.push('', '## Проблемы', '');
  for (const p of selected) out.push(`- ${forClient ? '' : `\`${p.id}\` — `}${p.data.title}`);
  out.push('', '## Вопросы для диагностики', '');
  for (const q of questions.filter((q) => f.questions.includes(q.key))) out.push(`- ${q.q} — ${q.who}. ${q.src ? `(${q.src})` : ''}`);
  if (approach && f.plan) {
    out.push('', '## Выбранный путь', '', `${forClient ? '' : `\`${approach.id}\` — `}${approach.data.title}`);
    if (f.plan.summary) out.push('', f.plan.summary);
    out.push('', `## Регламент${f.plan.source === 'ai' && !forClient ? ` (черновик ИИ: ${f.plan.model || ''})` : ''}`, '');
    f.plan.steps.forEach((st, i) => {
      out.push(`### Шаг ${i + 1}. ${st.title}`, '');
      st.items.forEach((it) => out.push(`- [${it.done ? 'x' : ' '}] ${it.text}`));
      if (st.note) out.push('', `Заметка: ${st.note}`);
      out.push('');
    });
  }
  if (f.outcome) out.push('## Итог', '', f.outcome, '');
  if (!forClient) out.push(`<!-- dt-state:${encodeState(f)} -->`, '');
  return out.join('\n');
}
