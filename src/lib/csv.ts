/** Minimal CSV read/write — no xlsx dependency needed since Excel opens
 *  and saves .csv natively; this covers "give me an Excel file" imports
 *  and exports across the various Master screens. */

export function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function toCsv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map((v) => csvEscape(String(v))).join(",")).join("\r\n");
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "", inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQuotes = false; }
      else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

export function parseCsv(text: string): string[][] {
  return text.split(/\r\n|\n/).filter((l) => l.trim().length > 0).map(parseCsvLine);
}

export function downloadFile(filename: string, content: string) {
  const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8;" }); // BOM so Excel opens ₹/UTF-8 cleanly
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
