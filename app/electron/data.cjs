// Чтение базы Design-Tools и приватной библиотеки с диска.
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

function readCards(dir, kind) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md')
    .map((f) => {
      const raw = fs.readFileSync(path.join(dir, f), 'utf8');
      let parsed;
      try {
        parsed = matter(raw);
      } catch (e) {
        parsed = { data: {}, content: raw };
      }
      const id = parsed.data.id || f.replace(/\.md$/, '');
      return { kind, id, file: f, data: parsed.data, body: parsed.content };
    });
}

function readText(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function loadBase(baseDir, libDir) {
  const ok = baseDir && fs.existsSync(path.join(baseDir, 'taxonomy.md'));
  if (!ok) return { ok: false, error: 'Не найдена папка базы Design-Tools (нет taxonomy.md).' };
  const analysesDir = libDir ? path.join(libDir, 'analyses') : null;
  return {
    ok: true,
    problems: readCards(path.join(baseDir, 'problems'), 'problem'),
    approaches: readCards(path.join(baseDir, 'approaches'), 'approach'),
    sources: readCards(path.join(baseDir, 'sources'), 'source'),
    cases: readCards(path.join(baseDir, 'cases'), 'case'),
    taxonomy: readText(path.join(baseDir, 'taxonomy.md')),
    intake: readText(path.join(baseDir, 'templates', 'intake.md')),
    contextRu: readText(path.join(baseDir, 'context', 'ru.md')),
    analyses: analysesDir ? readCards(analysesDir, 'analysis').sort((a, b) => b.file.localeCompare(a.file)) : [],
    library: {
      ok: !!(libDir && fs.existsSync(path.join(libDir, 'md'))),
      dir: libDir || null,
    },
  };
}

// Кэш разбитых по страницам книг: id -> { pages: Map<number,string>, order: number[], sections, chapterPage }
const bookCache = new Map();
function clearBookCache() {
  bookCache.clear();
}

// Имя книги — только буквы, цифры, дефис, точка и подчёркивание: путь наружу из md/ собрать нельзя.
const safeId = (id) => /^[\w.-]+$/.test(String(id)) && !String(id).includes('..');

const NUM_WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const ROMAN = { i: 1, v: 5, x: 10, l: 50 };
function toNumber(t) {
  const x = String(t).toLowerCase();
  if (/^\d+$/.test(x)) return Number(x);
  if (NUM_WORDS.includes(x)) return NUM_WORDS.indexOf(x) + 1;
  if (/^[ivxl]+$/.test(x)) return [...x].reduce((sum, c, i, arr) => sum + (ROMAN[c] < (ROMAN[arr[i + 1]] || 0) ? -ROMAN[c] : ROMAN[c]), 0);
  return null;
}
const CHAPTER_RE = /^(?:глава|гл\.|chapter|ch\.)\s*([0-9]+|[ivxl]+|[a-z]+)(?![a-zа-яё])[\s.:—–-]*(.*)$/i;
const stripTags = (t) => t.replace(/<[^>]+>/g, '').replace(/\\?[*_]/g, '').replace(/\s+/g, ' ').trim();
const PART_RE = /^(part|часть|раздел)\s+([ivxl]+|\d+|one|two|three|four|five|six|seven|eight|nine|ten|перв|втор|трет|четв|пят)/i;

// Заголовки-главы в тексте: [{ level, n, title, index }].
function chapterHeads(text) {
  const heads = [];
  const re = /^(#{1,3})\s+(.+)$/gm;
  let m;
  while ((m = re.exec(text))) {
    const title = stripTags(m[2]);
    const c = title.match(CHAPTER_RE);
    const n = c ? toNumber(c[1]) : null;
    heads.push({ level: m[1].length, title: n ? `Глава ${n}${c[2] ? '. ' + c[2] : ''}` : title, n, index: m.index, end: re.lastIndex });
  }
  return heads;
}

// Книга без меток страниц делится на разделы по заголовкам того уровня, на котором стоят главы.
function splitSections(text) {
  const heads = chapterHeads(text);
  const chapters = heads.filter((h) => h.n);
  const count = (lvl) => chapters.filter((h) => h.level === lvl).length;
  const level = chapters.length ? [1, 2, 3].sort((a, b) => count(b) - count(a))[0] : Math.min(3, ...heads.map((h) => h.level));
  const cuts = heads.filter((h) => h.level === level);
  const out = [];
  const head = text.slice(0, cuts.length ? cuts[0].index : text.length);
  if (head.replace(/^---[\s\S]*?\n---/, '').trim().length > 200) out.push({ title: 'Начало', n: null, text: head });
  const lastChapter = cuts.map((h) => !!h.n).lastIndexOf(true);
  cuts.forEach((h, i) => {
    const body = text.slice(h.end, i + 1 < cuts.length ? cuts[i + 1].index : text.length);
    if (!h.title && body.trim().length < 40) return; // пустые служебные заголовки
    const prev = out[out.length - 1];
    // Заголовок того же уровня посреди главы (таблица, врезка) главу не разрывает.
    if (!h.n && prev && prev.n && i < lastChapter && !PART_RE.test(h.title)) {
      prev.text += `\n\n### ${h.title}\n` + body;
      return;
    }
    out.push({ title: h.title || 'Без названия', n: h.n, text: body });
  });
  return out;
}

function loadBook(libDir, id) {
  const key = libDir + '|' + id;
  if (bookCache.has(key)) return bookCache.get(key);
  if (!safeId(id)) return null;
  const file = path.join(libDir, 'md', id + '.md');
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, 'utf8');
  const re = /<!--\s*p\.\s*(\d+)\s*-->/g;
  const pages = new Map();
  const order = [];
  const marks = []; // [позиция в тексте, страница]
  let m;
  let last = null;
  let lastIdx = 0;
  while ((m = re.exec(text))) {
    if (last !== null) pages.set(last, (pages.get(last) || '') + text.slice(lastIdx, m.index));
    last = Number(m[1]);
    marks.push([m.index, last]);
    if (!pages.has(last)) order.push(last);
    lastIdx = re.lastIndex;
  }
  if (last !== null) pages.set(last, (pages.get(last) || '') + text.slice(lastIdx));
  const book = { pages, order };
  if (order.length) {
    // Страница, с которой начинается каждая глава: для ссылок «гл. N».
    book.chapterPage = new Map();
    for (const h of chapterHeads(text)) {
      if (!h.n || book.chapterPage.has(h.n)) continue;
      const before = marks.filter(([i]) => i <= h.index).pop();
      book.chapterPage.set(h.n, before ? before[1] : order[0]);
    }
  } else book.sections = splitSections(text);
  if (bookCache.size > 6) bookCache.delete(bookCache.keys().next().value);
  bookCache.set(key, book);
  return book;
}

function cleanPage(s) {
  return s
    .replace(/<\/?(mark|u|span|div|a)[^>]*>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function mapParts(libDir, id) {
  if (!safeId(id)) return [];
  const file = path.join(libDir, 'maps', id + '.md');
  if (!fs.existsSync(file)) return [];
  const { content } = matter(fs.readFileSync(file, 'utf8'));
  return content.split(/\n(?=## )/).filter((p) => p.startsWith('## '));
}

// Разделы карты книги, в диапазон которых попадает страница.
function mapSections(libDir, id, page) {
  const hits = [];
  for (const part of mapParts(libDir, id)) {
    const head = part.split('\n')[0];
    const pp = head.match(/с\.\s*([\d\s,–-]+)/);
    const nums = [...(pp ? pp[1] : head).matchAll(/(\d+)\s*[–-]\s*(\d+)|(\d+)/g)].map((x) =>
      x[1] ? [Number(x[1]), Number(x[2])] : [Number(x[3]), Number(x[3])]
    );
    const inHead = nums.some(([a, b]) => page >= a && page <= b);
    const inBody = new RegExp('с\\.\\s*' + page + '(?!\\d)').test(part);
    if (inHead || inBody) hits.push(part.trim());
  }
  return hits.slice(0, 3);
}

// Разделы карты книги по номеру главы или по названию раздела.
function mapByChapter(libDir, id, n, title) {
  const norm = (t) => String(t || '').toLowerCase().replace(/[^a-zа-яё0-9]+/gi, ' ').trim();
  return mapParts(libDir, id)
    .filter((part) => {
      const head = stripTags(part.split('\n')[0].replace(/^##\s*/, ''));
      const c = head.match(CHAPTER_RE);
      if (n) return !!c && toNumber(c[1]) === n;
      return !c && !!norm(title) && norm(head).startsWith(norm(title));
    })
    .map((p) => p.trim())
    .slice(0, 3);
}

// Страница книги. Если в тексте нет меток страниц, книга открывается по главам.
// chapter — номер главы из ссылки «гл. N» (или порядковый номер раздела со знаком минус, для перелистывания).
function bookPage(libDir, id, page, chapter) {
  if (!libDir) return { ok: false, error: 'Не указана папка библиотеки Design-tools-library.' };
  const book = loadBook(libDir, id);
  if (!book) return { ok: false, error: `В библиотеке нет текста md/${id}.md.` };

  if (book.sections) {
    const list = book.sections;
    if (!list.length) return { ok: false, error: 'Текст книги пуст.' };
    let i = 0;
    let note = '';
    if (chapter < 0) i = Math.min(list.length - 1, -chapter - 1);
    else if (chapter) {
      i = list.findIndex((x) => x.n === Number(chapter));
      if (i < 0) {
        i = 0;
        note = `Главы ${chapter} в тексте не нашлось — открыто начало книги.`;
      } else if (page) note = `В тексте этой книги нет номеров страниц, поэтому вместо с. ${page} открыта глава ${chapter} целиком.`;
    } else {
      i = Math.max(0, list.findIndex((x) => x.n));
      if (page) note = `В тексте этой книги нет номеров страниц — с. ${page} открыть нельзя. Выберите главу в списке внизу.`;
    }
    const cur = list[i];
    return {
      ok: true,
      mode: 'chapters',
      id,
      index: i,
      chapter: cur.n,
      title: cur.title,
      note,
      text: cleanPage(cur.text),
      sections: list.map((x) => ({ title: x.title, n: x.n })),
      prev: i > 0 ? i : null, // порядковые номера с единицы
      next: i < list.length - 1 ? i + 2 : null,
      total: list.length,
      map: mapByChapter(libDir, id, cur.n, cur.title),
    };
  }

  let p = Number(page);
  let note = '';
  let byChapter = [];
  if (!p && chapter) {
    byChapter = mapByChapter(libDir, id, Number(chapter));
    if (book.chapterPage.has(Number(chapter))) p = book.chapterPage.get(Number(chapter));
    else {
      // Заголовок главы в тексте не распознан — берём первую страницу из заголовка раздела карты.
      const first = (byChapter[0] || '').split('\n')[0].match(/с\.\s*(\d+)/);
      p = first ? Number(first[1]) : book.order[0];
      if (!first) note = `Начало главы ${chapter} в тексте не найдено — открыта первая страница книги.`;
    }
  }
  const requested = p;
  if (!book.pages.has(p)) {
    // ближайшая существующая страница
    p = book.order.reduce((best, x) => (Math.abs(x - p) < Math.abs(best - p) ? x : best), book.order[0]);
  }
  const i = book.order.indexOf(p);
  return {
    ok: true,
    mode: 'pages',
    id,
    page: p,
    requested,
    chapter: !page && chapter ? Number(chapter) : null,
    note,
    text: cleanPage(book.pages.get(p) || ''),
    prev: i > 0 ? book.order[i - 1] : null,
    next: i < book.order.length - 1 ? book.order[i + 1] : null,
    total: book.order.length,
    map: byChapter.length ? byChapter : mapSections(libDir, id, p),
  };
}

function analysesDir(libDir) {
  if (!libDir) throw new Error('Не указана папка библиотеки.');
  const dir = path.join(libDir, 'analyses');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Имя файла без путей: разбор всегда лежит в analyses/.
function safeName(name) {
  return path.basename(String(name)).replace(/[\\/:*?"<>|]/g, '-');
}

// Шапка файла (frontmatter) построчно. Нужна, чтобы менять только нужные строки и не переписывать остальное.
function splitHeader(raw) {
  const m = raw.match(/^(﻿?---\r?\n)([\s\S]*?)(\r?\n---[ \t]*(?:\r?\n|$))/);
  if (!m) return null;
  const eol = /\r\n/.test(m[1]) ? '\r\n' : '\n';
  return { open: m[1], lines: m[2].split(/\r?\n/), close: m[3], rest: raw.slice(m[0].length), eol };
}
// Строки одного поля: строка «ключ:» и её продолжения с отступом (многострочные значения).
function fieldRange(lines, key) {
  const i = lines.findIndex((l) => new RegExp('^' + key + '\\s*:').test(l));
  if (i < 0) return null;
  let j = i + 1;
  for (;;) {
    let k = j;
    while (k < lines.length && !lines[k].trim()) k++; // пустые строки внутри многострочного значения
    if (k < lines.length && /^\s+\S/.test(lines[k])) j = k + 1;
    else break;
  }
  return [i, j];
}
function fieldValue(v) {
  if (v === true || v === false) return String(v);
  if (v === null || v === undefined || v === '') return '';
  return JSON.stringify(String(v)); // строка в двойных кавычках читается как YAML
}
// Заменить в шапке только перечисленные поля. Остальные строки остаются как были, байт в байт.
function patchHeader(raw, patch) {
  const h = splitHeader(raw);
  if (!h) return null;
  for (const [key, value] of Object.entries(patch)) {
    const line = `${key}: ${fieldValue(value)}`.trimEnd();
    const r = fieldRange(h.lines, key);
    if (r) h.lines.splice(r[0], r[1] - r[0], line);
    else h.lines.push(line);
  }
  return h.open + h.lines.join(h.eol) + h.close + h.rest;
}
// Перенести строки полей из шапки старого файла в новый текст как есть.
function keepFields(oldRaw, nextRaw, keys) {
  const a = splitHeader(oldRaw);
  const b = splitHeader(nextRaw);
  if (!a || !b) return nextRaw;
  for (const key of keys) {
    const from = fieldRange(a.lines, key);
    if (!from) continue;
    const keep = a.lines.slice(from[0], from[1]);
    const to = fieldRange(b.lines, key);
    if (to) b.lines.splice(to[0], to[1] - to[0], ...keep);
    else b.lines.push(...keep);
  }
  return b.open + b.lines.join(b.eol) + b.close + b.rest;
}

// Сохранить разбор. Если файл с таким именем уже есть и это не тот же разбор — добавить суффикс.
// При повторном сохранении дата, итог и кейс берутся из файла: итог пишется в «Моих разборах»,
// и редактор не должен затирать его старым значением.
function saveAnalysis(libDir, filename, content, overwrite) {
  try {
    const dir = analysesDir(libDir);
    let name = safeName(filename);
    if (!overwrite) {
      const base = name.replace(/\.md$/, '');
      let i = 2;
      while (fs.existsSync(path.join(dir, name))) name = `${base}-${i++}.md`;
    }
    const file = path.join(dir, name);
    let text = content;
    if (overwrite && fs.existsSync(file)) text = keepFields(fs.readFileSync(file, 'utf8'), content, ['date', 'outcome', 'case']);
    fs.writeFileSync(file, text, 'utf8');
    return { ok: true, file, name };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Удалить разбор — в корзину, чтобы его можно было вернуть. trash — функция системы (shell.trashItem).
// Если корзина недоступна, файл переносится в запасную папку, а не стирается.
async function deleteAnalysis(libDir, filename, { trash, spareDir } = {}) {
  try {
    const file = path.join(analysesDir(libDir), safeName(filename));
    if (path.basename(file).toLowerCase() === 'readme.md') return { ok: false, error: 'README удалять нельзя.' };
    if (!fs.existsSync(file)) return { ok: false, error: 'Файл уже удалён.' };
    if (trash) {
      try {
        await trash(file);
        if (!fs.existsSync(file)) return { ok: true, where: 'trash' };
      } catch (e) {}
    }
    if (!spareDir) return { ok: false, error: 'Не удалось переместить файл в корзину.' };
    fs.mkdirSync(spareDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dest = path.join(spareDir, `${stamp}-${path.basename(file)}`);
    fs.copyFileSync(file, dest);
    fs.unlinkSync(file);
    return { ok: true, where: 'spare', dest };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Поменять поля шапки разбора (итог, тестовый или реальный). Меняются только строки этих полей.
function updateAnalysisMeta(libDir, filename, patch) {
  try {
    const file = path.join(analysesDir(libDir), safeName(filename));
    const next = patchHeader(fs.readFileSync(file, 'utf8'), patch);
    if (next === null) return { ok: false, error: 'В файле нет шапки с полями — поправить её автоматически нельзя.' };
    fs.writeFileSync(file, next, 'utf8');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { loadBase, bookPage, clearBookCache, saveAnalysis, deleteAnalysis, updateAnalysisMeta, patchHeader, keepFields };
