import { useEffect, useState } from 'react';
import { Button, Progress } from '@heroui/react';
import { RefreshCw, Rocket } from 'lucide-react';
import { Panel } from './ui.jsx';

const TEXT = {
  dev: 'Запущено из исходников (npm start) — обновление через git pull, см. инструкцию.',
  idle: 'Проверка ещё не запускалась.',
  checking: 'Проверяю, есть ли новая версия…',
  latest: 'Установлена последняя версия.',
  downloading: 'Скачиваю новую версию…',
  ready: 'Новая версия скачана. Она установится при перезапуске.',
  error: 'Не удалось проверить обновления.',
};

// Версия программы и обновление установленного .exe из выпусков на GitHub.
export default function UpdatePanel() {
  const [st, setSt] = useState(null);
  useEffect(() => {
    window.dt.update.state().then(setSt);
    return window.dt.update.onState((s) => setSt((x) => ({ ...x, ...s })));
  }, []);
  if (!st) return null;
  return (
    <Panel
      title="Программа"
      subtitle={`Версия ${st.current}. Установленная программа сама проверяет обновления при запуске. База знаний обновляется отдельно — кнопкой «Обновить базу».`}
      actions={
        st.status === 'ready' ? (
          <Button size="sm" color="primary" startContent={<Rocket size={14} />} onPress={() => window.dt.update.install()}>
            Перезапустить и обновить
          </Button>
        ) : (
          st.status !== 'dev' && (
            <Button
              size="sm"
              variant="flat"
              startContent={st.status !== 'checking' && <RefreshCw size={14} />}
              isLoading={st.status === 'checking'}
              onPress={async () => setSt(await window.dt.update.check())}
            >
              Проверить обновления
            </Button>
          )
        )
      }
    >
      <p className={`text-xs ${st.status === 'error' ? 'text-danger' : 'text-default-600'}`}>
        {TEXT[st.status] || ''}
        {st.version && (st.status === 'ready' || st.status === 'downloading') ? ` Версия ${st.version}.` : ''}
        {st.error ? ` ${st.error}` : ''}
      </p>
      {st.status === 'downloading' && <Progress aria-label="Загрузка" size="sm" value={st.percent || 0} className="mt-2" />}
    </Panel>
  );
}
