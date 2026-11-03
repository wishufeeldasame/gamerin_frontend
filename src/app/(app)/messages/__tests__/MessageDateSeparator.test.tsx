import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import MessageDateSeparator from '../MessageDateSeparator';

describe('MessageDateSeparator', () => {
  it('renders an accessible separator with the visible date label', () => {
    render(<MessageDateSeparator label="2025년 12월 31일" />);

    expect(screen.getByRole('separator', { name: '2025년 12월 31일' })).toHaveTextContent(
      '2025년 12월 31일'
    );
  });
});
