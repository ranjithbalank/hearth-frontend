import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import { Logo } from "../design/ui";
import { api } from "../lib/api";
import { useApp } from "../lib/app-context";
import { NAV } from "../lib/modules";

function NotificationBell() {
  const nav = useNavigate();
  const { canAccess } = useApp();
  const { data } = useQuery({
    queryKey: ["notif-count"],
    queryFn: async () => (await api.get<{ count: number }>("/notifications/")).data,
    refetchInterval: 15000,
    enabled: canAccess("notifications"),
  });
  if (!canAccess("notifications")) return null;
  const count = data?.count ?? 0;
  return (
    <button onClick={() => nav("/notifications")} className="relative p-2 rounded-lg hover:bg-hairline/60" title="Notifications">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M6 9a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6Z" stroke="#3D4A4E" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M10 19a2 2 0 004 0" stroke="#3D4A4E" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-clay text-white text-[10px] font-bold flex items-center justify-center">
          {count}
        </span>
      )}
    </button>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, property, canAccess, logout } = useApp();

  const groups = NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => canAccess(i.key)),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-ink text-white flex flex-col">
        <div className="flex items-center gap-3 px-5 py-5">
          <Logo size={34} />
          <div>
            <div className="font-display text-xl leading-none">Hearth</div>
            <div className="text-[10px] tracking-[0.18em] text-white/45 mt-1">
              {property?.name?.toUpperCase()}
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {groups.map((g) => (
            <div key={g.title} className="mb-5">
              <div className="px-3 text-[10px] uppercase tracking-wider text-white/35 font-semibold mb-1">
                {g.title}
              </div>
              {g.items.map((i) => (
                <NavLink
                  key={i.key}
                  to={i.path}
                  className={({ isActive }) =>
                    `block rounded-lg px-3 py-2 text-sm transition-colors ${
                      isActive ? "bg-pine text-white" : "text-white/70 hover:bg-white/5"
                    }`
                  }
                >
                  {i.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-clay/90 flex items-center justify-center text-sm font-bold">
            {user?.name?.split(" ").map((w) => w[0]).slice(0, 2).join("")}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm truncate">{user?.name}</div>
            <div className="text-[11px] text-white/45 truncate">{user?.role}</div>
          </div>
          <button onClick={logout} className="text-white/50 hover:text-white text-xs" title="Sign out">
            ⎋
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto flex flex-col">
        <header className="flex items-center gap-3 px-8 py-3 border-b border-hairline bg-surface/60 backdrop-blur sticky top-0 z-10">
          <div className="text-sm text-muted">
            {property?.name}
            {property?.business_date && <span className="ml-2 text-xs">· business date {property.business_date}</span>}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="pill bg-pine-50 text-pine capitalize">{property?.edition} edition</span>
            <NotificationBell />
          </div>
        </header>
        <div className="mx-auto w-full max-w-[1180px] px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
