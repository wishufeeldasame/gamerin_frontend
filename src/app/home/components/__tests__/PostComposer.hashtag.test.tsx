import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@/test/feedback';

vi.mock('@/app/context/AuthContext', () => ({ useAuth: () => ({ user: { nickname: '테스터', handle: 'tester' } }) }));
vi.mock('@/lib/community-search-api', () => ({ fetchHashtagSuggestions: vi.fn().mockResolvedValue([]) }));

import { PostComposer } from '../PostComposer';

describe('PostComposer 해시태그 버튼', () => {
  it('커서 위치에 #을 넣고, 앞 글자가 공백이 아니면 띄어 쓴다', () => {
    render(<PostComposer />);
    const textarea = screen.getByLabelText<HTMLTextAreaElement>('게시글 내용');
    const hashtagButton = screen.getByRole('button', { name: '해시태그 추가' });

    fireEvent.click(hashtagButton);
    expect(textarea.value).toBe('#');

    fireEvent.change(textarea, { target: { value: '오늘 랭크' } });
    textarea.setSelectionRange(2, 2);
    fireEvent.click(hashtagButton);
    expect(textarea.value).toBe('오늘 # 랭크');
  });
});
