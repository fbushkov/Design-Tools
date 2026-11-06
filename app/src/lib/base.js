// Индексация базы: разделы карточек, ссылки на источники, подбор проблем и подходов.

export function sections(body) {
  const out = {};
  const parts = ('\n' + body).split(/\n## /);
  out._intro = parts[0].trim();
  for (const p of parts.slice(1)) {
    const nl = p.indexOf('\n');
    const title = (nl < 0 ? p : p.slice(0, nl)).trim();
    out[title] = nl < 0 ? '' : p.slice(nl + 1).trim();
  }
  return out;
}

export function sectionStarting(secs, prefix) {
  const key = Object.keys(secs).find((k) => k.toLowerCase().startsWith(prefix.toLowerCase()));
  return key ? secs[key] : '';
}

// Строки markdown-таблицы -> массив массивов ячеек (без заголовка и разделителя).
export function tableRows(md) {
  const lines = md.split('\n').filter((l) => l.trim().startsWith('|'));
  if (lines.length < 3) return [];
  return lines.slice(2).map((l) =>
    l
      .trim()
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((c) => c.trim())
  );
}

export function listItems(md) {
  const items = [];
  let cur = null;
  for (const line of md.split('\n')) {
    const m = line.match(/^[-*]\s+(.*)$/) || line.match(/^\d+\.\s+(.*)$/);
    if (m) {
      if (cur) items.push(cur);
      cur = m[1];
    } else if (cur && /^\s{2,}\S/.test(line)) {
      cur += ' ' + line.trim();
    } else if (cur && line.trim() === '') {
      items.push(cur);
      cur = null;
    }
  }
  if (cur) items.push(cur);
  if (!items.length && md.trim()) return md.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  return items;
}

export function firstParagraph(md, max = 420) {
  const p = (md || '').split(/\n\s*\n/).find((x) => x.trim() && !x.trim().startsWith('|')) || '';
  return p.length > max ? p.slice(0, max).replace(/\s+\S*$/, '') + '…' : p;
}

// ---------- Таксономия ----------

export function parseTaxonomy(md) {
  const categories = [];
  for (const m of md.matchAll(/^\|\s*`([a-z-]+)`\s*—\s*([^|]+)\|\s*([^|]*)\|\s*([^|]*)\|/gm)) {
    if (/^(management|process|product|data|ai)$/.test(m[1])) continue;
    categories.push({ id: m[1], title: m[2].trim(), directions: m[3].trim(), symptoms: m[4].trim() });
  }
  const directions = [];
  for (const m of md.matchAll(/^-\s*`([a-z-]+)`\s*—\s*(.+)$/gm)) {
    if (/scale|model|offer|market|strategic|operational|product/.test(m[1])) continue;
    directions.push({ id: m[1], title: m[2].trim() });
  }
  const axes = [];
  for (const m of md.matchAll(/^\|\s*`(management|process|product|data|ai)`\s*—\s*([^|]+)\|([^\n]+)$/gm)) {
    const levels = m[3].split('|').map((s) => s.trim()).filter(Boolean);
    axes.push({ id: m[1], title: m[2].trim(), levels });
  }
  const greiner = [];
  const g = md.split('### Ось `management` по Грейнеру')[1];
  if (g) for (const r of tableRows(g)) if (/^\d$/.test(r[0])) greiner.push({ level: Number(r[0]), phase: r[1], crisis: r[2] });
  const typeLine = (k) => {
    const line = md.split('\n').find((l) => l.startsWith('- `' + k + '`')) || '';
    return [...line.replace(/^- `[a-z]+`\s*—\s*/, '').matchAll(/`([a-z-]+)`(?:\s*\(([^)]*)\))?/g)].map((x) => ({ id: x[1], note: x[2] || '' }));
  };
  const contours = [];
  const categoryContours = {};
  const cb = md.split('## Контуры бизнеса')[1]?.split('\n## ')[0] || '';
  for (const m of cb.matchAll(/^-\s*`([a-z-]+)`\s*—\s*(.+)$/gm)) contours.push({ id: m[1], title: m[2].split(':')[0].trim(), note: m[2].trim() });
  for (const m of cb.matchAll(/^\|\s*`([a-z-]+)`\s*\|\s*([^|]+)\|/gm)) categoryContours[m[1]] = m[2].split(',').map((x) => x.trim());
  return {
    contours,
    categoryContours,
    categories,
    directions,
    axes,
    greiner,
    scale: typeLine('scale'),
    model: typeLine('model'),
    offer: typeLine('offer'),
    market: typeLine('market'),
  };
}

// ---------- Ссылки на источники ----------

const norm = (s) =>
  s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я]/g, '');
const key5 = (s) => norm(s).slice(0, 5);

export function buildCiteIndex(sources) {
  const byKey = new Map();
  for (const s of sources) {
    const cite = String(s.data.cite || '');
    const surname = cite.split(/[\s,]/)[0];
    if (!surname) continue;
    const k = key5(surname);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(s);
  }
  return byKey;
}

function resolveAuthor(index, text, preferIds) {
  const words = [...text.matchAll(/([A-ZА-ЯЁ][\p{L}'’-]{2,})/gu)].map((m) => m[1]);
  for (const w of words) {
    const list = index.get(key5(w));
    if (!list) continue;
    if (list.length === 1) return list[0].id;
    // Несколько источников одного автора: сначала по году, затем по соавтору, затем по списку карточки.
    const year = text.match(/(19|20)\d\d/);
    if (year) {
      const hit = list.find((s) => String(s.data.year) === year[0]);
      if (hit) return hit.id;
    }
    const withCo = list.find((s) => /\sи\s/.test(s.data.cite) && new RegExp(String(s.data.cite).split(/\sи\s/)[1].split(' ')[0]).test(text));
    if (withCo) return withCo.id;
    const pref = list.find((s) => preferIds.includes(s.id));
    if (pref) return pref.id;
    const solo = list.find((s) => !/\sи\s/.test(s.data.cite));
    return (solo || list[0]).id;
  }
  return null;
}

// Превращает «(Румельт, с. 9, 15–17)» и «с. 12» в ссылки cite:<id>:<page>.
export function linkifyCitations(body, card, index) {
  const preferIds = [...(card.data.sources || []), card.kind === 'source' ? card.id : null].filter(Boolean);
  const fallback = card.kind === 'source' ? card.id : (card.data.sources || [])[0] || null;
  const re = /(с\.\s*)(\d+(?:\s*[–-]\s*\d+)?(?:\s*,\s*\d+(?:\s*[–-]\s*\d+)?)*)/g;
  let out = '';
  let last = 0;
  let paraAuthor = null;
  let m;
  while ((m = re.exec(body))) {
    const before = body.slice(last, m.index);
    if (/\n\s*\n/.test(before)) paraAuthor = null;
    const window = body.slice(Math.max(0, m.index - 90), m.index);
    const cut = Math.max(window.lastIndexOf('('), window.lastIndexOf(';'), window.lastIndexOf('|'), window.lastIndexOf('\n'));
    const seg = window.slice(cut + 1);
    const insideLink = /\]\([^)]*$/.test(window) || /`[^`]*$/.test(window);
    let id = insideLink ? null : resolveAuthor(index, seg, preferIds);
    if (id) paraAuthor = id;
    else if (!insideLink) id = paraAuthor || fallback;
    out += before + m[1];
    if (id) {
      out += m[2].replace(/(\d+)(\s*[–-]\s*\d+)?/g, (all, a) => `[${all}](cite:${id}:${a})`);
    } else out += m[2];
    last = m.index + m[0].length;
  }
  return out + body.slice(last);
}

// ---------- Подбор ----------

const STOP = new Set(['котор', 'чтобы', 'этого', 'когда', 'потом', 'очень', 'всего', 'только', 'между', 'после', 'сейча', 'компа', 'котор', 'нужно', 'может', 'будет', 'также', 'через', 'своих', 'свою', 'своей', 'этому', 'именн', 'более', 'теперь']);

export function stems(text) {
  return new Set(
    norm(' ' + (text || '').replace(/[^\p{L}\s]/gu, ' ') + ' ')
      ? (text || '')
          .toLowerCase()
          .replace(/ё/g, 'е')
          .split(/[^a-zа-я]+/)
          .filter((w) => w.length >= 4)
          .map((w) => w.slice(0, 5))
          .filter((w) => !STOP.has(w))
      : []
  );
}

export function scoreProblems(problems, query, chosenCategories = []) {
  const docs = problems.map((p) => {
    const s = sections(p.body);
    const text = [p.data.title, s['Как выглядит'], (p.data.tags || []).join(' '), s['Почему так происходит']?.slice(0, 1500)].join(' ');
    return { p, st: stems(text) };
  });
  const df = new Map();
  for (const d of docs) for (const w of d.st) df.set(w, (df.get(w) || 0) + 1);
  const q = stems(query);
  return docs
    .map(({ p, st }) => {
      let score = 0;
      const hits = [];
      for (const w of q)
        if (st.has(w)) {
          score += Math.log(1 + docs.length / (df.get(w) || 1));
          hits.push(w);
        }
      const cats = [].concat(p.data.category || []);
      if (cats.some((c) => chosenCategories.includes(c))) score += 8;
      return { problem: p, score, hits };
    })
    .sort((a, b) => b.score - a.score);
}

export function maturityFit(approach, maturity) {
  const min = approach.data.maturity_min || {};
  const gaps = Object.entries(min)
    .filter(([axis, lvl]) => maturity[axis] && Number(maturity[axis]) < Number(lvl))
    .map(([axis, lvl]) => `${axis} ≥ ${lvl}`);
  return { ok: gaps.length === 0, gaps };
}

// Органично или вредно на уровне management по полям stages_fit / stages_harm.
export function stageFit(approach, level) {
  if (!level) return null;
  const fit = [].concat(approach.data.stages_fit || []).map(Number);
  const harm = [].concat(approach.data.stages_harm || []).map(Number);
  if (harm.includes(Number(level))) return 'harm';
  if (fit.includes(Number(level))) return 'fit';
  return null;
}

export function rankApproaches(base, selectedProblems, query, maturity) {
  const byId = new Map(base.approaches.map((a) => [a.id, a]));
  const counts = new Map();
  for (const p of selectedProblems) for (const id of p.data.approaches || []) counts.set(id, (counts.get(id) || 0) + 1);
  const cats = selectedProblems.flatMap((p) => [].concat(p.data.category || []));
  for (const a of base.approaches) {
    const solves = a.data.solves || [];
    const n = solves.filter((c) => cats.includes(c) || selectedProblems.some((p) => p.id === c)).length;
    if (n) counts.set(a.id, (counts.get(a.id) || 0) + n * 0.5);
  }
  const q = stems(query);
  return [...counts.entries()]
    .map(([id, c]) => {
      const a = byId.get(id);
      if (!a) return null;
      const st = stems([a.data.title, (a.data.tags || []).join(' '), sections(a.body)['Когда работает']].join(' '));
      let text = 0;
      for (const w of q) if (st.has(w)) text += 1;
      const fit = maturityFit(a, maturity);
      const stage = stageFit(a, maturity.management);
      const bonus = stage === 'harm' ? -6 : stage === 'fit' ? 2 : 0;
      return { approach: a, score: c * 3 + text - (fit.ok ? 0 : 2) + bonus, refs: c, fit, stage };
    })
    .filter(Boolean)
    .sort((x, y) => y.score - x.score);
}

export function citesIn(text, index) {
  const ids = new Set();
  for (const m of (text || '').matchAll(/([A-ZА-ЯЁ][\p{L}'’-]{2,})/gu)) {
    const list = index.get(key5(m[1]));
    if (list) list.forEach((s) => ids.add(s.id));
  }
  return [...ids];
}

export function slug(s) {
  const map = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ы: 'y', э: 'e', ю: 'yu', я: 'ya' };
  return (s || 'razbor')
    .toLowerCase()
    .split('')
    .map((c) => (map[c] !== undefined ? map[c] : c))
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'razbor';
}
