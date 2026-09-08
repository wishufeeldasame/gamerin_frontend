'use client';

import { Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchAdminHiddenContents,
  restoreAdminHiddenContent,
  type AdminHiddenContentApiItem,
} from '@/lib/admin-content-api';
import type { AdminReportTargetTypeCode } from '@/lib/admin-report-api';
import { useVisiblePolling } from '@/hooks/useVisiblePolling';
import { AdminPagination } from '../../_components/AdminPagination';
import { AdminRefreshStatus } from '../../_components/AdminRefreshStatus';
import { AdminStatePanel } from '../../_components/AdminStatePanel';
import { AdminToast } from '../../_components/AdminToast';
import { RestoreContentButton } from './RestoreContentDialogButton';

const PAGE_SIZE = 20;

const targetTypeLabel: Record<AdminReportTargetTypeCode, string> = {
  POST: '게시글',
  COMMENT: '댓글',
  USER: '사용자',
  MENTORING: '멘토링',
  MESSAGE: '메시지',
};

function canRestoreContent(targetType: AdminReportTargetTypeCode) {
  return targetType === 'POST' || targetType === 'COMMENT';
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function AdminContentManagement() {
  const [query, setQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [contents, setContents] = useState<AdminHiddenContentApiItem[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [restoringContentId, setRestoringContentId] = useState<string | null>(null);
  const [toastId, setToastId] = useState(0);
  const [toastDescription, setToastDescription] = useState('');
  const requestControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const requestInFlightRef = useRef(false);

  const loadContents = useCallback(async (background = false, force = false) => {
    if (background && requestInFlightRef.current && !force) return;

    requestControllerRef.current?.abort();
    const controller = new AbortController();
    const requestId = ++requestIdRef.current;
    requestControllerRef.current = controller;
    requestInFlightRef.current = true;

    if (background) {
      setIsRefreshing(true);
      setRefreshError(null);
    } else {
      setLoading(true);
      setLoadError(null);
    }

    try {
      const response = await fetchAdminHiddenContents(
        { page: currentPage, size: PAGE_SIZE, sort: 'updatedAt,desc' },
        controller.signal,
      );

      if (requestId !== requestIdRef.current) return;

      if (currentPage > 0 && currentPage >= response.totalPages) {
        setCurrentPage(Math.max(response.totalPages - 1, 0));
        return;
      }

      setContents(response.content.filter((content) => content.isHidden));
      setTotalPages(response.totalPages);
      setTotalItems(response.totalElements);
      setLoadError(null);
      setRefreshError(null);
      setLastUpdatedAt(new Date());
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (requestId !== requestIdRef.current) return;

      const message = error instanceof Error ? error.message : '숨김 콘텐츠를 불러오지 못했습니다.';
      if (background) {
        setRefreshError(message);
      } else {
        setContents([]);
        setTotalPages(0);
        setTotalItems(0);
        setLoadError(message);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        requestInFlightRef.current = false;
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [currentPage]);

  useEffect(() => {
    void loadContents(false);
    return () => requestControllerRef.current?.abort();
  }, [loadContents]);

  useVisiblePolling(
    () => loadContents(true),
    { enabled: restoringContentId === null, intervalMs: 30_000 },
  );

  const visibleContents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return contents;
    return contents.filter((content) => content.targetId.toLowerCase().includes(normalizedQuery));
  }, [contents, query]);

  const restoreContent = async (content: AdminHiddenContentApiItem) => {
    setRestoringContentId(content.id);
    try {
      const restored = await restoreAdminHiddenContent(content.targetType, content.targetId);
      setContents((current) => current.filter((item) => item.id !== restored.id));
      setToastDescription(
        `${targetTypeLabel[content.targetType]} ${content.targetId}을(를) 복구했습니다.`,
      );
      setToastId(Date.now());
      await loadContents(true, true);
    } finally {
      setRestoringContentId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="w-full lg:max-w-md">
          <label className="relative block">
            <span className="sr-only">현재 페이지에서 콘텐츠 UUID 검색</span>
            <Search className="pointer-events-none absolute top-3 left-3 size-4 text-[#98a2b3]" strokeWidth={1.7} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="현재 페이지에서 콘텐츠 UUID 검색"
              className="h-10 w-full rounded-2xl border border-[#d0d5dd] bg-white pr-[13px] pl-[37px] text-sm text-[#172033] outline-none focus:border-[#315ef5] focus:ring-2 focus:ring-[#315ef5]/10"
            />
          </label>
          <p className="mt-1.5 text-xs text-[#98a2b3]">
            서버 검색 API가 없어 현재 페이지 {PAGE_SIZE}건 안에서만 검색합니다.
          </p>
        </div>
        <AdminRefreshStatus
          isRefreshing={isRefreshing}
          lastUpdatedAt={lastUpdatedAt}
          onRefresh={() => void loadContents(true)}
        />
      </div>

      {refreshError ? (
        <p className="mt-3 rounded-2xl border border-[#fedf89] bg-[#fffaeb] px-4 py-3 text-sm text-[#b54708]" role="status">
          기존 목록을 유지했습니다. 새 데이터를 확인하지 못했습니다: {refreshError}
        </p>
      ) : null}

      <section className="mt-4 min-h-[300px] overflow-hidden rounded-[20px] border border-[#e4e7ec] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        {loading ? (
          <AdminStatePanel state="loading" title="숨김 콘텐츠를 불러오는 중입니다." />
        ) : loadError ? (
          <AdminStatePanel
            state="error"
            title="숨김 콘텐츠를 불러오지 못했습니다."
            description={loadError}
            onRetry={() => void loadContents(false)}
          />
        ) : visibleContents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] table-fixed border-collapse">
              <colgroup>
                <col className="w-[12%]" />
                <col className="w-[36%]" />
                <col className="w-[13%]" />
                <col className="w-[13%]" />
                <col className="w-[17%]" />
                <col className="w-[9%]" />
              </colgroup>
              <thead>
                <tr className="h-[42px] border-b border-[#f2f4f7] bg-[#fcfcfd] text-left text-xs font-bold text-[#667085]">
                  <th className="px-5">유형</th>
                  <th>대상 UUID</th>
                  <th>누적 신고</th>
                  <th>상태</th>
                  <th>최종 변경 시각</th>
                  <th className="pr-5 text-right">복구</th>
                </tr>
              </thead>
              <tbody>
                {visibleContents.map((content) => {
                  const restorable = canRestoreContent(content.targetType);
                  return (
                    <tr key={content.id} className="h-[65px] border-b border-[#f2f4f7] last:border-b-0">
                      <td className="px-5 text-[13px] font-semibold text-[#172033]">
                        {targetTypeLabel[content.targetType]}
                      </td>
                      <td className="truncate font-mono text-[11px] text-[#667085]">
                        {content.targetId}
                      </td>
                      <td className="text-[13px] font-semibold text-[#344054]">
                        {content.reportCount}회
                      </td>
                      <td>
                        <span className="rounded-full bg-[#fff4e5] px-2.5 py-1 text-xs font-semibold text-[#b54708]">
                          자동 숨김
                        </span>
                      </td>
                      <td className="text-[13px] whitespace-nowrap text-[#98a2b3]">
                        {formatDateTime(content.updatedAt)}
                      </td>
                      <td className="pr-5 text-right">
                        {restorable ? (
                          <RestoreContentButton
                            contentPreview={`${targetTypeLabel[content.targetType]} ${content.targetId}`}
                            onRestore={() => restoreContent(content)}
                            disabled={restoringContentId !== null}
                          />
                        ) : (
                          <span className="text-[11px] font-semibold text-[#98a2b3]">
                            백엔드 복구 미지원
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <AdminStatePanel
            state="empty"
            title={query ? '현재 페이지에 검색 결과가 없습니다.' : '숨김 처리된 콘텐츠가 없습니다.'}
            description={query ? '다른 UUID를 입력하거나 페이지를 이동해보세요.' : '현재 자동 숨김 상태인 콘텐츠가 없습니다.'}
          />
        )}

        {!loading && !loadError ? (
          <AdminPagination
            currentPage={Math.min(currentPage, Math.max(totalPages - 1, 0))}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={PAGE_SIZE}
            itemLabel="건"
            onPageChange={(page) => {
              setQuery('');
              setCurrentPage(page);
            }}
          />
        ) : null}
      </section>

      {toastId > 0 ? (
        <AdminToast
          key={toastId}
          variant="success"
          title="콘텐츠를 복구했습니다."
          description={toastDescription}
          onDismiss={() => setToastId(0)}
        />
      ) : null}
    </div>
  );
}
