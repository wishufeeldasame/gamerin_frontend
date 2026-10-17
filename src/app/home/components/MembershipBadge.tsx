import { Crown } from 'lucide-react';

/** 멤버십 회원 왕관 배지. 닉네임 바로 뒤에 두고, 말줄임은 닉네임에만 건다. */
export function MembershipBadge({ active }: { active?: boolean | null }) {
  if (!active) return null;
  return (
    <span role="img" aria-label="멤버십 회원" title="멤버십 회원" className="inline-flex shrink-0 items-center">
      <Crown size={14} aria-hidden="true" className="text-amber-600 dark:text-[#f5b93d]" />
    </span>
  );
}
