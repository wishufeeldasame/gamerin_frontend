import { ChevronDown } from 'lucide-react';

export type AdminFilterOption = string | {
  value: string;
  label: string;
};

type AdminFilterSelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly AdminFilterOption[];
  className?: string;
  disabled?: boolean;
};

export function AdminFilterSelect({
  label,
  value,
  onChange,
  options,
  className = '',
  disabled = false,
}: AdminFilterSelectProps) {
  return (
    <label className={`relative block min-w-0 ${className}`}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="h-10 w-full appearance-none rounded-2xl border border-[#d0d5dd] bg-white px-[13px] pr-9 text-sm text-[#667085] outline-none transition focus:border-[#315ef5] focus:ring-2 focus:ring-[#315ef5]/10 disabled:cursor-not-allowed disabled:bg-[#f2f4f7] disabled:text-[#98a2b3] dark:!border-[#d0d5dd] dark:!bg-white dark:!text-[#667085]"
      >
        <option value="">{label}</option>
        {options.map((option) => {
          const normalized = typeof option === 'string'
            ? { value: option, label: option }
            : option;
          return (
            <option key={normalized.value} value={normalized.value}>
              {normalized.label}
            </option>
          );
        })}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-3 right-3 size-4 text-[#98a2b3]"
        strokeWidth={1.7}
        aria-hidden="true"
      />
    </label>
  );
}
