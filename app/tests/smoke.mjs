// Дымовой тест: запускает Electron, проходит по экранам, открывает страницу книги, делает снимки.
import { _electron as electron } from 'playwright-core';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shots = path.join(root, 'tests', 'screens');
mkdirSync(shots, { recursive: true });

const app = await electron.launch({ args: [root, '--no-sandbox'], env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: '1' } });
const win = await app.firstWindow();
const errors = [];
win.on('pageerror', (e) => errors.push(String(e)));
win.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
win.on('dialog', (d) => d.accept());
await win.setViewportSize({ width: 1440, height: 900 });
await win.waitForSelector('text=Новый разбор', { timeout: 30000 });
await win.waitForTimeout(1200);
const snap = (n) => win.screenshot({ path: path.join(shots, n + '.png') });
const step = async (name) => {
  await win.getByRole('button', { name, exact: true }).last().click();
  await win.waitForTimeout(700);
};

await win.getByRole('button', { name: 'Новый', exact: true }).click();
await win.waitForTimeout(400);
// Если в черновике была несохранённая работа, программа спросит — подтверждаем.
if (await win.getByRole('button', { name: 'Начать новый' }).count()) await win.getByRole('button', { name: 'Начать новый' }).click();
await win.waitForTimeout(400);
await win.getByLabel('Ситуация', { exact: true }).fill(
  'Сеть сервисных центров на 300 человек. Ввели KPI по времени ответа и количеству звонков, премии привязаны к плану. Цифры зелёные, клиенты жалуются, менеджеры подгоняют отчёты. Отделы не стыкуются между собой.'
);
await win.getByLabel('Название разбора').fill('Тест: KPI в сервисной сети');
await win.getByRole('radiogroup', { name: 'управление' }).getByRole('radio', { name: '1' }).click();
await win.waitForTimeout(400);
await snap('01-situation');
await step('Проблемы и вопросы');
await win.getByRole('checkbox', { name: /Показатель стал целью/ }).first().click();
await win.waitForTimeout(500);
await snap('02-problems');
await step('Рекомендации');
await snap('03-recs');
await win.getByRole('button', { name: 'Выбрать', exact: true }).first().click();
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

await win.getByRole('button', { name: 'Карта' }).first().click();
await win.waitForTimeout(800);
await win.getByRole('button', { name: /Показатель стал целью/ }).first().click();
await win.waitForTimeout(600);
await snap('06-map');
await win.getByRole('button', { name: /^Подходы/ }).first().click();
await win.waitForTimeout(800);
await snap('07-library');
await win.keyboard.press('Control+k');
await win.waitForTimeout(400);
await win.keyboard.type('Голдратт');
await win.waitForTimeout(400);
await snap('08-palette');
await win.keyboard.press('Enter');
await win.waitForTimeout(600);
await snap('09-source');
await win.getByRole('button', { name: /Мои разборы/ }).click();
await win.waitForTimeout(600);
await snap('10-analyses');
await win.getByRole('button', { name: 'Сменить тему' }).click();
await win.getByRole('button', { name: /Новый разбор/ }).click();
await win.waitForTimeout(600);
await snap('11-dark');
await win.getByRole('button', { name: 'Сменить тему' }).click();

const counts = await win.evaluate(async () => {
  const b = await window.dt.loadBase();
  return { ok: b.ok, p: b.problems?.length, a: b.approaches?.length, s: b.sources?.length, lib: b.library?.ok };
});
console.log('База:', JSON.stringify(counts));
console.log(errors.length ? 'ОШИБКИ:\n' + errors.join('\n') : 'Ошибок в консоли нет');
await app.close();
process.exit(errors.length ? 1 : 0);
