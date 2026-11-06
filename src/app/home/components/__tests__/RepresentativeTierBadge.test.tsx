import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RepresentativeTierBadge } from '../RepresentativeTierBadge';

describe('RepresentativeTierBadge', () => {
  it('엠블럼을 대체 텍스트·툴팁과 함께 그린다', () => {
    render(<RepresentativeTierBadge tier={{ game: 'LOL', tierLabel: 'GOLD I' }} />);

    const image = screen.getByRole('img', { name: 'LoL GOLD I' });
    expect(image.getAttribute('src')).toContain('gold.png');
    expect(image.closest('[title]')?.getAttribute('title')).toBe('LoL GOLD I');
  });

  it('티어가 없거나 이미지가 없는 티어면 아무것도 그리지 않는다', () => {
    const { container, rerender } = render(<RepresentativeTierBadge tier={null} />);
    expect(container).toBeEmptyDOMElement();

    rerender(<RepresentativeTierBadge tier={{ game: 'LOL', tierLabel: 'UNRANKED' }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('이미지 로드에 실패하면 숨긴다', () => {
    const { container } = render(<RepresentativeTierBadge tier={{ game: 'R6', tierLabel: 'EMERALD II' }} />);

    fireEvent.error(screen.getByRole('img'));

    expect(container).toBeEmptyDOMElement();
  });
});
