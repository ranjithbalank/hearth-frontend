import { useQuery } from "@tanstack/react-query";

import { Card, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";

interface Employee {
  id: number; name: string; department: string; role: string; shifts: string[]; status: string;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SHIFT_TONE: Record<string, string> = {
  M: "bg-pine-50 text-pine",
  E: "bg-amber-50 text-amber-600",
  N: "bg-info-50 text-info",
  O: "bg-hairline text-muted",
};

export function Hr() {
  const { data, isLoading } = useQuery({
    queryKey: ["hr"],
    queryFn: async () => (await api.get<Employee[]>("/hr/")).data,
  });

  if (isLoading || !data) return <Spinner />;

  return (
    <div>
      <PageHeader title="HR & Staff" subtitle="Weekly roster" />
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
    </div>
  );
}
