import { describe, expect, it, vi } from 'vitest';
import { invalidateMileageAfter, subscribeToMileageInvalidation } from '../mileage-sync';

describe('mileage-sync', () => {
  it('signals only after the request succeeds', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToMileageInvalidation(listener);

    await expect(invalidateMileageAfter(Promise.resolve('ok'))).resolves.toBe('ok');
    expect(listener).toHaveBeenCalledTimes(1);

    await expect(invalidateMileageAfter(Promise.reject(new Error('fail')))).rejects.toThrow('fail');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    await invalidateMileageAfter(Promise.resolve(null));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
