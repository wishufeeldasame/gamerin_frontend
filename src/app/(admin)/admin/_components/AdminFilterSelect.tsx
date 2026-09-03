import { ChevronDown } from 'lucide-react';

type AdminFilterSelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  className?: string;
};

export function AdminFilterSelect({
  label,
  value,
  onChange,
  options,
  className = '',
}: AdminFilterSelectProps) {
  return (
    <label className={`relative block min-w-0 ${className}`}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full appearance-none rounded-2xl border border-[#d0d5dd] bg-white px-[13px] pr-9 text-sm text-[#667085] outline-none transition focus:border-[#315ef5] focus:ring-2 focus:ring-[#315ef5]/10 dark:!border-[#d0d5dd] dark:!bg-white dark:!text-[#667085]"
      >
        <option value="">{label}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-3 right-3 size-4 text-[#98a2b3]"
        strokeWidth={1.7}
        aria-hidden="true"
      />
    </label>
  );
}
