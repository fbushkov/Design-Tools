import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { buildCiteIndex, parseTaxonomy } from './lib/base.js';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

const LIB_VIEW = { problem: 'problems', approach: 'approaches', source: 'sources' };

function stored(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch (e) {
    return fallback;
  }
}

export function AppProvider({ children }) {
  const [base, setBase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('analysis');
  const [selected, setSelected] = useState({}); // выбранная карточка в каждом разделе справочника
  const [cardStack, setCardStack] = useState([]); // карточки поверх других экранов
  const [page, setPage] = useState(null); // { id, page }
  const [palette, setPalette] = useState(false);
  const [theme, setTheme] = useState(() => stored('dt-theme', 'light'));

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme !== 'dark');
    try {
      localStorage.setItem('dt-theme', theme);
    } catch (e) {}
  }, [theme]);

  // Спиннер на весь экран — только при первой загрузке. Дальше данные обновляются на месте,
  // чтобы экран не сбрасывал выбор и прокрутку.
  const reload = useCallback(async () => {
    const next = await window.dt.loadBase();
    setBase(next);
    setLoading(false);
    return next;
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const all = useMemo(() => (base?.ok ? [...base.problems, ...base.approaches, ...base.sources, ...base.cases] : []), [base]);
  const byId = useMemo(() => new Map(all.map((c) => [c.id, c])), [all]);
  const cardIds = useMemo(() => new Set(all.map((c) => c.id)), [all]);
  const citeIndex = useMemo(() => (base?.ok ? buildCiteIndex(base.sources) : null), [base]);
  const taxonomy = useMemo(() => (base?.ok ? parseTaxonomy(base.taxonomy) : null), [base]);

  // Карточка открывается на месте, если мы в справочнике, иначе — боковой панелью поверх экрана.
  const openCard = useCallback(
    (id, { inPlace } = {}) => {
      const c = byId.get(id);
      if (!c) return;
      const libView = LIB_VIEW[c.kind];
      if (inPlace || (libView && view === libView && cardStack.length === 0)) {
        setSelected((s) => ({ ...s, [libView]: id }));
        return;
      }
      setCardStack((s) => [...s.filter((x) => x !== id), id].slice(-30));
    },
    [byId, view, cardStack.length]
  );
  const goToCard = useCallback(
    (id) => {
      const c = byId.get(id);
      if (!c) return;
      const libView = LIB_VIEW[c.kind];
      setCardStack([]);
      if (libView) {
        setView(libView);
        setSelected((s) => ({ ...s, [libView]: id }));
      }
    },
    [byId]
  );
  const closeCard = useCallback(() => setCardStack((s) => s.slice(0, -1)), []);
  const closeAllCards = useCallback(() => setCardStack([]), []);
  const openPage = useCallback((id, p) => setPage({ id, page: p }), []);

  const value = {
    base,
    loading,
    reload,
    view,
    setView,
    selected,
    setSelected,
    byId,
    cardIds,
    citeIndex,
    taxonomy,
    cardStack,
    openCard,
    goToCard,
    closeCard,
    closeAllCards,
    page,
    openPage,
    setPage,
    palette,
    setPalette,
    theme,
    setTheme,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
