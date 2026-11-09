import Link from 'next/link';

export function RightSidebar() {
  return (
    <footer className="space-x-3 px-6 text-xs font-bold text-fg-tertiary">
      <Link href="/terms" className="hover:underline">
        이용약관
      </Link>
      <Link href="/privacy" className="hover:underline">
        개인정보처리방침
      </Link>
      <span>© 2026 GamerIN</span>
    </footer>
  );
}
