import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { BarChart } from "../../design/BarChart";
import { Card, PageHeader, Spinner } from "../../design/ui";
import { api, getAccess } from "../../lib/api";
import { money } from "../../lib/money";

interface Group { group: string; tiles: string[] }
interface Catalogue { groups: Group[]; allowed_reports: string[] }
interface ReportData {
  title: string;
  kpis: { label: string; value: string | number; money?: boolean }[];
  series_label: string;
  bars: { name: string; value: number }[];
  /** Optional order-level records rendered as a table under the chart. */
  records?: { columns: string[]; rows: (string | number)[][] };
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
  { key: "aggregator", label: "Zomato / Swiggy" },
  { key: "recipe_consumption", label: "Recipe-wise consumption" },
  { key: "sales_vs_consumption", label: "Sales vs consumption" },
  { key: "purchase_vs_consumption", label: "Purchase vs consumption" },
  { key: "food_cost", label: "Food cost" },
  { key: "item_profitability", label: "Item profitability" },
];

const QUICK_EXPORTS = [
  { key: "sales", label: "Sales summary" },
  { key: "tax", label: "GST summary" },
  { key: "occupancy", label: "Room status" },
  { key: "accounting", label: "Accounting (ERP)" },
  { key: "aggregator", label: "Zomato/Swiggy records" },
  { key: "guests", label: "Guest report (statutory)" },
];

export function Reports() {
  const [view, setView] = useState("sales");
  const { data, isLoading } = useQuery({
    queryKey: ["catalogue"],
    queryFn: async () => (await api.get<Catalogue>("/reports/catalogue/")).data,
  });
  // Only show tabs/exports for reports this role can actually pull —
  // matches the backend's per-report scoping (see ROLE_REPORT_ACCESS). Falls
  // back to the first allowed tab if the default "sales" somehow isn't one.
  const allowed = new Set(data?.allowed_reports ?? []);
  const activeView = allowed.has(view) ? view : VIEWS.find((v) => allowed.has(v.key))?.key ?? view;
  const { data: report } = useQuery({
    queryKey: ["report-view", activeView],
    queryFn: async () => (await api.get<ReportData>(`/reports/view/?report=${activeView}`)).data,
    enabled: !!data,
  });

  if (isLoading || !data) return <Spinner />;

  const visibleViews = VIEWS.filter((v) => allowed.has(v.key));

  return (
    <div>
      <PageHeader title="Reports" subtitle="Live viewer · export to XLSX / CSV" />

      {/* In-app report viewer with chart */}
      <Card className="mb-4">
        <div className="flex flex-wrap gap-2 mb-4">
          {visibleViews.map((v) => (
            <button key={v.key} onClick={() => setView(v.key)}
              className={`pill ${activeView === v.key ? "bg-ink text-white" : "bg-hairline text-body"}`}>
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
                  <div className="stat-num text-2xl">{k.money ? money(k.value) : k.value}</div>
                  <div className="text-xs text-muted mt-1">{k.label}</div>
                </div>
              ))}
              <div className="flex gap-2">
                <button className="btn-outline text-xs py-1" onClick={() => download(activeView, "xlsx")}>Export XLSX</button>
                <button className="btn-ghost text-xs py-1" onClick={() => download(activeView, "csv")}>CSV</button>
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted mb-2">{report.series_label}</div>
              <BarChart bars={report.bars} />
            </div>
          </div>
        )}

        {/* Record-level rows (e.g. every Zomato/Swiggy order) */}
        {report?.records && (
          <div className="mt-6">
            <div className="text-xs uppercase tracking-wide text-muted mb-2">
              Records ({report.records.rows.length})
            </div>
            <div className="overflow-x-auto rounded-card border border-hairline">
              <table className="w-full text-sm">
                <thead className="bg-cream text-muted text-xs uppercase tracking-wide">
                  <tr>
                    {report.records.columns.map((c) => (
                      <th key={c} className={`px-4 py-2.5 ${["Items", "Total"].includes(c) ? "text-right" : "text-left"}`}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.records.rows.map((row, i) => (
                    <tr key={i} className="border-t border-line">
                      {row.map((cell, j) => (
                        <td key={j} className={`px-4 py-2 ${
                          report.records!.columns[j] === "Total" ? "text-right font-medium"
                            : report.records!.columns[j] === "Items" ? "text-right" : ""}`}>
                          {report.records!.columns[j] === "Total" ? money(cell) : cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {!report.records.rows.length && (
                    <tr><td colSpan={report.records.columns.length}
                      className="px-4 py-6 text-center text-muted text-sm">No records yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      <Card className="mb-4">
        <div className="font-semibold mb-3">Quick exports</div>
        <div className="grid grid-cols-4 gap-3">
          {QUICK_EXPORTS.filter((r) => allowed.has(r.key)).map((r) => (
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
        {data.groups.map((g) => (
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
