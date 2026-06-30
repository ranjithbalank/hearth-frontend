/** Print-ready documents (open in a new window, trigger the print dialog).
 *  Used for GST tax invoices (folio) and POS bills/receipts. */
import type { Folio, Order } from "../../lib/types";

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

export function printBill(order: Order, propertyName: string) {
  const rows = order.lines.map((l) => `
    <tr><td>${l.name}</td><td class="r">${l.qty}</td>
        <td class="r">${inr(l.unit_price)}</td>
        <td class="r">${inr(Number(l.unit_price) * l.qty)}</td></tr>`).join("");
  const t = order.totals;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Bill ${order.kot_no || order.id}</title>
  <style>${BASE_CSS}
    body { width: 320px; }
    .brand { font-size:20px; }
  </style></head><body>
    <div class="head" style="border-bottom-width:2px;">
      <div><div class="brand">${propertyName}</div><div class="muted">${order.table_name ? "Table " + order.table_name : (order.mode || "")}</div></div>
      <div class="doc"><h1 style="font-size:14px;">BILL</h1><div class="muted">${order.kot_no || ("#" + order.id)}</div></div>
    </div>
    <table>
      <thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amt</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="tot" style="width:100%;">
      <div><span>Subtotal</span><span>${inr(t.subtotal)}</span></div>
      ${Number(t.discount) > 0 ? `<div><span>Discount</span><span>-${inr(t.discount)}</span></div>` : ""}
      <div><span>CGST</span><span>${inr(t.cgst)}</span></div>
      <div><span>SGST</span><span>${inr(t.sgst)}</span></div>
      <div class="grand"><span>Total</span><span>${inr(t.total)}</span></div>
    </div>
    <div class="foot">Thank you · ${propertyName}</div>
  </body></html>`;
  openAndPrint(html, 420);
}
