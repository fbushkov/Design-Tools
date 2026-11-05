import { useState } from 'react';
import { Listbox, ListboxItem, ScrollShadow, Button } from '@heroui/react';
import { FileText, Upload } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useApp } from '../state.jsx';

// Сохранённые разборы из приватной библиотеки (analyses/).
export default function Analyses() {
  const { base } = useApp();
  const [sel, setSel] = useState(base.analyses[0]?.id || null);
  const [log, setLog] = useState('');
  const cur = base.analyses.find((a) => a.id === sel);
  if (!base.library.ok) return <p className="p-4 text-default-500">Библиотека не подключена — укажите её в настройках.</p>;
  return (
    <div className="h-full grid grid-cols-[320px_1fr]">
      <div className="border-r border-default-200 p-3 flex flex-col gap-2">
        <Button
          size="sm"
          variant="flat"
          startContent={<Upload size={14} />}
          onPress={async () => setLog(await window.dt.pushAnalyses('Разборы из приложения'))}
        >
          Отправить разборы в GitHub
        </Button>
        {log && <pre className="text-xs whitespace-pre-wrap text-default-500 max-h-32 overflow-auto">{log}</pre>}
        <ScrollShadow className="flex-1">
          <Listbox aria-label="Разборы" selectionMode="single" selectedKeys={sel ? [sel] : []} onAction={(k) => setSel(String(k))}>
            {base.analyses.map((a) => (
              <ListboxItem key={a.id} startContent={<FileText size={16} />} description={[a.data.date, a.data.mode].filter(Boolean).join(' · ')}>
                {a.file.replace(/\.md$/, '')}
              </ListboxItem>
            ))}
          </Listbox>
        </ScrollShadow>
      </div>
      <div className="overflow-auto p-6">
        {cur ? (
          <div className="md max-w-4xl">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{cur.body}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-default-500">Разборов пока нет.</p>
        )}
      </div>
    </div>
  );
}
