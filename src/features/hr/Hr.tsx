import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useToast } from "../../design/Toast";
import { Badge, Card, PageHeader, Spinner, Stat } from "../../design/ui";
import { api } from "../../lib/api";
import { useApp } from "../../lib/app-context";
import { amount as decimalFilter, digits, personName } from "../../lib/inputs";
import { money } from "../../lib/money";
import { downloadPayslipPdf } from "../print/documents";

interface Employee {
  id: number; name: string; department: string; role: string; shifts: string[]; status: string;
  wage_type: "monthly" | "daily"; monthly_salary: string; daily_rate: string;
  statutory: boolean; has_allowances: boolean; phone: string;
}
interface PayrollRow {
  payslip: number | null; id: number; name: string; department: string; role: string;
  wage_type: "monthly" | "daily"; statutory: boolean;
  monthly_salary: string; days_marked: number | null; payable_days: string;
  basic: string; hra: string; other_allowance: string; gross_earned: string;
  pf: string; esi: string; pt: string; adjustment: string; adjustment_note: string;
  advance_recovery: string;
  net: string; payable: string;
}
interface Advance {
  id: number; employee: number; employee_name: string; department: string;
  kind: "advance" | "loan"; amount: string; monthly_installment: string;
  recovered: string; balance: string; status: "active" | "settled";
  note: string; issued_by: string; created_at: string;
}
interface Payroll {
  month: string; days_in_month: number; total_payable: string;
  run: { id: number; month: string; status: string; created_by: string;
    finalized_by: string; paid_by: string; paid_at: string | null } | null;
  rows: PayrollRow[];
}
interface Overview {
  date: string; headcount: number; salaried: number; casual: number;
  today: { present: number; half: number; leave: number; absent: number; unmarked: number };
  on_leave: { employee: string; type: string; until: string }[];
  monthly_wage_bill: string;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SHIFT_TONE: Record<string, string> = {
  M: "bg-pine-50 text-pine",
  E: "bg-amber-50 text-amber-600",
  N: "bg-info-50 text-info",
  O: "bg-hairline text-muted",
};
// Same hotel/restaurant split the approval routing uses (DEPARTMENT_APPROVERS):
// kitchen & bar staff report up the restaurant side, rooms departments up the
// hotel side; admin/accounts/security serve both.
const RESTAURANT_DEPTS = ["kitchen", "bar", "restaurant", "service", "steward", "f&b", "fnb"];
const HOTEL_DEPTS = ["housekeep", "front office", "front desk", "reservation", "banquet",
  "maintenance", "laundry", "concierge", "room", "bell", "spa"];
type Side = "all" | "hotel" | "restaurant" | "shared";
function sideOfDept(department: string): Exclude<Side, "all"> {
  const d = department.toLowerCase();
  if (RESTAURANT_DEPTS.some((k) => d.includes(k))) return "restaurant";
  if (HOTEL_DEPTS.some((k) => d.includes(k))) return "hotel";
  return "shared";
}
const SIDE_TABS: { key: Side; label: string }[] = [
  { key: "all", label: "All" },
  { key: "hotel", label: "🏨 Hotel" },
  { key: "restaurant", label: "🍽 Restaurant" },
  { key: "shared", label: "Shared" },
];

const MARKS = [
  ["present", "P", "bg-pine text-white"],
  ["half", "½", "bg-amber-400 text-white"],
  ["leave", "L", "bg-info text-white"],
  ["absent", "A", "bg-clay text-white"],
] as const;
// Mirrors the backend's PAYROLL_MANAGER_ROLES — CEO opens HR read-only.
const PAYROLL_MANAGERS = new Set([
  "Super Admin", "Managing Director", "General Manager", "HR Manager", "Finance",
]);
const RUN_TONE: Record<string, "amber" | "info" | "pine"> = {
  draft: "amber", finalized: "info", paid: "pine",
};

export function Hr() {
  const qc = useQueryClient();
  const toast = useToast();
  const { user } = useApp();
  const canManagePayroll = PAYROLL_MANAGERS.has(user?.role ?? "");
  const [tab, setTab] = useState<"roster" | "attendance" | "payroll" | "advances">("roster");
  const [side, setSide] = useState<Side>("all");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [editing, setEditing] = useState<Employee | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["hr"],
    queryFn: async () => (await api.get<Employee[]>("/hr/")).data,
  });
  const { data: att } = useQuery({
    queryKey: ["hr-att", date],
    queryFn: async () => (await api.get<{ date: string; marks: Record<string, string> }>(`/hr/attendance/?date=${date}`)).data,
    enabled: tab === "attendance",
  });
  const { data: payroll } = useQuery({
    queryKey: ["hr-payroll", month],
    queryFn: async () => (await api.get<Payroll>(`/hr/payroll/?month=${month}`)).data,
    enabled: tab === "payroll",
  });
  const { data: overview } = useQuery({
    queryKey: ["hr-overview"],
    queryFn: async () => (await api.get<Overview>("/hr/overview/")).data,
    enabled: tab === "roster",
  });

  const mark = useMutation({
    mutationFn: async ({ emp, status }: { emp: number; status: string }) =>
      (await api.post("/hr/mark_attendance/", { date, marks: { [emp]: status } })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr-att", date] }),
    onError: () => toast("Could not mark attendance", "error"),
  });

  if (isLoading || !data) return <Spinner />;

  const staff = side === "all" ? data : data.filter((e) => sideOfDept(e.department) === side);

  return (
    <div>
      <PageHeader title="HR & Staff" subtitle="Roster · attendance · payroll & salary" />
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {(["roster", "attendance", "payroll", "advances"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`pill capitalize ${tab === t ? "bg-ink text-white" : "bg-hairline text-body"}`}>
            {t}
          </button>
        ))}
        {(tab === "roster" || tab === "attendance") && (
          <div className="flex gap-1 rounded-pill bg-hairline p-1 ml-auto">
            {SIDE_TABS.map(({ key, label }) => {
              const n = key === "all" ? data.length : data.filter((e) => sideOfDept(e.department) === key).length;
              const active = side === key;
              return (
                <button key={key} onClick={() => setSide(key)}
                  className={`px-3 py-1 rounded-pill text-sm inline-flex items-center gap-1.5 transition-colors ${
                    active ? "bg-ink text-white shadow-sm" : "text-body hover:bg-white/60"}`}>
                  {label}
                  <span className={`min-w-[1.4em] h-[1.5em] px-1 inline-flex items-center justify-center rounded-full text-[10px] tabular-nums ${
                    active ? "bg-white/25 text-white" : "bg-white text-muted"}`}>
                    {n}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {tab === "roster" && overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Card>
            <div className="text-xs text-muted uppercase tracking-wide">Active staff</div>
            <div className="font-display text-2xl mt-1">{overview.headcount}</div>
            <div className="text-xs text-muted mt-1">{overview.salaried} salaried · {overview.casual} day-rate</div>
          </Card>
          <Card>
            <div className="text-xs text-muted uppercase tracking-wide">Today&apos;s muster</div>
            <div className="font-display text-2xl mt-1">
              {overview.today.present + overview.today.half}
              <span className="text-sm text-muted font-body"> in</span>
            </div>
            <div className="text-xs text-muted mt-1">
              {overview.today.leave} on leave · {overview.today.absent} absent · {overview.today.unmarked} unmarked
            </div>
          </Card>
          <Card>
            <div className="text-xs text-muted uppercase tracking-wide">On approved leave</div>
            <div className="font-display text-2xl mt-1">{overview.on_leave.length}</div>
            <div className="text-xs text-muted mt-1 truncate" title={overview.on_leave.map((l) => `${l.employee} (${l.type} → ${l.until})`).join(", ")}>
              {overview.on_leave.length
                ? overview.on_leave.map((l) => l.employee).join(", ")
                : "nobody away today"}
            </div>
          </Card>
          <Card>
            <div className="text-xs text-muted uppercase tracking-wide">Monthly wage bill</div>
            <div className="font-display text-2xl mt-1">{money(overview.monthly_wage_bill)}</div>
            <div className="text-xs text-muted mt-1">gross · day rates × 26 days</div>
          </Card>
        </div>
      )}

      {tab === "roster" && (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-muted text-xs uppercase">
              <tr>
                <th className="text-left py-2 pr-4">Employee</th>
                <th className="text-left py-2 pr-4">Dept</th>
                {DAYS.map((d) => <th key={d} className="text-center py-2 px-2">{d}</th>)}
                <th className="text-right py-2 pl-2">Salary</th>
                <th className="py-2 pl-2" />
              </tr>
            </thead>
            <tbody>
              {staff.map((e) => (
                <tr key={e.id} className={`border-t border-line ${e.status !== "Active" ? "opacity-50" : ""}`}>
                  <td className="py-2 pr-4">
                    <div className="font-medium">{e.name}</div>
                    <div className="text-xs text-muted">{e.role}{e.status !== "Active" ? ` · ${e.status}` : ""}</div>
                  </td>
                  <td className="py-2 pr-4 text-muted">{e.department}</td>
                  {DAYS.map((_, i) => (
                    <td key={i} className="py-2 px-2 text-center">
                      <span className={`pill ${SHIFT_TONE[e.shifts[i]] ?? "bg-hairline text-muted"}`}>
                        {e.shifts[i] ?? "—"}
                      </span>
                    </td>
                  ))}
                  <td className="py-2 pl-2 text-right">
                    {e.wage_type === "daily"
                      ? <>{money(e.daily_rate)}<span className="text-xs text-muted">/day</span></>
                      : money(e.monthly_salary)}
                    {!e.statutory && <div className="text-[10px] text-muted">no PF/ESI</div>}
                  </td>
                  <td className="py-2 pl-2 text-right">
                    <button className="btn-ghost text-sm" onClick={() => setEditing(e)}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex gap-3 mt-3 text-xs text-muted">
            <span>M Morning</span><span>E Evening</span><span>N Night</span><span>O Off</span>
          </div>
        </Card>
      )}

      {editing && (
        <EditEmployeeModal
          employee={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: ["hr"] });
          }}
        />
      )}

      {tab === "attendance" && (
        <>
          <div className="flex items-center gap-2 mb-4">
            <input className="input w-44" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <span className="text-xs text-muted">Tap a mark for each employee — P present · ½ half day · L paid leave · A absent</span>
          </div>
          <Card className="p-0 overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {staff.filter((e) => e.status === "Active").map((e) => {
                  const current = att?.marks[String(e.id)];
                  return (
                    <tr key={e.id} className="border-t border-line first:border-0">
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{e.name}</div>
                        <div className="text-xs text-muted">{e.department} · {e.role}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="inline-flex gap-1.5">
                          {MARKS.map(([status, label, tone]) => (
                            <button key={status}
                              onClick={() => mark.mutate({ emp: e.id, status })}
                              className={`h-8 w-8 rounded-lg text-sm font-semibold border transition-colors ${
                                current === status ? tone + " border-transparent" : "border-hairline text-muted hover:bg-cream"}`}>
                              {label}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {tab === "payroll" && payroll && (
        <PayrollSheet payroll={payroll} month={month} setMonth={setMonth}
          canManage={canManagePayroll} />
      )}

      {tab === "advances" && (
        <AdvancesPanel employees={data} canManage={canManagePayroll} />
      )}
    </div>
  );
}

function PayrollSheet({ payroll, month, setMonth, canManage }: {
  payroll: Payroll; month: string; setMonth: (m: string) => void; canManage: boolean;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const run = payroll.run;
  const isDraft = run?.status === "draft";

  const refresh = () => qc.invalidateQueries({ queryKey: ["hr-payroll", month] });
  const runPayroll = useMutation({
    mutationFn: async () => (await api.post("/hr/run_payroll/", { month })).data,
    onSuccess: () => { toast("Draft payroll created — numbers are now snapshotted"); refresh(); },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not run payroll", "error"),
  });
  const advance = useMutation({
    mutationFn: async (action?: string) =>
      (await api.post("/hr/advance_payroll/", { month, ...(action ? { action } : {}) })).data,
    onSuccess: (d: any) => {
      toast(d.discarded ? "Draft discarded — rerun after corrections"
        : d.status === "finalized" ? "Payroll finalized — numbers locked"
        : "Marked paid");
      refresh();
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not update payroll", "error"),
  });

  return (
    <>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input className="input w-40" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        <Stat label={`Total net payable · ${payroll.month}`} value={money(payroll.total_payable)} />
        {run
          ? <Badge tone={RUN_TONE[run.status] ?? "muted"}>{run.status}{run.status === "paid" && run.paid_by ? ` by ${run.paid_by}` : ""}</Badge>
          : <Badge tone="muted">preview — not run yet</Badge>}
        {canManage && (
          <span className="ml-auto flex gap-2">
            {!run && (
              <button className="btn-primary text-sm" disabled={runPayroll.isPending}
                onClick={() => runPayroll.mutate()}>
                Run payroll (draft)
              </button>
            )}
            {isDraft && (
              <>
                <button className="btn-primary text-sm" onClick={() => advance.mutate(undefined)}>
                  Finalize
                </button>
                <button className="btn-ghost text-sm text-clay" onClick={() => advance.mutate("discard")}>
                  Discard draft
                </button>
              </>
            )}
            {run?.status === "finalized" && (
              <button className="btn-primary text-sm" onClick={() => advance.mutate(undefined)}>
                Mark paid
              </button>
            )}
          </span>
        )}
      </div>

      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead className="bg-cream text-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Employee</th>
              <th className="text-right px-3 py-3">Gross salary</th>
              <th className="text-right px-3 py-3">Days</th>
              <th className="text-right px-3 py-3">Basic</th>
              <th className="text-right px-3 py-3">HRA</th>
              <th className="text-right px-3 py-3">Allowances</th>
              <th className="text-right px-3 py-3">Earned</th>
              <th className="text-right px-3 py-3">PF</th>
              <th className="text-right px-3 py-3">ESI</th>
              <th className="text-right px-3 py-3">PT</th>
              <th className="text-right px-3 py-3">Advance/loan</th>
              <th className="text-right px-3 py-3">Adjust</th>
              <th className="text-right px-4 py-3">Net pay</th>
              <th className="px-2 py-3" />
            </tr>
          </thead>
          <tbody>
            {payroll.rows.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="px-4 py-2.5">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-muted">{r.department} · {r.role}</div>
                </td>
                <td className="px-3 py-2.5 text-right">
                  {money(r.monthly_salary)}{r.wage_type === "daily" && <span className="text-xs text-muted">/day</span>}
                </td>
                <td className="px-3 py-2.5 text-right text-muted">
                  {Number(r.payable_days)}{r.days_marked != null ? `/${payroll.days_in_month}` : ""}
                </td>
                <td className="px-3 py-2.5 text-right">{money(r.basic)}</td>
                <td className="px-3 py-2.5 text-right">{Number(r.hra) ? money(r.hra) : "—"}</td>
                <td className="px-3 py-2.5 text-right">{Number(r.other_allowance) ? money(r.other_allowance) : "—"}</td>
                <td className="px-3 py-2.5 text-right">{money(r.gross_earned)}</td>
                <td className="px-3 py-2.5 text-right text-clay">{Number(r.pf) ? `−${money(r.pf)}` : "—"}</td>
                <td className="px-3 py-2.5 text-right text-clay">{Number(r.esi) ? `−${money(r.esi)}` : "—"}</td>
                <td className="px-3 py-2.5 text-right text-clay">{Number(r.pt) ? `−${money(r.pt)}` : "—"}</td>
                <td className="px-3 py-2.5 text-right text-clay">
                  {Number(r.advance_recovery) ? `−${money(r.advance_recovery)}` : "—"}
                </td>
                <td className="px-3 py-2.5 text-right">
                  {isDraft && canManage && r.payslip
                    ? <AdjustCell row={r} onSaved={refresh} />
                    : Number(r.adjustment)
                      ? <span title={r.adjustment_note}>{money(r.adjustment)}</span>
                      : "—"}
                </td>
                <td className="px-4 py-2.5 text-right font-medium">{money(r.net)}</td>
                <td className="px-2 py-2.5 text-right">
                  {r.payslip && (
                    <button className="btn-ghost text-sm" title="Download payslip PDF"
                      onClick={() => downloadPayslipPdf(r.payslip!, r.name, payroll.month)}>
                      ⤓
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div className="flex items-center gap-4 mt-3">
        <button className="btn-outline text-sm" onClick={() => exportCsv(payroll)}>Export CSV</button>
        <span className="text-xs text-muted">
          Salaried: basic 50% · HRA 20% · allowances 30%, prorated by payable days —
          PF 12% of basic (cap ₹1,800) · ESI 0.75% up to ₹21k gross · PT ₹200 over ₹21k,
          only for staff on the rolls. Daily wage: rate × days, no deductions unless on the rolls.
          {run ? " Snapshotted when the run was created." : " Live preview from attendance."}
        </span>
      </div>
    </>
  );
}

function AdjustCell({ row, onSaved }: { row: PayrollRow; onSaved: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(row.adjustment === "0.00" || row.adjustment === "0" ? "" : row.adjustment);
  const [note, setNote] = useState(row.adjustment_note);

  const save = useMutation({
    mutationFn: async () => (await api.post("/hr/adjust_payslip/", {
      payslip: row.payslip, amount: amount || "0", note,
    })).data,
    onSuccess: () => { setOpen(false); onSaved(); },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not adjust", "error"),
  });

  if (!open) {
    return (
      <button className="btn-ghost text-sm" title={row.adjustment_note}
        onClick={() => setOpen(true)}>
        {Number(row.adjustment) ? money(row.adjustment) : "＋"}
      </button>
    );
  }
  return (
    <span className="inline-flex gap-1 items-center">
      <input className="input w-24 text-right" inputMode="decimal" placeholder="± amount"
        value={amount} onChange={(e) => setAmount(decimalFilter(e.target.value))} autoFocus />
      <input className="input w-32" placeholder="Why? (bonus…)"
        value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
      <button className="btn-primary text-xs" disabled={save.isPending} onClick={() => save.mutate()}>✓</button>
      <button className="btn-ghost text-xs" onClick={() => setOpen(false)}>✕</button>
    </span>
  );
}

function EditEmployeeModal({ employee, onClose, onSaved }: {
  employee: Employee; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: employee.name, department: employee.department, role: employee.role,
    phone: employee.phone ?? "", monthly_salary: employee.monthly_salary,
    daily_rate: employee.daily_rate, wage_type: employee.wage_type,
    statutory: employee.statutory, has_allowances: employee.has_allowances,
    status: employee.status,
  });
  const [shifts, setShifts] = useState<string[]>(
    () => DAYS.map((_, i) => employee.shifts[i] ?? "O"));

  const save = useMutation({
    mutationFn: async () => (await api.put(`/hr/${employee.id}/`, { ...form, shifts })).data,
    onSuccess: onSaved,
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not save", "error"),
  });

  const set = (k: string, v: string | boolean) => setForm({ ...form, [k]: v });
  const daily = form.wage_type === "daily";
  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="card p-5 w-[420px]" onClick={(e) => e.stopPropagation()}>
        <div className="font-display text-xl mb-3">Edit {employee.name}</div>
        {([["name", "Name"], ["department", "Department"], ["role", "Role"],
           ["phone", "Phone"]] as const).map(([k, label]) => (
          <label key={k} className="block mb-3">
            <span className="text-xs text-muted uppercase tracking-wide">{label}</span>
            <input className="input mt-1" value={(form as any)[k]}
              onChange={(e) => set(k, k === "name" ? personName(e.target.value) : k === "phone" ? digits(e.target.value, 15) : e.target.value)} />
          </label>
        ))}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <label className="block">
            <span className="text-xs text-muted uppercase tracking-wide">Pay terms</span>
            <select className="input mt-1" value={form.wage_type}
              onChange={(e) => {
                const wage_type = e.target.value as "monthly" | "daily";
                // Casuals are typically off the rolls; salaried on them.
                setForm({ ...form, wage_type, statutory: wage_type === "monthly" });
              }}>
              <option value="monthly">Monthly salary</option>
              <option value="daily">Daily wage</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-muted uppercase tracking-wide">
              {daily ? "Rate per day" : "Monthly salary (gross)"}
            </span>
            <input className="input mt-1" inputMode="decimal"
              value={daily ? form.daily_rate : form.monthly_salary}
              onChange={(e) => set(daily ? "daily_rate" : "monthly_salary", decimalFilter(e.target.value))} />
          </label>
        </div>
        {!daily && (
          <label className="block mb-3">
            <span className="text-xs text-muted uppercase tracking-wide">Salary structure</span>
            <select className="input mt-1" value={form.has_allowances ? "split" : "basic"}
              onChange={(e) => set("has_allowances", e.target.value === "split")}>
              <option value="split">Basic 50% + HRA 20% + allowances 30%</option>
              <option value="basic">All basic — no allowances</option>
            </select>
          </label>
        )}
        <div className="grid grid-cols-2 gap-3 mb-3 items-end">
          <label className="flex items-center gap-2 text-sm pb-2">
            <input type="checkbox" checked={form.statutory}
              onChange={(e) => set("statutory", e.target.checked)} />
            On the rolls (PF / ESI / PT)
          </label>
          <label className="block">
            <span className="text-xs text-muted uppercase tracking-wide">Status</span>
            <select className="input mt-1" value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </label>
        </div>
        <div className="mb-4">
          <span className="text-xs text-muted uppercase tracking-wide">Weekly shifts</span>
          <div className="grid grid-cols-7 gap-1.5 mt-1">
            {DAYS.map((d, i) => (
              <label key={d} className="text-center">
                <div className="text-[10px] text-muted mb-0.5">{d}</div>
                <select className="input px-1 py-1.5 text-center text-sm" value={shifts[i]}
                  onChange={(e) => setShifts(shifts.map((s, ix) => (ix === i ? e.target.value : s)))}>
                  {(["M", "E", "N", "O"] as const).map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
            ))}
          </div>
          <div className="text-[10px] text-muted mt-1">M morning · E evening · N night · O off</div>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1" disabled={!form.name.trim() || save.isPending}
            onClick={() => save.mutate()}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

const ADVANCE_TONE: Record<string, "amber" | "pine"> = { active: "amber", settled: "pine" };

function AdvancesPanel({ employees, canManage }: { employees: Employee[]; canManage: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [issuing, setIssuing] = useState(false);
  const [showSettled, setShowSettled] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["hr-advances"],
    queryFn: async () => (await api.get<Advance[]>("/hr-advances/")).data,
  });

  const waive = useMutation({
    mutationFn: async (id: number) => (await api.post(`/hr-advances/${id}/waive/`)).data,
    onSuccess: () => {
      toast("Balance written off");
      qc.invalidateQueries({ queryKey: ["hr-advances"] });
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not write off", "error"),
  });

  if (isLoading || !data) return <Spinner />;
  const rows = data.filter((a) => showSettled || a.status === "active");

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={showSettled} onChange={(e) => setShowSettled(e.target.checked)} />
          Show settled
        </label>
        {canManage && (
          <button className="btn-primary text-sm ml-auto" onClick={() => setIssuing(true)}>
            + Issue advance / loan
          </button>
        )}
      </div>

      {issuing && (
        <IssueAdvanceModal employees={employees}
          onDone={() => {
            setIssuing(false);
            qc.invalidateQueries({ queryKey: ["hr-advances"] });
          }}
          onCancel={() => setIssuing(false)}
        />
      )}

      {!rows.length ? (
        <Card className="text-sm text-muted">No {showSettled ? "" : "active "}advances or loans.</Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream text-muted text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Employee</th>
                <th className="text-left px-3 py-3">Type</th>
                <th className="text-right px-3 py-3">Amount</th>
                <th className="text-right px-3 py-3">Installment</th>
                <th className="text-right px-3 py-3">Recovered</th>
                <th className="text-right px-3 py-3">Balance</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <div className="font-medium">{a.employee_name}</div>
                    <div className="text-xs text-muted">{a.department}{a.note ? ` · ${a.note}` : ""}</div>
                  </td>
                  <td className="px-3 py-3 capitalize">{a.kind}</td>
                  <td className="px-3 py-3 text-right">{money(a.amount)}</td>
                  <td className="px-3 py-3 text-right text-muted">
                    {a.kind === "loan" ? `${money(a.monthly_installment)}/mo` : "full next payroll"}
                  </td>
                  <td className="px-3 py-3 text-right">{money(a.recovered)}</td>
                  <td className="px-3 py-3 text-right font-medium">{money(a.balance)}</td>
                  <td className="px-3 py-3"><Badge tone={ADVANCE_TONE[a.status]}>{a.status}</Badge></td>
                  <td className="px-4 py-3 text-right">
                    {canManage && a.status === "active" && (
                      <button className="btn-ghost text-sm text-clay" onClick={() => waive.mutate(a.id)}>
                        Write off
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <div className="text-xs text-muted mt-3">
        Advances are recovered in full from the next payroll run; loans in fixed monthly installments —
        oldest first, never more than that month&apos;s net pay. Recovery is only applied to the balance
        once a run is marked paid; a discarded draft leaves nothing recovered.
      </div>
    </div>
  );
}

function IssueAdvanceModal({ employees, onDone, onCancel }: {
  employees: Employee[]; onDone: () => void; onCancel: () => void;
}) {
  const toast = useToast();
  const [employee, setEmployee] = useState<number | "">("");
  const [kind, setKind] = useState<"advance" | "loan">("advance");
  const [amount, setAmount] = useState("");
  const [installment, setInstallment] = useState("");
  const [note, setNote] = useState("");

  const save = useMutation({
    mutationFn: async () => (await api.post("/hr-advances/", {
      employee, kind, amount,
      ...(kind === "loan" ? { monthly_installment: installment } : {}),
      note,
    })).data,
    onSuccess: onDone,
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not issue", "error"),
  });

  const valid = employee && Number(amount) > 0 && (kind === "advance" || Number(installment) > 0);
  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="card p-5 w-[420px]" onClick={(e) => e.stopPropagation()}>
        <div className="font-display text-xl mb-3">Issue advance or loan</div>
        <label className="block mb-3">
          <span className="text-xs text-muted uppercase tracking-wide">Employee</span>
          <select className="input mt-1" value={employee} onChange={(e) => setEmployee(Number(e.target.value) || "")}>
            <option value="">Pick an employee…</option>
            {employees.filter((e) => e.status === "Active").map((e) => (
              <option key={e.id} value={e.id}>{e.name} — {e.department}</option>
            ))}
          </select>
        </label>
        <label className="block mb-3">
          <span className="text-xs text-muted uppercase tracking-wide">Type</span>
          <select className="input mt-1" value={kind} onChange={(e) => setKind(e.target.value as "advance" | "loan")}>
            <option value="advance">Advance — recovered in full next payroll</option>
            <option value="loan">Loan — recovered in fixed monthly installments</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <label className="block">
            <span className="text-xs text-muted uppercase tracking-wide">Amount</span>
            <input className="input mt-1" inputMode="decimal" value={amount}
              onChange={(e) => setAmount(decimalFilter(e.target.value))} />
          </label>
          {kind === "loan" && (
            <label className="block">
              <span className="text-xs text-muted uppercase tracking-wide">Monthly installment</span>
              <input className="input mt-1" inputMode="decimal" value={installment}
                onChange={(e) => setInstallment(decimalFilter(e.target.value))} />
            </label>
          )}
        </div>
        <input className="input mb-4" placeholder="Reason (optional)" value={note}
          onChange={(e) => setNote(e.target.value)} maxLength={200} />
        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={onCancel}>Cancel</button>
          <button className="btn-primary flex-1" disabled={!valid || save.isPending}
            onClick={() => save.mutate()}>
            Issue
          </button>
        </div>
      </div>
    </div>
  );
}

function exportCsv(payroll: Payroll) {
  const head = "name,department,role,gross_salary,payable_days,basic,hra,allowances,gross_earned,pf,esi,pt,advance_recovery,adjustment,net";
  const csv = [head, ...payroll.rows.map((r) =>
    [r.name, r.department, r.role, r.monthly_salary, r.payable_days, r.basic, r.hra,
     r.other_allowance, r.gross_earned, r.pf, r.esi, r.pt, r.advance_recovery, r.adjustment, r.net].join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `payroll-${payroll.month}.csv`;
  a.click();
}
