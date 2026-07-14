import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useToast } from "../../design/Toast";
import { Badge, Card, EmptyState, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { useApp } from "../../lib/app-context";
import { fmtDate } from "../../lib/date";

interface LeaveTypeRow {
  id: number; name: string; annual_quota: number; is_paid: boolean;
  carry_forward: boolean; active: boolean;
}
interface BalanceRow extends LeaveTypeRow { used: number; pending: number; remaining: number | null }
interface LeaveReq {
  id: number; employee: number; employee_name: string; department: string;
  leave_type: number; leave_type_name: string; is_paid: boolean;
  start_date: string; end_date: string; days: number; reason: string;
  status: string; requested_by: string; manager_decided_by: string;
  decided_by: string; decision_note: string;
  /** whose desk it waits on right now — dept manager, then HR (final) */
  approver_roles: string[];
}
interface StaffOpt { id: number; name: string; department: string; role: string; has_login: boolean }

const TONE: Record<string, "info" | "amber" | "pine" | "clay" | "muted"> = {
  pending: "info", manager_approved: "amber", approved: "pine", rejected: "clay", cancelled: "muted",
};
const STATUS_LABEL: Record<string, string> = { manager_approved: "awaiting HR" };
// Universal overrides — strip them from the "needs" hint so it reads as the
// SPECIFIC approver (same trick as Material Requests).
const UNIVERSAL_APPROVERS = ["General Manager", "Managing Director", "Super Admin"];
// Mirrors the backend's two-level chain: department managers decide first
// (LEAVE_DEPARTMENT_APPROVERS), HR gives the final sign-off
// (LEAVE_FINAL_APPROVERS); GM/MD/Super Admin can act at both levels.
const APPROVER_ROLES = new Set([
  "Super Admin", "Managing Director", "General Manager",
  "Hotel Manager", "Restaurant Manager", "HR Manager",
]);
const OVERSIGHT_ROLES = new Set(["Super Admin", "Managing Director", "General Manager", "HR Manager", "CEO"]);
const TYPE_MANAGER_ROLES = new Set(["Super Admin", "Managing Director", "General Manager", "Admin", "HR Manager"]);

type Tab = "mine" | "queue" | "all" | "types";

export function Leave() {
  const qc = useQueryClient();
  const toast = useToast();
  const { user } = useApp();
  const role = user?.role ?? "";
  const canApprove = APPROVER_ROLES.has(role);
  const isOversight = OVERSIGHT_ROLES.has(role);
  const managesTypes = TYPE_MANAGER_ROLES.has(role);
  const [tab, setTab] = useState<Tab>(() => (canApprove ? "queue" : "mine"));
  const [applying, setApplying] = useState(false);

  const tabs: { key: Tab; label: string }[] = [
    { key: "mine", label: "My leave" },
    ...(canApprove ? [{ key: "queue" as const, label: "Approvals" }] : []),
    ...(isOversight ? [{ key: "all" as const, label: "All requests" }] : []),
    ...(managesTypes ? [{ key: "types" as const, label: "Leave types" }] : []),
  ];

  return (
    <div>
      <PageHeader
        title="Leave"
        subtitle="Apply · balances · department-manager approval"
        action={
          <button className="btn-primary text-sm" onClick={() => setApplying(true)}>
            + Apply for leave
          </button>
        }
      />

      {applying && (
        <ApplyModal
          onDone={(who) => {
            setApplying(false);
            toast(`Leave applied — awaiting ${who}`);
            qc.invalidateQueries({ queryKey: ["leave"] });
          }}
          onCancel={() => setApplying(false)}
        />
      )}

      <div className="flex gap-6 mb-5 border-b border-hairline">
        {tabs.map((t) => {
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

      {tab === "mine" && <MyLeave />}
      {tab === "queue" && <ApprovalQueue view="queue" />}
      {tab === "all" && <ApprovalQueue view="all" />}
      {tab === "types" && <TypesMaster />}
    </div>
  );
}

function MyLeave() {
  const { user } = useApp();
  const { data: bal } = useQuery({
    queryKey: ["leave", "balances"],
    queryFn: async () => (await api.get<{ employee: number | null; balances: BalanceRow[]; detail?: string }>(
      "/leave/balances/")).data,
  });
  const { data: mine, isLoading } = useQuery({
    queryKey: ["leave", "mine"],
    queryFn: async () => (await api.get<LeaveReq[]>("/leave/?view=mine")).data,
  });

  return (
    <>
      {bal && !bal.employee && (
        <Card className="mb-4 text-sm text-muted">{bal.detail}</Card>
      )}
      {!!bal?.balances.length && bal.employee && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {bal.balances.map((b) => (
            <Card key={b.id}>
              <div className="text-xs text-muted uppercase tracking-wide">{b.name}</div>
              <div className="font-display text-2xl mt-1">
                {b.remaining === null ? "∞" : b.remaining}
                {b.annual_quota ? <span className="text-sm text-muted font-body"> / {b.annual_quota}</span> : null}
              </div>
              <div className="text-xs text-muted mt-1">
                {b.used} used{b.pending ? ` · ${b.pending} pending` : ""} · {b.is_paid ? "paid" : "unpaid"}
              </div>
            </Card>
          ))}
        </div>
      )}

      {isLoading ? <Spinner /> : !mine?.length ? (
        <EmptyState title="No leave applications yet"
          hint={'Use "+ Apply for leave" — it routes to your department manager for approval.'} />
      ) : (
        <RequestList rows={mine} me={user?.username} />
      )}
    </>
  );
}

function ApprovalQueue({ view }: { view: "queue" | "all" }) {
  const { user } = useApp();
  const { data, isLoading } = useQuery({
    queryKey: ["leave", view],
    queryFn: async () => (await api.get<LeaveReq[]>(`/leave/?view=${view}`)).data,
  });
  if (isLoading) return <Spinner />;
  if (!data?.length) {
    return <EmptyState
      title={view === "all" ? "No leave requests yet" : "Nothing awaiting your approval"}
      hint={view === "all"
        ? "Every application across the property will show up here."
        : "Requests land here at your level: department first, then HR's final sign-off."} />;
  }
  // Decide buttons render in both views, but only on rows whose current
  // stage matches the viewer's role (and never on their own requests).
  return <RequestList rows={data} me={user?.username} showDecide />;
}

function RequestList({ rows, me, showDecide = false }: {
  rows: LeaveReq[]; me?: string; showDecide?: boolean;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const { user } = useApp();
  const canApprove = APPROVER_ROLES.has(user?.role ?? "");
  const isOversight = OVERSIGHT_ROLES.has(user?.role ?? "");

  const decide = useMutation({
    mutationFn: async ({ id, decision }: { id: number; decision: "approve" | "reject" }) =>
      (await api.post(`/leave/${id}/decide/`, { decision })).data,
    onSuccess: (r: LeaveReq) => {
      toast(r.status === "approved" ? "Final approved — attendance marked"
        : r.status === "manager_approved" ? "Approved — sent to HR for final sign-off"
        : "Rejected");
      qc.invalidateQueries({ queryKey: ["leave"] });
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not decide", "error"),
  });
  const cancel = useMutation({
    mutationFn: async (id: number) => (await api.post(`/leave/${id}/cancel/`)).data,
    onSuccess: () => {
      toast("Withdrawn");
      qc.invalidateQueries({ queryKey: ["leave"] });
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not cancel", "error"),
  });

  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const isMine = r.requested_by === me;
        const inPipeline = r.status === "pending" || r.status === "manager_approved";
        // approver_roles is stage-aware from the API: the department manager
        // while pending, HR (final) once manager-approved.
        const canDecideThis = showDecide && !isMine && inPipeline
          && r.approver_roles.includes(user?.role ?? "");
        const canCancelThis =
          (inPipeline && (isMine || canApprove || isOversight))
          || (r.status === "approved" && (canApprove || (isOversight && user?.role !== "CEO")));
        return (
          <Card key={r.id}>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="font-semibold">{r.employee_name}</div>
              <span className="text-sm text-muted">{r.department}</span>
              <Badge tone={TONE[r.status] ?? "muted"}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
              <span className="text-sm">
                {r.leave_type_name} · {r.start_date === r.end_date
                  ? fmtDate(r.start_date) : `${fmtDate(r.start_date)} → ${fmtDate(r.end_date)}`} · {r.days}d
              </span>
              {inPipeline && (
                <span className="text-xs text-muted">
                  needs: {(r.approver_roles.filter((a) => !UNIVERSAL_APPROVERS.includes(a)).join(", "))
                    || r.approver_roles.join(", ")}
                  {r.status === "manager_approved" ? " (final)" : ""}
                </span>
              )}
              <span className="ml-auto flex gap-2">
                {canDecideThis && (
                  <>
                    <button className="btn-primary text-sm"
                      onClick={() => decide.mutate({ id: r.id, decision: "approve" })}>
                      {r.status === "manager_approved" ? "Final approve" : "Approve"}
                    </button>
                    <button className="btn-outline text-sm text-clay"
                      onClick={() => decide.mutate({ id: r.id, decision: "reject" })}>
                      Reject
                    </button>
                  </>
                )}
                {canCancelThis && (
                  <button className="btn-ghost text-sm text-muted" onClick={() => cancel.mutate(r.id)}>
                    {r.status === "approved" ? "Cancel leave" : "Withdraw"}
                  </button>
                )}
              </span>
            </div>
            {(r.reason || r.manager_decided_by || r.decided_by || (isMine ? false : r.requested_by)) && (
              <div className="text-xs text-muted mt-2 pl-1">
                {r.reason && <span>“{r.reason}”</span>}
                {!isMine && r.requested_by && <span>{r.reason ? " · " : ""}filed by {r.requested_by}</span>}
                {r.manager_decided_by && <span> · manager: {r.manager_decided_by}</span>}
                {r.decided_by && <span> · {r.status} by {r.decided_by}</span>}
                {r.decision_note && <span> — {r.decision_note}</span>}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function ApplyModal({ onDone, onCancel }: { onDone: (who: string) => void; onCancel: () => void }) {
  const toast = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const [employee, setEmployee] = useState<number | "">("");
  const [leaveType, setLeaveType] = useState<number | "">("");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [reason, setReason] = useState("");

  const { data: types } = useQuery({
    queryKey: ["leave", "types"],
    queryFn: async () => (await api.get<LeaveTypeRow[]>("/leave/types/")).data,
  });
  // Non-empty only for HR / the departments' managers — everyone else
  // applies for themselves.
  const { data: staff } = useQuery({
    queryKey: ["leave", "staff"],
    queryFn: async () => (await api.get<StaffOpt[]>("/leave/staff/")).data,
  });

  const days = (() => {
    const a = new Date(start), b = new Date(end);
    const d = Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
    return Number.isFinite(d) && d > 0 ? d : 0;
  })();

  const save = useMutation({
    mutationFn: async () => (await api.post("/leave/", {
      ...(employee ? { employee } : {}),
      leave_type: leaveType, start_date: start, end_date: end, reason,
    })).data,
    onSuccess: (r: LeaveReq) => {
      const who = r.approver_roles.filter((a) => !UNIVERSAL_APPROVERS.includes(a)).join(", ");
      onDone(who || "a manager");
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not apply", "error"),
  });

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="card p-5 w-[440px]" onClick={(e) => e.stopPropagation()}>
        <div className="font-display text-xl mb-1">Apply for leave</div>
        <div className="text-sm text-muted mb-4">
          Goes to the department&apos;s manager first, then HR for final approval —
          only then are the days marked in attendance.
        </div>
        {!!staff?.length && (
          <label className="block mb-3">
            <span className="text-xs text-muted uppercase tracking-wide">For</span>
            <select className="input mt-1" value={employee}
              onChange={(e) => setEmployee(Number(e.target.value) || "")}>
              <option value="">Myself</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.department}{s.has_login ? "" : " (no login)"}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block mb-3">
          <span className="text-xs text-muted uppercase tracking-wide">Leave type</span>
          <select className="input mt-1" value={leaveType}
            onChange={(e) => setLeaveType(Number(e.target.value) || "")}>
            <option value="">Pick a type…</option>
            {types?.filter((t) => t.active).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} — {t.annual_quota ? `${t.annual_quota}/yr` : "no cap"}{t.is_paid ? "" : " · unpaid"}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <label className="block">
            <span className="text-xs text-muted uppercase tracking-wide">From</span>
            <input className="input mt-1" type="date" value={start}
              onChange={(e) => { setStart(e.target.value); if (e.target.value > end) setEnd(e.target.value); }} />
          </label>
          <label className="block">
            <span className="text-xs text-muted uppercase tracking-wide">To</span>
            <input className="input mt-1" type="date" value={end} min={start}
              onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>
        <div className="text-sm text-muted mb-3">{days || "—"} day{days === 1 ? "" : "s"}</div>
        <input className="input mb-4" placeholder="Reason (optional)" value={reason}
          onChange={(e) => setReason(e.target.value)} maxLength={300} />
        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={onCancel}>Cancel</button>
          <button className="btn-primary flex-1" disabled={!leaveType || !days || save.isPending}
            onClick={() => save.mutate()}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

const EMPTY_TYPE = { id: 0, name: "", annual_quota: 0, is_paid: true, carry_forward: false, active: true };

function TypesMaster() {
  const qc = useQueryClient();
  const toast = useToast();
  const [draft, setDraft] = useState<LeaveTypeRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["leave", "types"],
    queryFn: async () => (await api.get<LeaveTypeRow[]>("/leave/types/")).data,
  });

  const save = useMutation({
    mutationFn: async (t: LeaveTypeRow) =>
      (await api.post("/leave/save_type/", { ...t, id: t.id || undefined })).data,
    onSuccess: () => {
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["leave", "types"] });
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not save", "error"),
  });

  if (isLoading) return <Spinner />;
  return (
    <>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-cream text-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-right px-4 py-3">Days / year</th>
              <th className="text-center px-4 py-3">Paid</th>
              <th className="text-center px-4 py-3">Carry forward</th>
              <th className="text-center px-4 py-3">Active</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {data?.map((t) => (
              <tr key={t.id} className="border-t border-line">
                <td className="px-4 py-3 font-medium">{t.name}</td>
                <td className="px-4 py-3 text-right">{t.annual_quota || "no cap"}</td>
                <td className="px-4 py-3 text-center">{t.is_paid ? "✓" : "—"}</td>
                <td className="px-4 py-3 text-center">{t.carry_forward ? "✓" : "—"}</td>
                <td className="px-4 py-3 text-center">{t.active ? "✓" : "—"}</td>
                <td className="px-4 py-3 text-right">
                  <button className="btn-ghost text-sm" onClick={() => setDraft({ ...t })}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <button className="btn-outline mt-3 text-sm" onClick={() => setDraft({ ...EMPTY_TYPE })}>
        ＋ Add leave type
      </button>
      <div className="text-xs text-muted mt-2">
        Paid leave counts as a payable day for payroll; unpaid (Loss of Pay) marks the day absent.
        0 days/year = no cap.
      </div>

      {draft && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50" onClick={() => setDraft(null)}>
          <div className="card p-5 w-[400px]" onClick={(e) => e.stopPropagation()}>
            <div className="font-display text-xl mb-3">{draft.id ? "Edit leave type" : "New leave type"}</div>
            <label className="block mb-3">
              <span className="text-xs text-muted uppercase tracking-wide">Name</span>
              <input className="input mt-1" value={draft.name} maxLength={80}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </label>
            <label className="block mb-3">
              <span className="text-xs text-muted uppercase tracking-wide">Days per year (0 = no cap)</span>
              <input className="input mt-1" inputMode="numeric" value={draft.annual_quota}
                onChange={(e) => setDraft({ ...draft, annual_quota: Number(e.target.value) || 0 })} />
            </label>
            <div className="space-y-2 mb-4 text-sm">
              {([["is_paid", "Paid leave (counts as a payable day)"],
                 ["carry_forward", "Unused balance carries into next year"],
                 ["active", "Active (selectable on the apply form)"]] as const).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2">
                  <input type="checkbox" checked={draft[k]}
                    onChange={(e) => setDraft({ ...draft, [k]: e.target.checked })} />
                  {label}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => setDraft(null)}>Cancel</button>
              <button className="btn-primary flex-1" disabled={!draft.name.trim() || save.isPending}
                onClick={() => save.mutate(draft)}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
