import { useQuery } from "@tanstack/react-query";

import { Card, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";

interface Matrix {
  roles: string[];
  matrix: { module: string; cells: boolean[] }[];
}

export function RoleMatrix() {
  const { data, isLoading } = useQuery({
    queryKey: ["role-matrix"],
    queryFn: async () => (await api.get<Matrix>("/auth/roles/matrix/")).data,
  });

  if (isLoading || !data) return <Spinner />;

  return (
    <div>
      <PageHeader title="Role Mapping" subtitle="Role × module access — enforced server-side" />
      <Card className="overflow-x-auto">
        <table className="text-sm">
          <thead>
            <tr>
              <th className="text-left py-2 pr-4 sticky left-0 bg-surface">Module</th>
              {data.roles.map((r) => (
                <th key={r} className="px-3 py-2 text-xs text-muted font-medium whitespace-nowrap">
                  {r}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.matrix.map((row) => (
              <tr key={row.module} className="border-t border-line">
                <td className="py-1.5 pr-4 font-mono text-xs sticky left-0 bg-surface">{row.module}</td>
                {row.cells.map((on, i) => (
                  <td key={i} className="px-3 py-1.5 text-center">
                    {on ? (
                      <span className="inline-block h-4 w-4 rounded-full bg-pine" title="allowed" />
                    ) : (
                      <span className="inline-block h-4 w-4 rounded-full bg-hairline" title="denied" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-muted mt-3">
        Read-only view of the server-enforced allow-lists. Each role's nav and API are gated by this
        matrix combined with the property's edition entitlements.
      </p>
    </div>
  );
}
