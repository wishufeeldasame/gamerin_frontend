import type { ReactNode } from 'react';

export const LEGAL_CONTACT_EMAIL = 'wishufeelthesame@gmail.com';
export const LEGAL_EFFECTIVE_DATE = '2026년 11월 2일';
// 처리방침 1.1(발로란트 전적 조회처 HenrikDev 추가)부터 약관과 시행일이 다르다.
export const PRIVACY_EFFECTIVE_DATE = '2026년 11월 6일';

export function LegalNotice() {
  return (
    <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
      이 문서는 실제 상용 서비스가 아닌 졸업 캡스톤 프로젝트 용도로 작성되었으며, 법률 검토를 거치지 않아 틀리거나
      확정되지 않은 내용이 포함될 수 있습니다.
    </p>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-black text-black">{title}</h2>
      {children}
    </section>
  );
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

export function LegalTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200">
      <table className="w-full min-w-[520px] border-collapse text-left text-sm">
        <thead className="bg-zinc-50 dark:bg-surface">
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col" className="border-b border-zinc-200 px-3 py-2 font-bold text-black">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.join('|')} className="border-b border-zinc-200 last:border-b-0">
              {row.map((cell, index) => (
                <td key={index} className="px-3 py-2 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
