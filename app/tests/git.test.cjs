// Проверка отправки разборов и обновления на настоящих временных репозиториях: node tests/git.test.cjs
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { pushAnalyses, pullAll } = require('../electron/git.cjs');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-git-'));
// Чистый git без имени и почты — как на новом компьютере.
fs.writeFileSync(path.join(root, 'empty.gitconfig'), '');
process.env.GIT_CONFIG_GLOBAL = path.join(root, 'empty.gitconfig');
process.env.GIT_CONFIG_NOSYSTEM = '1';
const sh = (cwd, ...a) => execFileSync('git', a, { cwd, stdio: 'pipe' }).toString();
const write = (dir, file, text) => {
  fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  fs.writeFileSync(path.join(dir, file), text);
};
let failed = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${cond ? '' : ' — ' + extra}`);
  if (!cond) failed++;
};

(async () => {
  // «GitHub» и два компьютера: пользователь и Claude.
  const remote = path.join(root, 'remote.git');
  sh(root, 'init', '--bare', '-b', 'main', remote);
  const claude = path.join(root, 'claude');
  sh(root, 'clone', remote, claude);
  sh(claude, 'config', 'user.email', 'c@x');
  sh(claude, 'config', 'user.name', 'c');
  write(claude, 'analyses/README.md', 'readme');
  write(claude, 'maps/a.md', 'карта');
  sh(claude, 'add', '-A');
  sh(claude, 'commit', '-m', 'init');
  sh(claude, 'push', '-u', 'origin', 'main');
  const user = path.join(root, 'user');
  sh(root, 'clone', remote, user);

  let r = await pushAnalyses(user, 'тест');
  check('нечего отправлять — это не ошибка', r.ok && r.status === 'nothing', JSON.stringify(r));

  write(user, 'analyses/2026-01-01-a.md', 'разбор А');
  r = await pushAnalyses(user, 'тест');
  check('новый разбор отправлен (без настроенного имени в git)', r.ok && r.status === 'pushed', r.message + '\n' + r.log);

  // В GitHub появились новые карты, у пользователя — новый разбор.
  write(claude, 'maps/b.md', 'новая карта');
  sh(claude, 'pull');
  sh(claude, 'add', '-A');
  sh(claude, 'commit', '-m', 'карты');
  sh(claude, 'push');
  write(user, 'analyses/2026-01-02-b.md', 'разбор Б');
  r = await pushAnalyses(user, 'тест');
  check('отправка, когда в GitHub есть новые изменения', r.ok && r.status === 'pushed', r.message + '\n' + r.log);
  check('новые карты при этом подтянулись', fs.existsSync(path.join(user, 'maps/b.md')));
  sh(claude, 'pull');
  check('разбор дошёл до GitHub', fs.existsSync(path.join(claude, 'analyses/2026-01-02-b.md')));

  // Удаление разбора тоже уходит.
  fs.unlinkSync(path.join(user, 'analyses/2026-01-01-a.md'));
  r = await pushAnalyses(user, 'тест');
  sh(claude, 'pull');
  check('удаление разбора отправлено', r.ok && !fs.existsSync(path.join(claude, 'analyses/2026-01-01-a.md')), r.message);

  // Обновление, когда есть несохранённый в git разбор и локальный неотправленный коммит.
  write(claude, 'maps/c.md', 'ещё карта');
  sh(claude, 'add', '-A');
  sh(claude, 'commit', '-m', 'карта c');
  sh(claude, 'push');
  write(user, 'analyses/2026-01-03-c.md', 'черновик');
  sh(user, 'add', '-A');
  sh(user, '-c', 'user.name=u', '-c', 'user.email=u@x', 'commit', '-m', 'локальный коммит');
  write(user, 'analyses/2026-01-04-d.md', 'ещё не в git');
  let p = await pullAll([user]);
  check('обновление при локальном коммите и новых файлах', p.ok && p.changed && fs.existsSync(path.join(user, 'maps/c.md')), p.message + '\n' + p.log);
  check('несохранённый в git разбор на месте', fs.existsSync(path.join(user, 'analyses/2026-01-04-d.md')));
  p = await pullAll([user]);
  check('повторное обновление — «новых изменений нет»', p.ok && !p.changed, p.message);

  // Конфликт: один файл изменён с двух сторон — всё возвращается как было, сообщение понятное.
  write(claude, 'analyses/2026-01-02-b.md', 'правка Claude');
  sh(claude, 'pull');
  sh(claude, 'add', '-A');
  sh(claude, 'commit', '-m', 'правка');
  sh(claude, 'push');
  write(user, 'analyses/2026-01-02-b.md', 'правка пользователя');
  r = await pushAnalyses(user, 'тест');
  check('конфликт: понятное сообщение', !r.ok && /изменён и здесь, и в GitHub/.test(r.message), r.message + '\n' + r.log);
  check('конфликт: файл пользователя цел', fs.readFileSync(path.join(user, 'analyses/2026-01-02-b.md'), 'utf8') === 'правка пользователя');
  check('конфликт: репозиторий не застрял в rebase', !fs.existsSync(path.join(user, '.git', 'rebase-merge')) && !fs.existsSync(path.join(user, '.git', 'rebase-apply')));

  // Не репозиторий.
  const plain = path.join(root, 'plain');
  write(plain, 'analyses/x.md', 'x');
  r = await pushAnalyses(plain, 'тест');
  check('папка без git: понятное сообщение', !r.ok && /не связана с GitHub/.test(r.message), r.message);

  fs.rmSync(root, { recursive: true, force: true });
  console.log(failed ? `Провалено: ${failed}` : 'Все проверки git пройдены');
  process.exit(failed ? 1 : 0);
})();
