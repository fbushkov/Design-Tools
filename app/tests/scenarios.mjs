// Три тестовых разбора через интерфейс: заполнить, выбрать проблемы и путь, поправить регламент, сохранить как тестовые.
import { _electron as electron } from 'playwright-core';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shots = path.join(root, 'tests', 'screens');
mkdirSync(shots, { recursive: true });

const SCENARIOS = [
  {
    key: 'a',
    title: 'Тест: сервисная сеть — KPI и жалобы клиентов',
    situation:
      'Сеть сервисных центров на 300 человек. Ввели KPI по времени ответа и количеству звонков, премии привязаны к плану. Цифры зелёные, клиенты жалуются, менеджеры подгоняют отчёты. Колл-центр и точки не стыкуются между собой, клиент звонит по три раза.',
    offer: 'услуга',
    maturity: { управление: '2', процессы: '2', данные: '3' },
    intake: ['B2C, сервисный ремонт техники, 12 городов', 'Операционный директор; решения — у собственника', 'Клиенты жалуются, NPS упал', 'Считают, что мастера ленятся'],
    problems: ['Показатель стал целью', 'Сервис разорван'],
    approach: 'Анализ спроса-сбоя',
    manual: 'Выгрузить 200 последних обращений и разметить: спрос на ценность или спрос-сбой',
  },
  {
    key: 'b',
    title: 'Тест: стартап — основатель решает всё, продукт по запросам',
    situation:
      'ИТ-стартап на 14 человек, B2C-сервис для обучения. Основатель сам решает все вопросы, от дизайна кнопок до найма. Команда делает фичи по просьбам самых громких клиентов, релизы каждую неделю, а удержание падает. Основатель хочет внедрить OKR и Scrum, чтобы навести порядок.',
    offer: 'ИТ-продукт',
    maturity: { управление: '1', продукт: '1', данные: '1' },
    trajectory: 'Растёт',
    intake: ['B2C, онлайн-обучение, Россия', 'Основатель, он же принимает все решения', 'Растут, а удержание падает', 'Не хватает порядка и процессов'],
    problems: ['Продукт без направления', 'Решения в одной точке', 'Клиенты уходят молча'],
    approach: 'Работа, которую клиент нанимает продукт сделать',
    manual: 'Провести 6 интервью-хронологий с ушедшими клиентами за последний месяц',
  },
  {
    key: 'c',
    title: 'Тест: производство — ИИ-ассистент не прижился, согласования тормозят',
    situation:
      'Производственная компания на 600 человек. Купили корпоративного ИИ-ассистента для инженеров, отчитались о внедрении, через квартал пользы не видно, часть людей пользуется своими инструментами тайком. Новые изделия выходят за 14 месяцев, каждое решение согласуют шесть отделов, директор подписывает всё. Инженеры жалуются на контроль и отчёты.',
    offer: 'производство',
    maturity: { управление: '3', процессы: '3', данные: '2', 'ИИ в команде': '2' },
    trajectory: 'Стареет',
    intake: ['B2B, машиностроение, 600 человек', 'Генеральный директор; ИТ-директор отвечает за ИИ', 'ИИ не дал эффекта, изделия выходят долго', 'Инженеры сопротивляются новому'],
    problems: ['ИИ не дал эффекта', 'Медленный поток', 'Решения в одной точке'],
    approach: 'Права на решение',
    manual: 'Составить карту согласований по одному изделию: кто, сколько дней, что меняет',
  },
];

const app = await electron.launch({ args: [root, '--no-sandbox'] });
const win = await app.firstWindow();
const errors = [];
win.on('pageerror', (e) => errors.push(String(e)));
win.on('dialog', (d) => d.accept());
await win.setViewportSize({ width: 1440, height: 900 });
await win.waitForSelector('text=Новый разбор', { timeout: 30000 });
await win.waitForTimeout(1000);
const snap = (n) => win.screenshot({ path: path.join(shots, n + '.png') });
const next = async (name) => {
  await win.getByRole('button', { name, exact: true }).last().click();
  await win.waitForTimeout(700);
};

for (const sc of SCENARIOS) {
  await win.getByRole('button', { name: /Новый разбор/ }).click();
  await win.getByRole('button', { name: 'Новый', exact: true }).click();
  await win.waitForTimeout(400);
  // Если в черновике была несохранённая работа, программа спросит — подтверждаем.
  if (await win.getByRole('button', { name: 'Начать новый' }).count()) await win.getByRole('button', { name: 'Начать новый' }).click();
  await win.waitForTimeout(400);
  await win.getByLabel('Название разбора').fill(sc.title);
  await win.getByLabel('Ситуация', { exact: true }).fill(sc.situation);
  await win.getByRole('switch').first().click();
  await win.locator('button[data-slot="trigger"][aria-label="Что продают"]').click();
  await win.getByRole('option', { name: new RegExp('^' + sc.offer, 'i') }).click();
  for (const [axis, lvl] of Object.entries(sc.maturity)) await win.getByRole('radiogroup', { name: axis }).getByRole('radio', { name: lvl }).click();
  if (sc.trajectory) await win.getByRole('radiogroup', { name: 'Траектория' }).getByRole('radio', { name: sc.trajectory }).click();
  const items = win.locator('section', { hasText: 'Уточнение' }).locator('button[data-slot="trigger"]');
  for (let i = 0; i < sc.intake.length; i++) {
    await items.nth(i).click();
    await win.waitForTimeout(250);
    await win.getByPlaceholder('Ответ или «не знаю»').last().fill(sc.intake[i]);
  }
  await snap(`t-${sc.key}-1`);
  await next('Проблемы и вопросы');
  for (const p of sc.problems) {
    const box = win.getByRole('checkbox', { name: new RegExp(p) }).first();
    if (!(await box.count())) await win.getByRole('button', { name: /Показать все проблемы/ }).click();
    await box.click();
  }
  await win.getByRole('button', { name: 'Отметить все' }).click();
  await win.waitForTimeout(400);
  await snap(`t-${sc.key}-2`);
  await next('Рекомендации');
  await snap(`t-${sc.key}-3`);
  const card = win.locator('div.rounded-large', { has: win.getByRole('button', { name: new RegExp('^' + sc.approach) }) }).first();
  await card.getByRole('button', { name: 'Выбрать', exact: true }).click();
  await win.waitForTimeout(900);
  // Ручная правка: отметить два пункта, добавить свой пункт и заметку.
  const boxes = win.getByRole('checkbox', { name: 'Выполнено' });
  await boxes.nth(0).click();
  await boxes.nth(1).click();
  await win.getByPlaceholder('Добавить пункт и нажать Enter').first().fill(sc.manual);
  await win.keyboard.press('Enter');
  await win.getByPlaceholder('Заметка: кто, когда, что адаптировать').first().fill('Тестовый разбор: проверка формата регламента');
  await win.waitForTimeout(400);
  await snap(`t-${sc.key}-4`);
  await win.keyboard.press('Control+s');
  await win.waitForTimeout(1200);
}

await win.getByRole('button', { name: /Мои разборы/ }).click();
await win.waitForTimeout(800);
await win.getByRole('radio', { name: /Тестовые/ }).click();
await win.waitForTimeout(400);
await snap('t-list');
// Продолжить последний тестовый разбор и проверить, что регламент восстановился.
await win.getByRole('button', { name: 'Продолжить' }).click();
await win.waitForTimeout(400);
if (await win.getByRole('button', { name: 'Открыть без сохранения' }).count()) await win.getByRole('button', { name: 'Открыть без сохранения' }).click();
await win.waitForTimeout(900);
const restored = await win.getByText('Тестовый разбор: проверка формата регламента').count();
await snap('t-continue');
console.log('Восстановлен регламент с заметкой:', restored > 0 || (await win.locator('input[value="Тестовый разбор: проверка формата регламента"]').count()) > 0);
console.log(errors.length ? 'ОШИБКИ:\n' + errors.join('\n') : 'Ошибок нет');
await app.close();
