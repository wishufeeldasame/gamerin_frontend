'use client';

export const gameFilterOptions = [
  { value: 'all', label: '전체' },
  { value: 'pubg', label: 'PUBG' },
  { value: 'valorant', label: 'VALORANT' },
  { value: 'league-of-legends', label: 'LEAGUE OF LEGENDS' },
  { value: 'fps', label: 'FPS' },
] as const;

export type GameFilterValue = (typeof gameFilterOptions)[number]['value'];

interface GameFilterProps {
  value: GameFilterValue;
  onChange: (value: GameFilterValue) => void;
}

export function GameFilter({ value, onChange }: GameFilterProps) {
  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1"
      role="group"
      aria-label="게임 카테고리"
    >
      {gameFilterOptions.map((option) => {
        const isSelected = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={isSelected}
            className={`shrink-0 rounded-md border px-4 py-2 text-xs font-black transition ${
              isSelected
                ? 'border-black bg-black text-white dark:border-[#f5b93d] dark:bg-[#f5b93d] dark:text-black'
                : 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-400 hover:text-black dark:border-neutral-700 dark:bg-neutral-900 dark:text-zinc-400 dark:hover:border-neutral-500 dark:hover:text-white'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
