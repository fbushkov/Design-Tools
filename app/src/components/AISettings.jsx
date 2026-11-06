import { useEffect, useState } from 'react';
import { Button, Input, Select, SelectItem, Chip, addToast, Tooltip } from '@heroui/react';
import { Plus, Trash2, Pencil, PlugZap, KeyRound, ShieldCheck } from 'lucide-react';
import { Panel } from './ui.jsx';

const CLAUDE_MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 — по умолчанию' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 — быстрее и дешевле' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 — самый дешёвый' },
  { id: 'claude-fable-5-1', label: 'Claude Fable 5.1 — самый сильный и дорогой' },
];
const EFFORT = [
  { id: 'low', label: 'низкая — быстро' },
  { id: 'medium', label: 'средняя' },
  { id: 'high', label: 'высокая — рекомендуется' },
  { id: 'xhigh', label: 'очень высокая' },
];

function Editor({ cfg, initial, onDone }) {
  const [p, setP] = useState(initial);
  const [key, setKey] = useState('');
  const preset = cfg.presets.find((x) => x.name === p.preset) || cfg.presets.find((x) => x.kind === p.kind && x.baseURL === p.baseURL);
  const isClaude = p.kind === 'anthropic';
  const choosePreset = (name) => {
    const pr = cfg.presets.find((x) => x.name === name);
    if (pr) setP({ ...p, preset: name, kind: pr.kind, name: p.id ? p.name : pr.name, baseURL: pr.baseURL, model: pr.model || p.model });
  };
  const valid = p.name && p.model && (isClaude || p.baseURL) && (!preset?.needsKey || key || p.hasKey || /localhost|127\.0\.0\.1/.test(p.baseURL));
  return (
    <div className="rounded-large border border-primary-200 bg-primary-50/40 p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Select size="sm" variant="bordered" label="Сервис" selectedKeys={preset ? [preset.name] : []} onSelectionChange={(k) => choosePreset([...k][0])}>
          {cfg.presets.map((x) => (
            <SelectItem key={x.name}>{x.name}</SelectItem>
          ))}
        </Select>
        <Input size="sm" variant="bordered" label="Название в списке" value={p.name || ''} onValueChange={(v) => setP({ ...p, name: v })} />
        {isClaude ? (
          <Select size="sm" variant="bordered" label="Модель" selectedKeys={p.model ? [p.model] : []} onSelectionChange={(k) => setP({ ...p, model: [...k][0] || '' })}>
            {CLAUDE_MODELS.map((m) => (
              <SelectItem key={m.id} description={m.id}>
                {m.label}
              </SelectItem>
            ))}
          </Select>
        ) : (
          <Input size="sm" variant="bordered" label="Модель" placeholder="например gpt-5 или qwen3:14b" value={p.model || ''} onValueChange={(v) => setP({ ...p, model: v })} />
        )}
        {isClaude ? (
          <Select size="sm" variant="bordered" label="Глубина рассуждения" selectedKeys={[p.effort || 'high']} onSelectionChange={(k) => setP({ ...p, effort: [...k][0] || 'high' })}>
            {EFFORT.map((m) => (
              <SelectItem key={m.id}>{m.label}</SelectItem>
            ))}
          </Select>
        ) : (
          <Input size="sm" variant="bordered" label="Адрес сервиса (base URL)" placeholder="https://…/v1" value={p.baseURL || ''} onValueChange={(v) => setP({ ...p, baseURL: v })} />
        )}
        <Input
          size="sm"
          variant="bordered"
          type="password"
          label="Ключ API"
          className="col-span-2"
          placeholder={p.hasKey ? 'ключ сохранён — введите новый, чтобы заменить' : preset?.needsKey === false ? 'для локальной модели не нужен' : ''}
          value={key}
          onValueChange={setKey}
          startContent={<KeyRound size={14} className="text-default-400" />}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="light" onPress={() => onDone(null)}>
          Отмена
        </Button>
        <Button size="sm" color="primary" isDisabled={!valid} onPress={async () => onDone(await window.dt.ai.save(p, key))}>
          Сохранить
        </Button>
      </div>
    </div>
  );
}

// Настройки ИИ-помощника. Без модели всё работает вручную.
export default function AISettings() {
  const [cfg, setCfg] = useState(null);
  const [edit, setEdit] = useState(null);
  const [testing, setTesting] = useState('');
  const [result, setResult] = useState({});
  useEffect(() => {
    window.dt.ai.config().then(setCfg);
  }, []);
  if (!cfg) return null;

  const Row = ({ id, title, sub, active, children }) => (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-medium border transition-colors ${
        active ? 'border-primary bg-primary-50/50' : 'border-default-200/70 hover:border-default-300'
      }`}
    >
      <button
        role="radio"
        aria-checked={active}
        aria-label={`Выбрать: ${title}`}
        onClick={async () => setCfg(await window.dt.ai.setActive(id))}
        className={`size-4 rounded-full border-2 grid place-items-center shrink-0 ${active ? 'border-primary' : 'border-default-300'}`}
      >
        {active && <span className="size-2 rounded-full bg-primary" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium">{title}</div>
        <div className="text-[11px] text-default-500 truncate">{sub}</div>
        {result[id] && <div className={`text-[11px] mt-0.5 ${result[id].ok ? 'text-success-600' : 'text-danger'}`}>{result[id].message}</div>}
      </div>
      {children}
    </div>
  );

  return (
    <Panel
      title="ИИ-помощник"
      subtitle="Необязателен. Без модели регламент собирается из карточек базы и правится вручную. Можно подключить несколько моделей и выбрать активную."
      actions={
        !edit && (
          <Button size="sm" variant="flat" startContent={<Plus size={14} />} onPress={() => setEdit({ kind: 'anthropic', name: 'Claude', model: 'claude-opus-5-5', effort: 'high', baseURL: '' })}>
            Добавить модель
          </Button>
        )
      }
    >
      <div className="space-y-2" role="radiogroup" aria-label="Активная модель">
        <Row id="none" title="Без ИИ — заполняю вручную" sub="Кнопка «Черновик с ИИ» будет неактивна" active={cfg.active === 'none'} />
        {cfg.providers.map((p) => (
          <Row
            key={p.id}
            id={p.id}
            title={p.name}
            sub={`${p.kind === 'anthropic' ? 'Anthropic' : p.baseURL} · ${p.model}${p.hasKey ? ' · ключ сохранён' : ''}`}
            active={cfg.active === p.id}
          >
            <div className="flex items-center gap-0.5">
              <Tooltip content="Проверить подключение" delay={300}>
                <Button
                  size="sm"
                  variant="light"
                  isIconOnly
                  aria-label="Проверить"
                  isLoading={testing === p.id}
                  onPress={async () => {
                    setTesting(p.id);
                    const r = await window.dt.ai.test(p.id);
                    setTesting('');
                    setResult((x) => ({ ...x, [p.id]: r }));
                  }}
                >
                  <PlugZap size={15} />
                </Button>
              </Tooltip>
              <Tooltip content="Изменить" delay={300}>
                <Button size="sm" variant="light" isIconOnly aria-label="Изменить" onPress={() => setEdit(p)}>
                  <Pencil size={15} />
                </Button>
              </Tooltip>
              <Tooltip content="Удалить" delay={300}>
                <Button
                  size="sm"
                  variant="light"
                  isIconOnly
                  aria-label="Удалить"
                  onPress={async () => window.confirm(`Удалить «${p.name}» и её ключ?`) && setCfg(await window.dt.ai.remove(p.id))}
                >
                  <Trash2 size={15} />
                </Button>
              </Tooltip>
            </div>
          </Row>
        ))}
        {edit && (
          <Editor
            cfg={cfg}
            initial={edit}
            onDone={(next) => {
              if (next) {
                setCfg(next);
                addToast({ title: 'Модель сохранена', description: 'Нажмите значок вилки, чтобы проверить подключение.', color: 'success' });
              }
              setEdit(null);
            }}
          />
        )}
      </div>
      <div className="mt-4 rounded-medium bg-default-50 border border-default-200/70 p-3 text-xs text-default-600 space-y-1">
        <div className="flex items-center gap-1.5 font-medium text-default-700">
          <ShieldCheck size={14} /> Что уходит в модель
        </div>
        <p>
          Текст ситуации, ответы на вопросы, выбранные карточки базы и отмеченные вопросы. Названия компаний и людей в разбор не вписывайте. Локальные модели (Ollama,
          LM Studio) работают без интернета.
        </p>
        <p>
          Ключи хранятся только на этом компьютере{cfg.encrypted ? ', зашифрованными средствами Windows' : ''}. Оплата — у выбранного сервиса, отдельно от подписки
          Claude.
        </p>
      </div>
    </Panel>
  );
}
