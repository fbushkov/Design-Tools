import { useEffect, useMemo, useState } from 'react';
import { Button, Chip, ScrollShadow, Textarea, addToast, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Tooltip } from '@heroui/react';
import { FileText, UploadCloud, FolderOpen, Play, Trash2, FlaskConical, BadgeCheck, Save } from 'lucide-react';
import Markdown from './Markdown.jsx';
import { useApp } from '../state.jsx';
import { EmptyState, Segmented, Panel } from './ui.jsx';
import { STATE_RE, decodeState } from './Analysis.jsx';

const fmtDate = (d) => {
  const t = d instanceof Date ? d : new Date(String(d || ''));
  return isNaN(t) ? '' : t.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).replace(' г.', '');
};
const titleOf = (a) => (a.body.match(/^# (.+)$/m) || [])[1] || a.file.replace(/\.md$/, '');

// Сохранённые разборы из приватной библиотеки (analyses/): просмотр, продолжение, итог, удаление.
export default function Analyses() {
  const { base, taxonomy, setView, reload } = useApp();
  const [filter, setFilter] = useState('all');
  const list = useMemo(
    () => base.analyses.filter((a) => filter === 'all' || (filter === 'test' ? a.data.real === false : a.data.real !== false)),
    [base.analyses, filter]
  );
  const [sel, setSel] = useState(list[0]?.file || null);
  const cur = base.analyses.find((a) => a.file === sel) || list[0];
  const [outcome, setOutcome] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => setOutcome(cur?.data.outcome || ''), [cur?.file]);

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
  const stateOf = (a) => {
    const m = a.body.match(STATE_RE);
    try {
      return m ? decodeState(m[1]) : null;
    } catch (e) {
      return null;
    }
  };
  const meta = async (patch, msg) => {
    const r = await window.dt.analysisMeta(cur.file, patch);
    addToast({ title: r.ok ? msg : 'Не удалось сохранить', description: r.error, color: r.ok ? 'success' : 'danger' });
    reload();
  };
  const cont = () => {
    const st = stateOf(cur);
    if (!st) return;
    try {
      localStorage.setItem('dt-draft', JSON.stringify({ ...st, file: cur.file, outcome: cur.data.outcome || st.outcome || '', real: cur.data.real !== false }));
    } catch (e) {}
    setView('analysis');
  };
  const body = cur ? cur.body.replace(STATE_RE, '').replace(/^# .+\n/m, '') : '';
  const counts = { all: base.analyses.length, real: base.analyses.filter((a) => a.data.real !== false).length, test: base.analyses.filter((a) => a.data.real === false).length };

  return (
    <div className="h-full grid grid-cols-[340px_1fr] min-h-0">
      <aside className="border-r border-default-200/70 flex flex-col min-h-0">
        <div className="px-5 pt-6 pb-3 space-y-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Мои разборы</h1>
            <p className="text-xs text-default-500 mt-0.5">Хранятся в приватной библиотеке, папка analyses.</p>
          </div>
          <Segmented
            ariaLabel="Фильтр"
            allowEmpty={false}
            value={filter}
            onChange={(v) => {
              setFilter(v);
              setSel(null);
            }}
            options={[
              { value: 'all', label: `Все ${counts.all}` },
              { value: 'real', label: `Реальные ${counts.real}` },
              { value: 'test', label: `Тестовые ${counts.test}` },
            ]}
          />
        </div>
        <ScrollShadow className="flex-1 px-2 pb-3">
          <ul className="space-y-0.5">
            {list.map((a) => {
              const on = a.file === cur?.file;
              return (
                <li key={a.file}>
                  <button
                    onClick={() => setSel(a.file)}
                    className={`w-full text-left flex gap-2.5 px-3 py-2.5 rounded-medium transition-colors ${on ? 'bg-primary-50' : 'hover:bg-default-100'}`}
                  >
                    {a.data.real === false ? (
                      <FlaskConical size={15} className="text-warning mt-0.5 shrink-0" />
                    ) : (
                      <FileText size={15} className="text-default-400 mt-0.5 shrink-0" />
                    )}
                    <span className="min-w-0">
                      <span className={`block text-[13px] leading-snug ${on ? 'font-medium' : ''}`}>{titleOf(a)}</span>
                      <span className="block text-[11px] text-default-500 mt-0.5">
                        {fmtDate(a.data.date)}
                        {a.data.mode ? ` · ${a.data.mode === 'full' ? 'полный' : 'быстрый'}` : ''}
                        {a.data.outcome ? ' · есть итог' : ''}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {!list.length && <EmptyState title="Разборов нет" text="Сохраните разбор на экране «Новый разбор»." />}
        </ScrollShadow>
        <div className="p-3 border-t border-default-200/70">
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
            Отправить все в GitHub
          </Button>
        </div>
      </aside>

      <div className="overflow-auto min-h-0 bg-content1">
        {cur ? (
          <div className="px-10 py-8 max-w-[860px] space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-default-500 mb-1">
                  {cur.data.real === false ? (
                    <Chip size="sm" variant="flat" color="warning" startContent={<FlaskConical size={11} />} className="h-5 text-[11px]">
                      тестовый
                    </Chip>
                  ) : (
                    <Chip size="sm" variant="flat" color="success" startContent={<BadgeCheck size={11} />} className="h-5 text-[11px]">
                      реальный
                    </Chip>
                  )}
                  <span>{fmtDate(cur.data.date)}</span>
                </div>
                <h2 className="text-xl font-semibold tracking-tight">{titleOf(cur)}</h2>
                <code className="block text-[11px] text-default-400 truncate mt-1" title={cur.file}>
                  {cur.file}
                </code>
                <div className="flex flex-wrap gap-1 mt-2">
                  {[].concat(cur.data.categories || []).map((c) => (
                    <Chip key={c} size="sm" variant="flat" className="h-6">
                      {catTitle(c)}
                    </Chip>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Tooltip content={stateOf(cur) ? 'Открыть в редакторе разбора' : 'Разбор сохранён старой версией — продолжить нельзя'} delay={300}>
                  <span>
                    <Button size="sm" color="primary" startContent={<Play size={14} />} isDisabled={!stateOf(cur)} onPress={cont}>
                      Продолжить
                    </Button>
                  </span>
                </Tooltip>
                <Button
                  size="sm"
                  variant="flat"
                  startContent={<FlaskConical size={14} />}
                  onPress={() => meta({ real: cur.data.real === false }, cur.data.real === false ? 'Отмечен как реальный' : 'Отмечен как тестовый')}
                >
                  {cur.data.real === false ? 'Сделать реальным' : 'Сделать тестовым'}
                </Button>
                <Tooltip content="Удалить разбор" delay={300}>
                  <Button size="sm" variant="light" color="danger" isIconOnly aria-label="Удалить разбор" onPress={() => setConfirm(true)}>
                    <Trash2 size={15} />
                  </Button>
                </Tooltip>
              </div>
            </div>

            <Panel title="Итог" subtitle="Какой путь выбрали и что получилось. Из разборов с итогом делаются обезличенные кейсы.">
              <Textarea aria-label="Итог" minRows={2} variant="bordered" placeholder="Например: выбрали…, через месяц…" value={outcome} onValueChange={setOutcome} />
              <div className="flex justify-end mt-2">
                <Button size="sm" variant="flat" startContent={<Save size={14} />} isDisabled={outcome === (cur.data.outcome || '')} onPress={() => meta({ outcome }, 'Итог сохранён')}>
                  Сохранить итог
                </Button>
              </div>
            </Panel>

            <Markdown text={body} card={{ kind: 'analysis', id: cur.file, data: { sources: [] } }} />
          </div>
        ) : (
          <EmptyState title="Выберите разбор слева" />
        )}
      </div>

      <Modal isOpen={confirm} onClose={() => setConfirm(false)} size="sm">
        <ModalContent>
          <ModalHeader>Удалить разбор?</ModalHeader>
          <ModalBody>
            <p className="text-sm">
              «{cur && titleOf(cur)}» будет удалён из папки analyses на этом компьютере. Если разбор уже отправлен в GitHub, после «Отправить все в GitHub» он
              удалится и там; прежние версии останутся в истории git.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setConfirm(false)}>
              Отмена
            </Button>
            <Button
              color="danger"
              onPress={async () => {
                const r = await window.dt.deleteAnalysis(cur.file);
                setConfirm(false);
                addToast({ title: r.ok ? 'Разбор удалён' : 'Не удалось удалить', description: r.error, color: r.ok ? 'success' : 'danger' });
                setSel(null);
                reload();
              }}
            >
              Удалить
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
