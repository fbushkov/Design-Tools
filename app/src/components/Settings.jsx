import { useEffect, useState } from 'react';
import { Button, Input, Code, addToast } from '@heroui/react';
import { FolderOpen, Download, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { useApp } from '../state.jsx';
import { PageHeader, Panel, FieldLabel } from './ui.jsx';
import AISettings from './AISettings.jsx';
import UpdatePanel from './UpdatePanel.jsx';

function Status({ ok, okText, badText }) {
  return (
    <span className={`flex items-center gap-1.5 text-xs ${ok ? 'text-success-600' : 'text-warning-600'}`}>
      {ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
      {ok ? okText : badText}
    </span>
  );
}

export default function Settings() {
  const { reload, base, updateBase, updating, pullLog } = useApp();
  const [s, setS] = useState(null);
  const [log, setLog] = useState('');
  const [busy, setBusy] = useState('');
  useEffect(() => {
    window.dt.getSettings().then(setS);
  }, []);
  if (!s) return null;
  const save = async (next) => {
    setS(await window.dt.setSettings(next));
    reload();
  };
  const pick = async (k) => {
    const d = await window.dt.pickFolder();
    if (d) save({ ...s, [k]: d });
  };
  return (
    <div className="h-full overflow-auto">
      <PageHeader title="Настройки" description="Где лежит база и как её обновлять. Всё хранится на этом компьютере, в интернет уходит только git." />
      <div className="px-8 pb-10 space-y-4 max-w-3xl">
        <Panel title="Папки базы" subtitle="Карточки берутся из Design-Tools, тексты книг, карты и разборы — из приватной Design-tools-library.">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <FieldLabel help="Папка с карточками базы: проблемы, подходы, источники, словарь. В ней лежит файл taxonomy.md. Обычно C:\\Users\\<имя>\\Design-Tools.">Папка базы Design-Tools</FieldLabel>
              <Input
                aria-label="Папка базы Design-Tools"
                placeholder="Не выбрана"
                variant="bordered"
                value={s.baseDir}
                onValueChange={(v) => setS({ ...s, baseDir: v })}
                onBlur={() => save(s)}
                endContent={
                  <Button size="sm" variant="light" isIconOnly aria-label="Выбрать папку" onPress={() => pick('baseDir')}>
                    <FolderOpen size={16} />
                  </Button>
                }
              />
              <Status
                ok={base?.ok}
                okText={base?.ok ? `загружено: ${base.problems.length} проблем, ${base.approaches.length} подходов, ${base.sources.length} источников` : ''}
                badText={base?.error || 'папка не найдена'}
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel help="Приватная папка с текстами книг, картами книг и вашими разборами. В ней лежат подпапки md, maps и analyses. Без неё не открываются страницы книг и не сохраняются разборы.">Папка библиотеки Design-tools-library</FieldLabel>
              <Input
                aria-label="Папка библиотеки Design-tools-library"
                placeholder="Не выбрана"
                variant="bordered"
                value={s.libDir}
                onValueChange={(v) => setS({ ...s, libDir: v })}
                onBlur={() => save(s)}
                endContent={
                  <Button size="sm" variant="light" isIconOnly aria-label="Выбрать папку" onPress={() => pick('libDir')}>
                    <FolderOpen size={16} />
                  </Button>
                }
              />
              <Status ok={base?.library?.ok} okText="тексты книг доступны — ссылки на страницы работают" badText="без библиотеки ссылки на страницы книг не откроются" />
            </div>
            <div className="flex items-center gap-3">
              <Button variant="flat" startContent={!updating && <RefreshCw size={15} />} isLoading={updating} onPress={updateBase}>
                Обновить базу
              </Button>
              <span className="text-xs text-default-500">Скачивает новое с GitHub и перечитывает файлы. Та же кнопка есть внизу меню.</span>
            </div>
          </div>
        </Panel>

        <Panel title="Первая установка" subtitle="Скачать обе базы в выбранную папку. Из библиотеки берутся только тексты, карты, разборы и каталог — без файлов книг.">
          <div className="space-y-3">
            <ol className="text-sm text-default-600 list-decimal pl-5 space-y-1">
              <li>Нужен установленный git и вход в GitHub — при первой загрузке откроется окно входа.</li>
              <li>Выберите папку, например домашнюю. Внутри появятся Design-Tools и Design-tools-library.</li>
              <li>Если папки уже есть, они не перезаписываются.</li>
            </ol>
            <div className="flex items-end gap-2">
              <div>
                <FieldLabel help="Версия базы в GitHub, которую скачать. Основная называется main — менять её нужно, только если Claude попросит.">Ветка</FieldLabel>
                <Input aria-label="Ветка" size="md" variant="bordered" className="w-[200px]" value={s.branch || 'main'} onValueChange={(v) => setS({ ...s, branch: v })} />
              </div>
              <Button
                color="primary"
                startContent={busy !== 'setup' && <Download size={15} />}
                isLoading={busy === 'setup'}
                onPress={async () => {
                  const d = await window.dt.pickFolder();
                  if (!d) return;
                  setBusy('setup');
                  const r = await window.dt.setup(d, s.branch || 'main');
                  setLog(r.log + (r.ok ? '\nГотово.' : '\nОшибка.'));
                  setBusy('');
                  setS(await window.dt.getSettings());
                  reload();
                  addToast({ title: r.ok ? 'База скачана' : 'Не удалось скачать', color: r.ok ? 'success' : 'danger' });
                }}
              >
                Скачать базу в папку…
              </Button>
            </div>
          </div>
        </Panel>

        <AISettings />
        <UpdatePanel />

        {(log || pullLog) && (
          <Panel title="Журнал git">
            <Code className="whitespace-pre-wrap block p-3 text-xs w-full" size="sm">
              {[pullLog, log].filter(Boolean).join('\n\n')}
            </Code>
          </Panel>
        )}
      </div>
    </div>
  );
}
