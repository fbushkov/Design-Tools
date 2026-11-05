import { Chip, Divider } from '@heroui/react';
import { BookOpen, Compass, AlertTriangle, FileText } from 'lucide-react';
import Markdown from './Markdown.jsx';
import { useApp } from '../state.jsx';

const KIND = {
  problem: { label: 'Проблема', icon: AlertTriangle, color: 'danger' },
  approach: { label: 'Подход', icon: Compass, color: 'primary' },
  source: { label: 'Источник', icon: BookOpen, color: 'secondary' },
  case: { label: 'Кейс', icon: FileText, color: 'success' },
  analysis: { label: 'Разбор', icon: FileText, color: 'default' },
};

export function KindIcon({ kind, size = 16 }) {
  const I = (KIND[kind] || KIND.case).icon;
  return <I size={size} />;
}

function Links({ label, ids }) {
  const { byId, openCard } = useApp();
  const list = [].concat(ids || []).filter(Boolean);
  if (!list.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-default-500 mr-1">{label}</span>
      {list.map((id) => {
        const c = byId.get(id);
        return (
          <Chip
            key={id}
            size="sm"
            variant={c ? 'flat' : 'bordered'}
            color={c ? KIND[c.kind]?.color : 'default'}
            className={c ? 'cursor-pointer' : 'opacity-60'}
            onClick={() => c && openCard(id)}
            startContent={c ? <KindIcon kind={c.kind} size={12} /> : null}
          >
            {c?.kind === 'source' ? c.data.cite || id : c?.data.title?.split(' — ')[0] || id}
          </Chip>
        );
      })}
    </div>
  );
}

export default function CardView({ card }) {
  const { base } = useApp();
  const d = card.data;
  const k = KIND[card.kind] || KIND.case;
  const usedBy =
    card.kind === 'source'
      ? base.approaches.filter((a) => (a.data.sources || []).includes(card.id)).map((a) => a.id)
      : card.kind === 'approach'
        ? base.problems.filter((p) => (p.data.approaches || []).includes(card.id)).map((p) => p.id)
        : [];
  return (
    <article className="space-y-3">
      <div className="flex items-center gap-2 text-default-500 text-sm">
        <KindIcon kind={card.kind} />
        <span>{k.label}</span>
        <code className="text-xs">{card.id}</code>
        {d.status && (
          <Chip size="sm" variant="dot" color={d.status === 'draft' ? 'warning' : 'success'}>
            {d.status}
          </Chip>
        )}
        {card.kind === 'source' && d.read === false && (
          <Chip size="sm" color="warning" variant="flat">
            не прочитан
          </Chip>
        )}
      </div>
      <h1 className="text-2xl font-semibold leading-tight">{d.title || card.id}</h1>
      {card.kind === 'source' && (
        <div className="text-default-600 text-sm">
          {[].concat(d.authors || []).join(', ')} · {d.year} · {d.type}
        </div>
      )}
      <div className="space-y-1.5">
        <Links label="Категории" ids={[].concat(d.category || d.categories || [])} />
        <Links label={card.kind === 'problem' ? 'Подходы' : 'Решает'} ids={card.kind === 'problem' ? d.approaches : d.solves} />
        {card.kind === 'source' && <Links label="Подходы" ids={d.approaches} />}
        <Links label="Источники" ids={d.sources} />
        <Links label={card.kind === 'source' ? 'Используется в' : 'Используют проблемы'} ids={usedBy} />
        {d.tags?.length ? (
          <div className="flex flex-wrap gap-1">
            {d.tags.map((t) => (
              <Chip key={t} size="sm" variant="light">
                #{t}
              </Chip>
            ))}
          </div>
        ) : null}
      </div>
      <Divider />
      <Markdown text={card.body} card={card} />
    </article>
  );
}
