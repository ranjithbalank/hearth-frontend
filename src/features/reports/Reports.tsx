import { useQuery } from "@tanstack/react-query";

import { Card, PageHeader, Spinner } from "../../design/ui";
import { api } from "../../lib/api";

interface Group { group: string; tiles: string[] }

export function Reports() {
  const { data, isLoading } = useQuery({
    queryKey: ["catalogue"],
    queryFn: async () => (await api.get<Group[]>("/reports/catalogue/")).data,
  });

  if (isLoading || !data) return <Spinner />;

  return (
    <div>
      <PageHeader title="Reports" subtitle="Report catalogue · export to PDF / XLSX (coming soon)" />
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
