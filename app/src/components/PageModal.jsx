import { useEffect, useState } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Tabs, Tab, Spinner, Input } from '@heroui/react';
import { ChevronLeft, ChevronRight, BookOpen, Map as MapIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useApp } from '../state.jsx';
import { Hotkey } from './ui.jsx';

// Страница полного текста книги из приватной библиотеки и раздел её карты.
export default function PageModal() {
  const { page, setPage, byId, goToCard } = useApp();
  const [data, setData] = useState(null);
  const [jump, setJump] = useState('');

  useEffect(() => {
    if (!page) return;
    setData(null);
    window.dt.bookPage(page.id, page.page).then((d) => {
      setData(d);
      setJump(String(d?.page || page.page));
    });
  }, [page]);

  const go = (p) => p && setPage({ id: page.id, page: p });
  useEffect(() => {
    if (!page) return;
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft' && data?.prev) go(data.prev);
      if (e.key === 'ArrowRight' && data?.next) go(data.next);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const src = page ? byId.get(page.id) : null;

  return (
    <Modal isOpen={!!page} onClose={() => setPage(null)} size="4xl" scrollBehavior="inside" backdrop="blur">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-0.5 pb-2">
          <div className="flex items-center gap-2 text-sm">
            <BookOpen size={16} className="text-secondary" />
            <span className="font-semibold">{src?.data.cite || page?.id}</span>
            <span className="text-default-400 font-normal truncate">{src?.data.title}</span>
          </div>
          <div className="text-xs font-normal text-default-500">
            Страница {data?.page ?? page?.page} по PDF
            {data?.ok && data.page !== data.requested && <span className="text-warning"> · запрошена {data.requested}, показана ближайшая</span>}
          </div>
        </ModalHeader>
        <ModalBody className="pb-2">
          {!data && <Spinner className="my-10" />}
          {data && !data.ok && <p className="text-danger py-6">{data.error}</p>}
          {data?.ok && (
            <Tabs aria-label="Страница или карта книги" variant="underlined" size="sm">
              <Tab key="text" title="Текст страницы">
                <div className="reader py-2">
                  {data.text ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.text.replace(/<!--[^>]*-->/g, '')}</ReactMarkdown> : 'Страница пустая.'}
                </div>
              </Tab>
              <Tab
                key="map"
                title={
                  <span className="flex items-center gap-1.5">
                    <MapIcon size={14} />
                    Карта книги{data.map.length ? '' : ' — нет'}
                  </span>
                }
              >
                {data.map.length ? (
                  data.map.map((m, i) => (
                    <div className="md py-2" key={i}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m}</ReactMarkdown>
                    </div>
                  ))
                ) : (
                  <p className="text-default-500 py-6">Для этой страницы раздела карты нет.</p>
                )}
              </Tab>
            </Tabs>
          )}
        </ModalBody>
        <ModalFooter className="justify-between border-t border-default-100">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="flat" isIconOnly aria-label="Предыдущая страница" isDisabled={!data?.prev} onPress={() => go(data.prev)}>
              <ChevronLeft size={16} />
            </Button>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (Number(jump)) go(Number(jump));
              }}
            >
              <Input aria-label="Перейти к странице" size="sm" className="w-20" value={jump} onValueChange={setJump} classNames={{ input: 'text-center tabular' }} />
            </form>
            <span className="text-xs text-default-400 tabular">из {data?.total ?? '…'}</span>
            <Button size="sm" variant="flat" isIconOnly aria-label="Следующая страница" isDisabled={!data?.next} onPress={() => go(data.next)}>
              <ChevronRight size={16} />
            </Button>
            <span className="text-xs text-default-400 ml-2 hidden md:inline">
              <Hotkey>←</Hotkey> <Hotkey>→</Hotkey> листать
            </span>
          </div>
          {src && (
            <Button
              size="sm"
              variant="light"
              color="secondary"
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
