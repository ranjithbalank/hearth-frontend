import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Card, Spinner } from "../../design/ui";
import { api } from "../../lib/api";

interface AuditRow {
  id: number; created_at: string; user: string; user_name: string;
  action: string; entity: string; entity_id: string;
  before: Record<string, unknown> | null; after: Record<string, unknown> | null;
  note: string;
}

/** Compact "field: old → new" rendering of a before/after pair. Fields that
 *  only exist on one side still show, with — on the missing side. */
function Diff({ before, after }: { before: AuditRow["before"]; after: AuditRow["after"] }) {
  if (!before && !after) return null;
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];
  const fmt = (v: unknown) =>
    v === undefined || v === null ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v);
  return (
    <div className="space-y-0.5">
      {keys.map((k) => {
        const b = before?.[k];
        const a = after?.[k];
        const changed = before && after && JSON.stringify(b) !== JSON.stringify(a);
        return (
          <div key={k} className="text-xs font-mono">
            <span className="text-muted">{k}:</span>{" "}
            {before && <span className={changed ? "text-clay line-through" : ""}>{fmt(b)}</span>}
            {before && after && <span className="text-muted"> → </span>}
            {after && <span className={changed ? "text-pine font-semibold" : ""}>{fmt(a)}</span>}
          </div>
        );
      })}
    </div>
  );
}

export function AuditLogPanel() {
  const [entity, setEntity] = useState("");
  const [q, setQ] = useState("");
  const { data: rows, isLoading } = useQuery({
    queryKey: ["audit-log", entity, q],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (entity) params.set("entity", entity);
      if (q) params.set("q", q);
      return (await api.get<AuditRow[]>(`/auth/audit/?${params}`)).data;
    },
  });
  const entities = [...new Set((rows ?? []).map((r) => r.entity).filter(Boolean))].sort();

  return (
    <Card>
      <div className="font-semibold mb-1">Audit log</div>
      <div className="text-sm text-muted mb-3">
        Who did what, when — with the values before and after. The trail is append-only:
        entries can never be edited or deleted, by anyone.
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        <select className="input w-48" value={entity} onChange={(e) => setEntity(e.target.value)}>
          <option value="">All record types</option>
          {entities.map((en) => <option key={en}>{en}</option>)}
        </select>
        <input className="input w-48" placeholder="Filter by username…" value={q}
          onChange={(e) => setQ(e.target.value)} />
      </div>
      {isLoading ? <Spinner /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-muted text-xs uppercase">
              <tr>
                <th className="text-left py-2 pr-3">When</th>
                <th className="text-left py-2 pr-3">Who</th>
                <th className="text-left py-2 pr-3">Action</th>
                <th className="text-left py-2 pr-3">Record</th>
                <th className="text-left py-2">Change</th>
              </tr>
            </thead>
            <tbody>
              {rows?.map((r) => (
                <tr key={r.id} className="border-t border-line align-top">
                  <td className="py-2 pr-3 whitespace-nowrap text-xs text-muted">
                    {new Date(r.created_at).toLocaleString("en-IN")}
                  </td>
                  <td className="py-2 pr-3 font-medium whitespace-nowrap">{r.user_name}</td>
                  <td className="py-2 pr-3"><span className="pill bg-hairline">{r.action}</span></td>
                  <td className="py-2 pr-3 whitespace-nowrap text-muted">
                    {r.entity}{r.entity_id && ` #${r.entity_id}`}
                  </td>
                  <td className="py-2">
                    <Diff before={r.before} after={r.after} />
                    {r.note && <div className="text-xs text-muted italic">{r.note}</div>}
                  </td>
                </tr>
              ))}
              {!rows?.length && (
                <tr><td colSpan={5} className="py-6 text-center text-muted text-sm">No entries match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
