// Проверка ИИ-помощника без ключей: локальный сервер, совместимый с OpenAI, отвечает готовым JSON.
import http from 'http';
import { _electron as electron } from 'playwright-core';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let lastPrompt = '';
const server = http
  .createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const j = JSON.parse(body || '{}');
      lastPrompt = j.messages?.map((m) => m.content).join('\n') || '';
      const plan = {
        summary: 'Тестовый ответ модели: сначала разобрать спрос, потом менять показатели.',
        steps: [{ title: 'Разметить обращения', why: 'Понять долю спроса-сбоя', items: ['Выгрузить 200 обращений (Седдон, с. 38)', 'Разметить с операторами (гипотеза)'] }],
        risks: ['Разметка по кодам CRM теряет взгляд клиента'],
        questions_to_client: ['Кто владеет данными обращений?'],
      };
      const content = j.response_format ? JSON.stringify(plan) : 'работает';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ model: 'mock-model', choices: [{ message: { content } }] }));
    });
  })
  .listen(18765);

const app = await electron.launch({ args: [root, '--no-sandbox'] });
const win = await app.firstWindow();
const errors = [];
win.on('pageerror', (e) => errors.push(String(e)));
win.on('dialog', (d) => d.accept());
await win.setViewportSize({ width: 1440, height: 900 });
await win.waitForSelector('text=Новый разбор', { timeout: 30000 });
const cfg = await win.evaluate(async () => {
  const c = await window.dt.ai.save({ kind: 'openai', name: 'Тестовая локальная модель', baseURL: 'http://localhost:18765/v1', model: 'mock-model' }, '');
  const p = c.providers.find((x) => x.name === 'Тестовая локальная модель');
  await window.dt.ai.setActive(p.id);
  return { id: p.id, test: await window.dt.ai.test(p.id) };
});
console.log('Проверка подключения:', cfg.test.message);
await win.getByRole('button', { name: 'Настройки' }).click();
await win.waitForTimeout(700);
await win.getByText('ИИ-помощник').scrollIntoViewIfNeeded();
await win.screenshot({ path: path.join(root, 'tests', 'screens', 'ai-settings.png') });
// Открыть первый тестовый разбор и собрать черновик с ИИ.
await win.getByRole('button', { name: /Мои разборы/ }).click();
await win.waitForTimeout(600);
await win.getByRole('button', { name: 'Продолжить' }).click();
await win.waitForTimeout(900);
await win.getByRole('button', { name: 'Черновик с ИИ' }).click();
await win.waitForTimeout(2000);
const ok = (await win.getByText('Выгрузить 200 обращений').count()) + (await win.locator('input[value="Разметить обращения"]').count());
await win.screenshot({ path: path.join(root, 'tests', 'screens', 'ai-plan.png') });
console.log('Черновик ИИ в регламенте:', ok > 0, '· контекст передан:', lastPrompt.includes('Выбранный подход'));
// Вернуть настройки: удалить тестовую модель.
await win.evaluate(async (id) => window.dt.ai.remove(id), cfg.id);
console.log(errors.length ? 'ОШИБКИ:\n' + errors.join('\n') : 'Ошибок нет');
await app.close();
server.close();
