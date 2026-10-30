import { CircleAlert, Inbox, LoaderCircle } from 'lucide-react';

type AdminStatePanelProps = {
  state: 'loading' | 'empty' | 'error';
  title?: string;
  description?: string;
  onRetry?: () => void;
  compact?: boolean;
};

const stateDefaults = {
  loading: {
    title: '데이터를 불러오는 중입니다.',
    description: '잠시만 기다려주세요.',
    icon: LoaderCircle,
  },
  empty: {
    title: '표시할 데이터가 없습니다.',
    description: '검색 조건을 변경하거나 나중에 다시 확인해주세요.',
    icon: Inbox,
  },
  error: {
    title: '데이터를 불러오지 못했습니다.',
    description: '잠시 후 다시 시도해주세요.',
    icon: CircleAlert,
  },
} as const;

export function AdminStatePanel({
  state,
  title,
  description,
  onRetry,
  compact = false,
}: AdminStatePanelProps) {
  const defaults = stateDefaults[state];
  const Icon = defaults.icon;

  return (
    <div
      className={`flex flex-col items-center justify-center px-5 text-center ${compact ? 'min-h-40' : 'min-h-64'}`}
      role={state === 'error' ? 'alert' : 'status'}
      aria-live="polite"
    >
      <span
        className={`grid size-11 place-items-center rounded-2xl ${
          state === 'error' ? 'bg-[#feeceb] text-[#d92d20]' : 'bg-[#eef3ff] text-[#315ef5]'
        }`}
      >
        <Icon
          className={`size-5 ${state === 'loading' ? 'animate-spin' : ''}`}
          strokeWidth={1.8}
          aria-hidden="true"
        />
      </span>
      <p className="mt-3 text-sm font-semibold text-[#344054]">{title ?? defaults.title}</p>
      <p className="mt-1 max-w-sm text-xs leading-[18px] text-[#98a2b3]">
        {description ?? defaults.description}
      </p>
      {state === 'error' && onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 h-9 rounded-2xl border border-[#d0d5dd] bg-white px-4 text-[13px] font-semibold text-[#344054] transition hover:bg-[#f9fafb]"
        >
          다시 시도
        </button>
      ) : null}
    </div>
  );
}
