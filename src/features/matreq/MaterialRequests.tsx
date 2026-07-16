import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useToast } from "../../design/Toast";
import { Badge, Card, EmptyState, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { useApp } from "../../lib/app-context";

interface Req {
  id: number;
  department: string;
  requested_by: string;
  status: string;
  lines: { ingredient: string; qty: string }[];
  approver_roles: string[];
}
interface IngredientOpt { id: number; name: string; unit: string; current_stock: string }

const TONE: Record<string, "info" | "amber" | "pine"> = {
  requested: "info",
  approved: "amber",
  issued: "pine",
};
const NEXT_LABEL: Record<string, string> = { requested: "Approve", approved: "Issue (deduct stock)" };
// Universal overrides — every department already lists these; strip them
// out of the on-card hint so it reads as the SPECIFIC approver, not the noise.
const UNIVERSAL_APPROVERS = ["General Manager", "Managing Director", "Super Admin"];
// Mirrors the backend's DEPARTMENT_APPROVERS, for the "who approves this"
// hint while composing a new request (before the API has assigned an id).
// Hotel Manager approves Housekeeping/Banquets/Front-Office-supplies — Front
// Office is the only role that would raise those, so it can't also sign off
// on them (same rule that keeps Restaurant Manager off Kitchen/Bar).
const DEPT_APPROVER_LABEL: Record<string, string> = {
  Kitchen: "Restaurant Manager", Bar: "Restaurant Manager",
  Housekeeping: "Hotel Manager", Maintenance: "Housekeeping",
  Banquets: "Hotel Manager", "Front Office": "Hotel Manager",
};
// A role can't raise a request for a department it also approves — that's
// the exact bug the user caught (Restaurant Manager requesting Kitchen stock
// and being the only one who could then approve it). Mirrors the backend's
// role_can_request_department; GM/MD/Super Admin are exempt.
const UNIVERSAL_ROLE_NAMES = ["Super Admin", "Managing Director", "General Manager"];
// CEO sees the same full "every department, every status" oversight list as
// the universal roles (mirrors the backend's INDENT_OVERSIGHT_ROLES) — but
// CEO is deliberately left OUT of UNIVERSAL_ROLE_NAMES/ISSUER_ROLES, so
// canAdvance() below never shows CEO an Approve/Issue button. Visibility,
// not authority.
const OVERSIGHT_ROLE_NAMES = [...UNIVERSAL_ROLE_NAMES, "CEO"];
function roleCanRequestDepartment(role: string, department: string): boolean {
  if (UNIVERSAL_ROLE_NAMES.includes(role)) return true;
  return DEPT_APPROVER_LABEL[department] !== role;
}
// Mirrors the backend's INDENT_ISSUER_ROLES — only stock custodians issue.
const ISSUER_ROLES = ["Super Admin", "Managing Director", "General Manager",
  "Restaurant Manager", "Store Keeper"];
// Roles that approve or issue for AT LEAST ONE department — their natural
// home screen is the queue of work waiting on them, not their own requests.
// Front Office is NOT here — it only requests (Housekeeping/Banquets/its own
// supplies), Hotel Manager approves those.
const APPROVER_CAPABLE_ROLES = new Set([
  "Super Admin", "Managing Director", "General Manager",
  "Restaurant Manager", "Hotel Manager", "Housekeeping", "Store Keeper",
]);

type Tab = "queue" | "mine";

export function MaterialRequests() {
  const qc = useQueryClient();
  const toast = useToast();
  const { user } = useApp();
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<Tab>(
    () => (user && (APPROVER_CAPABLE_ROLES.has(user.role) || OVERSIGHT_ROLE_NAMES.includes(user.role))
      ? "queue" : "mine"));

  // Can THIS user actually move this indent forward? (server already scopes
  // the queue to items that are actionable, but this still guards the
  // self-requested edge case where the same universal-approver role raised
  // the indent — the button shouldn't invite a doomed click.)
  function canAdvance(r: Req) {
    if (!user) return false;
    if (r.status === "requested") {
      return r.approver_roles.includes(user.role) && r.requested_by !== user.username;
    }
    if (r.status === "approved") {
      return ISSUER_ROLES.includes(user.role);
    }
    return false;
  }

  const { data, isLoading } = useQuery({
    queryKey: ["matreq", tab],
    queryFn: async () => (await api.get<Req[]>(`/material-requests/?view=${tab}`)).data,
  });

  const advance = useMutation({
    mutationFn: async (r: Req) => (await api.post(`/material-requests/${r.id}/advance/`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matreq"] });
      qc.invalidateQueries({ queryKey: ["ingredients"] });
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not advance", "error"),
  });

  return (
    <div>
      <PageHeader
        title="Material Requests"
        subtitle="Departmental indents · Requested → Approved → Issued (issues deduct store stock)"
        action={
          <button className="btn-primary text-sm" onClick={() => setCreating(true)}>
            + Request materials
          </button>
        }
      />

      {creating && (
        <NewRequestModal
          role={user?.role ?? ""}
          onDone={(department) => {
            setCreating(false);
            const who = DEPT_APPROVER_LABEL[department] ?? "a manager";
            toast(`Indent raised — awaiting approval by ${who}`);
            qc.invalidateQueries({ queryKey: ["matreq"] });
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      {/* Segregated by design: nobody sees every department's indents dumped
          together. "My requests" tracks what YOU raised. The other tab is
          "Approval queue" for department-scoped roles (only what's waiting
          on your desk), but "All requests" for Super Admin/MD/GM (universal
          approvers+issuers) and CEO (oversight-only, see OVERSIGHT_ROLE_NAMES
          above) — full property, every department, every status. */}
      {(() => {
        const isOversight = !!user && OVERSIGHT_ROLE_NAMES.includes(user.role);
        return (
          <div className="flex gap-6 mb-5 border-b border-hairline">
            {([
              { key: "queue" as const, label: isOversight ? "All requests" : "Approval queue" },
              { key: "mine" as const, label: "My requests" },
            ]).map((t) => {
              const active = tab === t.key;
              return (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`relative pb-2.5 text-sm font-semibold transition-colors ${
                    active ? "text-ink" : "text-muted hover:text-body"}`}>
                  {t.label}
                  {active && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-pine rounded-full" />}
                </button>
              );
            })}
          </div>
        );
      })()}

      {isLoading ? <Spinner /> : !data?.length ? (
        <EmptyState
          title={tab === "queue"
            ? (user && OVERSIGHT_ROLE_NAMES.includes(user.role) ? "No indents raised yet" : "Nothing awaiting your approval")
            : "You haven't raised any indents"}
          hint={tab === "queue"
            ? "Requests from departments you approve (or that are ready to issue) will show up here."
            : "Use \"+ Request materials\" to raise one."}
        />
      ) : (
        <div className="space-y-3">
          {data.map((r) => (
            <Card key={r.id}>
              <div className="flex items-center gap-3">
                <div className="font-semibold">Indent #{r.id}</div>
                <span className="text-sm text-muted">{r.department}{r.requested_by ? ` · by ${r.requested_by}` : ""}</span>
                <Badge tone={TONE[r.status] ?? "muted"}>{r.status}</Badge>
                {r.status === "requested" && (
                  <span className="text-xs text-muted">
                    needs: {(r.approver_roles.filter((role) => !UNIVERSAL_APPROVERS.includes(role)).join(", "))
                      || r.approver_roles.join(", ")}
                  </span>
                )}
                {r.status === "approved" && (
                  <span className="text-xs text-muted">awaiting the store keeper to issue</span>
                )}
                {NEXT_LABEL[r.status] && canAdvance(r) && (
                  <button className="btn-outline ml-auto" onClick={() => advance.mutate(r)}>
                    {NEXT_LABEL[r.status]}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-8 mt-3 text-sm pl-1">
                {r.lines.map((l, i) => (
                  <div key={i} className="flex justify-between border-b border-line py-1">
                    <span>{l.ingredient}</span>
                    <span className="text-muted">{Number(l.qty)}</span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

interface DraftLine { ingredient: number | null; qty: string }
const EMPTY: DraftLine = { ingredient: null, qty: "" };
// Fallback until the department master loads (it seeds with these six).
const DEFAULT_DEPARTMENTS = ["Kitchen", "Bar", "Housekeeping", "Banquets", "Front Office", "Maintenance"];

function NewRequestModal({ role, onDone, onCancel }: {
  role: string; onDone: (department: string) => void; onCancel: () => void;
}) {
  const toast = useToast();
  // Departments come from the master (Settings > Masters) — a department
  // added there is immediately requestable; its indents route to GM/MD/
  // Super Admin unless it has a dedicated approver.
  const { data: masterDepts } = useQuery({
    queryKey: ["master-departments"],
    queryFn: async () =>
      (await api.get<{ name: string; active: boolean }[]>("/masters/departments/")).data,
  });
  const departments = masterDepts?.length
    ? masterDepts.filter((d) => d.active).map((d) => d.name)
    : DEFAULT_DEPARTMENTS;
  // Hide departments this role would only be able to raise and never see
  // approved (it's the department's own approver) — matches the backend.
  const selectable = departments.filter((d) => roleCanRequestDepartment(role, d));
  const [department, setDepartment] = useState(selectable[0] ?? departments[0]);
  const [lines, setLines] = useState<DraftLine[]>([{ ...EMPTY }]);

  // Scoped picklist (not /inventory/ — most roles that can raise an indent
  // don't have the full Inventory & Stock module).
  const { data: materials } = useQuery({
    queryKey: ["matreq-materials"],
    queryFn: async () => (await api.get<IngredientOpt[]>("/material-requests/materials/")).data,
  });

  const setLine = (i: number, patch: Partial<DraftLine>) =>
    setLines(lines.map((l, ix) => (ix === i ? { ...l, ...patch } : l)));
  const valid = lines.filter((l) => l.ingredient && Number(l.qty) > 0);

  const save = useMutation({
    mutationFn: async () => (await api.post("/material-requests/", {
      department,
      lines: valid.map((l) => ({ ingredient: l.ingredient, qty: l.qty })),
    })).data,
    onSuccess: () => onDone(department),
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not raise the indent", "error"),
  });

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="card p-5 w-[480px] max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="font-display text-xl mb-1">Request materials</div>
        <div className="text-sm text-muted mb-3">
          Raised in your name — <b>{DEPT_APPROVER_LABEL[department] ?? "a manager"}</b> approves it,
          then the store keeper issues the stock.
        </div>
        <select className="input mb-3" value={department} onChange={(e) => setDepartment(e.target.value)}>
          {selectable.map((d) => <option key={d}>{d}</option>)}
        </select>
        {!selectable.length && (
          <div className="text-xs text-clay mb-3">
            You approve every department — ask someone on the floor to raise this one instead.
          </div>
        )}
        <div className="space-y-2 overflow-y-auto flex-1">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_100px_32px] gap-2 items-center">
              <select className="input" value={l.ingredient ?? ""}
                onChange={(e) => setLine(i, { ingredient: Number(e.target.value) || null })}>
                <option value="">Pick a material…</option>
                {materials?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {Number(m.current_stock)} {m.unit} in store
                  </option>
                ))}
              </select>
              <input className="input" inputMode="decimal" placeholder="Qty"
                value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} />
              <button className="btn-ghost text-clay text-sm"
                onClick={() => setLines(lines.length > 1 ? lines.filter((_, ix) => ix !== i) : [{ ...EMPTY }])}>
                ✕
              </button>
            </div>
          ))}
        </div>
        <button className="btn-outline text-xs mt-2" onClick={() => setLines([...lines, { ...EMPTY }])}>
          ＋ Add line
        </button>
        <div className="flex gap-2 mt-4">
          <button className="btn-ghost flex-1" onClick={onCancel}>Cancel</button>
          <button className="btn-primary flex-1" disabled={!valid.length || !selectable.length || save.isPending}
            onClick={() => save.mutate()}>
            Raise indent
          </button>
        </div>
      </div>
    </div>
  );
}
