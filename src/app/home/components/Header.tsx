import { Bell, MessageSquare, Search } from "lucide-react";

export function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-[#d69a1f] bg-[#f5b93d]">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-4 px-6 lg:px-6">
        <div className="min-w-0 flex-1 lg:max-w-[240px]">
          <div
            className="text-[2.05rem] font-semibold leading-none text-black"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            GamerIN
          </div>
        </div>

        <div className="hidden flex-1 justify-start md:flex">
          <label className="flex h-10 w-full max-w-[385px] items-center gap-3 rounded-xl border border-black/10 bg-[#f3f1f7] px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
            <Search size={18} className="text-zinc-500" strokeWidth={2.1} />
            <input
              type="text"
              placeholder="Search games, players, posts..."
              className="w-full bg-transparent text-sm text-black outline-none placeholder:text-zinc-500"
            />
          </label>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-3 lg:max-w-md">
          <button className="flex h-9 w-9 items-center justify-center rounded-full text-black transition hover:bg-black/5">
            <Bell size={18} strokeWidth={2.1} />
          </button>
          <button className="flex h-9 w-9 items-center justify-center rounded-full text-black transition hover:bg-black/5">
            <MessageSquare size={18} strokeWidth={2.1} />
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-sm font-black text-white">
            JD
          </div>
        </div>
      </div>
    </header>
  );
}
