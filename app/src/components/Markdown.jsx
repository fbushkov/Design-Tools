import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useApp } from '../state.jsx';
import { linkifyCitations } from '../lib/base.js';

// Markdown карточки: ссылки на другие карточки и на страницы книг кликабельны.
export default function Markdown({ text, card, compact }) {
  const { openCard, openPage, cardIds, citeIndex } = useApp();
  const src = card && citeIndex ? linkifyCitations(text || '', card, citeIndex) : text || '';
  return (
    <div className={'md' + (compact ? ' text-sm' : '')}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(u) => u}
        components={{
          a({ href = '', children }) {
            if (href.startsWith('cite:')) {
              const [, id, page] = href.split(':');
              return (
                <a className="cite-link" title="Открыть страницу книги" onClick={() => openPage(id, Number(page))}>
                  {children}
                </a>
              );
            }
            const md = href.match(/([^/]+)\.md$/);
            if (md && cardIds.has(md[1])) {
              return (
                <a className="card-link" onClick={() => openCard(md[1])}>
                  {children}
                </a>
              );
            }
            return (
              <a className="ext-link" href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            );
          },
          code({ children }) {
            const t = String(children);
            if (cardIds.has(t)) {
              return (
                <a className="card-link" onClick={() => openCard(t)}>
                  <code>{t}</code>
                </a>
              );
            }
            return <code>{children}</code>;
          },
        }}
      >
        {src}
      </ReactMarkdown>
    </div>
  );
}
