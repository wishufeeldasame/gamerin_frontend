import { beforeEach, describe, expect, it, vi } from 'vitest';

const authStoreMocks = vi.hoisted(() => ({
  assertCurrentAuthGeneration: vi.fn(),
  ensureAccessToken: vi.fn(),
  getAuthGeneration: vi.fn(),
  logoutAuthSession: vi.fn(),
  refreshAccessToken: vi.fn(),
}));

const authorizationMocks = vi.hoisted(() => ({
  notifyAdminAuthorizationFailure: vi.fn(),
}));

vi.mock('@/lib/auth-store', () => authStoreMocks);
vi.mock('@/lib/api-base', () => ({
  getApiBaseUrl: () => 'http://api.test',
}));
vi.mock('@/lib/admin-auth', () => authorizationMocks);

import {
  fetchAdminReports,
  updateAdminReportStatus,
} from '@/lib/admin-report-api';
import {
  fetchAdminHiddenContents,
  restoreAdminHiddenContent,
} from '@/lib/admin-content-api';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('admin API requests', () => {
  beforeEach(() => {
    authStoreMocks.getAuthGeneration.mockReturnValue(7);
    authStoreMocks.ensureAccessToken.mockResolvedValue('access-token');
    authStoreMocks.refreshAccessToken.mockResolvedValue(null);
    authStoreMocks.logoutAuthSession.mockResolvedValue(undefined);
    vi.stubGlobal('fetch', vi.fn());
  });

  it('notifies the guard and rejects with 401 when refresh fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(401, {
        success: false,
        message: 'expired',
      }),
    );

    await expect(fetchAdminReports({})).rejects.toMatchObject({
      status: 401,
    });

    expect(authStoreMocks.refreshAccessToken).toHaveBeenCalledWith(7);
    expect(authorizationMocks.notifyAdminAuthorizationFailure).toHaveBeenCalledWith(401);
  });

  it('notifies the guard and preserves a 403 response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(403, {
        success: false,
        message: 'forbidden',
      }),
    );

    await expect(fetchAdminReports({})).rejects.toMatchObject({
      status: 403,
      message: 'forbidden',
    });

    expect(authStoreMocks.refreshAccessToken).not.toHaveBeenCalled();
    expect(authorizationMocks.notifyAdminAuthorizationFailure).toHaveBeenCalledWith(403);
  });

  it('sends the refreshed token after a recoverable 401', async () => {
    authStoreMocks.refreshAccessToken.mockResolvedValueOnce('refreshed-token');
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(401, { success: false }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          data: {
            content: [],
            totalPages: 0,
            totalElements: 0,
            number: 0,
            size: 20,
          },
        }),
      );

    await expect(fetchAdminReports({})).resolves.toMatchObject({
      content: [],
    });

    const secondRequest = vi.mocked(fetch).mock.calls[1];
    const headers = secondRequest[1]?.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer refreshed-token');
    expect(authorizationMocks.notifyAdminAuthorizationFailure).not.toHaveBeenCalled();
  });

  it('updates a report status with the backend report UUID', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(200, {
        success: true,
        data: {
          id: 'a9c79ce8-d1b5-4fba-a6e3-7f9c66212193',
          reportCode: 'RPT-20260831-0001',
          status: 'IN_REVIEW',
        },
      }),
    );

    await expect(
      updateAdminReportStatus('a9c79ce8-d1b5-4fba-a6e3-7f9c66212193', 'IN_REVIEW'),
    ).resolves.toMatchObject({ status: 'IN_REVIEW' });

    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(
      'http://api.test/api/v1/admin/reports/a9c79ce8-d1b5-4fba-a6e3-7f9c66212193/status',
    );
    expect(options).toMatchObject({
      method: 'PATCH',
      body: JSON.stringify({ status: 'IN_REVIEW' }),
      credentials: 'include',
    });
  });

  it('loads hidden content using the backend paging contract', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(200, {
        success: true,
        data: {
          content: [],
          totalPages: 0,
          totalElements: 0,
          number: 0,
          size: 25,
        },
      }),
    );

    await fetchAdminHiddenContents({ page: 0, size: 25, sort: 'updatedAt,desc' });

    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(
      'http://api.test/api/v1/admin/contents/hidden?page=0&size=25&sort=updatedAt%2Cdesc',
    );
    expect(options).toMatchObject({
      credentials: 'include',
    });
  });

  it('restores hidden content without sending an unsupported reason body', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(200, {
        success: true,
        data: {
          id: 'count-id',
          targetType: 'POST',
          targetId: 'content-id',
          reportCount: 5,
          isHidden: false,
          updatedAt: '2026-08-31T12:00:00+09:00',
        },
      }),
    );

    await restoreAdminHiddenContent('POST', 'content-id');

    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(
      'http://api.test/api/v1/admin/contents/POST/content-id/restore',
    );
    expect(options).toMatchObject({
      method: 'POST',
      credentials: 'include',
    });
    expect(options?.body).toBeUndefined();
  });
});
