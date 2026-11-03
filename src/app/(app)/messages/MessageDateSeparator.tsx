type MessageDateSeparatorProps = {
  label: string;
};

export default function MessageDateSeparator({ label }: MessageDateSeparatorProps) {
  return (
    <div role="separator" aria-label={label} className="flex items-center gap-3 py-1">
      <span aria-hidden="true" className="h-px flex-1 bg-zinc-200" />
      <span className="text-xs font-bold text-zinc-500">{label}</span>
      <span aria-hidden="true" className="h-px flex-1 bg-zinc-200" />
    </div>
  );
}
