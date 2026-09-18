import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AdminHiddenContentApiItem,
  AdminHiddenContentPageResponse,
} from '@/lib/admin-content-api';

const contentApi = vi.hoisted(() => ({
  fetchAdminHiddenContents: vi.fn(),
  restoreAdminHiddenContent: vi.fn(),
}));

vi.mock('@/lib/admin-content-api', () => contentApi);
vi.mock('@/hooks/useVisiblePolling', () => ({
  useVisiblePolling: vi.fn(),
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

function pageResponse(
  content: AdminHiddenContentApiItem[],
  overrides: Partial<AdminHiddenContentPageResponse> = {},
): AdminHiddenContentPageResponse {
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
      );
      expect(contentApi.fetchAdminHiddenContents.mock.calls.length).toBeGreaterThan(
        callsBeforeRestore,
      );
    });
  });

  it('keeps the restore dialog open and shows an error when restore fails', async () => {
    contentApi.restoreAdminHiddenContent.mockRejectedValueOnce(new Error('복구 실패'));
    render(<AdminContentManagement />);

    expect(await screen.findByText(post.targetId)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '복구' }));
    fireEvent.click(screen.getByRole('button', { name: '콘텐츠 복구' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('복구 실패');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
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
