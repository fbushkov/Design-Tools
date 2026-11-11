// Работа с git: обновление баз и отправка разборов. Не зависит от Electron — проверяется тестом tests/git.test.cjs.
const path = require('path');
const { execFile } = require('child_process');

function git(args, cwd) {
  return new Promise((resolve) => {
    execFile('git', args, { cwd, maxBuffer: 1 << 24, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' } }, (err, stdout, stderr) => {
      resolve({
        ok: !err,
        out: ((stdout || '') + (stderr || '')).trim(),
        missing: !!err && err.code === 'ENOENT',
      });
    });
  });
}

const NO_GIT = 'На компьютере не найден git. Установите его с git-scm.com/download/win и перезапустите программу.';

// Перевод типичных ошибок git на понятный язык. Полный вывод остаётся в журнале.
function explain(out) {
  if (/could not read Username|Authentication failed|terminal prompts disabled|Permission denied|403/i.test(out))
    return 'GitHub не пустил: нужен вход. Откройте PowerShell в папке библиотеки, выполните git push и войдите в открывшемся окне.';
  if (/Could not resolve host|unable to access|Failed to connect|timed out/i.test(out)) return 'Нет связи с GitHub. Проверьте интернет и повторите.';
  if (/CONFLICT|could not apply|Resolve all conflicts/i.test(out))
    return 'Один и тот же файл изменён и здесь, и в GitHub. Программа вернула всё как было. Напишите Claude — он разберёт расхождение.';
  if (/not a git repository/i.test(out)) return 'Папка не связана с GitHub (это не клон репозитория). Скачайте базу заново через «Скачать базу в папку…».';
  return '';
}

// Если в git не указаны имя и почта, коммит и перенос своих коммитов не сработают — подставляем запасные.
async function identity(dir) {
  const who = await git(['config', 'user.email'], dir);
  return who.ok && who.out ? [] : ['-c', 'user.name=Design Tools', '-c', 'user.email=design-tools@localhost'];
}

async function hasGit() {
  const r = await git(['--version']);
  return !r.missing;
}

// Подтянуть изменения из GitHub, не теряя локальных: свои коммиты переносятся поверх, незакоммиченное сохраняется.
async function pullOne(dir) {
  const log = [];
  const run = async (args) => {
    const r = await git(args, dir);
    log.push(`git ${args.join(' ')}\n${r.out}`);
    return r;
  };
  const ident = await identity(dir);
  const r = await run([...ident, 'pull', '--rebase', '--autostash']);
  if (!r.ok) {
    if (r.missing) return { ok: false, message: NO_GIT, log: log.join('\n') };
    await run(['rebase', '--abort']);
    return { ok: false, message: explain(r.out) || 'Не удалось обновить. Подробности — в журнале ниже.', log: log.join('\n') };
  }
  return { ok: true, changed: !/Already up to date|Current branch .* is up to date/i.test(r.out), log: log.join('\n') };
}

async function pullAll(dirs) {
  const results = [];
  for (const dir of dirs.filter(Boolean)) results.push({ name: path.basename(dir), ...(await pullOne(dir)) });
  const bad = results.filter((r) => !r.ok);
  return {
    ok: bad.length === 0,
    changed: results.some((r) => r.changed),
    message: bad.length ? bad.map((r) => `${r.name}: ${r.message}`).join(' ') : results.some((r) => r.changed) ? 'Скачаны новые изменения.' : 'Новых изменений нет.',
    log: results.map((r) => `── ${r.name} ──\n${r.log}`).join('\n\n'),
  };
}

// Отправить разборы: закоммитить изменения в analyses/, подтянуть чужие изменения, отправить.
// status: 'pushed' — отправлено, 'nothing' — отправлять нечего, 'error' — не получилось.
async function pushAnalyses(libDir, message) {
  if (!libDir) return { ok: false, status: 'error', message: 'Не указана папка библиотеки.', log: '' };
  const log = [];
  const run = async (args) => {
    const r = await git(args, libDir);
    log.push(`git ${args.join(' ')}\n${r.out}`);
    return r;
  };
  const fail = (r, fallback) => ({ ok: false, status: 'error', message: r.missing ? NO_GIT : explain(r.out) || fallback, log: log.join('\n') });

  const ident = await identity(libDir);
  let r = await run(['add', '--sparse', '-A', 'analyses']);
  if (!r.ok && !r.missing && /unknown option|usage:/i.test(r.out)) r = await run(['add', '-A', 'analyses']); // старый git без --sparse
  if (!r.ok) return fail(r, 'Не удалось подготовить разборы к отправке.');

  const staged = await run(['diff', '--cached', '--quiet', '--', 'analyses']);
  let committed = false;
  if (!staged.ok) {
    r = await run([...ident, 'commit', '-m', message || 'Разборы из приложения', '--', 'analyses']);
    if (!r.ok) return fail(r, 'Не удалось записать разборы в историю.');
    committed = true;
  }

  const upstream = await run(['rev-parse', '--abbrev-ref', '@{u}']);
  if (upstream.ok) {
    r = await run([...ident, 'pull', '--rebase', '--autostash']);
    if (!r.ok) {
      await run(['rebase', '--abort']);
      return fail(r, 'Не удалось подтянуть изменения из GitHub перед отправкой.');
    }
    const ahead = await run(['rev-list', '--count', '@{u}..HEAD']);
    if (ahead.ok && ahead.out.trim() === '0') return { ok: true, status: 'nothing', message: 'Все разборы уже в GitHub.', log: log.join('\n') };
    r = await run(['push']);
  } else {
    r = await run(['push', '-u', 'origin', 'HEAD']);
  }
  if (!r.ok) return fail(r, 'Не удалось отправить. Подробности — в журнале.');
  return { ok: true, status: 'pushed', message: committed ? 'Разборы отправлены в GitHub.' : 'Отправлены ранее сохранённые разборы.', log: log.join('\n') };
}

module.exports = { git, hasGit, pullAll, pushAnalyses, explain, NO_GIT };
