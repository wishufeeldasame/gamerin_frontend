type MessageDateSeparatorProps = {
  label: string;
};

export default function MessageDateSeparator({ label }: MessageDateSeparatorProps) {
  return (
    <div role="separator" aria-label={label} className="flex items-center gap-3 py-1">
      <span className="flex-1 text-center text-caption text-fg-tertiary">{label}</span>
    </div>
  );
}
