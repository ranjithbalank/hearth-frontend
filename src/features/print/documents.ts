/** Print-ready documents (open in a new window, trigger the print dialog).
 *  Used for GST tax invoices (folio) and POS bills/receipts. */
import { getAccess } from "../../lib/api";
import type { Folio, Order } from "../../lib/types";

async function downloadPdf(path: string, filename: string) {
  const res = await fetch(path, { headers: { Authorization: `Bearer ${getAccess()}` } });
  if (!res.ok) return;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Download the server-generated GST invoice PDF for a folio. */
export const downloadInvoicePdf = (folio: { id: number; invoice_no?: string }) =>
  downloadPdf(`/api/folios/${folio.id}/invoice_pdf/`, `${folio.invoice_no || "folio-" + folio.id}.pdf`);

/** Download the POS bill/receipt PDF. */
export const downloadBillPdf = (order: { id: number; bill_no?: string }) =>
  downloadPdf(`/api/pos/orders/${order.id}/bill_pdf/`, `${order.bill_no || "bill-" + order.id}.pdf`);

/** Download the Banquet Event Order (BEO) PDF. */
export const downloadBeoPdf = (event: { id: number; beo_no?: string }) =>
  downloadPdf(`/api/banquets/${event.id}/beo_pdf/`, `${event.beo_no || "BEO-" + event.id}.pdf`);

const inr = (v: string | number) =>
  "₹" + new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2 }).format(Number(v) || 0);

function openAndPrint(html: string, width = 800) {
  const w = window.open("", "_blank", `width=${width},height=1000`);
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

const BASE_CSS = `
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; color: #16221F; }
  .head { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #1C6B57; padding-bottom:10px; }
  .brand { font-family: Georgia, serif; font-size:24px; color:#1C6B57; font-weight:600; }
  .muted { color:#8A8478; font-size:12px; }
  .doc h1 { font-size:17px; margin:0; letter-spacing:1px; text-align:right; }
  table { width:100%; border-collapse:collapse; font-size:12.5px; margin-top:16px; }
  th { text-align:left; background:#F6F2EC; color:#8A8478; font-size:10.5px; text-transform:uppercase; letter-spacing:.05em; padding:7px 8px; }
  td { padding:7px 8px; border-bottom:1px solid #EDE7DC; }
  td.r, th.r { text-align:right; }
  .tot { margin-top:12px; margin-left:auto; width:45%; font-size:13px; }
  .tot div { display:flex; justify-content:space-between; padding:3px 0; }
  .tot .grand { border-top:2px solid #1C6B57; margin-top:6px; padding-top:8px; font-weight:700; font-size:15px; }
  .foot { margin-top:24px; font-size:10.5px; color:#B6AF9F; text-align:center; }
`;

export function printInvoice(folio: Folio, propertyName: string, gstin: string) {
  const rows = folio.lines.map((l) => `
    <tr><td>${l.description}</td>
        <td class="r">${inr(l.taxable)}</td>
        <td class="r">${inr(l.cgst)}</td>
        <td class="r">${inr(l.sgst)}</td>
        <td class="r">${inr(l.total)}</td></tr>`).join("");
  const cgst = folio.lines.reduce((s, l) => s + Number(l.cgst), 0);
  const sgst = folio.lines.reduce((s, l) => s + Number(l.sgst), 0);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${folio.invoice_no || folio.id}</title>
  <style>${BASE_CSS}</style></head><body>
    <div class="head">
      <div><div class="brand">${propertyName}</div><div class="muted">${gstin ? "GSTIN: " + gstin : ""}</div></div>
      <div class="doc"><h1>TAX INVOICE</h1>
        <div class="muted">No. ${folio.invoice_no || "—"}<br>${new Date().toLocaleDateString("en-IN")}</div></div>
    </div>
    <div style="margin-top:14px; font-size:13px;">
      <b>Bill to:</b> ${folio.guest_name}${folio.room_number ? ` &nbsp;·&nbsp; Room ${folio.room_number}` : ""}
    </div>
    <table>
      <thead><tr><th>Description</th><th class="r">Taxable</th><th class="r">CGST</th><th class="r">SGST</th><th class="r">Amount</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5">No charges</td></tr>'}</tbody>
    </table>
    <div class="tot">
      <div><span>Taxable</span><span>${inr(Number(folio.charges_total) - cgst - sgst)}</span></div>
      <div><span>CGST</span><span>${inr(cgst)}</span></div>
      <div><span>SGST</span><span>${inr(sgst)}</span></div>
      <div class="grand"><span>Total</span><span>${inr(folio.charges_total)}</span></div>
      <div><span>Paid</span><span>${inr(folio.paid_total)}</span></div>
      <div><span>Balance</span><span>${inr(folio.balance)}</span></div>
    </div>
    <div class="foot">${propertyName} · GST-compliant tax invoice · computer-generated, no signature required</div>
  </body></html>`;
  openAndPrint(html);
}

export function printKot(order: Order, propertyName: string) {
  // Print only the latest fired round — earlier rounds already went to the kitchen.
  const latest = order.lines.filter((l) => l.kot_fired && l.kot_no === order.kot_no);
  const fired = latest.length ? latest : order.lines.filter((l) => l.kot_fired);
  const lines = (fired.length ? fired : order.lines).map((l) =>
    `<tr><td class="r" style="width:34px">${l.qty}</td><td>${l.name}${l.note ? ` <i>(${l.note})</i>` : ""}</td></tr>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${order.kot_no || "KOT"}</title>
  <style>${BASE_CSS}
    body { width: 300px; }
    .kt { font-family: 'JetBrains Mono', monospace; }
    h1 { font-size:16px; margin:0; }
    td { font-size:14px; padding:6px 6px; border-bottom:1px dashed #DDD5C7; }
  </style></head><body>
    <div style="text-align:center; border-bottom:2px dashed #16221F; padding-bottom:8px;">
      <h1>KITCHEN ORDER · KOT</h1>
      ${order.token_no ? `<div class="kt" style="font-size:26px; font-weight:bold; margin:4px 0;">TOKEN ${order.token_no}</div>` : ""}
      <div class="muted kt">${order.kot_no || "#" + order.id} · ${order.table_name ? "Table " + order.table_name : (order.mode || "")}</div>
      <div class="muted kt">${new Date().toLocaleString("en-IN")}</div>
    </div>
    <table class="kt"><tbody>${lines}</tbody></table>
    <div class="foot kt">${propertyName} · expedite</div>
  </body></html>`;
  openAndPrint(html, 360);
}

export interface ZReport {
  tenders: { tender: string; amount: string; count: number; tip: string }[];
  total: string;
  tips: string;
}

export function printZReport(z: ZReport, propertyName: string) {
  const rows = z.tenders.map((t) =>
    `<tr><td>${t.tender}</td><td class="r">${t.count}</td><td class="r">${inr(t.tip)}</td><td class="r">${inr(t.amount)}</td></tr>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Day-end Z</title>
  <style>${BASE_CSS} body{width:420px;}</style></head><body>
    <div class="head" style="border-bottom-width:2px;">
      <div><div class="brand">${propertyName}</div><div class="muted">Day-end (Z) settlement</div></div>
      <div class="doc"><h1 style="font-size:14px;">Z-REPORT</h1><div class="muted">${new Date().toLocaleDateString("en-IN")}</div></div>
    </div>
    <table>
      <thead><tr><th>Tender</th><th class="r">Txns</th><th class="r">Tips</th><th class="r">Amount</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4">No collections</td></tr>'}</tbody>
    </table>
    <div class="tot" style="width:100%;">
      <div><span>Total tips</span><span>${inr(z.tips)}</span></div>
      <div class="grand"><span>Total collected</span><span>${inr(z.total)}</span></div>
    </div>
    <div class="foot">${propertyName} · cashier reconciliation · count cash against this figure</div>
  </body></html>`;
  openAndPrint(html, 480);
}
