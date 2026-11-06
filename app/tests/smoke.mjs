// Дымовой тест: запускает Electron, проходит по экранам, открывает ссылку на страницу книги, делает снимки.
import { _electron as electron } from 'playwright-core';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shots = path.join(root, 'tests', 'screens');
mkdirSync(shots, { recursive: true });

const app = await electron.launch({
  args: [root, '--no-sandbox'],
  env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: '1' },
});
const win = await app.firstWindow();
const errors = [];
win.on('pageerror', (e) => errors.push(String(e)));
win.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await win.setViewportSize({ width: 1440, height: 900 });
await win.waitForSelector('text=Разбор', { timeout: 30000 });
await win.waitForTimeout(1500);
const snap = (n) => win.screenshot({ path: path.join(shots, n + '.png') });

await win.getByRole('button', { name: 'Новый' }).click();
await win.waitForTimeout(300);
await snap('01-analysis');
await win.getByLabel('Ситуация словами заказчика').fill(
  'Сеть сервисных центров. Ввели KPI по времени ответа и количеству звонков, премии привязаны к плану. Цифры зелёные, клиенты жалуются, менеджеры подгоняют отчёты. Отделы не стыкуются между собой.'
);
await win.getByLabel('Название разбора').fill('Тест KPI в сервисной сети');
await win.getByRole('button', { name: 'Подобрать проблемы' }).click();
await win.waitForTimeout(800);
await win.locator('label:has-text("Показатель стал целью")').first().click();
await win.waitForTimeout(500);
await snap('02-problems');
await win.getByRole('button', { name: 'К рекомендациям' }).click();
await win.waitForTimeout(800);
await snap('03-recs');
await win.getByRole('button', { name: /Выбрать и собрать регламент/ }).first().click();
await win.waitForTimeout(800);
await snap('04-plan');
const cite = win.locator('a.cite-link').first();
if (await cite.count()) {
  await cite.click();
  await win.waitForTimeout(1200);
  await snap('05-page');
  await win.keyboard.press('Escape');
  await win.waitForTimeout(400);
} else errors.push('нет ссылок на страницы в регламенте');

await win.getByRole('button', { name: 'Карта' }).click();
await win.waitForTimeout(1000);
await snap('06-map');
await win.getByRole('button', { name: 'Подходы' }).click();
await win.waitForTimeout(800);
await win.getByRole('option').first().click();
await win.waitForTimeout(800);
await snap('07-card');
await win.keyboard.press('Escape');
await win.getByRole('button', { name: 'Разборы' }).click();
await win.waitForTimeout(800);
await snap('08-analyses');

const counts = await win.evaluate(async () => {
  const b = await window.dt.loadBase();
  return { ok: b.ok, p: b.problems?.length, a: b.approaches?.length, s: b.sources?.length, lib: b.library?.ok };
});
console.log('База:', JSON.stringify(counts));
console.log(errors.length ? 'ОШИБКИ:\n' + errors.join('\n') : 'Ошибок в консоли нет');
await app.close();
process.exit(errors.length ? 1 : 0);
