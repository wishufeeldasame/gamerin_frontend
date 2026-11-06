import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMileageBalance } from '@/hooks/useMileageBalance';
import { fetchMyMileageBalance } from '@/lib/mileage-api';
import { invalidateMileage } from '@/lib/mileage-sync';

vi.mock('@/lib/mileage-api', () => ({ fetchMyMileageBalance: vi.fn() }));

const fetchBalance = vi.mocked(fetchMyMileageBalance);
const media = Object.assign(new EventTarget(), { matches: false });

beforeEach(() => {
  media.matches = false;
  vi.stubGlobal('matchMedia', vi.fn(() => media));
  fetchBalance.mockReset().mockResolvedValue({ currentBalance: 100 });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useMileageBalance', () => {
  it('현재 화면 폭에서 보이는 카드만 조회하고 폭 전환 때 새로 읽는다', async () => {
    const mobile = renderHook(() => useMileageBalance('viewer', 'mobile'));
    const desktop = renderHook(() => useMileageBalance('viewer', 'desktop'));

    await waitFor(() => expect(mobile.result.current).toBe(100));
    expect(desktop.result.current).toBeNull();
    expect(fetchBalance).toHaveBeenCalledTimes(1);

    fetchBalance.mockResolvedValueOnce({ currentBalance: 200 });
    await act(async () => {
      media.matches = true;
      media.dispatchEvent(new Event('change'));
    });
    expect(desktop.result.current).toBe(200);
    expect(fetchBalance).toHaveBeenCalledTimes(2);
  });

  it('탭에 복귀하거나 잔액 무효화 신호를 받으면 다시 조회한다', async () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    const { result } = renderHook(() => useMileageBalance('viewer', 'mobile'));
    await waitFor(() => expect(result.current).toBe(100));

    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(fetchBalance).toHaveBeenCalledTimes(1);

    visibility.mockReturnValue('visible');
    fetchBalance.mockResolvedValueOnce({ currentBalance: 200 });
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(result.current).toBe(200);

    fetchBalance.mockResolvedValueOnce({ currentBalance: 300 });
    await act(async () => { invalidateMileage(); });
    expect(result.current).toBe(300);
    expect(fetchBalance).toHaveBeenCalledTimes(3);
  });

  it('새 요청보다 늦게 도착한 잔액을 폐기한다', async () => {
    let resolveFirst!: (balance: { currentBalance: number }) => void;
    fetchBalance.mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }));
    fetchBalance.mockResolvedValueOnce({ currentBalance: 200 });
    const { result } = renderHook(() => useMileageBalance('viewer', 'mobile'));

    await act(async () => { invalidateMileage(); });
    expect(result.current).toBe(200);

    await act(async () => { resolveFirst({ currentBalance: 100 }); });
    expect(result.current).toBe(200);
  });

  it('계정을 바꾸면 새 잔액이 오기 전에도 이전 계정 잔액을 표시하지 않는다', async () => {
    const { result, rerender } = renderHook(
      ({ userId }) => useMileageBalance(userId, 'mobile'),
      { initialProps: { userId: 'first' } },
    );
    await waitFor(() => expect(result.current).toBe(100));

    fetchBalance.mockResolvedValueOnce({ currentBalance: 200 });
    rerender({ userId: 'second' });
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toBe(200));
  });
});
