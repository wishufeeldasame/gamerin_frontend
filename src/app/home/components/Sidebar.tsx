'use client';

import {
  Compass,
  Gamepad2,
  Home,
  LogOut,
  MessageCircle,
  ShieldQuestion,
  User,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";

const items = [
  { label: "Home", icon: Home, active: true },
  { label: "Discover", icon: Compass },
  { label: "Friends", icon: Users },
  { label: "Mentoring", icon: ShieldQuestion },
  { label: "Messages", icon: MessageCircle },
  { label: "Profile", icon: User },
];

export function Sidebar() {
  const router = useRouter();
  const apiBase =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

  const handleLogout = async () => {
    try {
      await fetch(`${apiBase}/api/v1/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      router.push("/login");
    }
  };

  return (
    <aside className="fixed left-0 top-16 hidden h-[calc(100vh-4rem)] w-64 flex-col border-r border-zinc-200 bg-zinc-50/80 px-4 py-6 lg:flex">
      <div className="mb-8 flex items-center gap-3 rounded-2xl bg-black px-4 py-4 text-white shadow-lg">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-yellow-400 text-black">
          <Gamepad2 size={22} />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
            Player Hub
          </p>
          <p className="text-lg font-bold">Game Social</p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <nav className="space-y-2">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                  item.active
                    ? "bg-black text-white shadow-sm"
                    : "text-zinc-700 hover:bg-white hover:text-black"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-zinc-200 pt-6">
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-white hover:text-black"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}
