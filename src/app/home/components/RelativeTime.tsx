import { formatAbsoluteTime, formatRelativeTimeLabel, parseDisplayTime, UNKNOWN_TIME } from '@/lib/time-format';

export function RelativeTime({ createdAt, className }: { createdAt: string; className?: string }) {
  const date = parseDisplayTime(createdAt);
  if (!date) return <span className={className}>{UNKNOWN_TIME}</span>;

  return (
    <time dateTime={date.toISOString()} title={formatAbsoluteTime(date)} className={className}>
      {formatRelativeTimeLabel(createdAt)}
    </time>
  );
}
