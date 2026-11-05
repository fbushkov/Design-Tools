import { useEffect, useState } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Tabs, Tab, Spinner } from '@heroui/react';
import { ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useApp } from '../state.jsx';

// Страница полного текста книги из приватной библиотеки и раздел её карты.
export default function PageModal() {
  const { page, setPage, byId, openCard } = useApp();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!page) return;
    setData(null);
    window.dt.bookPage(page.id, page.page).then(setData);
  }, [page]);

  const src = page ? byId.get(page.id) : null;
  const go = (p) => p && setPage({ id: page.id, page: p });

  return (
    <Modal isOpen={!!page} onClose={() => setPage(null)} size="4xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <BookOpen size={18} />
          <span>{src?.data.cite || page?.id}</span>
          <span className="text-default-500 font-normal">· с. {data?.page ?? page?.page} (по PDF)</span>
          {data?.ok && data.page !== data.requested && (
            <span className="text-warning text-sm font-normal">запрошена с. {data.requested}, показана ближайшая</span>
          )}
        </ModalHeader>
        <ModalBody>
          {!data && <Spinner />}
          {data && !data.ok && <p className="text-danger">{data.error}</p>}
          {data?.ok && (
            <Tabs aria-label="Страница или карта" variant="underlined">
              <Tab key="text" title="Текст страницы">
                <div className="md whitespace-pre-wrap">{data.text || '(страница пустая)'}</div>
              </Tab>
              <Tab key="map" title={`Карта книги${data.map.length ? '' : ' (нет)'}`}>
                {data.map.length ? (
                  data.map.map((m, i) => (
                    <div className="md" key={i}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m}</ReactMarkdown>
                    </div>
                  ))
                ) : (
                  <p className="text-default-500">Карты для этой страницы нет.</p>
                )}
              </Tab>
            </Tabs>
          )}
        </ModalBody>
        <ModalFooter className="justify-between">
          <div className="flex gap-2">
            <Button size="sm" variant="flat" isDisabled={!data?.prev} onPress={() => go(data.prev)} startContent={<ChevronLeft size={16} />}>
              {data?.prev ?? ''}
            </Button>
            <Button size="sm" variant="flat" isDisabled={!data?.next} onPress={() => go(data.next)} endContent={<ChevronRight size={16} />}>
              {data?.next ?? ''}
            </Button>
          </div>
          {src && (
            <Button
              size="sm"
              color="secondary"
              variant="light"
              onPress={() => {
                setPage(null);
                openCard(src.id);
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
