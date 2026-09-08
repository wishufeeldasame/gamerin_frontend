import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const reportApi = vi.hoisted(() => ({
  createReport: vi.fn(),
  fetchReportReasons: vi.fn(),
  ReportApiError: class ReportApiError extends Error {
    constructor(message: string, public readonly status: number) {
      super(message);
    }
  },
}));

vi.mock('@/lib/report-api', () => reportApi);
vi.mock('@/lib/feed-api', () => ({
  getInitials: (value: string) => value.charAt(0),
}));

import { ReportContentModal } from '../Report';

const defaultProps = {
  targetType: 'POST' as const,
  targetId: '11111111-1111-4111-8111-111111111111',
  title: '게시글 신고',
  author: '작성자',
  authorHandle: 'author',
  content: '신고 대상 내용',
  emptyContentLabel: '내용 없음',
  onClose: vi.fn(),
};

describe('ReportContentModal', () => {
  beforeEach(() => {
    reportApi.createReport.mockReset();
    reportApi.fetchReportReasons.mockReset();
    reportApi.fetchReportReasons.mockResolvedValue([
      { code: 'SPAM', label: '스팸' },
      { code: 'OTHER', label: '기타' },
    ]);
    reportApi.createReport.mockResolvedValue({ id: 'report-id' });
  });

  it('allows optional details for every non-OTHER reason and trims them', async () => {
    render(<ReportContentModal {...defaultProps} />);

    fireEvent.click(await screen.findByRole('button', { name: '스팸' }));
    fireEvent.change(screen.getByRole('textbox', { name: '신고 상세 내용' }), {
      target: { value: '  반복 게시물입니다.  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: '신고 접수' }));
    fireEvent.click(within(
      screen.getByRole('dialog', { name: '신고하시겠습니까?' }),
    ).getByRole('button', { name: '신고 접수' }));

    await waitFor(() => {
      expect(reportApi.createReport).toHaveBeenCalledWith({
        targetType: 'POST',
        targetId: defaultProps.targetId,
        reasonCode: 'SPAM',
        details: '반복 게시물입니다.',
      });
    });
  });

  it('sends whitespace-only optional details as null', async () => {
    render(<ReportContentModal {...defaultProps} />);

    fireEvent.click(await screen.findByRole('button', { name: '스팸' }));
    fireEvent.change(screen.getByRole('textbox', { name: '신고 상세 내용' }), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: '신고 접수' }));
    fireEvent.click(within(
      screen.getByRole('dialog', { name: '신고하시겠습니까?' }),
    ).getByRole('button', { name: '신고 접수' }));

    await waitFor(() => {
      expect(reportApi.createReport).toHaveBeenCalledWith(
        expect.objectContaining({ details: null }),
      );
    });
  });

  it('requires OTHER details, preserves text across reason changes, and limits it to 300 characters', async () => {
    render(<ReportContentModal {...defaultProps} />);

    fireEvent.click(await screen.findByRole('button', { name: '기타' }));
    const submitButton = screen.getByRole('button', { name: '신고 접수' });
    const details = screen.getByRole('textbox', { name: '신고 상세 내용' });
    expect(submitButton).toBeDisabled();
    expect(details).toHaveAttribute('maxlength', '300');
    expect(details).toHaveAttribute('aria-required', 'true');

    fireEvent.change(details, { target: { value: '작성 중인 상세 내용' } });
    expect(submitButton).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '스팸' }));
    expect(details).toHaveValue('작성 중인 상세 내용');
    expect(screen.getByText('11 / 300')).toBeInTheDocument();
  });

  it('prevents duplicate submissions while the first request is pending', async () => {
    let finishRequest: (() => void) | undefined;
    reportApi.createReport.mockImplementation(
      () => new Promise<void>((resolve) => {
        finishRequest = resolve;
      }),
    );
    render(<ReportContentModal {...defaultProps} />);

    fireEvent.click(await screen.findByRole('button', { name: '스팸' }));
    fireEvent.click(screen.getByRole('button', { name: '신고 접수' }));
    const confirmButton = within(
      screen.getByRole('dialog', { name: '신고하시겠습니까?' }),
    ).getByRole('button', { name: '신고 접수' });
    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);

    expect(reportApi.createReport).toHaveBeenCalledTimes(1);
    finishRequest?.();
    await screen.findByText('신고가 접수되었습니다');
  });
});
