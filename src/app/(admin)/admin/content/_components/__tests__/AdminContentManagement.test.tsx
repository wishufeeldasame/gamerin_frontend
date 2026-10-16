import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminHiddenContentApiItem } from '@/lib/admin-content-api';
import { deferred } from '@/test/fetch-routes';
import type { PageResponse } from '@/types/api';

const contentApi = vi.hoisted(() => ({
  fetchAdminHiddenContents: vi.fn(),
  restoreAdminHiddenContent: vi.fn(),
}));
const auth = vi.hoisted(() => ({ user: { id: 'admin-1' } }));
const polling = vi.hoisted(() => ({
  callback: undefined as undefined | (() => void | Promise<void>),
}));

vi.mock('@/lib/admin-content-api', () => contentApi);
vi.mock('@/app/context/AuthContext', () => ({
  useAuth: () => ({ user: auth.user }),
}));
vi.mock('@/hooks/useVisiblePolling', () => ({
  useVisiblePolling: vi.fn((callback: () => void | Promise<void>) => {
    polling.callback = callback;
  }),
}));

import { AdminContentManagement } from '../AdminContentManagement';

const post: AdminHiddenContentApiItem = {
  id: 'hidden-post',
  targetType: 'POST',
  targetId: '11111111-1111-4111-8111-111111111111',
  reportCount: 5,
  isHidden: true,
  updatedAt: '2026-09-07T00:00:00Z',
};
const user: AdminHiddenContentApiItem = {
  id: 'hidden-user',
  targetType: 'USER',
  targetId: '22222222-2222-4222-8222-222222222222',
  reportCount: 7,
  isHidden: true,
  updatedAt: '2026-09-07T00:01:00Z',
};
const nextPagePost: AdminHiddenContentApiItem = {
  ...post,
  id: 'next-page-post',
  targetId: '33333333-3333-4333-8333-333333333333',
};
const staleNextPagePost: AdminHiddenContentApiItem = {
  ...post,
  id: 'stale-next-page-post',
  targetId: '44444444-4444-4444-8444-444444444444',
};

function pageResponse(
  content: AdminHiddenContentApiItem[],
  overrides: Partial<PageResponse<AdminHiddenContentApiItem>> = {},
): PageResponse<AdminHiddenContentApiItem> {
  return {
    content,
    totalPages: content.length > 0 ? 1 : 0,
    totalElements: content.length,
    number: 0,
    size: 20,
    ...overrides,
  };
}

describe('AdminContentManagement', () => {
  beforeEach(() => {
    contentApi.fetchAdminHiddenContents.mockReset();
    contentApi.restoreAdminHiddenContent.mockReset();
    auth.user = { id: 'admin-1' };
    polling.callback = undefined;
    contentApi.fetchAdminHiddenContents.mockResolvedValue(pageResponse([post, user]));
    contentApi.restoreAdminHiddenContent.mockResolvedValue({
      ...post,
      isHidden: false,
    });
  });

  it('requests one server page with 20 items and shows unsupported types', async () => {
    render(<AdminContentManagement />);

    expect(await screen.findByText(post.targetId)).toBeInTheDocument();
    expect(contentApi.fetchAdminHiddenContents).toHaveBeenCalledWith(
      { page: 0, size: 20, sort: 'updatedAt,desc' },
      expect.any(AbortSignal),
    );
    expect(screen.getByText('백엔드 복구 미지원')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '복구' })).toHaveLength(1);
  });

  it('filters UUIDs only within the current page', async () => {
    render(<AdminContentManagement />);

    expect(await screen.findByText(post.targetId)).toBeInTheDocument();
    const input = screen.getByRole('searchbox', {
      name: '현재 페이지에서 콘텐츠 UUID 검색',
    });
    fireEvent.change(input, { target: { value: '22222222' } });

    expect(screen.queryByText(post.targetId)).not.toBeInTheDocument();
    expect(screen.getByText(user.targetId)).toBeInTheDocument();
    expect(contentApi.fetchAdminHiddenContents).toHaveBeenCalledTimes(1);
  });

  it('restores POST content and refetches the current page', async () => {
    render(<AdminContentManagement />);

    expect(await screen.findByText(post.targetId)).toBeInTheDocument();
    const callsBeforeRestore = contentApi.fetchAdminHiddenContents.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: '복구' }));
    fireEvent.click(screen.getByRole('button', { name: '콘텐츠 복구' }));

    await waitFor(() => {
      expect(contentApi.restoreAdminHiddenContent).toHaveBeenCalledWith(
        'POST',
        post.targetId,
        expect.any(AbortSignal),
      );
      expect(contentApi.fetchAdminHiddenContents.mock.calls.length).toBeGreaterThan(
        callsBeforeRestore,
      );
    });
  });

  it('keeps the restore dialog open after failure and allows retry', async () => {
    contentApi.restoreAdminHiddenContent.mockRejectedValueOnce(new Error('복구 실패'));
    render(<AdminContentManagement />);

    expect(await screen.findByText(post.targetId)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '복구' }));
    fireEvent.click(screen.getByRole('button', { name: '콘텐츠 복구' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('복구 실패');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '콘텐츠 복구' }));
    await waitFor(() => expect(contentApi.restoreAdminHiddenContent).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('refetches the latest page after a restore and ignores the aborted page response', async () => {
    const restore = deferred<AdminHiddenContentApiItem>();
    const latePage = deferred<PageResponse<AdminHiddenContentApiItem>>();
    let pageOneCalls = 0;
    contentApi.restoreAdminHiddenContent.mockReturnValue(restore.promise);
    contentApi.fetchAdminHiddenContents.mockImplementation(({ page }: { page: number }) => {
      if (page === 0) {
        return Promise.resolve(pageResponse([post], { totalPages: 2, totalElements: 21 }));
      }
      pageOneCalls += 1;
      return pageOneCalls === 1
        ? latePage.promise
        : Promise.resolve(pageResponse([nextPagePost], { number: 1, totalPages: 2, totalElements: 21 }));
    });

    render(<AdminContentManagement />);
    await screen.findByText(post.targetId);
    fireEvent.click(screen.getByRole('button', { name: '복구' }));
    fireEvent.click(screen.getByRole('button', { name: '콘텐츠 복구' }));
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    await waitFor(() => expect(contentApi.fetchAdminHiddenContents).toHaveBeenCalledTimes(2));

    const firstPageOneSignal = contentApi.fetchAdminHiddenContents.mock.calls[1][1] as AbortSignal;
    await act(async () => {
      restore.resolve({ ...post, isHidden: false });
    });

    await waitFor(() => {
      expect(contentApi.fetchAdminHiddenContents.mock.calls.map(([params]) => params.page)).toEqual([0, 1, 1]);
    });
    expect(firstPageOneSignal.aborted).toBe(true);
    expect(await screen.findByText(nextPagePost.targetId)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page');

    await act(async () => {
      latePage.resolve(pageResponse([staleNextPagePost], { number: 1, totalPages: 2, totalElements: 21 }));
    });
    expect(screen.queryByText(staleNextPagePost.targetId)).not.toBeInTheDocument();
    expect(screen.getByText(nextPagePost.targetId)).toBeInTheDocument();
  });

  it('does not start another list request when visible polling fires during a pending request', async () => {
    const pending = deferred<PageResponse<AdminHiddenContentApiItem>>();
    contentApi.fetchAdminHiddenContents.mockReturnValueOnce(pending.promise);
    render(<AdminContentManagement />);

    await act(async () => {
      await polling.callback?.();
      await polling.callback?.();
    });
    expect(contentApi.fetchAdminHiddenContents).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve(pageResponse([post]));
    });
    expect(await screen.findByText(post.targetId)).toBeInTheDocument();
  });

  it('ignores a late restore result after the administrator changes', async () => {
    const restore = deferred<AdminHiddenContentApiItem>();
    contentApi.restoreAdminHiddenContent.mockReturnValue(restore.promise);
    contentApi.fetchAdminHiddenContents
      .mockResolvedValueOnce(pageResponse([post]))
      .mockResolvedValueOnce(pageResponse([nextPagePost]));

    const view = render(<AdminContentManagement />);
    await screen.findByText(post.targetId);
    fireEvent.click(screen.getByRole('button', { name: '복구' }));
    fireEvent.click(screen.getByRole('button', { name: '콘텐츠 복구' }));
    const mutationSignal = contentApi.restoreAdminHiddenContent.mock.calls[0][2] as AbortSignal;

    auth.user = { id: 'admin-2' };
    view.rerender(<AdminContentManagement />);
    expect(await screen.findByText(nextPagePost.targetId)).toBeInTheDocument();
    expect(mutationSignal.aborted).toBe(true);
    const fetchCount = contentApi.fetchAdminHiddenContents.mock.calls.length;

    await act(async () => {
      restore.resolve({ ...post, isHidden: false });
    });
    expect(contentApi.fetchAdminHiddenContents).toHaveBeenCalledTimes(fetchCount);
    expect(screen.getByText(nextPagePost.targetId)).toBeInTheDocument();
    expect(screen.queryByText('콘텐츠를 복구했습니다.')).not.toBeInTheDocument();
  });

  it('aborts a pending restore and ignores its late result after unmount', async () => {
    const restore = deferred<AdminHiddenContentApiItem>();
    contentApi.restoreAdminHiddenContent.mockReturnValue(restore.promise);
    const view = render(<AdminContentManagement />);
    await screen.findByText(post.targetId);
    fireEvent.click(screen.getByRole('button', { name: '복구' }));
    fireEvent.click(screen.getByRole('button', { name: '콘텐츠 복구' }));
    const mutationSignal = contentApi.restoreAdminHiddenContent.mock.calls[0][2] as AbortSignal;
    const fetchCount = contentApi.fetchAdminHiddenContents.mock.calls.length;

    view.unmount();
    expect(mutationSignal.aborted).toBe(true);
    await act(async () => {
      restore.resolve({ ...post, isHidden: false });
    });
    expect(contentApi.fetchAdminHiddenContents).toHaveBeenCalledTimes(fetchCount);
  });

  it('moves to the last valid page after the current hidden-content page disappears', async () => {
    contentApi.fetchAdminHiddenContents
      .mockResolvedValueOnce(pageResponse([post], {
        totalPages: 2,
        totalElements: 21,
      }))
      .mockResolvedValueOnce(pageResponse([], {
        totalPages: 1,
        totalElements: 1,
        number: 1,
      }))
      .mockResolvedValueOnce(pageResponse([post], {
        totalPages: 1,
        totalElements: 1,
      }));

    render(<AdminContentManagement />);
    expect(await screen.findByText(post.targetId)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '2' }));

    await waitFor(() => {
      const requestedPages = contentApi.fetchAdminHiddenContents.mock.calls.map(
        ([params]) => params.page,
      );
      expect(requestedPages).toEqual([0, 1, 0]);
    });
    expect(screen.getByRole('button', { name: '1' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
