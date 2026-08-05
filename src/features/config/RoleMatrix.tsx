import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { Fragment, useEffect, useState } from "react";

import { useToast } from "../../design/Toast";
import { Card, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { NAV } from "../../lib/modules";

interface RoleMeta {
  role: string;
  is_system: boolean;
  rank: number;
  behaves_as: string;
  users: number;
  active: boolean;
}

interface Matrix {
  roles: string[];
  matrix: { module: string; cells: boolean[] }[];
  meta?: RoleMeta[];
  protected: string[];
  my_role?: string;
}

/** What each rank means, in the words the owner would use. */
const RANK_LABEL: Record<number, string> = {
  4: "Owner",
  3: "Executive",
  2: "Manager",
  1: "Staff",
  0: "Retired",
};

// Readable names for module keys that aren't top-level nav items.
const EXTRA_LABELS: Record<string, string> = {
  checkin: "Check-In",
  execdashboard: "Executive Overview",
};

/** Create a role of the property's own.
 *
 *  "Based on" is the load-bearing field: it decides the rules the new role
 *  plays by (what it may approve, which tenders it may take, whether it runs
 *  the bar or the restaurant floor) and pre-fills its screens. Everything
 *  after that is a normal edit in the grid below. */
function NewRoleModal({ meta, onClose, onCreated }: {
  meta: RoleMeta[]; onClose: () => void; onCreated: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [base, setBase] = useState("");
  const [description, setDescription] = useState("");
  // Only the built-ins are valid templates — a custom role is already one of
  // them underneath, so basing one on another would just add indirection.
  const bases = meta.filter((m) => m.is_system && m.active);
  const chosen = bases.find((b) => b.role === base);

  const create = useMutation({
    mutationFn: async () => (await api.post("/auth/roles/", {
      name: name.trim(), base_role: base, rank: chosen?.rank ?? 1,
      description: description.trim(), modules: [],
    })).data,
    onSuccess: async (row: { id: number }) => {
      // Start it with its base's screens: the owner tweaks from there rather
      // than ticking twenty boxes from nothing.
      const src = await api.get<{ role: string; modules: string[] | "*" }[]>(
        "/auth/users/assignable-roles/");
      const template = src.data.find((r) => r.role === base);
      if (template && template.modules !== "*") {
        await api.patch(`/auth/roles/${row.id}/`, { modules: template.modules });
      }
      toast(`${name.trim()} created — tick its screens below`);
      onCreated();
    },
    onError: (e: any) => toast(
      e?.response?.data?.detail ?? e?.response?.data?.name?.[0] ?? "Could not create this role",
      "error"),
  });

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="card p-5 w-full max-w-[460px]" onClick={(e) => e.stopPropagation()}>
        <div className="font-display text-xl mb-1">New role</div>
        <div className="text-sm text-muted mb-4">
          A role of your own — "Night Manager", "Floor Supervisor". It inherits the rules of the
          role you base it on, and starts with that role's screens for you to adjust.
        </div>

        <label className="block mb-3">
          <span className="text-xs text-muted uppercase tracking-wide">Name</span>
          <input className="input mt-1" value={name} autoFocus
            onChange={(e) => setName(e.target.value)} placeholder="Night Manager" />
        </label>

        <label className="block mb-3">
          <span className="text-xs text-muted uppercase tracking-wide">Based on</span>
          <select className="input mt-1" value={base} onChange={(e) => setBase(e.target.value)}>
            <option value="">Choose the role it behaves like…</option>
            {bases.map((b) => (
              <option key={b.role} value={b.role}>
                {b.role} · {RANK_LABEL[b.rank] ?? b.rank}
              </option>
            ))}
          </select>
        </label>

        <label className="block mb-4">
          <span className="text-xs text-muted uppercase tracking-wide">Description <span className="opacity-70">· optional</span></span>
          <input className="input mt-1" value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Runs the front desk on the night shift" />
        </label>

        {chosen && (
          <div className="text-xs text-muted mb-4">
            Approvals, tenders and floor rules will follow <b>{chosen.role}</b>. Its level
            ({RANK_LABEL[chosen.rank] ?? chosen.rank}) decides who is senior enough to hand this
            role out.
          </div>
        )}

        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1" disabled={!name.trim() || !base || create.isPending}
            onClick={() => create.mutate()}>
            {create.isPending ? "Creating…" : "Create role"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function RoleMatrix() {
  const qc = useQueryClient();
  const toast = useToast();
  const [fullScreen, setFullScreen] = useState(false);
  const [creating, setCreating] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["role-matrix"],
    queryFn: async () => (await api.get<Matrix>("/auth/roles/matrix/")).data,
  });

  // Escape exits full screen — a matrix this wide (every role × every
  // module) is the one screen in Settings worth reclaiming the sidebar
  // and header for, without needing the browser's own Fullscreen API.
  useEffect(() => {
    if (!fullScreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFullScreen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullScreen]);

  const toggle = useMutation({
    mutationFn: async (b: { role: string; module: string; allowed: boolean }) =>
      (await api.post("/auth/roles/matrix/", b)).data,
    onSuccess: () => refreshRoles(),
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not update", "error"),
  });

  // A role's screens are its mapping, so both halves of this screen — the
  // list of roles and the grid — read the same query.
  function refreshRoles() {
    qc.invalidateQueries({ queryKey: ["role-matrix"] });
    qc.invalidateQueries({ queryKey: ["assignable-roles"] });
  }

  const remove = useMutation({
    mutationFn: async (role: string) => {
      const rows = (await api.get<{ id: number; name: string }[]>("/auth/roles/")).data;
      const row = rows.find((r) => r.name === role);
      if (!row) throw new Error("not found");
      return (await api.delete(`/auth/roles/${row.id}/`)).data;
    },
    onSuccess: () => { toast("Role deleted"); refreshRoles(); },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not delete this role", "error"),
  });

  if (isLoading || !data) return <Spinner />;
  const d = data; // narrowed alias so nested components keep the non-null type

  const isProtected = (role: string) => d.protected.includes(role);
  const cellsOf = (module: string) => d.matrix.find((m) => m.module === module)?.cells ?? [];
  const labelOf = (key: string) =>
    NAV.flatMap((g) => g.items).find((i) => i.key === key)?.label ?? EXTRA_LABELS[key] ?? key;

  // Present modules grouped by nav area (with readable labels); anything the
  // backend exposes that isn't in the nav falls into a trailing "Other" group.
  const grouped = NAV.map((g) => ({
    title: g.title,
    color: g.color,
    modules: g.items.map((i) => i.key).filter((k) => data.matrix.some((m) => m.module === k)),
  })).filter((g) => g.modules.length);
  const covered = new Set(grouped.flatMap((g) => g.modules));
  const leftover = data.matrix.map((m) => m.module).filter((k) => !covered.has(k));
  if (leftover.length) grouped.push({ title: "Other", color: "#64748B", modules: leftover });

  function Cell({ module, roleIndex }: { module: string; roleIndex: number }) {
    const role = d.roles[roleIndex];
    const on = cellsOf(module)[roleIndex];
    if (isProtected(role)) {
      return (
        <span className="inline-flex h-6 w-6 items-center justify-center text-pine" title="Full access — not editable">✓</span>
      );
    }
    return (
      <button
        disabled={toggle.isPending}
        onClick={() => toggle.mutate({ role, module, allowed: !on })}
        title={on ? "Allowed — click to revoke" : "Blocked — click to grant"}
        className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-semibold transition-colors ${
          on ? "bg-pine text-white hover:bg-pine-700"
             : "bg-hairline text-muted hover:bg-clay/20 hover:text-clay"
        }`}
      >
        {on ? "✓" : "–"}
      </button>
    );
  }

  const metaOf = (role: string) => d.meta?.find((m) => m.role === role);

  const fullScreenButton = (
    <div className="flex gap-2">
      {!fullScreen && (
        <button className="btn-primary text-sm" onClick={() => setCreating(true)}>+ New role</button>
      )}
      <button className="btn-outline text-sm" onClick={() => setFullScreen((v) => !v)}>
        {fullScreen ? "✕ Exit full screen" : "⛶ Full screen"}
      </button>
    </div>
  );

  /** The roles themselves, before the grid of what they open: who is senior to
   *  whom, which built-in each custom role behaves as, and how many people a
   *  change here would actually affect. */
  const roleList = d.meta && (
    <Card className="mb-4 overflow-x-auto">
      <div className="font-semibold mb-3">Roles</div>
      <table className="w-full text-sm min-w-[560px]">
        <thead className="text-muted text-xs uppercase">
          <tr>
            <th className="text-left py-2 pr-4">Role</th>
            <th className="text-left py-2 pr-4">Behaves as</th>
            <th className="text-left py-2 pr-4">Level</th>
            <th className="text-right py-2 pr-4">Screens</th>
            <th className="text-right py-2 pr-4">People</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {d.meta.map((m) => {
            const allow = d.matrix.filter((row) => row.cells[d.roles.indexOf(m.role)]).length;
            return (
              <tr key={m.role} className={`border-t border-line ${m.active ? "" : "opacity-50"}`}>
                <td className="py-2 pr-4 font-medium">
                  {m.role}
                  {!m.is_system && <span className="pill bg-cream text-muted ml-2 text-[10px]">custom</span>}
                  {!m.active && <span className="pill bg-cream text-muted ml-2 text-[10px]">retired</span>}
                </td>
                <td className="py-2 pr-4 text-muted">{m.is_system ? "—" : m.behaves_as}</td>
                <td className="py-2 pr-4 text-muted">{RANK_LABEL[m.rank] ?? m.rank}</td>
                <td className="py-2 pr-4 text-right tabular-nums">
                  {isProtected(m.role) ? "all" : allow}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">{m.users}</td>
                <td className="py-2 text-right">
                  {!m.is_system && m.users === 0 && (
                    <button className="btn-ghost text-xs text-clay" disabled={remove.isPending}
                      onClick={() => remove.mutate(m.role)}>Delete</button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-xs text-muted mt-3">
        The built-in roles can't be renamed or deleted — the rest of Hearth reasons in those
        names — but you can change which screens each one opens, right below. A role you create
        behaves as the built-in you base it on (who it may approve, what it may tender) and
        opens whichever screens you tick.
      </p>
    </Card>
  );

  return (
    <div className={fullScreen ? "fixed inset-0 z-50 bg-cream px-4 md:px-8 py-6 overflow-auto" : undefined}>
      <PageHeader icon={<ShieldCheck size={20} />} title="Role Mapping" subtitle="What each role can open, grouped by area. Click a cell to grant or revoke."
        action={fullScreenButton} />

      {!fullScreen && roleList}

      {creating && (
        <NewRoleModal
          meta={d.meta ?? []}
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); refreshRoles(); }}
        />
      )}

      <div className="flex items-center gap-4 mb-3 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="inline-block h-4 w-4 rounded bg-pine" /> Allowed</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-4 w-4 rounded bg-hairline" /> Blocked</span>
        <span className="flex items-center gap-1.5"><span className="text-pine">✓</span> Full access (not editable)</span>
      </div>

      {/* Freeze panes: header row and module column stay pinned while the
          matrix scrolls in both directions inside this container. */}
      {/* !p-0: the card's default padding would leave a gap above the sticky
          header through which scrolled rows stay visible (freeze-pane overlap).
          Full screen reclaims the app sidebar/header, so the table gets most
          of the viewport instead of stopping short for chrome that's gone. */}
      <Card className={`overflow-auto !p-0 ${fullScreen ? "max-h-[calc(100vh-180px)]" : "max-h-[calc(100vh-230px)]"}`}>
        <div className="overflow-x-auto"><table className="text-sm border-separate border-spacing-0 min-w-full">
          <thead>
            <tr>
              <th className="text-left px-4 py-3 sticky left-0 top-0 z-30 bg-cream min-w-[210px] text-xs uppercase tracking-wide text-muted border-b border-r border-hairline">
                Module
              </th>
              {data.roles.map((r) => (
                <th key={r} className="px-3 py-3 text-center whitespace-nowrap sticky top-0 z-20 bg-cream border-b border-hairline">
                  <div className="font-semibold text-body">{r}</div>
                  {isProtected(r)
                    ? <div className="text-[10px] font-normal text-pine">full access</div>
                    : metaOf(r) && !metaOf(r)!.is_system && (
                        <div className="text-[10px] font-normal text-muted">
                          as {metaOf(r)!.behaves_as}
                        </div>
                      )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grouped.map((g) => (
              <Fragment key={g.title}>
                <tr>
                  <td className="px-4 pt-4 pb-1.5 sticky left-0 z-10 bg-surface border-r border-hairline whitespace-nowrap">
                    <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: g.color }} />
                      {g.title}
                    </span>
                  </td>
                  <td colSpan={data.roles.length} className="bg-surface" />
                </tr>
                {g.modules.map((module) => (
                  <tr key={module} className="group">
                    <td className="px-4 py-2 sticky left-0 z-10 bg-surface group-hover:bg-cream font-medium border-t border-r border-line whitespace-nowrap transition-colors">
                      {labelOf(module)}
                    </td>
                    {data.roles.map((_, i) => (
                      <td key={i} className="px-3 py-2 text-center border-t border-line group-hover:bg-cream/40 transition-colors">
                        <Cell module={module} roleIndex={i} />
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table></div>
      </Card>

      <p className="text-xs text-muted mt-3">
        Super Admin, Managing Director &amp; General Manager always have full access and can't be edited. Changes
        apply immediately, are enforced server-side on every request, and refresh each user's menu on
        next sign-in.
      </p>
    </div>
  );
}
