import { useState } from 'react';
import { Button, Chip, ScrollShadow, addToast } from '@heroui/react';
import { FileText, UploadCloud, FolderOpen } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useApp } from '../state.jsx';
import { EmptyState } from './ui.jsx';

// Сохранённые разборы из приватной библиотеки (analyses/).
export default function Analyses() {
  const { base, taxonomy, setView } = useApp();
  const [sel, setSel] = useState(base.analyses[0]?.id || null);
  const [busy, setBusy] = useState(false);
  const cur = base.analyses.find((a) => a.id === sel);
  if (!base.library.ok)
    return (
      <EmptyState
        icon={FolderOpen}
        title="Библиотека не подключена"
        text="Разборы хранятся в приватной Design-tools-library. Подключите её в настройках."
        action={
          <Button color="primary" onPress={() => setView('settings')}>
            Настройки
          </Button>
        }
      />
    );
  const catTitle = (id) => taxonomy.categories.find((c) => c.id === id)?.title || id;
  return (
    <div className="h-full grid grid-cols-[340px_1fr] min-h-0">
      <aside className="border-r border-default-200/70 flex flex-col min-h-0 bg-content1/60">
        <div className="px-5 pt-6 pb-3 space-y-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Мои разборы</h1>
            <p className="text-xs text-default-500 mt-0.5">Хранятся в приватной библиотеке, в папке analyses.</p>
          </div>
          <Button
            size="sm"
            variant="flat"
            fullWidth
            isLoading={busy}
            startContent={!busy && <UploadCloud size={15} />}
            onPress={async () => {
              setBusy(true);
              const log = await window.dt.pushAnalyses('Разборы из приложения');
              setBusy(false);
              const ok = !/ошибка/.test(log);
              addToast({ title: ok ? 'Разборы отправлены в GitHub' : 'Не удалось отправить', description: ok ? undefined : log.slice(0, 200), color: ok ? 'success' : 'danger' });
            }}
          >
            Отправить в GitHub
          </Button>
        </div>
        <ScrollShadow className="flex-1 px-2 pb-3">
          <ul className="space-y-0.5">
            {base.analyses.map((a) => {
              const on = a.id === sel;
              return (
                <li key={a.id}>
                  <button
                    onClick={() => setSel(a.id)}
                    className={`w-full text-left flex gap-2.5 px-3 py-2.5 rounded-medium ${on ? 'bg-primary-50' : 'hover:bg-default-100'}`}
                  >
                    <FileText size={15} className="text-default-400 mt-0.5 shrink-0" />
                    <span className="min-w-0">
                      <span className={`block text-[13px] leading-snug ${on ? 'font-medium' : ''}`}>
                        {(a.body.match(/^# (.+)$/m) || [])[1] || a.file.replace(/\.md$/, '')}
                      </span>
                      <span className="block text-[11px] text-default-500 mt-0.5">
                        {String(a.data.date || '').slice(0, 10)}
                        {a.data.mode ? ` · ${a.data.mode === 'full' ? 'полный' : 'быстрый'}` : ''}
                        {a.data.real === false ? ' · тестовый' : ''}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {!base.analyses.length && <EmptyState title="Разборов пока нет" text="Сохраните разбор на экране «Новый разбор»." />}
        </ScrollShadow>
      </aside>
      <div className="overflow-auto min-h-0">
        {cur ? (
          <div className="px-10 py-8 max-w-[820px]">
            <div className="flex flex-wrap gap-1 mb-4">
              {[].concat(cur.data.categories || []).map((c) => (
                <Chip key={c} size="sm" variant="flat">
                  {catTitle(c)}
                </Chip>
              ))}
            </div>
            <div className="md">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{cur.body}</ReactMarkdown>
            </div>
          </div>
        ) : (
          <EmptyState title="Выберите разбор слева" />
        )}
      </div>
    </div>
  );
}
