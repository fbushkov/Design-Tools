// ИИ-помощник: подключение разных моделей. Ключи хранятся только на этом компьютере,
// зашифрованные средствами системы (Electron safeStorage).
const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');
const Anthropic = require('@anthropic-ai/sdk').default;
const { betaJSONSchemaOutputFormat } = require('@anthropic-ai/sdk/helpers/beta/json-schema');

// Типы подключений. Claude — через официальный SDK; остальные — по протоколу,
// совместимому с OpenAI Chat Completions (OpenAI, OpenRouter, Ollama, LM Studio и др.).
const PRESETS = [
  { kind: 'anthropic', name: 'Claude (Anthropic)', baseURL: '', model: 'claude-opus-5-5', needsKey: true },
  { kind: 'openai', name: 'OpenAI', baseURL: 'https://api.openai.com/v1', model: '', needsKey: true },
  { kind: 'openai', name: 'OpenRouter', baseURL: 'https://openrouter.ai/api/v1', model: '', needsKey: true },
  { kind: 'openai', name: 'Ollama (на этом компьютере)', baseURL: 'http://localhost:11434/v1', model: '', needsKey: false },
  { kind: 'openai', name: 'LM Studio (на этом компьютере)', baseURL: 'http://localhost:1234/v1', model: '', needsKey: false },
  { kind: 'openai', name: 'Другой, совместимый с OpenAI', baseURL: '', model: '', needsKey: true },
];

// Модели Claude, которые принимают серверный запасной вариант при отказе.
const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-fable-5-1', 'claude-opus-5', 'claude-sonnet-5-5']);

const cfgFile = () => path.join(app.getPath('userData'), 'ai.json');
const keyFile = () => path.join(app.getPath('userData'), 'ai-keys.json');

function readJSON(f, fallback) {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch (e) {
    return fallback;
  }
}
function writeJSON(f, v) {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(v, null, 2));
}

function config() {
  return readJSON(cfgFile(), { active: 'none', providers: [] });
}

function getKey(id) {
  const keys = readJSON(keyFile(), {});
  if (!keys[id]) return '';
  try {
    return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(Buffer.from(keys[id], 'base64')) : Buffer.from(keys[id], 'base64').toString();
  } catch (e) {
    return '';
  }
}

function setKey(id, key) {
  const keys = readJSON(keyFile(), {});
  if (key === null) delete keys[id];
  else keys[id] = (safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(key) : Buffer.from(key)).toString('base64');
  writeJSON(keyFile(), keys);
}

// То, что видит интерфейс: без ключей, только признак «ключ сохранён».
function publicConfig() {
  const c = config();
  return { ...c, presets: PRESETS, providers: c.providers.map((p) => ({ ...p, hasKey: !!getKey(p.id) })), encrypted: safeStorage.isEncryptionAvailable() };
}

function saveProvider(p, key) {
  const c = config();
  const id = p.id || 'p' + Date.now().toString(36);
  const clean = { id, kind: p.kind, name: p.name, baseURL: (p.baseURL || '').replace(/\/+$/, ''), model: p.model, effort: p.effort || 'high' };
  const i = c.providers.findIndex((x) => x.id === id);
  if (i >= 0) c.providers[i] = clean;
  else c.providers.push(clean);
  if (key !== undefined && key !== '') setKey(id, key);
  writeJSON(cfgFile(), c);
  return publicConfig();
}

function removeProvider(id) {
  const c = config();
  c.providers = c.providers.filter((p) => p.id !== id);
  if (c.active === id) c.active = 'none';
  setKey(id, null);
  writeJSON(cfgFile(), c);
  return publicConfig();
}

function setActive(id) {
  const c = config();
  c.active = id;
  writeJSON(cfgFile(), c);
  return publicConfig();
}

// ---------- Вызов модели ----------

const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'steps', 'risks', 'questions_to_client'],
  properties: {
    summary: { type: 'string', description: 'Два-три предложения: в чём суть пути для этой ситуации' },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'why', 'items'],
        properties: {
          title: { type: 'string' },
          why: { type: 'string', description: 'Зачем шаг, одной фразой' },
          items: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    risks: { type: 'array', items: { type: 'string' } },
    questions_to_client: { type: 'array', items: { type: 'string' } },
  },
};

const SYSTEM = `Ты помогаешь консультанту по стратегическому и сервис-дизайну составить регламент действий по выбранному подходу для конкретной ситуации клиента.

Правила:
- Опирайся только на переданные карточки базы знаний и описание ситуации. Ничего не придумывай о содержании книг.
- Ссылку на книгу давай только в форме «(Автор, с. N)» и только если эта страница есть в переданном тексте карточки. Если пункт — твоё предложение без опоры в карточках, допиши в конце « (гипотеза)».
- Шаги — по порядку выполнения, 4–7 шагов. Пункты внутри шага — конкретные действия: кто, с кем, что сделать, какой результат. Без общих слов.
- Учитывай уровень зрелости, траекторию и раздел «На каких стадиях»: не предлагай того, что карточка называет вредным на этой стадии.
- Пиши по-русски, коротко.
Верни JSON строго по схеме.`;

function userPrompt(ctx) {
  const parts = [
    `## Ситуация\n${ctx.situation || '—'}`,
    `## Контекст\nМасштаб: ${ctx.scale || '—'}; модель: ${ctx.model || '—'}; предложение: ${ctx.offer || '—'}; рынок: ${ctx.market || '—'}\nЗрелость: ${ctx.maturity || '—'}\nТраектория: ${ctx.trajectory || 'не ясно'}`,
    `## Ответы на уточняющие вопросы\n${ctx.intake || '—'}`,
    `## Выбранный подход (карточка базы)\n${ctx.approach}`,
    ...ctx.problems.map((p) => `## Проблема (карточка базы)\n${p}`),
    ctx.questions ? `## Вопросы для диагностики, отмеченные консультантом\n${ctx.questions}` : '',
    ctx.contextRu ? `## Российская специфика (context/ru.md)\n${ctx.contextRu}` : '',
  ];
  return parts.filter(Boolean).join('\n\n');
}

function extractJSON(text) {
  try {
    return JSON.parse(text);
  } catch (e) {}
  const m = text.match(/\{[\s\S]*\}/);
  if (m) return JSON.parse(m[0]);
  throw new Error('Модель вернула не JSON');
}

async function callAnthropic(p, key, system, user, { test } = {}) {
  const client = new Anthropic({ apiKey: key, ...(p.baseURL ? { baseURL: p.baseURL } : {}) });
  const fallback = FALLBACK_MODELS.has(p.model);
  const params = {
    model: p.model,
    max_tokens: test ? 1024 : 16000,
    system,
    messages: [{ role: 'user', content: user }],
    output_config: { effort: test ? 'low' : p.effort || 'high', ...(test ? {} : { format: betaJSONSchemaOutputFormat(PLAN_SCHEMA) }) },
    ...(fallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {}),
  };
  const res = test ? await client.beta.messages.create(params) : await client.beta.messages.parse(params);
  if (res.stop_reason === 'refusal') throw new Error('Модель отказалась отвечать' + (res.stop_details?.explanation ? `: ${res.stop_details.explanation}` : ''));
  if (res.stop_reason === 'max_tokens') throw new Error('Ответ обрезан по длине — попробуйте ещё раз');
  if (test) return { text: res.content.filter((b) => b.type === 'text').map((b) => b.text).join(''), model: res.model };
  if (!res.parsed_output) throw new Error('Ответ модели не совпал со схемой');
  return { data: res.parsed_output, model: res.model };
}

async function callOpenAI(p, key, system, user, { test } = {}) {
  if (!p.baseURL) throw new Error('Не указан адрес сервиса (base URL)');
  if (!p.model) throw new Error('Не указана модель');
  const body = {
    model: p.model,
    messages: [
      { role: 'system', content: test ? system : system + '\n\nСхема ответа (JSON Schema):\n' + JSON.stringify(PLAN_SCHEMA) },
      { role: 'user', content: user },
    ],
    ...(test ? { max_tokens: 64 } : { response_format: { type: 'json_object' } }),
  };
  const r = await fetch(p.baseURL + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Сервис ответил ${r.status}: ${j.error?.message || JSON.stringify(j).slice(0, 200)}`);
  const text = j.choices?.[0]?.message?.content || '';
  if (test) return { text, model: j.model || p.model };
  return { data: extractJSON(text), model: j.model || p.model };
}

function humanError(e) {
  if (e instanceof Anthropic.AuthenticationError) return 'Неверный ключ API';
  if (e instanceof Anthropic.PermissionDeniedError) return 'Нет доступа к этой модели с этим ключом';
  if (e instanceof Anthropic.NotFoundError) return 'Модель не найдена — проверьте название';
  if (e instanceof Anthropic.RateLimitError) return 'Превышен лимит запросов — попробуйте позже';
  if (e instanceof Anthropic.BadRequestError) return 'Запрос отклонён: ' + e.message;
  if (e instanceof Anthropic.APIConnectionError) return 'Нет связи с сервисом';
  if (e instanceof Anthropic.APIError) return `Ошибка сервиса ${e.status}: ${e.message}`;
  if (e?.cause?.code === 'ECONNREFUSED') return 'Сервис не отвечает — он запущен?';
  return e?.message || String(e);
}

async function run(id, system, user, opts) {
  const c = config();
  const p = c.providers.find((x) => x.id === (id || c.active));
  if (!p) throw new Error('Модель не выбрана — включите её в настройках');
  const key = getKey(p.id);
  const preset = PRESETS.find((x) => x.kind === p.kind && (!x.baseURL || x.baseURL === p.baseURL));
  if (p.kind === 'anthropic' && !key) throw new Error('Не сохранён ключ API');
  if (preset?.needsKey && !key && p.kind === 'openai' && !/localhost|127\.0\.0\.1/.test(p.baseURL)) throw new Error('Не сохранён ключ API');
  return p.kind === 'anthropic' ? callAnthropic(p, key, system, user, opts) : callOpenAI(p, key, system, user, opts);
}

async function test(id) {
  try {
    const r = await run(id, 'Ответь одним словом.', 'Скажи «работает».', { test: true });
    return { ok: true, message: `Подключено: ${r.model}. Ответ: ${r.text.trim().slice(0, 60)}` };
  } catch (e) {
    return { ok: false, message: humanError(e) };
  }
}

async function plan(ctx) {
  try {
    const r = await run(null, SYSTEM, userPrompt(ctx));
    return { ok: true, plan: r.data, model: r.model };
  } catch (e) {
    return { ok: false, error: humanError(e) };
  }
}

module.exports = { publicConfig, saveProvider, removeProvider, setActive, test, plan };
