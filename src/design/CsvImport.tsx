import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useToast } from "./Toast";
import { Badge, Card } from "./ui";
import { api, getAccess } from "../lib/api";

interface ImportResult {
  created: number;
  skipped_existing: string[];
  errors: { row: number; name: string; reason: string }[];
}

/** The masters' bulk-onboarding card: download the CSV format, fill it in
 *  Excel, upload it back — per-row results shown inline. `path` is the API
 *  endpoint that serves the template on GET and imports on POST. */
export function CsvImport({ path, templateFilename, noun, invalidate, hint }: {
  path: string;
  templateFilename: string;
  noun: string;                      // "dish", "supplier", "room"…
  invalidate: string[];              // react-query keys to refresh after import
  hint?: string;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [result, setResult] = useState<ImportResult | null>(null);

  async function downloadTemplate() {
    const res = await fetch(`/api${path}`, {
      headers: { Authorization: `Bearer ${getAccess()}` },
    });
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = templateFilename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = (await api.post(path, fd)).data as ImportResult;
      setResult(r);
      if (r.created) {
        toast(`${r.created} ${noun}(s) imported`);
        for (const key of invalidate) qc.invalidateQueries({ queryKey: [key] });
      } else if (!r.errors.length) {
        toast(`Nothing new — every ${noun} in the file already exists`);
      }
    } catch (err: any) {
      toast(err?.response?.data?.detail ?? "Import failed — use the downloaded format", "error");
    }
  }

  return (
    <Card className="mb-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-[260px]">
          <div className="font-semibold">Import from Excel / CSV</div>
          <div className="text-sm text-muted">
            {hint ?? `Setting up many ${noun}s? Download the format, fill it in Excel, and upload once.`}
          </div>
        </div>
        <button className="btn-outline text-sm" onClick={downloadTemplate}>
          ⬇ Download format
        </button>
        <label className="btn-primary text-sm cursor-pointer">
          ⬆ Upload file
          <input type="file" accept=".csv,.xlsx" className="hidden"
            onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
      </div>
      {result && (
        <div className="border-t border-line mt-3 pt-3 text-sm space-y-1">
          <div>
            <Badge tone="pine">{result.created} created</Badge>{" "}
            {!!result.skipped_existing.length && (
              <span className="text-muted text-xs">
                skipped (already exist): {result.skipped_existing.join(", ")}
              </span>
            )}
          </div>
          {result.errors.map((er) => (
            <div key={er.row} className="text-clay text-xs">
              Row {er.row} — {er.name}: {er.reason}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
