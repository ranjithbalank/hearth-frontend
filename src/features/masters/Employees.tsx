import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IdCard } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { CsvImport } from "../../design/CsvImport";
import { useToast } from "../../design/Toast";
import { Badge, Card, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { useApp } from "../../lib/app-context";
import { COUNTRY_CODES } from "../../lib/countryCodes";
import { amount, digits, personName } from "../../lib/inputs";
import { currencySymbol, money } from "../../lib/money";
import { monthlyEquivalent } from "../../lib/wage";
import type { Branch } from "../../lib/types";

interface Employee {
  id: number; name: string; department: string; role: string; status: string;
  country_code: string; phone: string;
  wage_type: "monthly" | "daily" | "weekly";
  monthly_salary: string; daily_rate: string; weekly_rate: string;
  branch: number | null; branch_name: string | null;
}
interface User { username: string; name: string; role: string }
interface MasterItem { id: number; name: string; active: boolean }

export function Employees() {
  const qc = useQueryClient();
  const toast = useToast();
  const { canAccess } = useApp();
  const empty = { name: "", department: "", role: "", country_code: "+91", phone: "", monthly_salary: "", branch: "" };
  const [f, setF] = useState(empty);
  const [q, setQ] = useState("");

  const { data: staff, isLoading } = useQuery({
    queryKey: ["employees-master"],
    queryFn: async () => (await api.get<Employee[]>("/hr/")).data,
  });
  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: async () => (await api.get<User[]>("/auth/users/")).data,
  });
  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => (await api.get<Branch[]>("/auth/branches/")).data,
  });
  // Department & designation options come from Settings > Masters.
  const { data: departments } = useQuery({
    queryKey: ["master-departments"],
    queryFn: async () => (await api.get<MasterItem[]>("/masters/departments/")).data,
  });
  const { data: designations } = useQuery({
    queryKey: ["master-designations"],
    queryFn: async () => (await api.get<MasterItem[]>("/masters/designations/")).data,
  });

  const create = useMutation({
    mutationFn: async () => (await api.post("/hr/", {
      name: f.name, department: f.department, role: f.role,
      country_code: f.country_code, phone: f.phone,
      monthly_salary: f.monthly_salary || 0, branch: f.branch || null,
    })).data,
    onSuccess: () => {
      setF(empty);
      toast("Employee added");
      qc.invalidateQueries({ queryKey: ["employees-master"] });
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not add employee", "error"),
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [ef, setEf] = useState(empty);
  function startEdit(e: Employee) {
    setEditingId(e.id);
    setEf({
      name: e.name, department: e.department, role: e.role,
      country_code: e.country_code || "+91", phone: e.phone,
      monthly_salary: e.monthly_salary, branch: e.branch ? String(e.branch) : "",
    });
  }
  const saveEdit = useMutation({
    mutationFn: async (id: number) => (await api.patch(`/hr/${id}/`, {
      name: ef.name, department: ef.department, role: ef.role,
      country_code: ef.country_code, phone: ef.phone,
      monthly_salary: ef.monthly_salary || 0, branch: ef.branch || null,
    })).data,
    onSuccess: () => { setEditingId(null); toast("Employee updated"); qc.invalidateQueries({ queryKey: ["employees-master"] }); },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not save changes", "error"),
  });

  if (isLoading || !staff) return <Spinner />;
  const userByName = new Map((users ?? []).map((u) => [u.name, u]));
  const showBranch = (branches?.length ?? 0) > 0;
  const active = (items?: MasterItem[], current = "") =>
    (items ?? []).filter((i) => i.active || i.name === current);
  const visible = staff.filter((e) => !q
    || e.name.toLowerCase().includes(q.toLowerCase())
    || e.department.toLowerCase().includes(q.toLowerCase())
    || e.role.toLowerCase().includes(q.toLowerCase())
    || e.phone.includes(q));

  return (
    <div>
      <PageHeader icon={<IdCard size={20} />} title="Employees" subtitle="Staff directory & system access" />

      <CsvImport path="/hr/import/" templateFilename="employees-template.csv"
        noun="employee" invalidate={["employees-master"]}
        hint="Onboarding many staff? Download the format, fill it in Excel (or export from your old system), and upload — department and designation must already exist in Settings > Masters." />

      <input className="input w-64 mb-4" placeholder="Search name, department, role, phone…"
        value={q} onChange={(e) => setQ(e.target.value)} />

      <Card className="mb-4">
        <div className="font-semibold mb-3">Add employee</div>
        <div className="grid grid-cols-4 gap-2 mb-2">
          <input className="input" placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: personName(e.target.value) })} />
          <select className="input" value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })}>
            <option value="">Department…</option>
            {active(departments).map((d) => <option key={d.id}>{d.name}</option>)}
          </select>
          <select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            <option value="">Designation…</option>
            {active(designations).map((d) => <option key={d.id}>{d.name}</option>)}
          </select>
          <div className="flex gap-1">
            <select className="input w-20 px-1" value={f.country_code} onChange={(e) => setF({ ...f, country_code: e.target.value })}>
              {COUNTRY_CODES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
            </select>
            <input className="input flex-1" placeholder="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: digits(e.target.value, 15) })} />
          </div>
          <input className="input" inputMode="decimal" placeholder="Monthly salary" value={f.monthly_salary}
            onChange={(e) => setF({ ...f, monthly_salary: amount(e.target.value) })} />
          {showBranch && (
            <select className="input" value={f.branch} onChange={(e) => setF({ ...f, branch: e.target.value })}>
              <option value="">Branch (defaults to yours)</option>
              {branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
        </div>
        <button className="btn-primary mt-1" disabled={!f.name || !f.department || !f.role || create.isPending}
          onClick={() => create.mutate()}>
          Add employee
        </button>
      </Card>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-cream text-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Department</th>
              <th className="text-left px-4 py-3">Role</th>
              <th className="text-left px-4 py-3">Phone</th>
              <th className="text-right px-4 py-3">Pay</th>
              {showBranch && <th className="text-left px-4 py-3">Branch</th>}
              <th className="text-left px-4 py-3">System access</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">&nbsp;</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((e) => {
              const u = userByName.get(e.name);
              const editing = editingId === e.id;
              return (
                <tr key={e.id} className="border-t border-line hover:bg-cream/60 transition-colors">
                  <td className="px-4 py-3 font-medium">
                    {editing ? <input className="input py-1 text-xs w-28" value={ef.name} onChange={(v) => setEf({ ...ef, name: personName(v.target.value) })} /> : e.name}
                  </td>
                  <td className="px-4 py-3">
                    {editing ? (
                      <select className="input py-1 text-xs w-28" value={ef.department} onChange={(v) => setEf({ ...ef, department: v.target.value })}>
                        {active(departments, ef.department).map((d) => <option key={d.id}>{d.name}</option>)}
                      </select>
                    ) : e.department}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {editing ? (
                      <select className="input py-1 text-xs w-28" value={ef.role} onChange={(v) => setEf({ ...ef, role: v.target.value })}>
                        {active(designations, ef.role).map((d) => <option key={d.id}>{d.name}</option>)}
                      </select>
                    ) : e.role}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {editing ? (
                      <div className="flex gap-1">
                        <select className="input py-1 text-xs w-16 px-1" value={ef.country_code}
                          onChange={(v) => setEf({ ...ef, country_code: v.target.value })}>
                          {COUNTRY_CODES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                        </select>
                        <input className="input py-1 text-xs w-20" value={ef.phone} onChange={(v) => setEf({ ...ef, phone: digits(v.target.value, 15) })} />
                      </div>
                    ) : (e.phone ? `${e.country_code || "+91"} ${e.phone}` : "—")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editing ? (
                      e.wage_type === "monthly" ? (
                        <input className="input py-1 text-xs text-right w-24" inputMode="decimal"
                          value={ef.monthly_salary} onChange={(v) => setEf({ ...ef, monthly_salary: amount(v.target.value) })} />
                      ) : (
                        <Link to={`/hr?edit=${e.id}`} className="text-pine text-xs">
                          Edit {e.wage_type} rate in payroll →
                        </Link>
                      )
                    ) : e.wage_type === "daily" ? (
                      <>
                        {money(e.daily_rate)}<span className="text-xs text-muted">/day</span>
                        <div className="text-[10px] text-muted">~{money(monthlyEquivalent(e))}/mo</div>
                      </>
                    ) : e.wage_type === "weekly" ? (
                      <>
                        {money(e.weekly_rate)}<span className="text-xs text-muted">/week</span>
                        <div className="text-[10px] text-muted">~{money(monthlyEquivalent(e))}/mo</div>
                      </>
                    ) : (Number(e.monthly_salary) ? `${currencySymbol()}${Number(e.monthly_salary).toLocaleString("en-IN")}` : "—")}
                  </td>
                  {showBranch && (
                    <td className="px-4 py-3 text-muted">
                      {editing ? (
                        <select className="input py-1 text-xs" value={ef.branch} onChange={(v) => setEf({ ...ef, branch: v.target.value })}>
                          <option value="">Shared</option>
                          {branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                      ) : (e.branch_name ?? <span className="opacity-50">Shared</span>)}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    {u ? <Badge tone="pine">{u.username} · {u.role}</Badge> : <span className="text-muted">No login</span>}
                  </td>
                  <td className="px-4 py-3">{e.status}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {editing ? (
                      <>
                        <button className="btn-ghost text-xs py-1 px-2" disabled={saveEdit.isPending} onClick={() => setEditingId(null)}>Cancel</button>
                        <button className="btn-primary text-xs py-1 px-2" disabled={saveEdit.isPending} onClick={() => saveEdit.mutate(e.id)}>Save</button>
                      </>
                    ) : (
                      <>
                        {canAccess("hr") && (
                          <Link to={`/hr?edit=${e.id}`} className="text-pine text-xs py-1 px-2">View payroll →</Link>
                        )}
                        <button className="btn-ghost text-xs py-1 px-2" onClick={() => startEdit(e)}>Edit</button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
