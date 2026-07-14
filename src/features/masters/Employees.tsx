import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useToast } from "../../design/Toast";
import { Badge, Card, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";
import { amount, digits } from "../../lib/inputs";

interface Employee {
  id: number; name: string; department: string; role: string; status: string;
}
interface User { username: string; name: string; role: string }
interface MasterItem { id: number; name: string; active: boolean }

export function Employees() {
  const qc = useQueryClient();
  const toast = useToast();
  const empty = { name: "", department: "", role: "", phone: "", monthly_salary: "" };
  const [f, setF] = useState(empty);

  const { data: staff, isLoading } = useQuery({
    queryKey: ["employees-master"],
    queryFn: async () => (await api.get<Employee[]>("/hr/")).data,
  });
  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: async () => (await api.get<User[]>("/auth/users/")).data,
  });
  // Department & designation dropdowns come from the masters (Settings > Masters).
  const { data: departments } = useQuery({
    queryKey: ["master-departments"],
    queryFn: async () => (await api.get<MasterItem[]>("/masters/departments/")).data,
  });
  const { data: designations } = useQuery({
    queryKey: ["master-designations"],
    queryFn: async () => (await api.get<MasterItem[]>("/masters/designations/")).data,
  });

  const create = useMutation({
    mutationFn: async () => (await api.post("/hr/", f)).data,
    onSuccess: () => {
      setF(empty); toast("Employee added");
      qc.invalidateQueries({ queryKey: ["employees-master"] });
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not add employee", "error"),
  });
  const toggle = useMutation({
    mutationFn: async (e: Employee) =>
      (await api.post(`/hr/${e.id}/set_status/`,
        { status: e.status === "Active" ? "Inactive" : "Active" })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees-master"] }),
  });

  if (isLoading || !staff) return <Spinner />;
  const userByName = new Map((users ?? []).map((u) => [u.name, u]));
  const active = (items?: MasterItem[]) => (items ?? []).filter((i) => i.active);
  const set = (k: string, v: string) => setF({ ...f, [k]: v });

  return (
    <div>
      <PageHeader title="Employees" subtitle="Staff directory & system access" />

      <Card className="mb-4">
        <div className="font-semibold mb-1">Add employee</div>
        <div className="text-sm text-muted mb-3">
          A staff record for the roster and payroll — it doesn't create a login
          (that's Settings &gt; Users &amp; Roles). Departments and designations are
          managed in Settings &gt; Masters.
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 mb-2">
          <input className="input" placeholder="Full name" value={f.name}
            onChange={(e) => set("name", e.target.value)} />
          <select className="input" value={f.department} onChange={(e) => set("department", e.target.value)}>
            <option value="">Department…</option>
            {active(departments).map((d) => <option key={d.id}>{d.name}</option>)}
          </select>
          <select className="input" value={f.role} onChange={(e) => set("role", e.target.value)}>
            <option value="">Designation…</option>
            {active(designations).map((d) => <option key={d.id}>{d.name}</option>)}
          </select>
          <input className="input" inputMode="numeric" placeholder="Phone" value={f.phone}
            onChange={(e) => set("phone", digits(e.target.value, 10))} />
          <input className="input" inputMode="decimal" placeholder="Monthly salary" value={f.monthly_salary}
            onChange={(e) => set("monthly_salary", amount(e.target.value))} />
        </div>
        <button className="btn-primary" disabled={!f.name.trim() || !f.department || !f.role || create.isPending}
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
              <th className="text-left px-4 py-3">Designation</th>
              <th className="text-left px-4 py-3">System access</th>
              <th className="text-left px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((e) => {
              const u = userByName.get(e.name);
              return (
                <tr key={e.id} className="border-t border-line">
                  <td className="px-4 py-3 font-medium">{e.name}</td>
                  <td className="px-4 py-3">{e.department}</td>
                  <td className="px-4 py-3 text-muted">{e.role}</td>
                  <td className="px-4 py-3">
                    {u ? <Badge tone="pine">{u.username} · {u.role}</Badge> : <span className="text-muted">No login</span>}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      className={`pill ${e.status === "Active" ? "bg-pine text-white" : "bg-hairline text-muted"}`}
                      onClick={() => toggle.mutate(e)}
                    >
                      {e.status}
                    </button>
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
