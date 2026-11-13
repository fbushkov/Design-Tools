import { useEffect, useRef, useState } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Tabs, Tab, Spinner, Input } from '@heroui/react';
import { ChevronLeft, ChevronRight, BookOpen, Map as MapIcon, Info } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useApp } from '../state.jsx';
import { Hotkey } from './ui.jsx';

// Страница полного текста книги из приватной библиотеки и раздел её карты.
// Книги без номеров страниц открываются по главам.
export default function PageModal() {
  const { page, setPage, byId, goToCard } = useApp();
  const [data, setData] = useState(null);
  const [jump, setJump] = useState('');
  const [tab, setTab] = useState('text');
  const body = useRef(null);

  useEffect(() => {
    if (!page) return;
    setData(null);
    let alive = true;
    window.dt.bookPage(page.id, page.page, page.chapter).then((d) => {
      if (!alive) return;
      setData(d);
      setJump(String(d?.page || page.page || ''));
      // Ссылка «гл. N» в книге со страницами ведёт в карту книги, если раздел карты есть.
      setTab(d?.ok && d.mode === 'pages' && d.chapter && d.map.length ? 'map' : 'text');
      body.current?.scrollTo?.(0, 0);
    });
    return () => {
      alive = false;
    };
  }, [page]);

  const chapters = data?.ok && data.mode === 'chapters';
  // В книге по главам prev и next — порядковые номера разделов; они передаются со знаком минус.
  const go = (p) => p && setPage(chapters ? { id: page.id, page: 0, chapter: -p } : { id: page.id, page: p, chapter: 0 });
  useEffect(() => {
    if (!page) return;
    const onKey = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key === 'ArrowLeft' && data?.prev) go(data.prev);
      if (e.key === 'ArrowRight' && data?.next) go(data.next);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const src = page ? byId.get(page.id) : null;
  const where = !data?.ok
    ? ''
    : chapters
      ? data.title
      : `Страница ${data.page} по PDF${data.chapter ? ` · начало главы ${data.chapter}` : ''}`;

  return (
    <Modal isOpen={!!page} onClose={() => setPage(null)} size="4xl" scrollBehavior="inside" backdrop="blur">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-0.5 pb-2">
          <div className="flex items-center gap-2 text-sm min-w-0 pr-6">
            <BookOpen size={16} className="text-secondary shrink-0" />
            <span className="font-semibold whitespace-nowrap">{src?.data.cite || page?.id}</span>
            <span className="text-default-400 font-normal truncate">{src?.data.title}</span>
          </div>
          <div className="text-xs font-normal text-default-500" data-testid="book-where">
            {where || '…'}
            {data?.ok && !chapters && !data.chapter && data.page !== data.requested && <span className="text-warning"> · запрошена {data.requested}, показана ближайшая</span>}
          </div>
        </ModalHeader>
        <ModalBody className="pb-2" ref={body}>
          {!data && <Spinner className="my-10" />}
          {data && !data.ok && <p className="text-danger py-6">{data.error}</p>}
          {data?.ok && data.note && (
            <p className="flex items-start gap-2 text-xs rounded-medium bg-warning-50 text-warning-700 px-3 py-2">
              <Info size={14} className="mt-px shrink-0" />
              {data.note}
            </p>
          )}
          {data?.ok && (
            <Tabs aria-label="Текст или карта книги" variant="underlined" size="sm" selectedKey={tab} onSelectionChange={setTab} disabledKeys={data.map.length ? [] : ['map']}>
              <Tab key="text" title={chapters ? 'Текст главы' : 'Текст страницы'}>
                <div className="reader py-2">
                  {data.text ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.text}</ReactMarkdown> : chapters ? 'Раздел пустой.' : 'Страница пустая.'}
                </div>
              </Tab>
              <Tab
                key="map"
                title={
                  <span className="flex items-center gap-1.5">
                    <MapIcon size={14} />
                    Карта книги{data.map.length ? '' : chapters ? ' (для этого раздела нет)' : ' (для этой страницы нет)'}
                  </span>
                }
              >
                {data.map.map((m, i) => (
                  <div className="md py-2" key={i}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m}</ReactMarkdown>
                  </div>
                ))}
              </Tab>
            </Tabs>
          )}
        </ModalBody>
        <ModalFooter className="justify-between border-t border-default-100 gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Button size="sm" variant="flat" isIconOnly aria-label={chapters ? 'Предыдущий раздел' : 'Предыдущая страница'} isDisabled={!data?.prev} onPress={() => go(data.prev)}>
              <ChevronLeft size={16} />
            </Button>
            {chapters ? (
              <select
                aria-label="Перейти к главе"
                className="h-8 min-w-0 max-w-[320px] rounded-small bg-default-100 px-2 text-xs outline-none focus-visible:ring-2 ring-focus"
                value={data.index + 1}
                onChange={(e) => go(Number(e.target.value))}
              >
                {data.sections.map((x, i) => (
                  <option key={i} value={i + 1}>
                    {x.title}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (Number(jump)) go(Number(jump));
                  }}
                >
                  <Input aria-label="Перейти к странице" size="sm" className="w-20" value={jump} onValueChange={setJump} classNames={{ input: 'text-center tabular' }} />
                </form>
                <span className="text-xs text-default-400 tabular whitespace-nowrap">из {data?.total ?? '…'}</span>
              </>
            )}
            <Button size="sm" variant="flat" isIconOnly aria-label={chapters ? 'Следующий раздел' : 'Следующая страница'} isDisabled={!data?.next} onPress={() => go(data.next)}>
              <ChevronRight size={16} />
            </Button>
            <span className="text-xs text-default-400 ml-2 hidden md:inline whitespace-nowrap">
              <Hotkey>←</Hotkey> <Hotkey>→</Hotkey> листать
            </span>
          </div>
          {src && (
            <Button
              size="sm"
              variant="light"
              color="secondary"
              className="shrink-0"
              onPress={() => {
                setPage(null);
                goToCard(src.id);
              }}
            >
              Карточка источника
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
