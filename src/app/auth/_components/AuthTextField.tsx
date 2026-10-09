import type { InputHTMLAttributes, ReactNode } from 'react';

interface AuthTextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  /** 입력란 왼쪽 아이콘. 있으면 왼쪽 여백을 넓힌다. */
  icon?: ReactNode;
  /** 입력란 오른쪽에 겹쳐 놓는 요소(예: 비밀번호 표시 버튼). 위치는 요소가 스스로 정한다. */
  endAdornment?: ReactNode;
  /** 오류 스타일(빨간 테두리). */
  invalid?: boolean;
  /** 오류일 때 아이콘도 빨갛게 한다. */
  highlightIconOnError?: boolean;
  /**
   * 'reset'은 비밀번호 재설정 화면의 기존 입력 스타일이다. 글자 크기·placeholder 굵기·포커스 링이 없고
   * 아이콘이 포커스에 반응하지 않으며 아이콘이 없어도 왼쪽 여백이 넓다.
   */
  variant?: 'default' | 'reset';
}

const baseClassName = 'h-14 w-full rounded-2xl border bg-white font-semibold text-black outline-none transition-all';

export function AuthTextField({
  icon,
  endAdornment,
  invalid = false,
  highlightIconOnError = false,
  variant = 'default',
  className,
  ...inputProps
}: AuthTextFieldProps) {
  const isReset = variant === 'reset';
  const padding = icon || isReset ? 'px-14' : 'px-5';
  const typography = isReset
    ? 'placeholder:text-zinc-400'
    : 'text-[15px] placeholder:font-medium placeholder:text-zinc-400';
  const state = invalid
    ? 'border-red-500 ring-1 ring-red-500'
    : isReset
      ? 'border-zinc-200 focus:border-black'
      : 'border-zinc-200 focus:border-black focus:ring-1 focus:ring-black';

  const input = (
    <input
      {...inputProps}
      className={`${baseClassName} ${padding} ${typography} ${state}${className ? ` ${className}` : ''}`}
    />
  );

  if (!icon && !endAdornment) {
    return input;
  }

  const iconTone = isReset
    ? 'text-zinc-400'
    : `transition-colors ${
        highlightIconOnError && invalid ? 'text-red-500' : 'text-zinc-400 group-focus-within:text-black'
      }`;

  return (
    <div className={isReset ? 'relative' : 'group relative'}>
      {icon ? (
        <div className={`absolute left-5 top-1/2 -translate-y-1/2 ${iconTone}`}>
          {icon}
        </div>
      ) : null}
      {input}
      {endAdornment}
    </div>
  );
}
