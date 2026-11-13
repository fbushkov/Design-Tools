import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useApp } from '../state.jsx';
import { linkifyCitations } from '../lib/base.js';

export const headingId = (text) => 'h-' + String(text).toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-');

// Markdown карточки: ссылки на другие карточки и на страницы книг кликабельны.
export default function Markdown({ text, card, compact, className = '' }) {
  const { openCard, openPage, cardIds, citeIndex } = useApp();
  const src = card && citeIndex ? linkifyCitations(text || '', card, citeIndex) : text || '';
  return (
    <div className={`md${compact ? ' compact' : ''} ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(u) => u}
        components={{
          h2({ children }) {
            return <h2 id={headingId(String(children))}>{children}</h2>;
          },
          a({ href = '', children }) {
            if (href.startsWith('cite:')) {
              // cite:<id>:<страница>[:ch<глава>] или cite:<id>:ch<глава>
              const [, id, a, b] = href.split(':');
              const ch = [a, b].find((x) => /^ch\d+$/.test(x || ''));
              const page = /^\d+$/.test(a) ? Number(a) : 0;
              return (
                <a className="cite-link" title={page ? 'Открыть страницу книги' : 'Открыть главу книги'} onClick={() => openPage(id, page, ch ? Number(ch.slice(2)) : 0)}>
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
