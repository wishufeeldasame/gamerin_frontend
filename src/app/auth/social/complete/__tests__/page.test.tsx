import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  completeSocialSignup: vi.fn(),
  login: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock('@/app/context/AuthContext', () => ({ useAuth: () => ({ login: mocks.login }) }));
vi.mock('@/lib/auth-api', () => ({
  SignupCompletedError: class extends Error {},
  completeSocialSignup: mocks.completeSocialSignup,
}));

import SocialCompletePage from '../page';

describe('SocialCompletePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = '#signupToken=signup-token';
    mocks.completeSocialSignup.mockResolvedValue({ id: 'user-id' });
  });

  it('동의 전에는 제출할 수 없고 동의 값을 요청에 싣는다', async () => {
    render(<SocialCompletePage />);
    fireEvent.change(screen.getByLabelText('아이디'), { target: { value: 'demo_01' } });
    fireEvent.change(screen.getByLabelText('닉네임'), { target: { value: '데모' } });

    const submit = screen.getByRole('button', { name: '회원가입 완료' });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByLabelText('필수 항목 전체 동의'));
    fireEvent.click(submit);

    await waitFor(() =>
      expect(mocks.completeSocialSignup).toHaveBeenCalledWith({
        signupToken: 'signup-token',
        handle: 'demo_01',
        nickname: '데모',
        agreedToTerms: true,
        agreedToPrivacy: true,
        agreedToAge14: true,
        termsVersion: '1.0',
        privacyVersion: '1.1',
      }),
    );
  });
});
