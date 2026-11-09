'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import { CornerDownLeft, Search, X } from 'lucide-react';

interface SearchPanelProps {
  onClose: () => void;
  id?: string;
  panelRef?: RefObject<HTMLDivElement | null>;
  // panel: 데스크톱 사이드바 슬라이드 패널, fullscreen: 모바일 전체 화면(F9).
  variant?: 'panel' | 'fullscreen';
}

// 검색 결과는 지금처럼 /search 페이지에서 보여 준다. 패널은 검색어 입력과 이동만 맡는다(F5).
export function SearchPanel({ onClose, id, panelRef, variant = 'panel' }: SearchPanelProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const keyword = query.trim();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!keyword) return;
    router.push(`/search?q=${encodeURIComponent(keyword)}`);
    onClose();
  };

  const closeButton = (
    <button type="button" onClick={onClose} className="btn-icon" aria-label="검색 닫기">
      <X size={20} strokeWidth={1.67} />
    </button>
  );

  const input = (
    <div className="relative min-w-0 flex-1">
      <Search size={18} strokeWidth={1.67} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-icon-secondary" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="사용자, 게시글, 해시태그 검색"
        aria-label="통합 검색"
        enterKeyHint="search"
        className="input-base pl-10"
      />
    </div>
  );

  return (
    <div
      id={id}
      ref={panelRef}
      className={`flex h-full flex-col px-4 ${
        variant === 'fullscreen' ? 'bg-canvas pt-[calc(0.5rem+env(safe-area-inset-top))]' : 'bg-surface pt-5'
      }`}
    >
      <form role="search" onSubmit={submit} className="flex flex-col gap-2">
        {variant === 'panel' ? (
          <>
            <div className="flex items-center justify-between pl-2">
              <h2 className="text-title text-fg-primary">검색</h2>
              {closeButton}
            </div>
            {input}
          </>
        ) : (
          <div className="flex items-center gap-2">
            {closeButton}
            {input}
          </div>
        )}

        {keyword ? (
          <button
            type="submit"
            className="flex h-11 w-full items-center gap-3 rounded-control bg-brand-subtle px-3 text-left text-body font-medium text-fg-primary transition hover:brightness-110"
          >
            <Search size={18} strokeWidth={1.67} className="shrink-0 text-icon-brand" />
            <span className="min-w-0 flex-1 truncate">‘{keyword}’ 전체 결과 보기</span>
            <span className="hidden shrink-0 items-center gap-1 rounded-md border border-line-strong px-1.5 py-0.5 text-caption text-fg-secondary lg:inline-flex">
              <CornerDownLeft size={12} />
              Enter
            </span>
          </button>
        ) : null}
      </form>

      <p className="mt-3 px-2 text-caption text-fg-tertiary">게임, 플레이어, 게시글, #해시태그를 검색할 수 있어요.</p>
    </div>
  );
}
