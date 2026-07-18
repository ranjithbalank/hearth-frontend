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

async function download(report: string, format: "xlsx" | "csv", from = "", to = "") {
  const range = `${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`;
  const res = await fetch(`/api/reports/export/?report=${report}&fmt=${format}${range}`, {
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

/** The viewer's report picker, grouped by department so the long list stays
 *  scannable. Export-only reports (guests, accounting) live in Quick exports. */
const VIEW_GROUPS = [
  { group: "Overview", views: [{ key: "sales", label: "Sales summary" }] },
  { group: "Rooms", views: [
    { key: "occupancy", label: "Room status" },
    { key: "arrivals", label: "Arrivals & departures" },
    { key: "night_audit", label: "Night audit" },
    { key: "noshow", label: "No-show & cancellation" },
    { key: "source", label: "Bookings by source" },
  ] },
  { group: "F&B", views: [
    { key: "discounts", label: "Discounts & voids" },
    { key: "aggregator", label: "Zomato / Swiggy" },
  ] },
  { group: "Inventory", views: [
    { key: "recipe_consumption", label: "Recipe-wise consumption" },
    { key: "sales_vs_consumption", label: "Sales vs consumption" },
    { key: "purchase_vs_consumption", label: "Purchase vs consumption" },
    { key: "food_cost", label: "Food cost" },
    { key: "item_profitability", label: "Item profitability" },
  ] },
  { group: "Finance", views: [{ key: "tax", label: "GST by slab" }] },
];

const VIEWS = VIEW_GROUPS.flatMap((g) => g.views);

const QUICK_EXPORTS = [
  { key: "sales", label: "Sales summary" },
  { key: "tax", label: "GST summary" },
  { key: "occupancy", label: "Room status" },
  { key: "accounting", label: "Accounting (ERP)" },
  { key: "aggregator", label: "Zomato/Swiggy records" },
  { key: "guests", label: "Guest report (statutory)" },
];

// Local-date ISO (toISOString shifts a day back for IST-like timezones).
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Date-range presets. Empty from+to = all time. */
const PRESETS = [
  { label: "Today", range: () => ({ from: iso(new Date()), to: iso(new Date()) }) },
  { label: "7 days", range: () => {
    const d = new Date(); d.setDate(d.getDate() - 6);
    return { from: iso(d), to: iso(new Date()) };
  } },
  { label: "This month", range: () => {
    const now = new Date();
    return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) };
  } },
  { label: "All time", range: () => ({ from: "", to: "" }) },
];

export function Reports() {
  const [view, setView] = useState("sales");
  // Chart mode for the shape of things; table mode for the detail — full
  // names and exact values, no hovering required.
  const [mode, setMode] = useState<"chart" | "table">("chart");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["catalogue"],
    queryFn: async () => (await api.get<Catalogue>("/reports/catalogue/")).data,
  });
  // Only show tabs/exports for reports this role can actually pull —
  // matches the backend's per-report scoping (see ROLE_REPORT_ACCESS). Falls
  // back to the first allowed tab if the default "sales" somehow isn't one.
  const allowed = new Set(data?.allowed_reports ?? []);
  const activeView = allowed.has(view) ? view : VIEWS.find((v) => allowed.has(v.key))?.key ?? view;
  const range = `${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`;
  const { data: report } = useQuery({
    queryKey: ["report-view", activeView, from, to],
    queryFn: async () =>
      (await api.get<ReportData>(`/reports/view/?report=${activeView}${range}`)).data,
    enabled: !!data,
  });

  if (isLoading || !data) return <Spinner />;

  return (
    <div>
      <PageHeader title="Reports" subtitle="Live viewer · export to XLSX / CSV" />

      {/* Master-detail: report menu on the left, selected report on the right */}
      <Card className="mb-4">
        <div className="grid md:grid-cols-[220px_1fr] gap-6">
          <nav className="space-y-4 md:border-r md:border-hairline md:pr-4">
            {VIEW_GROUPS.map((g) => {
              const views = g.views.filter((v) => allowed.has(v.key));
              if (!views.length) return null;
              return (
                <div key={g.group}>
                  <div className="text-xs uppercase tracking-wide text-muted mb-1.5">
                    {g.group}
                  </div>
                  <div className="space-y-1">
                    {views.map((v) => (
                      <button key={v.key} onClick={() => setView(v.key)}
                        className={`block w-full text-left text-sm px-3 py-1.5 rounded-lg transition-colors ${
                          activeView === v.key
                            ? "bg-ink text-white font-medium"
                            : "text-body hover:bg-hairline"}`}>
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </nav>

          <div className="min-w-0">
            {report && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="font-display text-xl">{report.title}</div>
                  <div className="flex items-center gap-2">
                    <div className="flex rounded-full bg-hairline p-0.5 text-xs">
                      {(["chart", "table"] as const).map((m) => (
                        <button key={m} onClick={() => setMode(m)}
                          className={`px-3 py-1 rounded-full capitalize ${
                            mode === m ? "bg-ink text-white font-medium" : "text-muted"}`}>
                          {m}
                        </button>
                      ))}
                    </div>
                    <button className="btn-outline text-xs py-1" onClick={() => download(activeView, "xlsx", from, to)}>Export XLSX</button>
                    <button className="btn-ghost text-xs py-1" onClick={() => download(activeView, "csv", from, to)}>CSV</button>
                  </div>
                </div>

                {/* Date range — presets + custom from/to; empty = all time */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  {PRESETS.map((p) => {
                    const r = p.range();
                    const active = from === r.from && to === r.to;
                    return (
                      <button key={p.label}
                        onClick={() => { setFrom(r.from); setTo(r.to); }}
                        className={`pill text-xs ${active ? "bg-ink text-white" : "bg-hairline text-body"}`}>
                        {p.label}
                      </button>
                    );
                  })}
                  <input type="date" value={from} max={to || undefined}
                    onChange={(e) => setFrom(e.target.value)}
                    className="input py-1 text-xs w-36" aria-label="From date" />
                  <span className="text-xs text-muted">to</span>
                  <input type="date" value={to} min={from || undefined}
                    onChange={(e) => setTo(e.target.value)}
                    className="input py-1 text-xs w-36" aria-label="To date" />
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                  {report.kpis.map((k) => (
                    <div key={k.label} className="card p-4">
                      <div className="stat-num text-2xl">{k.money ? money(k.value) : k.value}</div>
                      <div className="text-xs text-muted mt-1">{k.label}</div>
                    </div>
                  ))}
                </div>
                <div className="text-xs uppercase tracking-wide text-muted mb-2">{report.series_label}</div>
                {mode === "chart" ? (
                  <BarChart bars={report.bars} />
                ) : (
                  <div className="overflow-x-auto rounded-card border border-hairline max-w-xl">
                    <table className="w-full text-sm">
                      <thead className="bg-cream text-muted text-xs uppercase tracking-wide">
                        <tr>
                          <th className="px-4 py-2.5 text-left">{report.series_label}</th>
                          <th className="px-4 py-2.5 text-right">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.bars.map((b, i) => (
                          <tr key={`${b.name}-${i}`} className="border-t border-line">
                            <td className="px-4 py-2">{b.name}</td>
                            <td className="px-4 py-2 text-right font-medium tabular-nums">
                              {b.value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Record-level rows (e.g. every Zomato/Swiggy order) */}
                {report.records && (
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
              </>
            )}
          </div>
        </div>
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
    </div>
  );
}
