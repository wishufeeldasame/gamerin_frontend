import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@/test/feedback';

vi.mock('@/app/context/AuthContext', () => ({ useAuth: () => ({ user: { nickname: '테스터', handle: 'tester' } }) }));
vi.mock('@/lib/community-search-api', () => ({
  fetchHashtagSuggestions: vi.fn().mockResolvedValue([{ hashtagId: 'h1', name: '게임스', postCount: 3 }]),
}));

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

  it('기존 단어 앞에 #을 넣으면 뒤에 공백을 두고 커서는 # 바로 뒤에 둔다', async () => {
    render(<PostComposer />);
    const textarea = screen.getByLabelText<HTMLTextAreaElement>('게시글 내용');

    fireEvent.change(textarea, { target: { value: '오늘 랭크' } });
    textarea.setSelectionRange(3, 3);
    fireEvent.click(screen.getByRole('button', { name: '해시태그 추가' }));

    expect(textarea.value).toBe('오늘 # 랭크');
    await waitFor(() => expect(textarea.selectionStart).toBe(4));
  });

  it('자동완성이 열린 채 #을 넣으면 이전 추천을 닫는다', async () => {
    render(<PostComposer />);
    const textarea = screen.getByLabelText<HTMLTextAreaElement>('게시글 내용');

    fireEvent.change(textarea, { target: { value: '#게임' } });
    expect(await screen.findByRole('button', { name: /#게임스/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '해시태그 추가' }));
    expect(textarea.value).toBe('#게임 #');
    expect(screen.queryByRole('button', { name: /#게임스/ })).not.toBeInTheDocument();
  });
});
