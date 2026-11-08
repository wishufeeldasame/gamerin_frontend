import type { ReactNode } from 'react';

export const LEGAL_CONTACT_EMAIL = 'wishufeelthesame@gmail.com';
export const LEGAL_EFFECTIVE_DATE = '2026년 11월 2일';
// 처리방침 1.1(발로란트 전적 조회처 HenrikDev 추가)부터 약관과 시행일이 다르다.
export const PRIVACY_EFFECTIVE_DATE = '2026년 11월 6일';

export function LegalNotice() {
  return (
    <p className="rounded-control bg-brand-subtle px-4 py-3 text-label leading-6 text-fg-brand">
      이 문서는 실제 상용 서비스가 아닌 졸업 캡스톤 프로젝트 용도로 작성되었으며, 법률 검토를 거치지 않아 틀리거나
      확정되지 않은 내용이 포함될 수 있습니다.
    </p>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-heading text-fg-primary">{title}</h2>
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
    <div role="region" aria-label={headers.join(' · ')} tabIndex={0} className="overflow-x-auto rounded-control border border-line focus-visible:outline-2 focus-visible:outline-line-focus">
      <table className="w-full min-w-[520px] border-collapse text-left text-label">
        <thead className="bg-subtle">
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col" className="border-b border-line px-3 py-2 font-semibold text-fg-primary">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.join('|')} className="border-b border-line last:border-b-0">
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
