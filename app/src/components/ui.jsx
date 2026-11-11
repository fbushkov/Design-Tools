import { useRef, useState } from 'react';
import { Button, Popover, PopoverContent, PopoverTrigger, Tooltip } from '@heroui/react';
import { AlertTriangle, BookOpen, CircleHelp, Compass, FileText, Inbox } from 'lucide-react';

export const KIND = {
  problem: { label: 'Проблема', plural: 'Проблемы', icon: AlertTriangle, color: 'danger', tint: 'text-danger' },
  approach: { label: 'Подход', plural: 'Подходы', icon: Compass, color: 'primary', tint: 'text-primary' },
  source: { label: 'Источник', plural: 'Источники', icon: BookOpen, color: 'secondary', tint: 'text-secondary' },
  case: { label: 'Кейс', plural: 'Кейсы', icon: FileText, color: 'success', tint: 'text-success' },
  analysis: { label: 'Разбор', plural: 'Разборы', icon: FileText, color: 'default', tint: 'text-default-500' },
};

export function KindIcon({ kind, size = 16, className = '' }) {
  const k = KIND[kind] || KIND.case;
  const I = k.icon;
  return <I size={size} className={`${k.tint} shrink-0 ${className}`} />;
}

// Заголовок страницы: название, пояснение одной строкой, действия справа.
export function PageHeader({ title, description, actions, children }) {
  return (
    <header className="flex items-start justify-between gap-4 px-8 pt-7 pb-4">
      <div className="min-w-0">
        {typeof title === 'string' ? <h1 className="text-xl font-semibold tracking-tight">{title}</h1> : title}
        {description && <p className="text-default-500 text-sm mt-1 max-w-3xl">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}

// Блок с заголовком: основной строительный элемент экранов.
export function Panel({ title, subtitle, icon: I, actions, children, className = '', bodyClass = '' }) {
  return (
    <section className={`bg-content1 rounded-large border border-default-200/70 ${className}`}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-2">
          <div className="flex items-start gap-2.5 min-w-0">
            {I && <I size={17} className="text-default-400 mt-0.5 shrink-0" />}
            <div className="min-w-0">
              <h2 className="font-semibold text-[0.95rem] leading-snug">{title}</h2>
              {subtitle && <p className="text-xs text-default-500 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      )}
      <div className={`px-5 pb-5 ${title ? 'pt-1' : 'pt-5'} ${bodyClass}`}>{children}</div>
    </section>
  );
}

// Сегментированный выбор: вместо выпадающих списков, когда вариантов мало.
export function Segmented({ value, onChange, options, size = 'sm', ariaLabel, allowEmpty = true }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex p-0.5 rounded-medium bg-default-100 gap-0.5">
      {options.map((o) => {
        const on = String(value) === String(o.value);
        const btn = (
          <button
            key={o.value}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(on && allowEmpty ? '' : o.value)}
            className={`${size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-sm'} min-w-8 rounded-[7px] font-medium transition-colors ${
              on ? 'bg-content1 text-foreground shadow-sm' : 'text-default-500 hover:text-foreground'
            }`}
          >
            {o.label}
          </button>
        );
        return o.hint ? (
          <Tooltip key={o.value} content={o.hint} delay={300} className="max-w-xs">
            {btn}
          </Tooltip>
        ) : (
          btn
        );
      })}
    </div>
  );
}

export function EmptyState({ icon: I = Inbox, title, text, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 gap-2">
      <div className="size-11 rounded-full bg-default-100 grid place-items-center mb-1">
        <I size={20} className="text-default-400" />
      </div>
      <div className="font-medium">{title}</div>
      {text && <p className="text-sm text-default-500 max-w-sm">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Meter({ value, max = 1, className = '' }) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  return (
    <div className={`h-1.5 rounded-full bg-default-100 overflow-hidden ${className}`}>
      <div className="h-full rounded-full bg-primary" style={{ width: pct + '%' }} />
    </div>
  );
}

export function Hotkey({ children }) {
  return <kbd className="text-[10px] font-medium text-default-500 border border-default-200 rounded px-1 py-px bg-content1">{children}</kbd>;
}

export function IconButton({ label, icon: I, onPress, ...rest }) {
  return (
    <Tooltip content={label} delay={300}>
      <Button isIconOnly size="sm" variant="light" aria-label={label} onPress={onPress} {...rest}>
        <I size={16} />
      </Button>
    </Tooltip>
  );
}

// Значок «?» с пояснением: для полей и терминов, которые без пояснения непонятны.
// Открывается наведением, щелчком и с клавиатуры; щелчок закрепляет подсказку, пока не щёлкнуть мимо.
export function Help({ children, label = 'Пояснение' }) {
  const [open, setOpen] = useState(false);
  const timer = useRef(null);
  const hover = useRef(false);
  const pinned = useRef(false);
  const show = () => {
    hover.current = true;
    clearTimeout(timer.current);
    setOpen(true);
  };
  const hide = () => {
    hover.current = false;
    if (pinned.current) return;
    timer.current = setTimeout(() => setOpen(false), 160);
  };
  const change = (next) => {
    if (!next && hover.current && !pinned.current) {
      pinned.current = true; // щелчок по уже открытой наведением подсказке закрепляет её
      return;
    }
    pinned.current = next;
    setOpen(next);
  };
  return (
    <Popover isOpen={open} onOpenChange={change} placement="top-start" offset={6} triggerScaleOnOpen={false}>
      <PopoverTrigger>
        <button
          type="button"
          aria-label={label}
          onMouseEnter={show}
          onMouseLeave={hide}
          className="text-default-400 hover:text-foreground data-[focus-visible=true]:text-foreground rounded-full shrink-0 cursor-help outline-offset-2"
        >
          <CircleHelp size={14} />
        </button>
      </PopoverTrigger>
      <PopoverContent onMouseEnter={show} onMouseLeave={hide} className="max-w-xs px-3 py-2.5">
        <div className="text-xs leading-relaxed space-y-1.5 text-default-700">{children}</div>
      </PopoverContent>
    </Popover>
  );
}

// Подпись поля снаружи: название, необязательная пометка и «?».
export function FieldLabel({ children, help, note, htmlFor, className = '' }) {
  return (
    <div className={`flex items-center gap-1.5 mb-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-foreground">
        {children}
      </label>
      {help && <Help label={`Что такое «${typeof children === 'string' ? children : 'поле'}»`}>{help}</Help>}
      {note && <span className="text-[11px] text-default-400">{note}</span>}
    </div>
  );
}
