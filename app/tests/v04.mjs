// Проверки версии 0.4 (пункты 7–15 аудита): итог и шапка файла, корзина, дополнение регламента,
// сворачивание и критерии, узкое окно, книги по главам, отмена ИИ, кнопка «Обновить базу».
// Запуск: DT_BASE_DIR=<копия базы> DT_LIB_DIR=<копия библиотеки> xvfb-run -a node tests/v04.mjs
// Обе папки должны быть копиями: тест скачивает, сохраняет и удаляет.
import http from 'http';
import { _electron as electron } from 'playwright-core';
import { createRequire } from 'module';
import { readFileSync, existsSync, readdirSync, mkdtempSync, mkdirSync } from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lib = process.env.DT_LIB_DIR;
if (!lib || !process.env.DT_BASE_DIR) {
  console.log('Нужны DT_BASE_DIR и DT_LIB_DIR — копии базы и библиотеки.');
  process.exit(2);
}
const shots = path.join(root, 'tests', 'screens');
mkdirSync(shots, { recursive: true });
let failed = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${cond ? '' : ' — ' + extra}`);
  if (!cond) failed++;
};

// --- Без окна: чтение книг и правка шапки ---
const data = createRequire(import.meta.url)(path.join(root, 'electron', 'data.cjs'));
const mdDir = path.join(lib, 'md');
const has = (id) => existsSync(path.join(mdDir, id + '.md'));
if (has('auzan-2022-cultural-codes')) {
  const r = data.bookPage(lib, 'auzan-2022-cultural-codes', 0, 6);
  check('книга без страниц открывается по главе', r.ok && r.mode === 'chapters' && r.chapter === 6 && r.text.length > 1000, JSON.stringify({ ...r, text: undefined, sections: undefined }));
  check('к главе подобран раздел карты книги', r.ok && r.map.length > 0 && /Гл\. 6/.test(r.map[0]));
  const p = data.bookPage(lib, 'auzan-2022-cultural-codes', 12, 0);
  check('страница в книге без страниц: первая глава и пояснение', p.ok && p.chapter === 1 && /нет номеров страниц/.test(p.note), p.note);
}
if (has('seddon-2003-freedom-from-command')) {
  const r = data.bookPage(lib, 'seddon-2003-freedom-from-command', 0, 3);
  check('«гл. N» в книге со страницами ведёт к началу главы и в карту', r.ok && r.mode === 'pages' && r.page > 1 && r.map.length > 0, `с. ${r.page}`);
}
check('имя книги с путём наружу отклоняется', data.bookPage(lib, '../catalog', 1, 0).ok === false);
{
  const raw = '---\r\ndate: 2026-11-01\r\nmodel: [b2c, b2b]\r\nreal: false\r\noutcome:\r\ncase:\r\n---\r\n\r\n# Т\r\n';
  const next = data.patchHeader(raw, { outcome: 'Строка 1\nстрока "2"' });
  const diff = next.split('\r\n').filter((l, i) => l !== raw.split('\r\n')[i]);
  check('правка шапки меняет одну строку и сохраняет переводы строк', diff.length === 1 && diff[0].startsWith('outcome: "') && next.includes('date: 2026-11-01\r\n'), JSON.stringify(next));
}

// --- Сервер-заглушка ИИ, который не отвечает ---
const hung = [];
const server = http.createServer((req, res) => hung.push(res)).listen(18766);

const ud = mkdtempSync(path.join(os.tmpdir(), 'dt-v04-'));
const app = await electron.launch({ args: [root, '--no-sandbox', `--user-data-dir=${ud}`], env: { ...process.env, DT_NO_TRASH: '1', DT_AI_TIMEOUT_MS: '2500' } });
const win = await app.firstWindow();
const errors = [];
win.on('pageerror', (e) => errors.push(String(e)));
const dialogs = [];
win.on('dialog', (d) => {
  dialogs.push(d.message());
  d.accept();
});
await win.setViewportSize({ width: 1440, height: 900 });
await win.waitForSelector('text=Новый разбор', { timeout: 30000 });
const wait = (ms = 500) => win.waitForTimeout(ms);
// Текст на экране без неразрывных пробелов, которые ставит типограф.
const norm = (t) => String(t || '').replace(/[\u00a0\u202f]/g, ' ');
const screen = async () => norm(await win.locator('body').innerText());
const nav = (re) => win.locator('nav').getByRole('button', { name: re }).click();
const step = (re) => win.locator('ol[aria-label="Шаги разбора"]').getByRole('button', { name: re }).click();
const header = async () => (await win.locator('div.px-8.pt-6').innerText()).replace(/\u00a0/g, ' ');
const fileOf = (name) => path.join(lib, 'analyses', name);
const headerOf = (name) => readFileSync(fileOf(name), 'utf8').split(/\r?\n---/)[0].split(/\r?\n/);

// 15. Одна кнопка «Обновить базу».
check('значка «Перечитать базу» больше нет', (await win.getByRole('button', { name: 'Перечитать базу' }).count()) === 0);
await win.locator('nav').getByRole('button', { name: 'Обновить базу' }).click();
await win.waitForFunction(() => /скачана сегодня/.test(document.querySelector('[data-testid=last-pull]')?.textContent || ''), null, { timeout: 60000 }).catch(() => {});
await wait(300);
check('«Обновить базу» скачивает и перечитывает', /База уже свежая|База обновлена/.test(await screen()), (await screen()).slice(-300));
check('под кнопкой дата последнего скачивания', /скачана сегодня в \d\d:\d\d/.test(norm(await win.getByTestId('last-pull').innerText())), await win.getByTestId('last-pull').innerText());

// Новый разбор до регламента.
await nav(/Новый разбор/);
await win.getByRole('button', { name: 'Новый', exact: true }).click();
await wait(300);
if (await win.getByRole('button', { name: 'Начать новый' }).count()) await win.getByRole('button', { name: 'Начать новый' }).click();
await wait(300);
await win.getByLabel('Название разбора').fill('Проверка версии 0.4');
await win.getByLabel('Ситуация', { exact: true }).fill('Сервисная сеть. Ввели KPI по времени ответа, премии привязаны к плану, цифры зелёные, клиенты жалуются, отчёты подгоняют.');
await step(/Проблемы и вопросы/);
await wait(500);
await win.getByRole('checkbox', { name: /Показатель стал целью/ }).first().click();
await wait(400);
const qBoxes = win.locator('ul.divide-y input[type="checkbox"]');
await qBoxes.nth(0).click({ force: true });
await qBoxes.nth(1).click({ force: true });
await step(/Рекомендации/);
await wait(500);
await win.getByRole('button', { name: 'Выбрать', exact: true }).first().click();
await wait(900);
const expand = async () => {
  const b = win.getByRole('button', { name: 'Развернуть все' });
  if (await b.count()) await b.click();
  await wait(300);
};
await expand();
const items = win.getByRole('checkbox', { name: 'Выполнено' });
const n0 = await items.count();
check('свежий регламент не считается устаревшим', (await win.getByTestId('plan-stale').count()) === 0);
await items.nth(0).click();
const note = () => win.getByPlaceholder('Заметка: кто, когда, что адаптировать').first();
await note().fill('ЗАМЕТКА 0.4');
await wait(300);

// 10. Новые отмеченные вопросы попадают в регламент без потери правок.
await step(/Проблемы и вопросы/);
await wait(400);
await qBoxes.nth(2).click({ force: true });
await step(/Регламент/);
await wait(600);
check('регламент замечает, что выбор изменился', /Новых вопросов, которых нет в регламенте: 1/.test(norm(await win.getByTestId('plan-stale').innerText().catch(() => ''))), await win.getByTestId('plan-stale').innerText().catch(() => 'плашки нет'));
await win.screenshot({ path: path.join(shots, 'v04-stale.png') });
await win.getByTestId('plan-stale').getByRole('button', { name: /Добавить 1|Обновить регламент/ }).click();
await wait(600);
await expand();
check('пункт добавлен, плашка ушла', (await items.count()) === n0 + 1 && (await win.getByTestId('plan-stale').count()) === 0, `${n0} → ${await items.count()}`);
check('отметка и заметка на месте', (await items.nth(0).isChecked()) && (await note().inputValue()) === 'ЗАМЕТКА 0.4');

// 11. Критерии цели отмечаются; шаги сворачиваются; выполненное скрывается.
const goal = win.getByRole('checkbox', { name: 'Критерий выполнен' });
check('критерии цели — отмечаемые', (await goal.count()) > 0);
await goal.first().click();
await wait(300);
check('счётчик критериев', /1 из \d+/.test(await win.locator('section', { hasText: 'Цель и как понять' }).first().innerText()));
await win.getByRole('button', { name: 'Свернуть все' }).click();
await wait(300);
check('шаги сворачиваются', (await win.getByPlaceholder('Добавить пункт и нажать Enter').count()) === 0);
await win.screenshot({ path: path.join(shots, 'v04-collapsed.png') });
await expand();
await win.getByRole('switch', { name: /Скрывать выполненное/ }).click({ force: true });
await wait(300);
check('выполненное скрывается', /Скрыто выполненных: 1/.test(await screen()) && (await items.count()) === n0, `пунктов ${await items.count()} при ${n0 + 1}`);
await win.getByRole('switch', { name: /Скрывать выполненное/ }).click({ force: true });

// 14. Запрос к ИИ: отмена и остановка по времени.
const ai = await win.evaluate(async () => {
  const c = await window.dt.ai.save({ kind: 'openai', name: 'Молчащая модель', baseURL: 'http://localhost:18766/v1', model: 'mute' }, '');
  const p = c.providers.find((x) => x.name === 'Молчащая модель');
  await window.dt.ai.setActive(p.id);
  return p.id;
});
await nav(/Мои разборы/);
await wait(300);
await nav(/Новый разбор/);
await wait(600);
const askAI = async () => {
  await win.getByRole('button', { name: 'Черновик с ИИ' }).click();
  await wait(400);
  if (await win.getByRole('button', { name: 'Заменить', exact: true }).count()) await win.getByRole('button', { name: 'Заменить', exact: true }).click();
  await wait(500);
};
await askAI();
check('у запроса к ИИ есть «Отменить»', (await win.getByRole('button', { name: 'Отменить', exact: true }).count()) === 1);
await win.getByRole('button', { name: 'Отменить', exact: true }).click();
await wait(700);
check('отмена останавливает запрос, регламент цел', (await win.getByText('Запрос к ИИ отменён').count()) > 0 && (await note().inputValue()) === 'ЗАМЕТКА 0.4');
await askAI();
await wait(3500);
check('запрос останавливается по времени сам', /Модель не ответила за/.test(await screen()) && (await win.getByRole('button', { name: 'Отменить', exact: true }).count()) === 0);
await win.evaluate(async (id) => window.dt.ai.remove(id), ai);

// 7 и 9. Итог: один источник, шапка меняется одной строкой.
await win.keyboard.press('Control+s');
await wait(1200);
const name = ((await header()).match(/\d{4}-\d\d-\d\d-[\w-]+\.md/) || [])[0];
check('разбор сохранён', !!name && existsSync(fileOf(name)), await header());
const h0 = headerOf(name);
await nav(/Мои разборы/);
await wait(500);
await win.getByText('Проверка версии 0.4').first().click();
await wait(300);
await win.getByLabel('Итог').fill('ИТОГ-1: выбрали анализ спроса');
await win.getByRole('button', { name: 'Сохранить итог' }).click();
await wait(900);
const h1 = headerOf(name);
const changed = h1.filter((l, i) => l !== h0[i]);
check('«Сохранить итог» меняет в шапке одну строку', h1.length === h0.length && changed.length === 1 && /^outcome: "ИТОГ-1/.test(changed[0]), changed.join(' | '));
check('дата в шапке осталась датой', /^date: \d{4}-\d\d-\d\d$/.test(h1.find((l) => l.startsWith('date:')) || ''), h1.find((l) => l.startsWith('date:')));
await win.getByRole('button', { name: 'Сделать тестовым' }).click();
await wait(900);
const h2 = headerOf(name);
check('«Сделать тестовым» меняет одну строку', h2.filter((l, i) => l !== h1[i]).join() === 'real: false', h2.filter((l, i) => l !== h1[i]).join(' | '));
await win.getByRole('button', { name: 'Продолжить' }).click();
await wait(900);
check('редактор знает о новой пометке и не считает разбор изменённым', /Сохранён в библиотеке/.test(await header()) && (await win.getByRole('switch', { name: /Тестовый/ }).isChecked()), await header());
await step(/Ситуация/);
await wait(300);
await win.getByLabel('Ситуация', { exact: true }).fill('Сервисная сеть. ПРАВКА после итога.');
await step(/Регламент/);
await win.keyboard.press('Control+s');
await wait(1200);
const raw = readFileSync(fileOf(name), 'utf8');
check('сохранение из редактора не затирает итог', /^outcome: "ИТОГ-1/m.test(raw) && /ПРАВКА после итога/.test(raw) && /^real: false$/m.test(raw), headerOf(name).join(' | '));
check('в файле есть отмеченные критерии', /## Как понять, что стало лучше/.test(raw) && /- \[x\] /.test(raw.split('## Как понять')[1] || ''));

// 12. Узкое окно.
await win.setViewportSize({ width: 1000, height: 700 });
await wait(600);
const fits = async () => win.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const box = async (loc) => (await loc.boundingBox()) || { x: -1, width: 0 };
const saveBtn = await box(win.getByRole('button', { name: /^Сохранен?о|^Сохранить$/ }).first());
const titleBox = await box(win.getByLabel('Название разбора'));
check('узкое окно: название не сжато, «Сохранить» на экране', titleBox.width >= 380 && saveBtn.x + saveBtn.width <= 1000 && (await fits()), JSON.stringify({ titleBox, saveBtn }));
await win.screenshot({ path: path.join(shots, 'v04-narrow-plan.png') });
await step(/Ситуация/);
await wait(400);
await win.screenshot({ path: path.join(shots, 'v04-narrow-situation.png') });
await nav(/Мои разборы/);
await wait(500);
await win.screenshot({ path: path.join(shots, 'v04-narrow-analyses.png') });
check('узкое окно: «Мои разборы» без горизонтальной прокрутки', await fits());
await win.setViewportSize({ width: 1440, height: 900 });
await wait(400);

// 8. Удаление не безвозвратно.
await win.getByText('Проверка версии 0.4').first().click();
await wait(300);
await win.getByRole('button', { name: 'Удалить разбор' }).click();
await wait(400);
check('в вопросе об удалении сказано про корзину', /в корзину Windows/.test(await screen()));
await win.getByRole('button', { name: 'В корзину', exact: true }).click();
await wait(900);
const spare = path.join(ud, 'deleted-analyses');
const kept = existsSync(spare) ? readdirSync(spare).filter((f) => f.endsWith(name)) : [];
check('файл убран из analyses, но не стёрт', !existsSync(fileOf(name)) && kept.length === 1, `в запасной папке: ${kept.join(', ') || 'пусто'}`);
check('разбор исчез из списка', (await win.getByText('Проверка версии 0.4').count()) === 0);

// 13. Книга без номеров страниц в интерфейсе.
if (has('auzan-2022-cultural-codes')) {
  await nav(/Источники/);
  await wait(500);
  await win.getByPlaceholder('Название, тег или слово из текста').fill('Культурные коды');
  await wait(500);
  await win.locator('main ul button').first().click();
  await wait(600);
  const link = win.locator('a.cite-link', { hasText: /^\d+$/ }).first();
  check('в карточке Аузана «гл. N» — ссылка', (await link.count()) === 1);
  await link.click();
  await wait(900);
  const where = await win.getByTestId('book-where').innerText();
  check('окно книги открывает главу', /^Глава \d+/.test(where) && (await win.locator('.reader').innerText()).length > 1000, where);
  await win.screenshot({ path: path.join(shots, 'v04-chapter.png') });
  await win.getByRole('button', { name: 'Следующий раздел' }).click();
  await wait(700);
  check('листание по главам', (await win.getByTestId('book-where').innerText()) !== where);
  await win.keyboard.press('Escape');
}

check('системных окон не было', dialogs.length === 0, dialogs.join(' | '));
console.log(errors.length ? 'ОШИБКИ:\n' + errors.join('\n') : 'Ошибок в консоли нет');
console.log(failed ? `Провалено: ${failed}` : 'Все проверки версии 0.4 пройдены');
await app.close();
hung.forEach((r) => r.destroy());
server.close();
process.exit(failed || errors.length ? 1 : 0);
