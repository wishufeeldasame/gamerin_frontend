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

  it('뒤로가기 링크를 폼보다 먼저 제공한다', () => {
    const { container } = render(
      <AuthPageShell title="제목" description="설명" back={{ href: '/?login=1', label: '돌아가기' }}>
        <p>본문</p>
      </AuthPageShell>,
    );

    expect(screen.getByRole('link', { name: '돌아가기' })).toHaveAttribute('href', '/?login=1');
    expect(container.querySelector('a')?.compareDocumentPosition(screen.getByText('본문'))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('뒤로가기가 없으면 링크 없이 좁은 간격으로 그린다', () => {
    const { container } = render(
      <AuthPageShell title="제목" description="설명">
        <p>본문</p>
      </AuthPageShell>,
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(container.querySelector('.max-w-\\[400px\\]')).toHaveClass('space-y-6');
  });

  it('아이콘 슬롯을 주면 제목 위 원형 배지에 그린다', () => {
    render(
      <AuthPageShell title="제목" description="설명" icon={<svg data-testid="icon" />}>
        <p>본문</p>
      </AuthPageShell>,
    );

    const badge = screen.getByTestId('icon').parentElement;
    expect(badge).toHaveClass('rounded-full', 'bg-brand-subtle');
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
    expect(screen.getByPlaceholderText('필드')).not.toHaveClass('pl-11');

    rerender(<AuthTextField placeholder="필드" icon={<svg data-testid="icon" />} />);
    expect(screen.getByPlaceholderText('필드')).toHaveClass('pl-11');
    expect(screen.getByTestId('icon').parentElement).toHaveClass('group-focus-within:text-fg-brand');
  });

  it('오류면 빨간 테두리로 그리고, 요청할 때만 아이콘도 빨갛게 한다', () => {
    const { rerender } = render(<AuthTextField placeholder="필드" icon={<svg data-testid="icon" />} invalid />);
    expect(screen.getByPlaceholderText('필드')).toHaveClass('border-line-danger', 'focus:ring-1', 'focus:ring-line-danger');
    expect(screen.getByTestId('icon').parentElement).not.toHaveClass('text-fg-danger');

    rerender(<AuthTextField placeholder="필드" icon={<svg data-testid="icon" />} invalid highlightIconOnError />);
    expect(screen.getByTestId('icon').parentElement).toHaveClass('text-fg-danger');
  });

  it('정상이면 포커스 링을 그린다', () => {
    render(<AuthTextField placeholder="필드" />);
    expect(screen.getByPlaceholderText('필드')).toHaveClass('input-base', 'focus:ring-1', 'focus:ring-fg-brand');
  });

  it('오류 상태를 보조 기술에 전달하고 기존 설명 연결을 유지한다', () => {
    const { rerender } = render(<AuthTextField aria-label="이메일" aria-describedby="email-error" invalid />);
    expect(screen.getByRole('textbox', { name: '이메일' })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-describedby', 'email-error');
    rerender(<AuthTextField aria-label="이메일" />);
    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid');
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
    expect(screen.getByTestId('icon').parentElement).toHaveClass('rounded-full', 'bg-brand-subtle');
    expect(screen.getByRole('button', { name: '확인' })).toBeInTheDocument();
  });
});
