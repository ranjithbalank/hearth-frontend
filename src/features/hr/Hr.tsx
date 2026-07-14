import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useToast } from "../../design/Toast";
import { Card, PageHeader, Spinner, Stat } from "../../design/ui";
import { api } from "../../lib/api";
import { money } from "../../lib/money";

interface Employee {
  id: number; name: string; department: string; role: string; shifts: string[]; status: string;
  monthly_salary: string;
}
interface Payroll {
  month: string; days_in_month: number; total_payable: string;
  rows: { id: number; name: string; department: string; role: string; monthly_salary: string;
    days_marked: number; payable_days: string; payable: string }[];
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SHIFT_TONE: Record<string, string> = {
  M: "bg-pine-50 text-pine",
  E: "bg-amber-50 text-amber-600",
  N: "bg-info-50 text-info",
  O: "bg-hairline text-muted",
};
const MARKS = [
  ["present", "P", "bg-pine text-white"],
  ["half", "½", "bg-amber-400 text-white"],
  ["leave", "L", "bg-info text-white"],
  ["absent", "A", "bg-clay text-white"],
] as const;

export function Hr() {
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<"roster" | "attendance" | "payroll">("roster");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

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

  const mark = useMutation({
    mutationFn: async ({ emp, status }: { emp: number; status: string }) =>
      (await api.post("/hr/mark_attendance/", { date, marks: { [emp]: status } })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr-att", date] }),
    onError: () => toast("Could not mark attendance", "error"),
  });

  if (isLoading || !data) return <Spinner />;

  return (
    <div>
      <PageHeader title="HR & Staff" subtitle="Roster · attendance · payroll" />
      <div className="flex gap-2 mb-4">
        {(["roster", "attendance", "payroll"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`pill capitalize ${tab === t ? "bg-ink text-white" : "bg-hairline text-body"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "roster" && (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-muted text-xs uppercase">
              <tr>
                <th className="text-left py-2 pr-4">Employee</th>
                <th className="text-left py-2 pr-4">Dept</th>
                {DAYS.map((d) => <th key={d} className="text-center py-2 px-2">{d}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.map((e) => (
                <tr key={e.id} className="border-t border-line">
                  <td className="py-2 pr-4">
                    <div className="font-medium">{e.name}</div>
                    <div className="text-xs text-muted">{e.role}</div>
                  </td>
                  <td className="py-2 pr-4 text-muted">{e.department}</td>
                  {DAYS.map((_, i) => (
                    <td key={i} className="py-2 px-2 text-center">
                      <span className={`pill ${SHIFT_TONE[e.shifts[i]] ?? "bg-hairline text-muted"}`}>
                        {e.shifts[i] ?? "—"}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex gap-3 mt-3 text-xs text-muted">
            <span>M Morning</span><span>E Evening</span><span>N Night</span><span>O Off</span>
          </div>
        </Card>
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
                {data.filter((e) => e.status === "Active").map((e) => {
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
        <>
          <div className="flex items-center gap-3 mb-4">
            <input className="input w-40" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            <Stat label={`Total payable · ${payroll.month}`} value={money(payroll.total_payable)} />
          </div>
          <Card className="p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-cream text-muted text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3">Employee</th>
                  <th className="text-right px-4 py-3">Monthly salary</th>
                  <th className="text-right px-4 py-3">Days marked</th>
                  <th className="text-right px-4 py-3">Payable days</th>
                  <th className="text-right px-4 py-3">Payable</th>
                </tr>
              </thead>
              <tbody>
                {payroll.rows.map((r) => (
                  <tr key={r.id} className="border-t border-line">
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted">{r.department} · {r.role}</div>
                    </td>
                    <td className="px-4 py-3 text-right">{money(r.monthly_salary)}</td>
                    <td className="px-4 py-3 text-right text-muted">{r.days_marked}/{payroll.days_in_month}</td>
                    <td className="px-4 py-3 text-right">{r.payable_days}</td>
                    <td className="px-4 py-3 text-right font-medium">{money(r.payable)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <button
            className="btn-outline mt-3 text-sm"
            onClick={() => {
              const csv = ["name,department,role,monthly_salary,days_marked,payable_days,payable",
                ...payroll.rows.map((r) => `${r.name},${r.department},${r.role},${r.monthly_salary},${r.days_marked},${r.payable_days},${r.payable}`)].join("\n");
              const a = document.createElement("a");
              a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
              a.download = `payroll-${payroll.month}.csv`;
              a.click();
            }}
          >
            Export CSV
          </button>
        </>
      )}
    </div>
  );
}
