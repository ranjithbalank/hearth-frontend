import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment } from "react";

import { useToast } from "../../design/Toast";
import { Card, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { NAV } from "../../lib/modules";

interface Matrix {
  roles: string[];
  matrix: { module: string; cells: boolean[] }[];
  protected: string[];
}

// Readable names for module keys that aren't top-level nav items.
const EXTRA_LABELS: Record<string, string> = {
  checkin: "Check-In",
  execdashboard: "Executive Overview",
};

export function RoleMatrix() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ["role-matrix"],
    queryFn: async () => (await api.get<Matrix>("/auth/roles/matrix/")).data,
  });

  const toggle = useMutation({
    mutationFn: async (b: { role: string; module: string; allowed: boolean }) =>
      (await api.post("/auth/roles/matrix/", b)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["role-matrix"] }),
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not update", "error"),
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
  if (leftover.length) grouped.push({ title: "Other", color: "#8A8478", modules: leftover });

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

  return (
    <div>
      <PageHeader title="Role Mapping" subtitle="What each role can open, grouped by area. Click a cell to grant or revoke." />

      <div className="flex items-center gap-4 mb-3 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="inline-block h-4 w-4 rounded bg-pine" /> Allowed</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-4 w-4 rounded bg-hairline" /> Blocked</span>
        <span className="flex items-center gap-1.5"><span className="text-pine">✓</span> Full access (not editable)</span>
      </div>

      {/* Freeze panes: header row and module column stay pinned while the
          matrix scrolls in both directions inside this container. */}
      {/* !p-0: the card's default padding would leave a gap above the sticky
          header through which scrolled rows stay visible (freeze-pane overlap). */}
      <Card className="overflow-auto !p-0 max-h-[calc(100vh-230px)]">
        <table className="text-sm border-separate border-spacing-0 min-w-full">
          <thead>
            <tr>
              <th className="text-left px-4 py-3 sticky left-0 top-0 z-30 bg-cream min-w-[210px] text-xs uppercase tracking-wide text-muted border-b border-r border-hairline">
                Module
              </th>
              {data.roles.map((r) => (
                <th key={r} className="px-3 py-3 text-center whitespace-nowrap sticky top-0 z-20 bg-cream border-b border-hairline">
                  <div className="font-semibold text-body">{r}</div>
                  {isProtected(r) && <div className="text-[10px] font-normal text-pine">full access</div>}
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
        </table>
      </Card>

      <p className="text-xs text-muted mt-3">
        Super Admin, Managing Director &amp; General Manager always have full access and can't be edited. Changes
        apply immediately, are enforced server-side on every request, and refresh each user's menu on
        next sign-in.
      </p>
    </div>
  );
}
