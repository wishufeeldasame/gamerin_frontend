import { fireEvent, screen, waitFor } from '@testing-library/react';
import { render } from '@/test/feedback';
import type { ComponentProps, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: {
    div: (props: ComponentProps<'div'> & { initial?: unknown; animate?: unknown; exit?: unknown }) => {
      const { initial, animate, exit, ...divProps } = props;
      void initial;
      void animate;
      void exit;
      return <div {...divProps} />;
    },
  },
}));

import { EditProfileModal } from '../EditProfileModal';

describe('EditProfileModal 저장 오류 표시', () => {
  it.each([
    ['unknown failure', '프로필을 저장하지 못했습니다.'],
    [new Error('Request failed.'), 'Request failed.'],
  ])('한국어 대체 안내를 표시하고 Error.message와 저장 재시도 동작을 유지한다 (%s)', async (error, message) => {
    const onClose = vi.fn();
    const onSaveUserInfo = vi.fn().mockRejectedValue(error);
    render(<EditProfileModal
      onClose={onClose}
      coverImage={null}
      avatarImage={null}
      userInfo={{ name: '테스터', bio: '', location: '', website: '' }}
      onSaveUserInfo={onSaveUserInfo}
    />);
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(message);
      expect(screen.getByRole('button', { name: '저장' })).toBeEnabled();
    });
    expect(onSaveUserInfo).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });
});
