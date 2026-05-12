type ActionIcon = 'archive' | 'edit' | 'restore' | 'save' | 'trash';
type ActionTone = 'danger' | 'neutral' | 'primary';

type ActionButtonProps = {
  icon: ActionIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: ActionTone;
};

function Icon({ name }: { name: ActionIcon }) {
  const commonProps = {
    'aria-hidden': true,
    className: 'h-4 w-4',
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 2,
    viewBox: '0 0 24 24',
  };

  if (name === 'edit') {
    return (
      <svg {...commonProps}>
        <path d="m16.9 4.1 3 3L8 19l-4 1 1-4 11.9-11.9Z" />
        <path d="m14.5 6.5 3 3" />
      </svg>
    );
  }

  if (name === 'archive') {
    return (
      <svg {...commonProps}>
        <path d="M4 7h16" />
        <path d="M5 7l1 13h12l1-13" />
        <path d="M8 4h8l1 3H7l1-3Z" />
        <path d="M10 12h4" />
      </svg>
    );
  }

  if (name === 'restore') {
    return (
      <svg {...commonProps}>
        <path d="M4 12a8 8 0 1 0 2.3-5.7" />
        <path d="M4 5v6h6" />
      </svg>
    );
  }

  if (name === 'save') {
    return (
      <svg {...commonProps}>
        <path d="M5 3h12l2 2v16H5V3Z" />
        <path d="M8 3v6h8" />
        <path d="M8 21v-7h8v7" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 14h10l1-14" />
      <path d="M9 7V4h6v3" />
    </svg>
  );
}

export default function ActionButton({ disabled, icon, label, onClick, tone = 'neutral' }: ActionButtonProps) {
  const className =
    tone === 'danger'
      ? 'inline-flex h-9 w-9 items-center justify-center rounded-md border border-red-200 text-red-700 transition hover:bg-red-50 disabled:opacity-50'
      : tone === 'primary'
        ? 'inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--brand-cyan)] bg-[var(--brand-cyan-soft)] text-[var(--brand-blue)] transition hover:bg-cyan-100 disabled:opacity-50'
        : 'inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-700 transition hover:border-cyan-200 hover:bg-cyan-50 disabled:opacity-50';

  return (
    <button aria-label={label} className={className} disabled={disabled} onClick={onClick} title={label} type="button">
      <Icon name={icon} />
    </button>
  );
}
