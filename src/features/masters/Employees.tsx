import { useQuery } from "@tanstack/react-query";

import { Badge, Card, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";

interface Employee {
  id: number; name: string; department: string; role: string; status: string;
}
interface User { username: string; name: string; role: string }

export function Employees() {
  const { data: staff, isLoading } = useQuery({
    queryKey: ["employees-master"],
    queryFn: async () => (await api.get<Employee[]>("/hr/")).data,
  });
  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: async () => (await api.get<User[]>("/auth/users/")).data,
  });

  if (isLoading || !staff) return <Spinner />;
  const userByName = new Map((users ?? []).map((u) => [u.name, u]));

  return (
    <div>
      <PageHeader title="Employees" subtitle="Staff directory & system access" />
      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-cream text-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Department</th>
              <th className="text-left px-4 py-3">Role</th>
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
                  <td className="px-4 py-3">{e.status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
