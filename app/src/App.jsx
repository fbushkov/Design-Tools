import { Button, Drawer, DrawerContent, DrawerHeader, DrawerBody, Spinner, Tooltip } from '@heroui/react';
import { ClipboardList, Network, AlertTriangle, Compass, BookOpen, FolderOpen, Settings as SettingsIcon, ArrowLeft, X, RefreshCw } from 'lucide-react';
import { useApp } from './state.jsx';
import Analysis from './components/Analysis.jsx';
import MapView from './components/MapView.jsx';
import Library from './components/Library.jsx';
import Analyses from './components/Analyses.jsx';
import Settings from './components/Settings.jsx';
import CardView from './components/CardView.jsx';
import PageModal from './components/PageModal.jsx';

const NAV = [
  { key: 'analysis', label: 'Разбор', icon: ClipboardList },
  { key: 'map', label: 'Карта', icon: Network },
  { key: 'problems', label: 'Проблемы', icon: AlertTriangle },
  { key: 'approaches', label: 'Подходы', icon: Compass },
  { key: 'sources', label: 'Источники', icon: BookOpen },
  { key: 'analyses', label: 'Разборы', icon: FolderOpen },
  { key: 'settings', label: 'Настройки', icon: SettingsIcon },
];

export default function App() {
  const { base, loading, view, setView, cardStack, closeCard, byId, reload } = useApp();
  const top = cardStack.length ? byId.get(cardStack[cardStack.length - 1]) : null;
  const ready = base?.ok;
  return (
    <div className="h-full flex bg-background text-foreground">
      <nav className="w-52 shrink-0 border-r border-default-200 flex flex-col p-2 gap-1">
        <div className="px-3 py-3 font-semibold">Design Tools</div>
        {NAV.map((n) => (
          <Button
            key={n.key}
            variant={view === n.key ? 'flat' : 'light'}
            color={view === n.key ? 'primary' : 'default'}
            className="justify-start"
            startContent={<n.icon size={18} />}
            onPress={() => setView(n.key)}
            isDisabled={!ready && n.key !== 'settings'}
          >
            {n.label}
          </Button>
        ))}
        <div className="mt-auto px-3 py-2 text-xs text-default-500 space-y-1">
          {ready && (
            <>
              <div>
                Проблем {base.problems.length} · подходов {base.approaches.length}
              </div>
              <div>
                Источников {base.sources.length} · разборов {base.analyses.length}
              </div>
            </>
          )}
          <Tooltip content="Перечитать файлы с диска">
            <Button size="sm" variant="light" isIconOnly onPress={reload} aria-label="Перечитать">
              <RefreshCw size={14} />
            </Button>
          </Tooltip>
        </div>
      </nav>
      <main className="flex-1 min-w-0">
        {loading && (
          <div className="h-full grid place-items-center">
            <Spinner label="Загружаю базу" />
          </div>
        )}
        {!loading && !ready && view !== 'settings' && (
          <div className="p-6 space-y-3">
            <p className="text-danger">{base?.error || 'База не загружена.'}</p>
            <Button color="primary" onPress={() => setView('settings')}>
              Открыть настройки
            </Button>
          </div>
        )}
        {!loading && ready && view === 'analysis' && <Analysis />}
        {!loading && ready && view === 'map' && <MapView />}
        {!loading && ready && ['problems', 'approaches', 'sources'].includes(view) && <Library key={view} which={view} />}
        {!loading && ready && view === 'analyses' && <Analyses />}
        {!loading && view === 'settings' && <Settings />}
      </main>
      <Drawer isOpen={!!top} onClose={() => cardStack.forEach(() => closeCard())} size="3xl" hideCloseButton>
        <DrawerContent>
          <DrawerHeader className="flex justify-between">
            <Button size="sm" variant="light" startContent={<ArrowLeft size={16} />} onPress={closeCard} isDisabled={cardStack.length < 2}>
              Назад
            </Button>
            <Button size="sm" variant="light" isIconOnly aria-label="Закрыть" onPress={() => cardStack.forEach(() => closeCard())}>
              <X size={18} />
            </Button>
          </DrawerHeader>
          <DrawerBody>{top && <CardView card={top} />}</DrawerBody>
        </DrawerContent>
      </Drawer>
      <PageModal />
    </div>
  );
}
