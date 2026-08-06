'use client';

import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AdminStatePanel } from '../../_components/AdminStatePanel';
import { AdminToast } from '../../_components/AdminToast';
import { hiddenComments, hiddenPosts } from '../_data/hidden-content';
import { RestoreContentButton } from './RestoreContentDialogButton';

type ContentTab = 'posts' | 'comments';

export function AdminContentManagement() {
  const [activeTab, setActiveTab] = useState<ContentTab>('posts');
  const [query, setQuery] = useState('');
  const [restoredIds, setRestoredIds] = useState<string[]>([]);
  const [toastId, setToastId] = useState(0);

  const visibleContents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase().replace(/^@/, '');
    const contents = activeTab === 'posts' ? hiddenPosts : hiddenComments;

    return contents.filter((content) => {
      const searchSource = [content.id, content.author, content.preview].join(' ').toLowerCase();
      return !restoredIds.includes(content.id) && (!normalizedQuery || searchSource.includes(normalizedQuery));
    });
  }, [activeTab, query, restoredIds]);

  const restoreContent = (contentId: string) => {
    setRestoredIds((current) => [...current, contentId]);
    setToastId(Date.now());
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full rounded-2xl bg-[#f2f4f7] p-1 sm:w-auto" role="tablist">
          <button type="button" role="tab" aria-selected={activeTab === 'posts'} onClick={() => { setActiveTab('posts'); setQuery(''); }} className={`h-10 flex-1 rounded-[14px] px-4 text-sm font-medium transition sm:flex-none sm:text-base ${activeTab === 'posts' ? 'bg-white text-[#172033] shadow-[0_1px_2px_rgba(0,0,0,0.1)]' : 'text-[#667085]'}`}>숨김 게시글</button>
          <button type="button" role="tab" aria-selected={activeTab === 'comments'} onClick={() => { setActiveTab('comments'); setQuery(''); }} className={`h-10 flex-1 rounded-[14px] px-4 text-sm font-medium transition sm:flex-none sm:text-base ${activeTab === 'comments' ? 'bg-white text-[#172033] shadow-[0_1px_2px_rgba(0,0,0,0.1)]' : 'text-[#667085]'}`}>숨김 댓글</button>
        </div>

        <label className="relative block w-full sm:w-72">
          <span className="sr-only">콘텐츠 검색</span>
          <Search className="pointer-events-none absolute top-3 left-3 size-4 text-[#98a2b3]" strokeWidth={1.7} aria-hidden="true" />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="작성자 · 콘텐츠 ID · 내용 검색" className="h-10 w-full rounded-2xl border border-[#d0d5dd] bg-white pr-[13px] pl-[37px] text-sm text-[#172033] outline-none focus:border-[#315ef5] focus:ring-2 focus:ring-[#315ef5]/10" />
        </label>
      </div>

      <section className="mt-4 min-h-[220px] overflow-hidden rounded-[20px] border border-[#e4e7ec] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        {visibleContents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] table-fixed border-collapse">
              <colgroup><col className="w-[35%]" /><col className="w-[16.1%]" /><col className="w-[13.3%]" /><col className="w-[11.1%]" /><col className="w-[16.8%]" /><col className="w-[7.7%]" /></colgroup>
              <thead><tr className="h-[42px] border-b border-[#f2f4f7] bg-[#fcfcfd] text-left text-xs font-bold text-[#667085]"><th className="px-5">콘텐츠 미리보기</th><th>작성자</th><th>숨김 사유</th><th>처리 관리자</th><th>처리 시각</th><th className="pr-5 text-right">복구</th></tr></thead>
              <tbody>
                {visibleContents.map((content) => (
                  <tr key={content.id} className="h-[65px] border-b border-[#f2f4f7] last:border-b-0">
                    <td className="px-5"><p className="max-w-[280px] truncate text-[13px] font-medium text-[#172033]">{content.preview}</p><p className="mt-0.5 font-mono text-[10px] text-[#98a2b3]">{content.id}</p></td>
                    <td><div className="flex items-center gap-2"><span className="grid size-7 shrink-0 place-items-center rounded-full text-[11.2px] font-bold text-white" style={{ backgroundColor: content.avatarColor }}>{content.avatar}</span><span className="truncate text-[13px] text-[#344054]">{content.author}</span></div></td>
                    <td className="truncate text-[13px] text-[#344054]">{content.reason}</td>
                    <td className="truncate text-[13px] text-[#667085]">{content.administrator}</td>
                    <td className="text-[13px] whitespace-nowrap text-[#98a2b3]">{content.processedAt}</td>
                    <td className="pr-5 text-right"><RestoreContentButton contentPreview={content.preview} onRestore={() => restoreContent(content.id)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <AdminStatePanel
            state="empty"
            compact
            title={query ? '검색 결과가 없습니다.' : '숨김 처리된 콘텐츠가 없습니다.'}
            description={query ? '다른 작성자, 콘텐츠 ID 또는 검색어를 입력해보세요.' : '복구하거나 숨김 처리된 콘텐츠가 없을 때 표시되는 상태입니다.'}
          />
        )}
      </section>

      {toastId > 0 ? <AdminToast key={toastId} variant="success" title="콘텐츠를 복구했습니다." description="복구 사유가 작업 이력에 기록되었습니다." onDismiss={() => setToastId(0)} /> : null}
    </div>
  );
}
