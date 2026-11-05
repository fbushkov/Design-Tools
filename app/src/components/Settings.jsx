import { useEffect, useState } from 'react';
import { Button, Card, CardBody, CardHeader, Input, Code } from '@heroui/react';
import { FolderOpen, Download, RefreshCw } from 'lucide-react';
import { useApp } from '../state.jsx';

export default function Settings() {
  const { reload, base } = useApp();
  const [s, setS] = useState(null);
  const [log, setLog] = useState('');
  const [busy, setBusy] = useState(false);
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
    <div className="p-4 space-y-4 max-w-3xl overflow-auto h-full">
      <Card shadow="sm">
        <CardHeader className="font-medium">Папки базы</CardHeader>
        <CardBody className="space-y-3">
          <Input
            label="Design-Tools (карточки, словарь)"
            value={s.baseDir}
            onValueChange={(v) => setS({ ...s, baseDir: v })}
            onBlur={() => save(s)}
            endContent={<FolderOpen size={18} className="cursor-pointer" onClick={() => pick('baseDir')} />}
            description={base?.ok ? 'Загружено' : base?.error}
            color={base?.ok ? 'default' : 'danger'}
          />
          <Input
            label="Design-tools-library (тексты книг, карты, разборы)"
            value={s.libDir}
            onValueChange={(v) => setS({ ...s, libDir: v })}
            onBlur={() => save(s)}
            endContent={<FolderOpen size={18} className="cursor-pointer" onClick={() => pick('libDir')} />}
            description={base?.library?.ok ? 'Тексты книг доступны' : 'Без библиотеки ссылки на страницы книг не откроются'}
          />
          <div className="flex gap-2">
            <Button
              startContent={<RefreshCw size={16} />}
              isLoading={busy}
              onPress={async () => {
                setBusy(true);
                setLog(await window.dt.pull());
                setBusy(false);
                reload();
              }}
            >
              Обновить с GitHub
            </Button>
          </div>
        </CardBody>
      </Card>
      <Card shadow="sm">
        <CardHeader className="font-medium">Первая установка</CardHeader>
        <CardBody className="space-y-3 text-sm">
          <p>
            Приложение скачает обе базы в выбранную папку. Из приватной библиотеки берутся только тексты, карты, разборы и каталог, без файлов книг.
            Нужен установленный git и вход в GitHub.
          </p>
          <Input label="Ветка" size="sm" className="max-w-xs" value={s.branch || 'main'} onValueChange={(v) => setS({ ...s, branch: v })} />
          <Button
            color="primary"
            startContent={<Download size={16} />}
            isLoading={busy}
            onPress={async () => {
              const d = await window.dt.pickFolder();
              if (!d) return;
              setBusy(true);
              const r = await window.dt.setup(d, s.branch || 'main');
              setLog(r.log + (r.ok ? '\nГотово.' : '\nОшибка.'));
              setBusy(false);
              setS(await window.dt.getSettings());
              reload();
            }}
          >
            Скачать базу в папку…
          </Button>
        </CardBody>
      </Card>
      {log && (
        <Code className="whitespace-pre-wrap block p-3 text-xs" size="sm">
          {log}
        </Code>
      )}
    </div>
  );
}
