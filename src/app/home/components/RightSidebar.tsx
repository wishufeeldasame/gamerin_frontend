const trendingGames = [
  { name: "Marvel Rivals", meta: "12.4K posts" },
  { name: "Elden Ring", meta: "9.8K posts" },
  { name: "VALORANT", meta: "7.2K posts" },
  { name: "Minecraft", meta: "5.9K posts" },
];

const suggestedFriends = [
  { name: "Jin Park", tag: "@jinplays", badge: "FPS coach" },
  { name: "Luna Choi", tag: "@lunaraid", badge: "MMO guild lead" },
  { name: "Theo Han", tag: "@theostream", badge: "Creator" },
];

export function RightSidebar() {
  return (
    <aside className="fixed right-0 top-16 hidden h-[calc(100vh-4rem)] w-80 overflow-y-auto border-l border-zinc-200 bg-zinc-50/70 p-6 xl:block">
      <section className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-[0_20px_60px_-45px_rgba(0,0,0,0.5)]">
        <h2 className="text-lg font-black text-black">Trending Games</h2>
        <div className="mt-4 space-y-3">
          {trendingGames.map((game) => (
            <div
              key={game.name}
              className="rounded-2xl bg-zinc-100 px-4 py-3 transition hover:bg-yellow-100"
            >
              <p className="text-sm font-bold text-black">{game.name}</p>
              <p className="mt-1 text-xs text-zinc-500">{game.meta}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-[28px] border border-zinc-200 bg-white p-5 shadow-[0_20px_60px_-45px_rgba(0,0,0,0.5)]">
        <h2 className="text-lg font-black text-black">Suggested Friends</h2>
        <div className="mt-4 space-y-4">
          {suggestedFriends.map((friend) => (
            <div key={friend.tag} className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-400 text-sm font-black text-black">
                {friend.name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-black">
                  {friend.name}
                </p>
                <p className="truncate text-xs text-zinc-500">{friend.tag}</p>
              </div>
              <span className="rounded-full bg-black px-3 py-1 text-[11px] font-bold text-white">
                {friend.badge}
              </span>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}
