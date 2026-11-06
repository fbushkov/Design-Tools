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

// Кэш разбитых по страницам книг: id -> { pages: Map<number,string>, order: number[] }
const bookCache = new Map();

function loadBook(libDir, id) {
  const key = libDir + '|' + id;
  if (bookCache.has(key)) return bookCache.get(key);
  const file = path.join(libDir, 'md', id + '.md');
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, 'utf8');
  const re = /<!--\s*p\.\s*(\d+)\s*-->/g;
  const pages = new Map();
  const order = [];
  let m;
  let last = null;
  let lastIdx = 0;
  while ((m = re.exec(text))) {
    if (last !== null) pages.set(last, (pages.get(last) || '') + text.slice(lastIdx, m.index));
    last = Number(m[1]);
    if (!pages.has(last)) order.push(last);
    lastIdx = re.lastIndex;
  }
  if (last !== null) pages.set(last, (pages.get(last) || '') + text.slice(lastIdx));
  const book = { pages, order };
  if (bookCache.size > 6) bookCache.delete(bookCache.keys().next().value);
  bookCache.set(key, book);
  return book;
}

function cleanPage(s) {
  return s
    .replace(/<\/?(mark|u|span)[^>]*>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Разделы карты книги, в диапазон которых попадает страница.
function mapSections(libDir, id, page) {
  const file = path.join(libDir, 'maps', id + '.md');
  if (!fs.existsSync(file)) return [];
  const { content } = matter(fs.readFileSync(file, 'utf8'));
  const parts = content.split(/\n(?=## )/);
  const hits = [];
  for (const part of parts) {
    const head = part.split('\n')[0];
    const nums = [...head.matchAll(/(\d+)\s*[–-]\s*(\d+)|(\d+)/g)].map((x) =>
      x[1] ? [Number(x[1]), Number(x[2])] : [Number(x[3]), Number(x[3])]
    );
    const inHead = head.startsWith('## ') && nums.some(([a, b]) => page >= a && page <= b);
    const inBody = new RegExp('с\\.\\s*' + page + '(?!\\d)').test(part);
    if (inHead || inBody) hits.push(part.trim());
  }
  return hits.slice(0, 3);
}

function bookPage(libDir, id, page) {
  if (!libDir) return { ok: false, error: 'Не указана папка библиотеки Design-tools-library.' };
  const book = loadBook(libDir, id);
  if (!book) return { ok: false, error: `В библиотеке нет текста md/${id}.md.` };
  let p = Number(page);
  if (!book.pages.has(p)) {
    // ближайшая существующая страница
    p = book.order.reduce((best, x) => (Math.abs(x - p) < Math.abs(best - p) ? x : best), book.order[0]);
  }
  const i = book.order.indexOf(p);
  return {
    ok: true,
    id,
    page: p,
    requested: Number(page),
    text: cleanPage(book.pages.get(p) || ''),
    prev: i > 0 ? book.order[i - 1] : null,
    next: i < book.order.length - 1 ? book.order[i + 1] : null,
    total: book.order.length,
    map: mapSections(libDir, id, p),
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

// Сохранить разбор. Если файл с таким именем уже есть и это не тот же разбор — добавить суффикс.
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
    fs.writeFileSync(file, content, 'utf8');
    return { ok: true, file, name };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function deleteAnalysis(libDir, filename) {
  try {
    const file = path.join(analysesDir(libDir), safeName(filename));
    if (path.basename(file).toLowerCase() === 'readme.md') return { ok: false, error: 'README удалять нельзя.' };
    fs.unlinkSync(file);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Поменять поля шапки разбора (итог, тестовый или реальный), не трогая текст.
function updateAnalysisMeta(libDir, filename, patch) {
  try {
    const file = path.join(analysesDir(libDir), safeName(filename));
    const parsed = matter(fs.readFileSync(file, 'utf8'));
    const data = { ...parsed.data, ...patch };
    fs.writeFileSync(file, matter.stringify(parsed.content, data), 'utf8');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { loadBase, bookPage, saveAnalysis, deleteAnalysis, updateAnalysisMeta };
