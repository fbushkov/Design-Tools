import { Button, Drawer, DrawerContent, DrawerHeader, DrawerBody, Spinner, Tooltip } from '@heroui/react';
import {
  ClipboardList,
  Network,
  AlertTriangle,
  Compass,
  BookOpen,
  FolderOpen,
  Settings as SettingsIcon,
  ArrowLeft,
  X,
  RefreshCw,
  Search,
  Moon,
  Sun,
  Sparkles,
} from 'lucide-react';
import { useApp } from './state.jsx';
import Analysis from './components/Analysis.jsx';
import MapView from './components/MapView.jsx';
import Library from './components/Library.jsx';
import Analyses from './components/Analyses.jsx';
import Settings from './components/Settings.jsx';
import CardView from './components/CardView.jsx';
import PageModal from './components/PageModal.jsx';
import CommandPalette from './components/CommandPalette.jsx';
import { EmptyState, Hotkey } from './components/ui.jsx';

const GROUPS = [
  {
    title: 'Работа',
    items: [
      { key: 'analysis', label: 'Новый разбор', icon: ClipboardList },
      { key: 'analyses', label: 'Мои разборы', icon: FolderOpen, count: (b) => b.analyses.length },
    ],
  },
  {
    title: 'База знаний',
    items: [
      { key: 'map', label: 'Карта', icon: Network },
      { key: 'problems', label: 'Проблемы', icon: AlertTriangle, count: (b) => b.problems.length },
      { key: 'approaches', label: 'Подходы', icon: Compass, count: (b) => b.approaches.length },
      { key: 'sources', label: 'Источники', icon: BookOpen, count: (b) => b.sources.length },
    ],
  },
];

function NavItem({ item, active, disabled, onPress, count }) {
  const I = item.icon;
  return (
    <button
      onClick={onPress}
      disabled={disabled}
      className={`group w-full h-9 flex items-center gap-2.5 px-3 rounded-medium text-[13px] transition-colors ${
        active ? 'bg-content1 text-foreground font-medium shadow-sm border border-default-200/70' : 'text-default-600 hover:bg-default-100 border border-transparent'
      } ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
    >
      <I size={16} className={active ? 'text-primary' : 'text-default-400 group-hover:text-default-600'} />
      <span className="flex-1 text-left">{item.label}</span>
      {count !== undefined && <span className="text-[11px] text-default-400 tabular">{count}</span>}
    </button>
  );
}

export default function App() {
  const { base, loading, view, setView, cardStack, closeCard, closeAllCards, byId, reload, setPalette, theme, setTheme, goToCard } = useApp();
  const top = cardStack.length ? byId.get(cardStack[cardStack.length - 1]) : null;
  const ready = base?.ok;
  return (
    <div className="h-screen overflow-hidden flex bg-background text-foreground">
      <nav className="w-60 shrink-0 h-full overflow-y-auto flex flex-col px-3 py-4 gap-5 border-r border-default-200/70" aria-label="Разделы">
        <div className="flex items-center gap-2 px-2">
          <div className="size-7 rounded-medium bg-primary grid place-items-center">
            <Sparkles size={15} className="text-primary-foreground" />
          </div>
          <div className="leading-tight">
            <div className="font-semibold text-sm">Design Tools</div>
            <div className="text-[11px] text-default-500">разборы по базе знаний</div>
          </div>
        </div>
        <button
          onClick={() => setPalette(true)}
          disabled={!ready}
          className="h-9 flex items-center gap-2 px-3 rounded-medium bg-content1 border border-default-200/70 text-default-500 text-[13px] hover:border-default-300 disabled:opacity-40"
        >
          <Search size={15} />
          <span className="flex-1 text-left">Поиск по базе</span>
          <Hotkey>Ctrl K</Hotkey>
        </button>
        {GROUPS.map((g) => (
          <div key={g.title} className="space-y-0.5">
            <div className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-default-400">{g.title}</div>
            {g.items.map((n) => (
              <NavItem
                key={n.key}
                item={n}
                active={view === n.key}
                disabled={!ready}
                count={ready && n.count ? n.count(base) : undefined}
                onPress={() => {
                  closeAllCards();
                  setView(n.key);
                }}
              />
            ))}
          </div>
        ))}
        <div className="mt-auto space-y-0.5">
          <NavItem item={{ label: 'Настройки', icon: SettingsIcon }} active={view === 'settings'} onPress={() => setView('settings')} />
          <div className="flex items-center justify-between px-2 pt-2">
            <Tooltip
              delay={200}
              className="max-w-xs"
              content={
                ready
                  ? base.library.ok
                    ? 'Карточки базы и тексты книг на месте.'
                    : 'Карточки базы есть, но не найдена приватная Design-tools-library: ссылки на страницы книг и сохранение разборов не работают. Нажмите, чтобы подключить.'
                  : 'Не найдена папка Design-Tools. Нажмите, чтобы указать.'
              }
            >
              <button onClick={() => setView('settings')} className="text-[11px] text-default-400 hover:text-foreground flex items-center gap-1.5 text-left">
                <span className={`size-1.5 rounded-full shrink-0 ${ready ? (base.library.ok ? 'bg-success' : 'bg-warning') : 'bg-danger'}`} />
                {ready ? (base.library.ok ? 'база и книги подключены' : 'библиотека не подключена →') : 'база не найдена →'}
              </button>
            </Tooltip>
            <div className="flex">
              <Tooltip content="Перечитать файлы базы" delay={300}>
                <Button size="sm" variant="light" isIconOnly aria-label="Перечитать базу" onPress={reload}>
                  <RefreshCw size={14} />
                </Button>
              </Tooltip>
              <Tooltip content={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'} delay={300}>
                <Button size="sm" variant="light" isIconOnly aria-label="Сменить тему" onPress={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                  {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                </Button>
              </Tooltip>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 min-w-0 min-h-0">
        {loading && (
          <div className="h-full grid place-items-center">
            <Spinner label="Загружаю базу" size="sm" />
          </div>
        )}
        {!loading && !ready && view !== 'settings' && (
          <EmptyState
            title="База не подключена"
            text={base?.error || 'Укажите папки Design-Tools и Design-tools-library или скачайте их в настройках.'}
            action={
              <Button color="primary" onPress={() => setView('settings')}>
                Открыть настройки
              </Button>
            }
          />
        )}
        {!loading && ready && view === 'analysis' && <Analysis />}
        {!loading && ready && view === 'map' && <MapView />}
        {!loading && ready && ['problems', 'approaches', 'sources'].includes(view) && <Library key={view} which={view} />}
        {!loading && ready && view === 'analyses' && <Analyses />}
        {!loading && view === 'settings' && <Settings />}
      </main>

      <Drawer isOpen={!!top} onClose={closeAllCards} size="3xl" hideCloseButton backdrop="opaque">
        <DrawerContent>
          <DrawerHeader className="flex items-center justify-between py-3 border-b border-default-100">
            <Button size="sm" variant="light" startContent={<ArrowLeft size={15} />} onPress={closeCard} isDisabled={cardStack.length < 2}>
              Назад
            </Button>
            <Button size="sm" variant="light" isIconOnly aria-label="Закрыть" onPress={closeAllCards}>
              <X size={17} />
            </Button>
          </DrawerHeader>
          <DrawerBody className="px-8 py-6">{top && <CardView card={top} onOpenFull={() => goToCard(top.id)} />}</DrawerBody>
        </DrawerContent>
      </Drawer>
      <PageModal />
      <CommandPalette />
    </div>
  );
}
