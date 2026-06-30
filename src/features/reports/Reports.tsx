import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { BarChart } from "../../design/BarChart";
import { Card, PageHeader, Spinner } from "../../design/ui";
import { api, getAccess } from "../../lib/api";
import { inr } from "../../lib/money";

interface Group { group: string; tiles: string[] }
interface ReportData {
  title: string;
  kpis: { label: string; value: string | number; money?: boolean }[];
  series_label: string;
  bars: { name: string; value: number }[];
}

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

const VIEWS = [
  { key: "sales", label: "Sales summary" },
  { key: "tax", label: "GST by slab" },
  { key: "source", label: "Bookings by source" },
  { key: "occupancy", label: "Room status" },
];

export function Reports() {
  const [view, setView] = useState("sales");
  const { data, isLoading } = useQuery({
    queryKey: ["catalogue"],
    queryFn: async () => (await api.get<Group[]>("/reports/catalogue/")).data,
  });
  const { data: report } = useQuery({
    queryKey: ["report-view", view],
    queryFn: async () => (await api.get<ReportData>(`/reports/view/?report=${view}`)).data,
  });

  if (isLoading || !data) return <Spinner />;

  return (
    <div>
      <PageHeader title="Reports" subtitle="Live viewer · export to XLSX / CSV" />

      {/* In-app report viewer with chart */}
      <Card className="mb-4">
        <div className="flex flex-wrap gap-2 mb-4">
          {VIEWS.map((v) => (
            <button key={v.key} onClick={() => setView(v.key)}
              className={`pill ${view === v.key ? "bg-ink text-white" : "bg-hairline text-body"}`}>
              {v.label}
            </button>
          ))}
        </div>
        {report && (
          <div className="grid grid-cols-[300px_1fr] gap-6">
            <div className="space-y-3">
              <div className="font-display text-xl">{report.title}</div>
              {report.kpis.map((k) => (
                <div key={k.label} className="card p-4">
                  <div className="stat-num text-2xl">{k.money ? inr(k.value) : k.value}</div>
                  <div className="text-xs text-muted mt-1">{k.label}</div>
                </div>
              ))}
              <div className="flex gap-2">
                <button className="btn-outline text-xs py-1" onClick={() => download(view, "xlsx")}>Export XLSX</button>
                <button className="btn-ghost text-xs py-1" onClick={() => download(view, "csv")}>CSV</button>
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted mb-2">{report.series_label}</div>
              <BarChart bars={report.bars} />
            </div>
          </div>
        )}
      </Card>

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
