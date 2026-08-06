type AdminStatusBadgeTone = 'warning' | 'info' | 'success' | 'neutral' | 'danger' | 'purple';

type AdminStatusBadgeProps = {
  label: string;
  tone?: AdminStatusBadgeTone;
};

const toneStyles: Record<AdminStatusBadgeTone, { background: string; dot: string; text: string }> = {
  warning: { background: '#fef6e7', dot: '#d97706', text: '#b54708' },
  info: { background: '#eef3ff', dot: '#315ef5', text: '#1d46c7' },
  success: { background: '#e7f6ee', dot: '#168a4a', text: '#087443' },
  neutral: { background: '#f2f4f7', dot: '#98a2b3', text: '#667085' },
  danger: { background: '#feeceb', dot: '#e5484d', text: '#b42318' },
  purple: { background: '#f4ebff', dot: '#7f56d9', text: '#6941c6' },
};

export function AdminStatusBadge({ label, tone = 'neutral' }: AdminStatusBadgeProps) {
  const style = toneStyles[tone];

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs leading-[18px] font-semibold whitespace-nowrap"
      style={{ backgroundColor: style.background, color: style.text }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: style.dot }} />
      {label}
    </span>
  );
}
