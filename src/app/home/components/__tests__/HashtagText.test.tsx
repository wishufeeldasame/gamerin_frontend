import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HashtagText } from '../HashtagText';

describe('HashtagText mentions', () => {
  it('links mentions and hashtags with distinct styles and preserves content', () => {
    const text = '안녕 @user, #게임 @bravo';
    const view = render(<HashtagText text={text} />);
    expect(view.container.textContent).toBe(text);
    expect(screen.getByRole('link', { name: '@user' })).toHaveAttribute('href', '/profile/user');
    expect(screen.getByRole('link', { name: '#게임' })).toHaveAttribute('href', '/hashtags/%EA%B2%8C%EC%9E%84');
    expect(screen.getByRole('link', { name: '@user' })).toHaveClass('text-sky-700', 'dark:text-sky-400');
    expect(screen.getByRole('link', { name: '#게임' })).toHaveClass('text-emerald-700', 'dark:text-emerald-400');
    for (const link of screen.getAllByRole('link')) expect(link).toHaveAttribute('data-card-open-ignore', 'true');
  });
  it('keeps comment hashtags plain and still links unknown handles', () => {
    render(<HashtagText text="#게임 @not_found" linkHashtags={false} />);
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: '@not_found' })).toHaveAttribute('href', '/profile/not_found');
    expect(screen.getByText('#게임')).not.toHaveAttribute('href');
  });
  it('does not link emails, URLs or invalid handles', () => {
    render(<HashtagText text="a@abc.com https://test.com?q=@abc @ABC @ab @abcdefghijklmnopqrstu" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
  it('keeps internal and trailing dots as plain text without looking up accounts', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const text = '@user.name @player. @unknown... @user.한글 @ab.name';
    const view = render(<HashtagText text={text} linkHashtags={false} />);
    expect(view.container.textContent).toBe(text);
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
      '@user', '@player', '@unknown', '@user',
    ]);
    expect(screen.getByRole('link', { name: '@player' })).toHaveAttribute('href', '/profile/player');
    expect(screen.getByRole('link', { name: '@unknown' })).toHaveAttribute('href', '/profile/unknown');
    expect(screen.queryByRole('link', { name: '@user.name' })).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
