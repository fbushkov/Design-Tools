const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { loadBase, bookPage, saveAnalysis, deleteAnalysis, updateAnalysisMeta } = require('./data.cjs');
const ai = require('./ai.cjs');

const REPOS = {
  base: 'https://github.com/fbushkov/Design-Tools.git',
  lib: 'https://github.com/fbushkov/Design-tools-library.git',
};

function settingsFile() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function defaultSettings() {
  // Если приложение запущено из папки app внутри клона Design-Tools — взять соседние папки.
  const repoRoot = path.resolve(__dirname, '..', '..');
  const baseDir = fs.existsSync(path.join(repoRoot, 'taxonomy.md')) ? repoRoot : '';
  const sibling = baseDir ? path.join(path.dirname(baseDir), 'Design-tools-library') : '';
  return { baseDir, libDir: sibling && fs.existsSync(sibling) ? sibling : '', branch: 'main' };
}

function readSettings() {
  const env = {
    baseDir: process.env.DT_BASE_DIR,
    libDir: process.env.DT_LIB_DIR,
  };
  let saved = {};
  try {
    saved = JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
  } catch (e) {}
  const s = { ...defaultSettings(), ...saved };
  if (env.baseDir) s.baseDir = env.baseDir;
  if (env.libDir) s.libDir = env.libDir;
  return s;
}

function writeSettings(s) {
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(s, null, 2));
}

function git(args, cwd) {
  return new Promise((resolve) => {
    execFile('git', args, { cwd, maxBuffer: 1 << 24 }, (err, stdout, stderr) => {
      resolve({ ok: !err, out: (stdout || '') + (stderr || ''), error: err ? err.message : null });
    });
  });
}

async function setupRepos(parentDir, branch) {
  const log = [];
  const baseDir = path.join(parentDir, 'Design-Tools');
  const libDir = path.join(parentDir, 'Design-tools-library');
  if (!fs.existsSync(baseDir)) {
    const r = await git(['clone', '--branch', branch, REPOS.base, baseDir], parentDir);
    log.push(r.out);
    if (!r.ok) return { ok: false, log: log.join('\n') };
  }
  if (!fs.existsSync(libDir)) {
    // Без файлов книг: только тексты, карты, разборы и каталог.
    let r = await git(['clone', '--filter=blob:none', '--no-checkout', '--branch', branch, REPOS.lib, libDir], parentDir);
    log.push(r.out);
    if (!r.ok) return { ok: false, log: log.join('\n') };
    r = await git(['sparse-checkout', 'set', '--no-cone', '/md/', '/maps/', '/analyses/', '/catalog.yml'], libDir);
    log.push(r.out);
    r = await git(['checkout', branch], libDir);
    log.push(r.out);
    if (!r.ok) return { ok: false, log: log.join('\n') };
  }
  return { ok: true, baseDir, libDir, log: log.join('\n') };
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 640,
    title: 'Design Tools',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.setMenuBarVisibility(false);
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  if (process.env.VITE_DEV) win.loadURL('http://localhost:5173');
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  return win;
}

ipcMain.handle('settings:get', () => readSettings());
ipcMain.handle('settings:set', (_e, s) => {
  writeSettings(s);
  return readSettings();
});
ipcMain.handle('dialog:folder', async () => {
  const r = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('base:load', () => {
  const s = readSettings();
  return loadBase(s.baseDir, s.libDir);
});
ipcMain.handle('book:page', (_e, id, page) => bookPage(readSettings().libDir, id, page));
ipcMain.handle('analysis:save', (_e, filename, content, overwrite) => saveAnalysis(readSettings().libDir, filename, content, overwrite));
ipcMain.handle('analysis:delete', (_e, filename) => deleteAnalysis(readSettings().libDir, filename));
ipcMain.handle('analysis:meta', (_e, filename, patch) => updateAnalysisMeta(readSettings().libDir, filename, patch));
ipcMain.handle('ai:config', () => ai.publicConfig());
ipcMain.handle('ai:save', (_e, provider, key) => ai.saveProvider(provider, key));
ipcMain.handle('ai:remove', (_e, id) => ai.removeProvider(id));
ipcMain.handle('ai:active', (_e, id) => ai.setActive(id));
ipcMain.handle('ai:test', (_e, id) => ai.test(id));
ipcMain.handle('ai:plan', (_e, ctx) => ai.plan(ctx));
ipcMain.handle('git:pull', async () => {
  const s = readSettings();
  const out = [];
  for (const dir of [s.baseDir, s.libDir].filter(Boolean)) {
    const r = await git(['pull', '--ff-only'], dir);
    out.push(`${path.basename(dir)}: ${r.ok ? 'обновлено' : 'ошибка'}\n${r.out}`);
  }
  return out.join('\n');
});
ipcMain.handle('git:push-analyses', async (_e, message) => {
  const s = readSettings();
  if (!s.libDir) return 'Не указана папка библиотеки.';
  const steps = [
    ['add', '--sparse', '-A', 'analyses'],
    ['commit', '-m', message || 'Разбор из приложения'],
    ['push'],
  ];
  const out = [];
  for (const a of steps) {
    const r = await git(a, s.libDir);
    out.push(`git ${a[0]}: ${r.ok ? 'ок' : 'ошибка'}\n${r.out}`);
    if (!r.ok) break;
  }
  return out.join('\n');
});
ipcMain.handle('git:setup', async (_e, parentDir, branch) => {
  const r = await setupRepos(parentDir, branch || 'main');
  if (r.ok) writeSettings({ ...readSettings(), baseDir: r.baseDir, libDir: r.libDir, branch: branch || 'main' });
  return r;
});
ipcMain.handle('shell:open', (_e, p) => shell.openPath(p));

// Обновление самой программы: установленная версия проверяет выпуски на GitHub,
// скачивает новую в фоне и ставит её при перезапуске. При запуске из исходников не работает.
let updateState = { status: 'idle' };
function sendUpdate(next) {
  updateState = { ...updateState, ...next };
  BrowserWindow.getAllWindows().forEach((w) => w.webContents.send('update:state', updateState));
}
function initUpdater() {
  if (!app.isPackaged) {
    updateState = { status: 'dev' };
    return null;
  }
  const { autoUpdater } = require('electron-updater');
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => sendUpdate({ status: 'checking', error: '' }));
  autoUpdater.on('update-available', (i) => sendUpdate({ status: 'downloading', version: i.version, percent: 0 }));
  autoUpdater.on('update-not-available', () => sendUpdate({ status: 'latest' }));
  autoUpdater.on('download-progress', (p) => sendUpdate({ status: 'downloading', percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (i) => sendUpdate({ status: 'ready', version: i.version }));
  autoUpdater.on('error', (e) => sendUpdate({ status: 'error', error: String(e?.message || e).slice(0, 200) }));
  return autoUpdater;
}
let updater = null;
ipcMain.handle('update:state', () => ({ ...updateState, current: app.getVersion() }));
ipcMain.handle('update:check', async () => {
  if (!updater) return { ...updateState, current: app.getVersion() };
  try {
    await updater.checkForUpdates();
  } catch (e) {
    sendUpdate({ status: 'error', error: String(e?.message || e).slice(0, 200) });
  }
  return { ...updateState, current: app.getVersion() };
});
ipcMain.handle('update:install', () => updater && updater.quitAndInstall());

app.whenReady().then(() => {
  createWindow();
  updater = initUpdater();
  if (updater) setTimeout(() => updater.checkForUpdates().catch(() => {}), 4000);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
