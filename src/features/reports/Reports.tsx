import { useQuery } from "@tanstack/react-query";

import { Card, PageHeader, Spinner } from "../../design/ui";
import { api, getAccess } from "../../lib/api";

interface Group { group: string; tiles: string[] }

async function download(report: string, format: "xlsx" | "csv") {
  const res = await fetch(`/api/reports/export/?report=${report}&fmt=${format}`, {
    headers: { Authorization: `Bearer ${getAccess()}` },
  });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${report}.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}

export function Reports() {
  const { data, isLoading } = useQuery({
    queryKey: ["catalogue"],
    queryFn: async () => (await api.get<Group[]>("/reports/catalogue/")).data,
  });

  if (isLoading || !data) return <Spinner />;

  return (
    <div>
      <PageHeader title="Reports" subtitle="Report catalogue · export to XLSX / CSV" />

      <Card className="mb-4">
        <div className="font-semibold mb-3">Quick exports</div>
        <div className="grid grid-cols-4 gap-3">
          {[
            { key: "sales", label: "Sales summary" },
            { key: "tax", label: "GST summary" },
            { key: "occupancy", label: "Room status" },
            { key: "accounting", label: "Accounting (ERP)" },
            { key: "guests", label: "Guest report (statutory)" },
          ].map((r) => (
            <div key={r.key} className="rounded-card border border-hairline p-3">
              <div className="font-medium text-sm mb-2">{r.label}</div>
              <div className="flex gap-2">
                <button className="btn-outline text-xs py-1" onClick={() => download(r.key, "xlsx")}>XLSX</button>
                <button className="btn-ghost text-xs py-1" onClick={() => download(r.key, "csv")}>CSV</button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        {data.map((g) => (
          <Card key={g.group}>
            <div className="font-semibold mb-3">{g.group}</div>
            <div className="flex flex-wrap gap-2">
              {g.tiles.map((t) => (
                <span key={t} className="pill bg-hairline text-body">{t}</span>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
