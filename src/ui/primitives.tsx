import type { ComponentType, ReactNode } from 'react';

type Icon = ComponentType<{ className?: string; strokeWidth?: number }>;

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

export function IconButton({
  icon: I,
  label,
  onClick,
  active,
  disabled,
  tone = 'default',
  shortcut,
}: {
  icon: Icon;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  tone?: 'default' | 'danger';
  shortcut?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={cx(
        'focus-ring grid size-9 place-items-center rounded-xl transition-colors disabled:cursor-not-allowed disabled:opacity-30 sm:size-10',
        active
          ? 'bg-sgx-yellow text-ink'
          : tone === 'danger'
            ? 'text-neutral-300 hover:bg-red-500/15 hover:text-red-300'
            : 'text-neutral-300 hover:bg-white/8 hover:text-white',
      )}
    >
      <I className="size-[18px]" strokeWidth={2} />
    </button>
  );
}

export function Divider({ vertical = true }: { vertical?: boolean }) {
  return <div className={vertical ? 'mx-1 h-6 w-px shrink-0 bg-white/10' : 'my-1 h-px w-full bg-white/10'} />;
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format = (v) => v.toFixed(2),
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  const fill = `${((value - min) / (max - min)) * 100}%`;
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-neutral-300">{label}</span>
        <span className="font-mono text-[11px] text-neutral-500">{format(value)}</span>
      </span>
      <input
        type="range"
        className="sgx-range focus-ring"
        style={{ ['--fill' as string]: fill }}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </label>
  );
}

export function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="focus-ring flex w-full items-center justify-between gap-3 rounded-lg py-1.5 text-left"
    >
      <span>
        <span className="block text-xs font-medium text-neutral-200">{label}</span>
        {hint && <span className="block text-[11px] leading-snug text-neutral-500">{hint}</span>}
      </span>
      <span
        className={cx(
          'relative h-5 w-9 shrink-0 rounded-full transition-colors',
          checked ? 'bg-sgx-yellow' : 'bg-white/15',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-4.5' : 'translate-x-0.5',
          )}
        />
      </span>
    </button>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-neutral-300">{label}</div>
      <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-black/40 p-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cx(
              'focus-ring rounded-md px-2 py-1.5 text-xs font-semibold transition-colors',
              value === o.value ? 'bg-white/12 text-white' : 'text-neutral-400 hover:text-white',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="mb-2 text-[10px] font-bold tracking-[0.18em] text-neutral-500 uppercase">{children}</div>;
}
