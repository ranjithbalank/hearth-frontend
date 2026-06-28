import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

import { Logo } from "../design/ui";
import { useApp } from "../lib/app-context";
import { NAV } from "../lib/modules";

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
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1180px] px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
