import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useToast } from "../../design/Toast";
import { Card, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";

interface Matrix {
  roles: string[];
  matrix: { module: string; cells: boolean[] }[];
  protected: string[];
}

export function RoleMatrix() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ["role-matrix"],
    queryFn: async () => (await api.get<Matrix>("/auth/roles/matrix/")).data,
  });

  const toggle = useMutation({
    mutationFn: async (b: { role: string; module: string; allowed: boolean }) =>
      (await api.post("/auth/roles/matrix/", b)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["role-matrix"] }),
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not update", "error"),
  });

  if (isLoading || !data) return <Spinner />;
  const isProtected = (role: string) => data.protected.includes(role);

  return (
    <div>
      <PageHeader title="Role Mapping" subtitle="Click a cell to grant / revoke a role's access to a module" />
      <Card className="overflow-x-auto">
        <table className="text-sm">
          <thead>
            <tr>
              <th className="text-left py-2 pr-4 sticky left-0 bg-surface">Module</th>
              {data.roles.map((r) => (
                <th key={r} className="px-3 py-2 text-xs text-muted font-medium whitespace-nowrap">
                  {r}{isProtected(r) && <span className="ml-1 text-[10px] text-pine">★</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.matrix.map((row) => (
              <tr key={row.module} className="border-t border-line">
                <td className="py-1.5 pr-4 font-mono text-xs sticky left-0 bg-surface">{row.module}</td>
                {row.cells.map((on, i) => {
                  const role = data.roles[i];
                  const locked = isProtected(role);
                  return (
                    <td key={i} className="px-3 py-1.5 text-center">
                      <button
                        disabled={locked || toggle.isPending}
                        onClick={() => toggle.mutate({ role, module: row.module, allowed: !on })}
                        title={locked ? "Full access — not editable" : on ? "Revoke" : "Grant"}
                        className={`inline-block h-5 w-5 rounded-full transition-colors ${
                          on ? "bg-pine hover:bg-pine-700" : "bg-hairline hover:bg-clay/40"
                        } ${locked ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-muted mt-3">
        ★ Managing Director &amp; General Manager always have full access. Changes apply immediately
        and are enforced on every request (server-side). Users see the updated menu on next sign-in.
      </p>
    </div>
  );
}
