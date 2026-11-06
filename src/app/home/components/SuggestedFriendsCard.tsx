const exampleFriends = [
  { name: 'Theo Han', initials: 'TH', stats: 'Master · 승률 58%' },
  { name: '미나', initials: '미', stats: 'Ascendant 1 · 승률 61%' },
  { name: 'Luna Choi', initials: 'LC', stats: 'Platinum 1 · 승률 52%' },
];

export function SuggestedFriendsCard() {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-heading text-fg-primary">추천 친구</h2>
        <span className="rounded-full bg-subtle px-2 py-0.5 text-caption text-fg-secondary">예시</span>
      </div>
      <ul className="divide-y divide-line rounded-card border border-line-card bg-surface px-4">
        {exampleFriends.map(({ name, initials, stats }) => (
          <li key={name} className="flex items-center gap-3 py-3">
            <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-subtle text-label text-fg-secondary">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-body font-medium text-fg-primary">{name}</p>
              <p className="text-caption text-fg-secondary">{stats}</p>
            </div>
            <button type="button" disabled className="btn-secondary h-8 px-3">팔로우</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
