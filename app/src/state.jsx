import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { buildCiteIndex, parseTaxonomy } from './lib/base.js';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [base, setBase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('analysis');
  const [cardStack, setCardStack] = useState([]); // история открытых карточек
  const [page, setPage] = useState(null); // { id, page }

  const reload = useCallback(async () => {
    setLoading(true);
    const b = await window.dt.loadBase();
    setBase(b);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const all = useMemo(() => {
    if (!base?.ok) return [];
    return [...base.problems, ...base.approaches, ...base.sources, ...base.cases];
  }, [base]);
  const byId = useMemo(() => new Map(all.map((c) => [c.id, c])), [all]);
  const cardIds = useMemo(() => new Set(all.map((c) => c.id)), [all]);
  const citeIndex = useMemo(() => (base?.ok ? buildCiteIndex(base.sources) : null), [base]);
  const taxonomy = useMemo(() => (base?.ok ? parseTaxonomy(base.taxonomy) : null), [base]);

  const openCard = useCallback(
    (id) => {
      if (!byId.has(id)) return;
      setCardStack((s) => [...s.filter((x) => x !== id), id].slice(-30));
    },
    [byId]
  );
  const closeCard = useCallback(() => setCardStack((s) => s.slice(0, -1)), []);
  const openPage = useCallback((id, p) => setPage({ id, page: p }), []);

  const value = {
    base,
    loading,
    reload,
    view,
    setView,
    byId,
    cardIds,
    citeIndex,
    taxonomy,
    cardStack,
    openCard,
    closeCard,
    page,
    openPage,
    setPage,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
