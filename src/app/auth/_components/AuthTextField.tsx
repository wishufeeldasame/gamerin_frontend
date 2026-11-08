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
}

const baseClassName = 'input-base h-12';

export function AuthTextField({
  icon,
  endAdornment,
  invalid = false,
  highlightIconOnError = false,
  className,
  ...inputProps
}: AuthTextFieldProps) {
  const padding = `${icon ? 'pl-11' : ''} ${endAdornment ? 'pr-12' : ''}`;
  const state = invalid
    ? 'border-line-danger focus:border-line-danger focus:ring-1 focus:ring-line-danger'
    : 'focus:border-fg-brand focus:ring-1 focus:ring-fg-brand';

  const input = (
    <input
      {...inputProps}
      aria-invalid={invalid || inputProps['aria-invalid']}
      className={`${baseClassName} ${padding} ${state}${className ? ` ${className}` : ''}`}
    />
  );

  if (!icon && !endAdornment) {
    return input;
  }

  const iconTone = highlightIconOnError && invalid
    ? 'text-fg-danger'
    : 'text-icon-secondary group-focus-within:text-fg-brand';

  return (
    <div className="group relative">
      {icon ? (
        <div aria-hidden="true" className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 ${iconTone}`}>
          {icon}
        </div>
      ) : null}
      {input}
      {endAdornment}
    </div>
  );
}
