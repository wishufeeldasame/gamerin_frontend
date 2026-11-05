/**
 * 멤버십 회원 배지(노란 바탕 + 검정 체크). 닉네임 바로 뒤에 두고, 말줄임은 닉네임에만 건다.
 * 톱니 원형 외곽선은 lucide `BadgeCheck`(ISC) 경로를 사용하고, 흰 배경에서도 보이도록 진한 노랑 테두리를 둔다.
 */
export function MembershipBadge({ active, size = 16 }: { active?: boolean | null; size?: number }) {
  if (!active) return null;
  return (
    <span role="img" aria-label="멤버십 회원" title="멤버십 회원" className="inline-flex shrink-0 items-center">
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"
          fill="#facc15"
          stroke="#eab308"
          strokeWidth={1.5}
        />
        <path d="m8.5 12 2.5 2.5 4.5-5" fill="none" stroke="#000" strokeWidth={2.6} />
      </svg>
    </span>
  );
}
