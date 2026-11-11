// Проверка, что работа не теряется: сохранение, признак изменений, «Продолжить», смена подхода, отправка.
// Запуск: DT_LIB_DIR=<копия библиотеки> xvfb-run -a node tests/safety.mjs
import { _electron as electron } from 'playwright-core';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = await electron.launch({ args: [root, '--no-sandbox'] });
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
let failed = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${cond ? '' : ' — ' + extra}`);
  if (!cond) failed++;
};
const nav = (re) => win.locator('nav').getByRole('button', { name: re }).click();
const count = async () => Number((await win.locator('nav').getByRole('button', { name: /Мои разборы/ }).innerText()).match(/\d+/)?.[0] || 0);
const title = () => win.getByLabel('Название разбора').inputValue();
const header = async () => (await win.locator('div.px-8.pt-6').innerText()).replace(/\u00a0/g, ' ');
const wait = (ms = 500) => win.waitForTimeout(ms);

// 1. Сохранение: разбор сразу в списке, статус меняется.
await win.getByRole('button', { name: 'Новый', exact: true }).click();
await win.waitForTimeout(400);
// Если в черновике была несохранённая работа, программа спросит — подтверждаем.
if (await win.getByRole('button', { name: 'Начать новый' }).count()) await win.getByRole('button', { name: 'Начать новый' }).click();
await wait(300);
await win.getByLabel('Название разбора').fill('Проверка сохранности');
await win.locator('textarea').first().fill('Собственник сам согласует все решения, отделы не стыкуются, клиенты уходят.');
await wait(300);
check('новый разбор помечен как несохранённый', /ещё не сохранён/.test(await header()), await header());
const before = await count();
await win.keyboard.press('Control+s');
await wait(1200);
check('после сохранения счётчик разборов вырос без перечитывания', (await count()) === before + 1, `${before} → ${await count()}`);
check('статус «Сохранён в библиотеке», кнопка «Сохранено»', /Сохранён в библиотеке/.test(await header()) && (await win.getByRole('button', { name: 'Сохранено' }).count()) === 1, await header());
await nav(/Мои разборы/);
await wait(600);
check('разбор виден в «Моих разборах»', (await win.getByText('Проверка сохранности').count()) > 0);

// 2. Признак несохранённых изменений.
await nav(/Новый разбор/);
await wait(400);
await win.locator('textarea').first().fill('Собственник сам согласует все решения. ИЗМЕНЕНО.');
await wait(300);
await win.screenshot({ path: path.join(root, 'tests', 'screens', 's-dirty.png') });
check('после правки статус «есть изменения»', /Есть несохранённые изменения/.test(await header()), await header());

// 3. «Продолжить» другой разбор не затирает черновик без вопроса.
await nav(/Мои разборы/);
await wait(500);
await win.getByText('Тест: стартап').first().click();
await wait(300);
await win.getByRole('button', { name: 'Продолжить' }).click();
await wait(500);
await win.screenshot({ path: path.join(root, 'tests', 'screens', 's-ask.png') });
check('«Продолжить» спрашивает про несохранённую работу', (await win.getByText('В редакторе есть несохранённая работа').count()) === 1);
await win.getByRole('button', { name: 'К черновику' }).click();
await wait(600);
check('«Перейти к черновику» сохраняет черновик', (await title()) === 'Проверка сохранности' && /ИЗМЕНЕНО/.test(await win.locator('textarea').first().inputValue()));

// 4. «Продолжить» тот же разбор с правками открывает правки, а не файл.
await nav(/Мои разборы/);
await wait(500);
await win.getByText('Проверка сохранности').first().click();
await wait(300);
await win.getByRole('button', { name: 'Продолжить' }).click();
await wait(700);
check('тот же разбор: правки на месте', /ИЗМЕНЕНО/.test(await win.locator('textarea').first().inputValue()));
await win.keyboard.press('Control+s');
await wait(1000);

// 5. Отправка при несохранённом черновике предупреждает.
await win.locator('textarea').first().fill('Собственник сам согласует все решения. ЕЩЁ ПРАВКА.');
await wait(300);
await nav(/Мои разборы/);
await wait(500);
await win.getByRole('button', { name: 'Отправить все в GitHub' }).click();
await wait(500);
check('отправка предупреждает о несохранённом разборе', (await win.getByText('В редакторе есть несохранённый разбор').count()) === 1);
await win.getByRole('button', { name: 'Отмена' }).click();
await wait(300);

// 6. Пометка «тестовый/реальный» не сбрасывает выбор в списке.
await win.getByText('Тест: производство').first().click();
await wait(300);
await win.getByRole('button', { name: /Сделать реальным|Сделать тестовым/ }).click();
await wait(900);
check('после смены пометки выбран тот же разбор', /Тест: производство/.test(await win.locator('h2').first().innerText()), await win.locator('h2').first().innerText());
await win.getByRole('button', { name: /Сделать реальным|Сделать тестовым/ }).click();
await wait(700);

// 7. Смена подхода не стирает регламент.
await win.getByText('Тест: стартап').first().click();
await wait(300);
await win.getByRole('button', { name: 'Продолжить' }).click();
await wait(500);
if (await win.getByText('В редакторе есть несохранённая работа').count()) await win.getByRole('button', { name: 'Открыть без сохранения' }).click();
await wait(900);
check('открыт сохранённый разбор без пометки «есть изменения»', /Сохранён в библиотеке/.test(await header()), await header());
const note = win.getByPlaceholder('Заметка: кто, когда, что адаптировать').first();
const noteBefore = await note.inputValue();
await note.fill('ЗАМЕТКА ДЛЯ ПРОВЕРКИ');
await wait(300);
await win.getByRole('button', { name: /Рекомендации/ }).first().click();
await wait(600);
await win.getByRole('button', { name: 'Выбрать', exact: true }).first().click();
await wait(1000);
check('при смене подхода сообщение «регламент отложен»', (await win.getByText('Прежний регламент отложен').count()) > 0);
await win.getByRole('button', { name: /Рекомендации/ }).first().click();
await wait(600);
const card = win.locator('div.rounded-large', { has: win.getByRole('button', { name: /^Работа, которую клиент нанимает/ }) }).first();
await card.getByRole('button', { name: 'Выбрать', exact: true }).click();
await wait(1000);
check('при возврате к подходу заметка на месте', (await win.getByPlaceholder('Заметка: кто, когда, что адаптировать').first().inputValue()) === 'ЗАМЕТКА ДЛЯ ПРОВЕРКИ', `было «${noteBefore}»`);

check('системных окон подтверждения не было', dialogs.length === 0, dialogs.join(' | '));
console.log(errors.length ? 'ОШИБКИ:\n' + errors.join('\n') : 'Ошибок в консоли нет');
console.log(failed ? `Провалено: ${failed}` : 'Все проверки сохранности пройдены');
await app.close();
process.exit(failed || errors.length ? 1 : 0);
