import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthPageShell } from '../AuthPageShell';
import { AuthStatusCard } from '../AuthStatusCard';
import { AuthTextField } from '../AuthTextField';

describe('AuthPageShell', () => {
  it('제목·설명·로고·내용을 그린다', () => {
    render(
      <AuthPageShell title="제목" description={<>첫 줄<br />둘째 줄</>}>
        <p>본문</p>
      </AuthPageShell>,
    );

    expect(screen.getByRole('heading', { level: 1, name: '제목' })).toBeInTheDocument();
    expect(screen.getByText(/첫 줄/)).toBeInTheDocument();
    expect(screen.getByAltText('GamerIN Logo')).toBeInTheDocument();
    expect(screen.getByText('본문')).toBeInTheDocument();
  });

  it('뒤로가기를 주면 링크와 모바일 상단 여백을 둔다', () => {
    const { container } = render(
      <AuthPageShell title="제목" description="설명" back={{ href: '/login', label: '돌아가기' }}>
        <p>본문</p>
      </AuthPageShell>,
    );

    expect(screen.getByRole('link', { name: '돌아가기' })).toHaveAttribute('href', '/login');
    expect(container.querySelector('.max-w-\\[420px\\]')).toHaveClass('space-y-12', 'pt-16', 'md:pt-0');
  });

  it('뒤로가기가 없으면 링크 없이 좁은 간격으로 그린다', () => {
    const { container } = render(
      <AuthPageShell title="제목" description="설명">
        <p>본문</p>
      </AuthPageShell>,
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(container.querySelector('.max-w-\\[420px\\]')).toHaveClass('space-y-8');
    expect(container.querySelector('.max-w-\\[420px\\]')).not.toHaveClass('pt-16');
  });

  it('아이콘 슬롯을 주면 제목 위 원형 배지에 그린다', () => {
    render(
      <AuthPageShell title="제목" description="설명" icon={<svg data-testid="icon" />}>
        <p>본문</p>
      </AuthPageShell>,
    );

    const badge = screen.getByTestId('icon').parentElement;
    expect(badge).toHaveClass('rounded-full', 'bg-black');
    expect(badge?.nextElementSibling).toContainElement(screen.getByRole('heading', { name: '제목' }));
  });
});

describe('AuthTextField', () => {
  it('일반 input 속성과 이벤트를 전달한다', () => {
    const onChange = vi.fn();
    render(<AuthTextField placeholder="아이디" aria-label="아이디" maxLength={20} autoComplete="username" onChange={onChange} />);

    const input = screen.getByPlaceholderText('아이디');
    expect(input).toHaveAttribute('aria-label', '아이디');
    expect(input).toHaveAttribute('maxlength', '20');
    expect(input).toHaveAttribute('autocomplete', 'username');
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('아이콘이 없으면 감싸지 않고 좁은 여백, 있으면 넓은 여백으로 그린다', () => {
    const { container, rerender } = render(<AuthTextField placeholder="필드" />);
    expect(container.firstElementChild?.tagName).toBe('INPUT');
    expect(screen.getByPlaceholderText('필드')).toHaveClass('px-5');

    rerender(<AuthTextField placeholder="필드" icon={<svg data-testid="icon" />} />);
    expect(screen.getByPlaceholderText('필드')).toHaveClass('px-14');
    expect(screen.getByTestId('icon').parentElement).toHaveClass('group-focus-within:text-black');
  });

  it('오류면 빨간 테두리로 그리고, 요청할 때만 아이콘도 빨갛게 한다', () => {
    const { rerender } = render(<AuthTextField placeholder="필드" icon={<svg data-testid="icon" />} invalid />);
    expect(screen.getByPlaceholderText('필드')).toHaveClass('border-red-500', 'ring-1', 'ring-red-500');
    expect(screen.getByTestId('icon').parentElement).not.toHaveClass('text-red-500');

    rerender(<AuthTextField placeholder="필드" icon={<svg data-testid="icon" />} invalid highlightIconOnError />);
    expect(screen.getByTestId('icon').parentElement).toHaveClass('text-red-500');
  });

  it('정상이면 포커스 링을 그린다', () => {
    render(<AuthTextField placeholder="필드" />);
    expect(screen.getByPlaceholderText('필드')).toHaveClass('border-zinc-200', 'focus:border-black', 'focus:ring-1', 'focus:ring-black', 'text-[15px]');
  });

  it("'reset' 변형은 기존 재설정 화면 스타일(글자 크기·포커스 링 없음, 아이콘 없어도 넓은 여백)을 유지한다", () => {
    render(<AuthTextField variant="reset" placeholder="필드" />);

    const input = screen.getByPlaceholderText('필드');
    expect(input).toHaveClass('px-14', 'focus:border-black', 'placeholder:text-zinc-400');
    expect(input).not.toHaveClass('text-[15px]');
    expect(input).not.toHaveClass('focus:ring-1');
    expect(input).not.toHaveClass('placeholder:font-medium');
  });

  it('오른쪽 요소를 입력란 뒤에 그린다', () => {
    render(<AuthTextField placeholder="필드" endAdornment={<button type="button">표시</button>} />);
    expect(screen.getByRole('button', { name: '표시' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('필드').nextElementSibling).toBe(screen.getByRole('button', { name: '표시' }));
  });
});

describe('AuthStatusCard', () => {
  it('아이콘·제목·설명·동작을 그린다', () => {
    render(
      <AuthStatusCard icon={<svg data-testid="icon" />} title="완료" description="설명입니다">
        <button type="button">확인</button>
      </AuthStatusCard>,
    );

    expect(screen.getByRole('heading', { level: 1, name: '완료' })).toBeInTheDocument();
    expect(screen.getByText('설명입니다')).toBeInTheDocument();
    expect(screen.getByTestId('icon').parentElement).toHaveClass('rounded-full', 'bg-black');
    expect(screen.getByRole('button', { name: '확인' })).toBeInTheDocument();
  });
});
