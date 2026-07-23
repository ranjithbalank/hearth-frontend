import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import { ErrorBoundary } from "../design/ErrorBoundary";
import { NavIcon } from "../design/NavIcon";
import { useToast } from "../design/Toast";
import { Logo } from "../design/ui";
import { api } from "../lib/api";
import { useApp } from "../lib/app-context";
import { fmtDate } from "../lib/date";
import { NAV } from "../lib/modules";
import { NOTIFICATION_ROUTES } from "../lib/notifications";
import { useOnlineStatus } from "../lib/useOnline";
import { ProductTour } from "./ProductTour";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={`transition-transform ${open ? "rotate-180" : ""}`}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

interface Alert { severity: string; module: string; title: string; detail: string }

/** Only appears for people who actually operate across more than one
 * branch — a Bar Captain or Housekeeping login with a single assignment
 * never sees this, they just land on their branch. */
function BranchSwitcher() {
  const { user, activeBranch, setBranch } = useApp();
  const qc = useQueryClient();
  const allBranches = user?.branches === "*";
  const { data: everyBranch } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => (await api.get<{ id: number; name: string; code: string }[]>("/auth/branches/")).data,
    enabled: allBranches,
  });

  const options = allBranches
    ? everyBranch ?? []
    : Array.from(
        new Map(
          (Array.isArray(user?.branches) ? user.branches : [])
            .map((a) => [a.branch, { id: a.branch, name: a.branch_name, code: a.branch_code }]),
        ).values(),
      );

  if (options.length <= 1 && !allBranches) return null;
  if (options.length === 0) return null;

  return (
    <select
      className="input py-1.5 text-xs max-w-[180px]"
      value={activeBranch ?? ""}
      onChange={(e) => {
        setBranch(e.target.value ? Number(e.target.value) : null);
        // Refetch every list under the new X-Branch-Id in place — no reload.
        qc.invalidateQueries();
      }}
      title="Switch branch"
    >
      {allBranches && <option value="">All branches</option>}
      {options.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
    </select>
  );
}

function NotificationBell() {
  const nav = useNavigate();
  const { canAccess } = useApp();
  const toast = useToast();
  const { data } = useQuery({
    queryKey: ["notif-count"],
    queryFn: async () => (await api.get<{ count: number; alerts: Alert[] }>("/notifications/")).data,
    refetchInterval: 15000,
    enabled: canAccess("notifications"),
  });

  // Pop a toast for whatever's genuinely NEW since the last poll — the point
  // is the right person notices "chicken request approved, go issue it" the
  // moment it happens, without having to sit on the Notifications screen.
  // `seen` starts as null so the first load just establishes a baseline
  // instead of replaying every pre-existing alert as a fresh toast.
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!data) return;
    const keyOf = (a: Alert) => `${a.severity}|${a.module}|${a.title}|${a.detail}`;
    if (seen.current === null) {
      seen.current = new Set(data.alerts.map(keyOf));
      return;
    }
    for (const a of data.alerts) {
      const key = keyOf(a);
      if ((a.severity === "warning" || a.severity === "critical") && !seen.current.has(key)) {
        const route = NOTIFICATION_ROUTES[a.module];
        toast(
          a.detail ? `${a.title} · ${a.detail}` : a.title,
          a.severity === "critical" ? "error" : "info",
          route ? () => nav(route) : undefined,
        );
      }
    }
    seen.current = new Set(data.alerts.map(keyOf));
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!canAccess("notifications")) return null;
  const count = data?.count ?? 0;
  return (
    <button
      data-tour="header-notifications"
      onClick={() => nav("/notifications")}
      className="relative p-2 rounded-lg hover:bg-hairline/60 text-body"
      title="Notifications"
      aria-label="Notifications"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M6 9a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M10 19a2 2 0 004 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
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
  const { user, property, canAccess, logout, justLoggedIn, clearJustLoggedIn } = useApp();
  const location = useLocation();
  const [open, setOpen] = useState(true);       // desktop: expanded vs rail
  const [mobileOpen, setMobileOpen] = useState(false); // mobile: drawer open
  const [hover, setHover] = useState<{ label: string; y: number } | null>(null);
  const [welcomeName, setWelcomeName] = useState<string | null>(null);
  const online = useOnlineStatus();
  const navInputRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  // First-login onboarding tour: auto-runs once per username, replayable
  // anytime via the header "?" button regardless of the seen-flag.
  const [tourRun, setTourRun] = useState(false);
  useEffect(() => {
    if (!user) return;
    try {
      const seen = JSON.parse(localStorage.getItem(`hearth_tour_seen_${user.username}`) || "null");
      if (!seen?.finishedAt) setTourRun(true);
    } catch {
      setTourRun(true);
    }
  }, [user?.username]); // eslint-disable-line react-hooks/exhaustive-deps

  // Greet whoever just signed in, by name, right on their landing screen —
  // fires once per login (not on every page refresh, since justLoggedIn only
  // flips true from an actual login() call). Skipped on someone's very first
  // login since the onboarding tour above already opens with its own
  // "Welcome, {role}" step — two welcomes stacking at once would be clutter.
  // A top banner (not the bottom auto-dismissing Toast) so it reads as a
  // proper greeting instead of a passing notification — stays until the
  // user dismisses it or signs out.
  useEffect(() => {
    if (!justLoggedIn || !user) return;
    let tourAlreadySeen = false;
    try {
      tourAlreadySeen = !!JSON.parse(localStorage.getItem(`hearth_tour_seen_${user.username}`) || "null")?.finishedAt;
    } catch { /* corrupted flag — treat as first login */ }
    if (tourAlreadySeen) {
      setWelcomeName(user.name?.split(" ")[0] || user.name);
    }
    clearJustLoggedIn();
  }, [justLoggedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Browser-tab title follows the screen (longest path prefix wins, so
  // /store/materials resolves to "Raw Material Master", not "Store Dashboard").
  useEffect(() => {
    const item = NAV.flatMap((g) => g.items)
      .slice()
      .sort((a, b) => b.path.length - a.path.length)
      .find((i) => i.path === location.pathname || location.pathname.startsWith(i.path + "/"));
    document.title = item ? `${item.label} · Hearth` : "Hearth — Hotel & Restaurant OS";
  }, [location.pathname]);

  // Fresh screen starts at the top (main is the scroll container).
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [location.pathname]);

  // Ctrl/Cmd+K jumps to the sidebar quick-find from anywhere.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        if (window.matchMedia("(max-width: 767px)").matches) setMobileOpen(true);
        requestAnimationFrame(() => navInputRef.current?.focus());
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // Hamburger: on phones/tablets toggle the drawer; on desktop toggle the rail.
  const toggleNav = () =>
    window.matchMedia("(max-width: 767px)").matches
      ? setMobileOpen((v) => !v)
      : setOpen((v) => !v);

  const groups = NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => canAccess(i.module ?? i.key)),
  })).filter((g) => g.items.length > 0);

  // Accordion default: collapse everything for big menus (MD/GM) so it's tidy;
  // for small menus (≤2 groups, e.g. Housekeeping) collapsing isn't needed — open all.
  // Remembered across sessions so nobody re-opens their usual groups every morning.
  const NAV_STATE = "hearth_nav_open_v2";
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(NAV_STATE) || "null");
      if (saved && typeof saved === "object") return saved;
    } catch { /* corrupted — fall through to defaults */ }
    return groups.length <= 2 ? Object.fromEntries(groups.map((g) => [g.title, true])) : {};
  });
  useEffect(() => {
    localStorage.setItem(NAV_STATE, JSON.stringify(openGroups));
  }, [openGroups]);
  // Wherever you land (deep link, refresh, cross-module jump), the group that
  // owns the current screen opens itself — no hunting for which section it's in.
  useEffect(() => {
    const here = groups.find((g) => g.items.some(
      (i) => i.path === location.pathname || location.pathname.startsWith(i.path + "/"),
    ));
    if (here) setOpenGroups((s) => (s[here.title] ? s : { ...s, [here.title]: true }));
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggleGroup = (t: string) => setOpenGroups((s) => ({ ...s, [t]: !s[t] }));

  // Quick find: type to filter the whole menu; matches show expanded.
  const [navQuery, setNavQuery] = useState("");
  const q = navQuery.trim().toLowerCase();
  const visibleGroups = q
    ? groups
        .map((g) => ({
          ...g,
          items: g.title.toLowerCase().includes(q)
            ? g.items
            : g.items.filter((i) => i.label.toLowerCase().includes(q)),
        }))
        .filter((g) => g.items.length > 0)
    : groups;

  return (
    <div className="flex h-full">
      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-ink/40 z-30 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar — off-canvas drawer on mobile, static rail/expanded on desktop */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-60 transform transition-transform duration-200
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          md:static md:z-auto md:translate-x-0 md:transition-[width]
          ${open ? "md:w-60" : "md:w-[68px]"}
          shrink-0 bg-ink text-white flex flex-col overflow-hidden`}
      >
        <div className={`flex items-center gap-3 py-5 ${open ? "px-5" : "px-0 justify-center"}`}>
          {property?.logo
            ? <img src={property.logo} alt="" className="h-9 w-9 rounded-[28%] object-cover bg-white/10 shrink-0" />
            : <Logo size={34} />}
          {open && (
            <div className="min-w-0">
              <div className="font-display text-lg leading-tight truncate">{property?.name || "Hearth"}</div>
              <div className="text-[9px] tracking-[0.16em] text-white/40 mt-0.5">POWERED BY HEARTH</div>
            </div>
          )}
        </div>

        {open ? (
          /* Expanded — collapsible groups, with a zone divider whenever the
             zone changes between consecutive VISIBLE groups (a role missing
             a zone's lead group still gets the divider ahead of whichever
             group of that zone it sees first). */
          <nav className="flex-1 overflow-y-auto px-3 pb-4">
            {groups.length > 2 && (
              <div className="px-1 pb-2 relative">
                <input
                  ref={navInputRef}
                  value={navQuery}
                  onChange={(e) => setNavQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Escape" && setNavQuery("")}
                  placeholder="Find a screen…"
                  aria-label="Find a screen"
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 pr-12 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/25"
                />
                <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/30 border border-white/15 rounded px-1 py-0.5 pointer-events-none">
                  Ctrl K
                </kbd>
              </div>
            )}
            {q && visibleGroups.length === 0 && (
              <div className="px-3 py-2 text-sm text-white/40">Nothing matches "{navQuery}"</div>
            )}
            {visibleGroups.map((g, idx) => {
              const expanded = q ? true : (openGroups[g.title] ?? false);
              const showZone = g.zone !== visibleGroups[idx - 1]?.zone;
              return (
                <div key={g.title}>
                  {showZone && (
                    <div className={`px-3 pb-1 text-[10px] uppercase tracking-widest text-white/30 font-semibold ${
                      idx === 0 ? "pt-1" : "pt-4 mt-1 border-t border-white/10"}`}>
                      {g.zone}
                    </div>
                  )}
                  <div className="mb-1.5">
                  <button
                    data-tour={`navgroup-${g.title}`}
                    onClick={() => toggleGroup(g.title)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] uppercase tracking-wider font-semibold text-white/50 hover:bg-white/5"
                  >
                    <span className="text-white/70"><NavIcon name={g.items[0].key} /></span>
                    <span className="flex-1 text-left">{g.title}</span>
                    <Chevron open={expanded} />
                  </button>
                  {expanded && (
                    <div className="mt-0.5 ml-2 pl-2 border-l border-white/10">
                      {g.items.map((i) => (
                        <NavLink
                          key={i.key}
                          to={i.path}
                          // "/store" is a prefix of every Store screen — require an
                          // exact match so Dashboard doesn't stay lit on all of them.
                          end={i.path === "/store"}
                          onClick={() => { setMobileOpen(false); setNavQuery(""); }}
                          className={({ isActive }) =>
                            `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                              isActive ? "bg-pine text-white font-medium" : "text-white/70 hover:bg-white/5 hover:text-white"
                            }`
                          }
                        >
                          <span className="shrink-0"><NavIcon name={i.key} /></span>
                          <span className="flex-1">{i.label}</span>
                        </NavLink>
                      ))}
                    </div>
                  )}
                  </div>
                </div>
              );
            })}
          </nav>
        ) : (
          /* Collapsed — one icon per main heading (group); hover shows its name */
          <nav className="flex-1 overflow-y-auto py-2 flex flex-col items-center gap-1.5">
            {groups.map((g, idx) => {
              const activeHere = g.items.some((i) => i.path === location.pathname);
              const showZone = idx > 0 && g.zone !== groups[idx - 1]?.zone;
              return (
                <div key={g.title} className="contents">
                  {showZone && <div className="w-7 border-t border-white/10 my-0.5" />}
                  <button
                    onMouseEnter={(e) => setHover({ label: g.title, y: e.currentTarget.getBoundingClientRect().top })}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => { setOpen(true); setOpenGroups((s) => ({ ...s, [g.title]: true })); }}
                    className={`grid place-items-center h-10 w-10 rounded-lg transition-colors ${
                      activeHere ? "bg-pine text-white" : "text-white/75 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <NavIcon name={g.items[0].key} />
                  </button>
                </div>
              );
            })}
          </nav>
        )}

        <div className={`border-t border-white/10 ${open ? "p-4 flex items-center gap-3" : "py-3 flex flex-col items-center gap-2"}`}>
          <div className="h-9 w-9 rounded-full bg-pine/90 flex items-center justify-center text-sm font-bold shrink-0" title={user?.name}>
            {user?.name?.split(" ").map((w) => w[0]).slice(0, 2).join("")}
          </div>
          {open && (
            <div className="min-w-0 flex-1">
              <div className="text-sm truncate">{user?.name}</div>
              <div className="text-[11px] text-white/45 truncate">{user?.role}</div>
            </div>
          )}
          <button onClick={logout} className="text-white/50 hover:text-white p-1" title="Sign out" aria-label="Sign out">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a1 1 0 011 1v16a1 1 0 01-1 1h-4M10 17l5-5-5-5M15 12H3" />
            </svg>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main ref={mainRef} className="flex-1 overflow-y-auto flex flex-col">
        <header className="flex items-center gap-3 px-6 py-3 border-b border-hairline bg-surface/80 backdrop-blur sticky top-0 z-10">
          <button
            onClick={toggleNav}
            className="p-2 -ml-2 rounded-lg hover:bg-hairline/60 text-body"
            title="Toggle menu"
            aria-label="Toggle navigation"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="text-sm text-muted truncate">
            {property?.name}
            {property?.business_date && <span className="ml-2 text-xs hidden sm:inline">· business date {fmtDate(property.business_date)}</span>}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="pill bg-pine-50 text-pine capitalize hidden sm:inline-flex">{property?.edition} edition</span>
            <BranchSwitcher />
            <NotificationBell />
            <button
              data-tour="header-help"
              onClick={() => setTourRun(true)}
              className="p-2 rounded-lg hover:bg-hairline/60 text-body"
              title="Replay tour"
              aria-label="Replay product tour"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.5 9a2.5 2.5 0 015 .5c0 1.5-2 2-2.5 3.2M12 17h.01" />
                <circle cx="12" cy="12" r="9" />
              </svg>
            </button>
          </div>
        </header>
        {welcomeName && (
          <div className="flex justify-center py-2 sticky top-[57px] z-10">
            <div className="flex items-center gap-2 bg-success-50 text-success text-sm font-semibold px-4 py-1.5 rounded-full shadow-sm">
              <span>Welcome, {welcomeName}!</span>
              <button
                onClick={() => setWelcomeName(null)}
                aria-label="Dismiss welcome banner"
                className="text-xs font-medium text-success/70 hover:text-success hover:underline underline-offset-2"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        {!online && (
          <div className={`bg-amber text-white text-xs font-semibold text-center py-1.5 sticky z-10 ${welcomeName ? "top-[100px]" : "top-[57px]"}`}>
            You're offline — changes will sync when you're back online
          </div>
        )}
        {/* Workstation screens (POS / KDS / online-order board) and the Store's
            table-heavy screens use the full width; reading/admin pages stay
            capped for comfortable line lengths. */}
        <div
          className={`mx-auto w-full px-4 md:px-8 py-6 md:py-8 ${
            ["/pos", "/kds", "/online-orders", "/reports"].includes(location.pathname)
              || location.pathname.startsWith("/store")
              || location.pathname.startsWith("/recipes")
              || location.pathname === "/inventory"
              || location.pathname === "/config/roles"
              ? "" : "max-w-[1180px]"
          }`}
        >
          <ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary>
        </div>
      </main>

      {/* Instant name tooltip for the collapsed icon rail */}
      {!open && hover && (
        <div
          className="fixed z-50 bg-ink text-white text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-pop pointer-events-none whitespace-nowrap"
          style={{ left: 74, top: hover.y + 4 }}
        >
          {hover.label}
        </div>
      )}

      <ProductTour
        run={tourRun}
        onDone={() => {
          setTourRun(false);
          if (user) {
            localStorage.setItem(
              `hearth_tour_seen_${user.username}`,
              JSON.stringify({ finishedAt: Date.now() }),
            );
          }
        }}
      />
    </div>
  );
}
