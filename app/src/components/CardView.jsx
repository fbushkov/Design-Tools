import { Chip, Divider, Button } from '@heroui/react';
import { ExternalLink, Layers } from 'lucide-react';
import Markdown, { headingId } from './Markdown.jsx';
import { useApp } from '../state.jsx';
import { KIND, KindIcon } from './ui.jsx';
import { sections } from '../lib/base.js';

function RelChips({ ids }) {
  const { byId, openCard } = useApp();
  const list = [].concat(ids || []).filter(Boolean);
  if (!list.length) return <span className="text-default-400 text-xs">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {list.map((id) => {
        const c = byId.get(id);
        const label = c?.kind === 'source' ? c.data.cite || id : c?.data.title?.split(' — ')[0] || id;
        return (
          <button
            key={id}
            onClick={() => c && openCard(id)}
            disabled={!c}
            className={`inline-flex items-center gap-1 h-6 px-2 rounded-md text-xs border transition-colors ${
              c ? 'border-default-200 hover:border-primary-200 hover:bg-primary-50 text-foreground' : 'border-dashed border-default-200 text-default-400'
            }`}
          >
            {c && <KindIcon kind={c.kind} size={12} />}
            <span className="truncate max-w-[220px]">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 items-start py-1.5">
      <div className="text-xs text-default-500 pt-1">{label}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

// Карточка базы: шапка, связи, оглавление и текст со ссылками на страницы книг.
export default function CardView({ card, onOpenFull }) {
  const { base, taxonomy } = useApp();
  const d = card.data;
  const k = KIND[card.kind] || KIND.case;
  const secs = Object.keys(sections(card.body)).filter((x) => x !== '_intro');
  const usedBy =
    card.kind === 'source'
      ? base.approaches.filter((a) => (a.data.sources || []).includes(card.id) && !(d.approaches || []).includes(a.id)).map((a) => a.id)
      : card.kind === 'approach'
        ? base.problems.filter((p) => (p.data.approaches || []).includes(card.id)).map((p) => p.id)
        : [];
  const cats = [].concat(d.category || d.categories || []);
  const catTitle = (id) => taxonomy?.categories.find((c) => c.id === id)?.title || id;
  const stages = card.kind === 'approach' && ((d.stages_fit || []).length || (d.stages_harm || []).length);

  return (
    <article className="max-w-[760px]">
      <div className="flex items-center gap-2 text-xs text-default-500 mb-2">
        <KindIcon kind={card.kind} size={14} />
        <span className="font-medium">{k.label}</span>
        <span className="text-default-300">·</span>
        <code className="text-[11px]">{card.id}</code>
        {d.status && (
          <Chip size="sm" variant="flat" color={d.status === 'draft' ? 'warning' : 'success'} className="h-5 text-[11px]">
            {d.status === 'draft' ? 'черновик' : d.status}
          </Chip>
        )}
        {card.kind === 'source' && d.read === false && (
          <Chip size="sm" color="warning" variant="flat" className="h-5 text-[11px]">
            не прочитан
          </Chip>
        )}
        {onOpenFull && (
          <Button size="sm" variant="light" className="ml-auto h-6 text-xs" endContent={<ExternalLink size={12} />} onPress={onOpenFull}>
            Открыть в справочнике
          </Button>
        )}
      </div>
      <h1 className="text-[1.45rem] font-semibold leading-tight tracking-tight">{d.title || card.id}</h1>
      {card.kind === 'source' && (
        <div className="text-default-500 text-sm mt-1">
          {[].concat(d.authors || []).join(', ')}
          {d.year ? ` · ${d.year}` : ''}
          {d.type ? ` · ${d.type}` : ''}
        </div>
      )}

      <div className="mt-4 rounded-large border border-default-200/70 bg-content1 px-4 py-2">
        {cats.length > 0 && (
          <Row label="Категории">
            <div className="flex flex-wrap gap-1">
              {cats.map((c) => (
                <Chip key={c} size="sm" variant="flat" className="h-6">
                  {catTitle(c)}
                </Chip>
              ))}
            </div>
          </Row>
        )}
        {card.kind === 'problem' && (
          <Row label="Подходы">
            <RelChips ids={d.approaches} />
          </Row>
        )}
        {card.kind === 'approach' && (
          <>
            <Row label="Решает">
              <RelChips ids={d.solves} />
            </Row>
            <Row label="Опора">
              <RelChips ids={d.sources} />
            </Row>
            {stages ? (
              <Row label="Стадии">
                <div className="flex flex-wrap gap-1.5 items-center text-xs">
                  <Layers size={13} className="text-default-400" />
                  {[1, 2, 3, 4].map((l) => {
                    const fit = (d.stages_fit || []).includes(l);
                    const harm = (d.stages_harm || []).includes(l);
                    return (
                      <span
                        key={l}
                        className={`h-6 min-w-6 px-1.5 grid place-items-center rounded-md font-medium ${
                          harm ? 'bg-danger-50 text-danger' : fit ? 'bg-success-50 text-success-700' : 'bg-default-100 text-default-400'
                        }`}
                        title={harm ? 'вредно' : fit ? 'органично' : 'не размечено'}
                      >
                        {l}
                      </span>
                    );
                  })}
                  <span className="text-default-400 ml-1">зелёный — органично, красный — вредно</span>
                </div>
              </Row>
            ) : null}
          </>
        )}
        {card.kind === 'source' && (
          <Row label="Подходы">
            <RelChips ids={d.approaches} />
          </Row>
        )}
        {usedBy.length > 0 && (
          <Row label={card.kind === 'source' ? 'Ещё ссылаются' : 'В проблемах'}>
            <RelChips ids={usedBy} />
          </Row>
        )}
      </div>

      {secs.length > 2 && (
        <nav className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-xs" aria-label="Содержание">
          {secs.map((s) => (
            <a
              key={s}
              className="text-default-500 hover:text-primary cursor-pointer"
              onClick={() => document.getElementById(headingId(s))?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              {s}
            </a>
          ))}
        </nav>
      )}
      <Divider className="my-5" />
      <Markdown text={card.body} card={card} />
    </article>
  );
}
