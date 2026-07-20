import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { PhoneInput, joinPhone, splitPhone } from "../../design/PhoneInput";
import { useToast } from "../../design/Toast";
import { Card, Field, PageHeader } from "../../design/ui";
import { api } from "../../lib/api";
import { fmtDate } from "../../lib/date";
import { amount, digits, gstin as gstinFilter, personName } from "../../lib/inputs";
import { currencySymbol } from "../../lib/money";
import { useApp } from "../../lib/app-context";
import { AuditLogPanel } from "./AuditLog";
import { CurrencyPanel, DepartmentsPanel, DesignationsPanel, KitchenStationsPanel, PaymentMethodsPanel } from "./Masters";
import type { Branch, BranchAccess, Entitlement, Role, User } from "../../lib/types";

const PROTECTED_ROLES: Role[] = ["Super Admin", "Managing Director", "General Manager"];

/** Which branch(es) a user operates in, and as what role there — the
 * "where" layer on top of the role dropdown above, which only decides
 * "what". Super Admin/MD/GM need no rows: they're all-branch implicitly. */
function BranchAccessCell({ user, branches }: { user: User; branches: Branch[] }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [branchId, setBranchId] = useState<number | "">("");
  const [role, setRole] = useState<Role>(user.role);
  const [endDate, setEndDate] = useState("");

  const { data: access } = useQuery({
    queryKey: ["branch-access", user.id],
    queryFn: async () => (await api.get<BranchAccess[]>(`/auth/branch-access/?user=${user.id}`)).data,
    enabled: user.branches !== "*",
  });

  const grant = useMutation({
    mutationFn: async () => (await api.post("/auth/branch-access/", {
      user: user.id, branch: branchId, role, end_date: endDate || null,
    })).data,
    onSuccess: () => {
      setAdding(false); setBranchId(""); setEndDate("");
      qc.invalidateQueries({ queryKey: ["branch-access", user.id] });
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not add — already assigned to this branch in this role?", "error"),
  });

  const revoke = useMutation({
    mutationFn: async (id: number) => api.delete(`/auth/branch-access/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branch-access", user.id] });
      qc.invalidateQueries({ queryKey: ["users"] });
    },
  });

  if (user.branches === "*" || PROTECTED_ROLES.includes(user.role)) {
    return <span className="pill bg-pine-50 text-pine">All branches</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {access?.map((a) => (
        <span key={a.id} className="pill bg-hairline text-body flex items-center gap-1">
          {a.branch_code} · {a.role}{a.end_date ? ` (until ${fmtDate(a.end_date)})` : ""}
          <button className="text-muted hover:text-clay ml-0.5" title="Remove" onClick={() => revoke.mutate(a.id)}>×</button>
        </span>
      ))}
      {adding ? (
        <span className="flex items-center gap-1">
          <select className="input py-1 text-xs" value={branchId} onChange={(e) => setBranchId(Number(e.target.value) || "")}>
            <option value="">Branch…</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}
          </select>
          <select className="input py-1 text-xs" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.filter((r) => !PROTECTED_ROLES.includes(r)).map((r) => <option key={r}>{r}</option>)}
          </select>
          <input type="date" className="input py-1 text-xs w-32" placeholder="Until (optional)"
            value={endDate} onChange={(e) => setEndDate(e.target.value)} title="Temporary — leave blank for standing" />
          <button className="btn-primary text-xs px-2 py-1" disabled={!branchId || grant.isPending}
            onClick={() => grant.mutate()}>Add</button>
          <button className="btn-ghost text-xs px-2 py-1" onClick={() => setAdding(false)}>Cancel</button>
        </span>
      ) : (
        <button className="pill bg-cream text-muted hover:text-pine" onClick={() => setAdding(true)}>+ Add branch</button>
      )}
    </div>
  );
}

const ROLES: Role[] = [
  "Super Admin", "Admin", "Managing Director", "CEO", "General Manager",
  "Finance", "Restaurant Manager", "Hotel Manager", "Front Office", "F&B Cashier", "Captain",
  "Housekeeping", "Chef / Kitchen", "Store Keeper", "Bar Captain", "Bar Cashier", "HR Manager",
];

function UsersPanel() {
  const qc = useQueryClient();
  const toast = useToast();
  const { user: me, refreshUser } = useApp();
  const empty = { username: "", first_name: "", last_name: "", role: "F&B Cashier" as Role,
    password: "", passcode: "", discount_cap_type: "none", discount_cap_value: "0" };
  const [f, setF] = useState(empty);
  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: async () => (await api.get<User[]>("/auth/users/")).data,
  });
  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => (await api.get<Branch[]>("/auth/branches/")).data,
  });
  const create = useMutation({
    mutationFn: async () => (await api.post("/auth/users/", f)).data,
    onSuccess: () => { setF(empty); toast("User created"); qc.invalidateQueries({ queryKey: ["users"] }); },
    onError: (e: any) => toast(
      e?.response?.data?.username?.[0] ?? e?.response?.data?.password?.[0]
        ?? e?.response?.data?.detail ?? "Could not create user", "error"),
  });
  const toggle = useMutation({
    mutationFn: async (u: User) => (await api.patch(`/auth/users/${u.id}/`, { is_active: !u.is_active })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
  const set = (k: string, v: string) => setF({ ...f, [k]: v });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [ef, setEf] = useState({
    first_name: "", last_name: "", role: "F&B Cashier" as Role, passcode: "",
    discount_cap_type: "none", discount_cap_value: "0", password: "",
  });
  function startEdit(u: User) {
    setEditingId(u.id);
    setEf({
      first_name: u.first_name, last_name: u.last_name, role: u.role,
      passcode: "", // write-only field — never sent back by the API, so it can't be pre-filled
      password: "", // reset-only: blank leaves the existing password untouched
      discount_cap_type: u.discount_cap_type ?? "none", discount_cap_value: u.discount_cap_value ?? "0",
    });
  }
  const saveEdit = useMutation({
    mutationFn: async (id: number) =>
      (await api.patch(`/auth/users/${id}/`, {
        first_name: ef.first_name, last_name: ef.last_name, role: ef.role,
        discount_cap_type: ef.discount_cap_type, discount_cap_value: ef.discount_cap_value,
        ...(ef.passcode ? { passcode: ef.passcode } : {}),
        ...(ef.password ? { password: ef.password } : {}),
      })).data,
    onSuccess: (_d, id) => {
      setEditingId(null); toast("User updated"); qc.invalidateQueries({ queryKey: ["users"] });
      // If you edited your own record, refresh the shell so your name/role/
      // initials at the bottom-left update immediately (no re-login needed).
      if (me?.id === id) refreshUser();
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not save changes", "error"),
  });

  return (
    <Card>
      <div className="font-semibold mb-3">Users &amp; roles</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <Field label="Username" required>
          <input className="input" value={f.username} onChange={(e) => set("username", e.target.value)} />
        </Field>
        <Field label="First name">
          <input className="input" value={f.first_name} onChange={(e) => set("first_name", personName(e.target.value))} />
        </Field>
        <Field label="Last name">
          <input className="input" value={f.last_name} onChange={(e) => set("last_name", personName(e.target.value))} />
        </Field>
        <Field label="Role">
          <select className="input" value={f.role} onChange={(e) => set("role", e.target.value)}>
            {ROLES.map((r) => <option key={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Password" required>
          <input className="input" type="password" value={f.password} onChange={(e) => set("password", e.target.value)} />
        </Field>
        <Field label="POS passcode" hint="Used for manager overrides">
          <input className="input" inputMode="numeric" value={f.passcode} onChange={(e) => set("passcode", digits(e.target.value, 6))} />
        </Field>
        <Field label="Discount cap">
          <select className="input" value={f.discount_cap_type} onChange={(e) => set("discount_cap_type", e.target.value)}>
            <option value="none">No discount cap</option>
            <option value="percent">% cap</option>
            <option value="fixed">Fixed cap</option>
          </select>
        </Field>
        <Field label="Cap value">
          <input className="input" inputMode="decimal" value={f.discount_cap_value} onChange={(e) => set("discount_cap_value", amount(e.target.value))} disabled={f.discount_cap_type === "none"} />
        </Field>
      </div>
      <button className="btn-primary mb-4" disabled={!f.username || !f.password || create.isPending} onClick={() => create.mutate()}>
        Add user
      </button>

      <table className="w-full text-sm">
        <thead className="text-muted text-xs uppercase">
          <tr>
            <th className="text-left py-2">Name</th><th className="text-left py-2">Username</th>
            <th className="text-left py-2">Role</th><th className="text-left py-2">Branches</th>
            <th className="text-left py-2">Cap</th>
            <th className="text-right py-2">Status</th>
            <th className="text-right py-2">&nbsp;</th>
          </tr>
        </thead>
        <tbody>
          {users?.map((u) => {
            const editing = editingId === u.id;
            // Never let this screen demote the top-level admin roles — same
            // boundary BranchAccessCell already draws for branch access.
            const roleLocked = PROTECTED_ROLES.includes(u.role);
            return (
              <tr key={u.id} className="border-t border-line align-top">
                <td className="py-2 font-medium">
                  {editing ? (
                    <div className="flex gap-1">
                      <input className="input py-1 text-xs w-20" value={ef.first_name} onChange={(e) => setEf({ ...ef, first_name: personName(e.target.value) })} />
                      <input className="input py-1 text-xs w-20" value={ef.last_name} onChange={(e) => setEf({ ...ef, last_name: personName(e.target.value) })} />
                    </div>
                  ) : u.name}
                </td>
                <td className="py-2 font-mono text-xs">{u.username}</td>
                <td className="py-2">
                  {editing ? (
                    roleLocked ? (
                      <span className="text-xs text-muted">{u.role} (protected)</span>
                    ) : (
                      <select className="input py-1 text-xs" value={ef.role} onChange={(e) => setEf({ ...ef, role: e.target.value as Role })}>
                        {ROLES.filter((r) => !PROTECTED_ROLES.includes(r)).map((r) => <option key={r}>{r}</option>)}
                      </select>
                    )
                  ) : u.role}
                </td>
                <td className="py-2">
                  {branches && <BranchAccessCell user={u} branches={branches} />}
                </td>
                <td className="py-2 text-muted">
                  {editing ? (
                    <div className="flex gap-1">
                      <select className="input py-1 text-xs" value={ef.discount_cap_type} onChange={(e) => setEf({ ...ef, discount_cap_type: e.target.value })}>
                        <option value="none">No cap</option>
                        <option value="percent">%</option>
                        <option value="fixed">Fixed</option>
                      </select>
                      <input className="input py-1 text-xs w-16" inputMode="decimal" disabled={ef.discount_cap_type === "none"}
                        value={ef.discount_cap_value} onChange={(e) => setEf({ ...ef, discount_cap_value: amount(e.target.value) })} />
                    </div>
                  ) : (
                    u.discount_cap_type === "percent" ? `${Number(u.discount_cap_value)}%`
                      : u.discount_cap_type === "fixed" ? `${currencySymbol()}${Number(u.discount_cap_value)}` : "—"
                  )}
                </td>
                <td className="py-2 text-right">
                  <button
                    className={`pill ${u.is_active ? "bg-pine text-white" : "bg-hairline text-muted"}`}
                    onClick={() => toggle.mutate(u)}
                  >
                    {u.is_active ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="py-2 text-right whitespace-nowrap">
                  {editing ? (
                    <div className="flex flex-col items-end gap-1">
                      <input className="input py-1 text-xs w-32" inputMode="numeric" placeholder="New passcode"
                        value={ef.passcode} onChange={(e) => setEf({ ...ef, passcode: digits(e.target.value, 6) })} />
                      <input className="input py-1 text-xs w-32" type="password" placeholder="Reset password"
                        autoComplete="new-password"
                        value={ef.password} onChange={(e) => setEf({ ...ef, password: e.target.value })} />
                      {ef.password && ef.password.length < 8 && (
                        <span className="text-[10px] text-clay">Min 8 characters</span>
                      )}
                      <div className="flex gap-1">
                        <button className="btn-ghost text-xs py-1 px-2" disabled={saveEdit.isPending} onClick={() => setEditingId(null)}>Cancel</button>
                        <button className="btn-primary text-xs py-1 px-2" disabled={saveEdit.isPending} onClick={() => saveEdit.mutate(u.id)}>Save</button>
                      </div>
                    </div>
                  ) : (
                    <button className="btn-ghost text-xs py-1 px-2" onClick={() => startEdit(u)}>Edit</button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function PropertyPanel() {
  const { property, refreshProperty } = useApp();
  const initialPhone = splitPhone(property?.phone ?? "");
  const [f, setF] = useState({
    name: property?.name ?? "", gstin: property?.gstin ?? "",
    address: property?.address ?? "",
    phone_code: initialPhone.code, phone: initialPhone.number,
  });
  const [logo, setLogo] = useState(property?.logo ?? "");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 400_000) return alert("Please use a logo under 400 KB.");
    const reader = new FileReader();
    reader.onload = () => setLogo(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function save() {
    setSaving(true);
    try {
      const { phone_code, phone, ...rest } = f;
      await api.patch("/auth/property/", { ...rest, phone: joinPhone(phone_code, phone), logo });
      await refreshProperty();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mb-4">
      <div className="font-semibold mb-1">Property details &amp; branding</div>
      <div className="text-sm text-muted mb-3">Your hotel's name, logo, GSTIN and address — the name/logo appear in the app and print on invoices.</div>

      <div className="flex items-center gap-4 mb-4">
        <div className="h-16 w-16 rounded-xl bg-cream border border-hairline overflow-hidden flex items-center justify-center">
          {logo ? <img src={logo} alt="" className="h-full w-full object-cover" /> : <span className="text-xs text-muted">No logo</span>}
        </div>
        <div>
          <label className="btn-outline text-xs cursor-pointer inline-block">
            Upload logo
            <input type="file" accept="image/*" className="hidden" onChange={onLogo} />
          </label>
          {logo && <button className="btn-ghost text-xs ml-2" onClick={() => setLogo("")}>Remove</button>}
          <div className="text-xs text-muted mt-1">PNG/JPG, square, under 400 KB.</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-muted mb-1">Business name</label>
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted mb-1">GSTIN</label>
          <input className="input font-mono" placeholder="22AAAAA0000A1Z5" value={f.gstin}
            onChange={(e) => setF({ ...f, gstin: gstinFilter(e.target.value) })} />
          {f.gstin.length > 0 && f.gstin.length !== 15 && (
            <div className="text-xs text-clay mt-1">GSTIN is 15 characters ({f.gstin.length}/15)</div>
          )}
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted mb-1">Address</label>
          <input className="input" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted mb-1">Phone</label>
          <PhoneInput code={f.phone_code} number={f.phone}
            onCode={(c) => setF({ ...f, phone_code: c })} onNumber={(n) => setF({ ...f, phone: n })} />
        </div>
      </div>
      <div className="flex items-center gap-3 mt-3">
        <button className="btn-primary" onClick={save} disabled={saving || (f.gstin.length > 0 && f.gstin.length !== 15)}>Save details</button>
        {saved && <span className="text-sm text-pine">Saved ✓</span>}
      </div>
    </Card>
  );
}

type Align = "left" | "center" | "right";

function AlignPicker({ value, onChange }: { value: Align; onChange: (a: Align) => void }) {
  const opts: { k: Align; label: string }[] = [
    { k: "left", label: "◧ Left" }, { k: "center", label: "▣ Center" }, { k: "right", label: "◨ Right" },
  ];
  return (
    <span className="inline-flex rounded-lg border border-hairline overflow-hidden">
      {opts.map((o) => (
        <button key={o.k} type="button" onClick={() => onChange(o.k)}
          className={`text-xs px-2 py-0.5 ${value === o.k ? "bg-pine text-white" : "text-body hover:bg-hairline/60"}`}>
          {o.label}
        </button>
      ))}
    </span>
  );
}

function LetterheadPanel() {
  const { property, refreshProperty } = useApp();
  const [header, setHeader] = useState(property?.doc_header ?? "");
  const [footer, setFooter] = useState(property?.doc_footer ?? "");
  const [headerAlign, setHeaderAlign] = useState<Align>(property?.doc_header_align ?? "left");
  const [footerAlign, setFooterAlign] = useState<Align>(property?.doc_footer_align ?? "center");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Mini editor: wrap the selected text of a textarea in a tag.
  function wrap(id: string, tag: string, value: string, set: (v: string) => void) {
    const el = document.getElementById(id) as HTMLTextAreaElement | null;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    set(value.slice(0, s) + `<${tag}>` + value.slice(s, e) + `</${tag}>` + value.slice(e));
    el.focus();
  }

  async function save() {
    setSaving(true);
    try {
      await api.patch("/auth/property/", {
        doc_header: header, doc_footer: footer,
        doc_header_align: headerAlign, doc_footer_align: footerAlign,
      });
      await refreshProperty();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  // The only markup this editor ever inserts is <b>/<i> via wrap() above —
  // escape everything, then re-open exactly those four literal tag
  // sequences. Anything else typed directly (e.g. <img onerror=...>) stays
  // inert text instead of executing (security review 2026-07, finding F2).
  // Normal header/footer text and real bold/italic formatting render
  // exactly as before.
  const ALLOWED_TAGS: Record<string, string> = {
    "&lt;b&gt;": "<b>", "&lt;/b&gt;": "</b>",
    "&lt;i&gt;": "<i>", "&lt;/i&gt;": "</i>",
  };
  const sanitize = (raw: string) => {
    const escaped = raw.replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]!));
    return escaped.replace(/&lt;\/?[bi]&gt;/g, (tag) => ALLOWED_TAGS[tag] ?? tag);
  };

  const previewLines = (text: string) =>
    text.split("\n").filter((l) => l.trim()).map((l, i) => (
      <div key={i} dangerouslySetInnerHTML={{ __html: sanitize(l) }} />
    ));

  return (
    <Card className="mb-4">
      <div className="font-semibold mb-1">Letterhead &amp; documents</div>
      <div className="text-sm text-muted mb-4">
        Extra lines printed on invoices and bills — tagline, CIN/FSSAI, terms, bank details.
        Use <b>B</b>/<i>I</i> to format. The logo, name, address &amp; GSTIN above are included automatically.
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-1 gap-2">
            <label className="text-xs font-semibold text-muted">Header lines (below the address)</label>
            <span className="flex items-center gap-2">
              <AlignPicker value={headerAlign} onChange={setHeaderAlign} />
              <button className="btn-ghost text-xs px-2 py-0.5 font-bold" onClick={() => wrap("lh-head", "b", header, setHeader)}>B</button>
              <button className="btn-ghost text-xs px-2 py-0.5 italic" onClick={() => wrap("lh-head", "i", header, setHeader)}>I</button>
            </span>
          </div>
          <textarea id="lh-head" className="input w-full font-mono text-xs" rows={3}
            placeholder={"Fine dining since 1998\nFSSAI Lic. No. 12345678901234"}
            value={header} onChange={(e) => setHeader(e.target.value)} />

          <div className="flex items-center justify-between mb-1 mt-3 gap-2">
            <label className="text-xs font-semibold text-muted">Footer — terms / bank details</label>
            <span className="flex items-center gap-2">
              <AlignPicker value={footerAlign} onChange={setFooterAlign} />
              <button className="btn-ghost text-xs px-2 py-0.5 font-bold" onClick={() => wrap("lh-foot", "b", footer, setFooter)}>B</button>
              <button className="btn-ghost text-xs px-2 py-0.5 italic" onClick={() => wrap("lh-foot", "i", footer, setFooter)}>I</button>
            </span>
          </div>
          <textarea id="lh-foot" className="input w-full font-mono text-xs" rows={4}
            placeholder={"Checkout time 11 AM. Tariff subject to change.\nBank: HDFC ****1234 · IFSC HDFC0000001"}
            value={footer} onChange={(e) => setFooter(e.target.value)} />

          <div className="flex items-center gap-3 mt-3">
            <button className="btn-primary" onClick={save} disabled={saving}>Save letterhead</button>
            {saved && <span className="text-sm text-pine">Saved ✓</span>}
          </div>
        </div>

        {/* Live preview of the printed letterhead */}
        <div className="rounded-card border border-hairline bg-white p-5 text-ink">
          <div className="flex justify-between items-start">
            <div>
              {property?.logo && <img src={property.logo} alt="" className="h-10 mb-2 rounded" />}
              <div className="font-display text-lg text-pine leading-tight">{property?.name}</div>
              <div className="text-[10px] text-muted">
                {property?.address && <div>{property.address}</div>}
                {property?.gstin && <div>GSTIN: {property.gstin}</div>}
                <div className={`mt-0.5 text-${headerAlign}`}>{previewLines(header)}</div>
              </div>
            </div>
            <div className="text-right text-[10px] text-muted">
              <div className="font-semibold text-xs text-ink">TAX INVOICE</div>
              No. HRT-202607-00001
            </div>
          </div>
          <div className="border-t-2 border-pine my-2" />
          <div className="text-[10px] text-muted italic py-4 text-center">… bill lines …</div>
          <div className={`border-t border-hairline pt-2 text-[10px] text-muted text-${footerAlign}`}>
            {previewLines(footer)}
            <div className="text-center mt-1 opacity-60">{property?.name} · computer-generated, no signature required</div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function MfaPanel() {
  const { user, refreshProperty } = useApp();
  const [secret, setSecret] = useState<string | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [enabled, setEnabled] = useState(user?.mfa_enabled ?? false);
  const [msg, setMsg] = useState<string | null>(null);

  async function begin() {
    const { data } = await api.post("/auth/mfa/setup/");
    setSecret(data.secret);
    setUri(data.otpauth_uri);
  }
  async function verify() {
    try {
      await api.post("/auth/mfa/verify/", { otp: code });
      setEnabled(true);
      setSecret(null);
      setMsg("MFA enabled — you'll be asked for a code at next sign-in.");
      await refreshProperty();
    } catch {
      setMsg("Invalid code, try again.");
    }
  }
  async function disable() {
    await api.post("/auth/mfa/disable/");
    setEnabled(false);
    setMsg("MFA disabled.");
  }

  return (
    <Card className="mb-4">
      <div className="font-semibold mb-1">Two-factor authentication (TOTP)</div>
      <div className="text-sm text-muted mb-3">
        {enabled ? "MFA is active on your account." : "Protect privileged access with an authenticator app."}
      </div>
      {msg && <div className="text-sm text-pine mb-3">{msg}</div>}
      {enabled ? (
        <button className="btn-outline" onClick={disable}>Disable MFA</button>
      ) : secret ? (
        <div className="space-y-2">
          <div className="text-xs text-muted">Add this secret to your authenticator, then enter a code:</div>
          <code className="block text-sm bg-cream px-3 py-2 rounded-lg break-all">{secret}</code>
          <div className="text-[11px] text-muted break-all">{uri}</div>
          <div className="flex gap-2">
            <input className="input w-40" inputMode="numeric" placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
            <button className="btn-primary" onClick={verify}>Verify &amp; enable</button>
          </div>
        </div>
      ) : (
        <button className="btn-primary" onClick={begin}>Enable MFA</button>
      )}
    </Card>
  );
}

const FLAGS: { key: keyof Entitlement; label: string; desc: string }[] = [
  { key: "hms", label: "Hotel (HMS)", desc: "Rooms, front office, folio, distribution" },
  { key: "restaurant", label: "Restaurant (POS)", desc: "Menu, tables, orders, KOT" },
  { key: "banquets", label: "Banquets & MICE", desc: "Function space and events" },
  { key: "rms", label: "Revenue Management", desc: "Forecasting and dynamic pricing" },
];

function CommissionPanel() {
  const { property, refreshProperty } = useApp();
  const [zomato, setZomato] = useState(property?.zomato_commission_pct ?? "25");
  const [swiggy, setSwiggy] = useState(property?.swiggy_commission_pct ?? "23");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.patch("/auth/property/", {
        zomato_commission_pct: zomato, swiggy_commission_pct: swiggy,
      });
      await refreshProperty();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mb-4">
      <div className="font-semibold mb-1">Aggregator commission</div>
      <div className="text-sm text-muted mb-4">
        Used by the Zomato/Swiggy report to show net realization after the platform's cut.
      </div>
      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div>
          <label className="text-xs text-muted">Zomato commission %</label>
          <input className="input w-full" inputMode="decimal" value={zomato}
            onChange={(e) => setZomato(amount(e.target.value))} />
        </div>
        <div>
          <label className="text-xs text-muted">Swiggy commission %</label>
          <input className="input w-full" inputMode="decimal" value={swiggy}
            onChange={(e) => setSwiggy(amount(e.target.value))} />
        </div>
      </div>
      <div className="flex items-center gap-3 mt-3">
        <button className="btn-primary" onClick={save} disabled={saving}>Save</button>
        {saved && <span className="text-sm text-pine">Saved ✓</span>}
      </div>
    </Card>
  );
}


function DocumentNumberingPanel() {
  const { property, refreshProperty } = useApp();
  const FIELDS = [
    { key: "invoice_prefix" as const, label: "Invoice (folio)" },
    { key: "bill_prefix" as const, label: "POS bill" },
    { key: "po_prefix" as const, label: "Purchase order" },
    { key: "grn_prefix" as const, label: "GRN" },
    { key: "beo_prefix" as const, label: "Banquet BEO" },
  ];
  const [f, setF] = useState({
    invoice_prefix: property?.invoice_prefix ?? "HRT",
    bill_prefix: property?.bill_prefix ?? "BILL",
    po_prefix: property?.po_prefix ?? "PO",
    grn_prefix: property?.grn_prefix ?? "GRN",
    beo_prefix: property?.beo_prefix ?? "BEO",
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const period = new Date().toISOString().slice(0, 7).replace("-", "");

  async function save() {
    setSaving(true);
    try {
      await api.patch("/auth/property/", f);
      await refreshProperty();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="font-semibold mb-1">Document numbering</div>
      <div className="text-sm text-muted mb-4">
        The prefix each document type uses for its sequential number — {"{prefix}"}-{"{YYYYMM}"}-{"{00001}"}, resetting every month.
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
        {FIELDS.map((field) => (
          <div key={field.key}>
            <label className="text-xs text-muted">{field.label} prefix</label>
            <input className="input w-full" value={f[field.key]}
              onChange={(e) => setF({ ...f, [field.key]: e.target.value.toUpperCase() })} />
            <div className="text-xs text-muted mt-1">
              Preview: {f[field.key] || "—"}-{period}-00001
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-4">
        <button className="btn-primary" onClick={save} disabled={saving}>Save</button>
        {saved && <span className="text-sm text-pine">Saved ✓</span>}
      </div>
    </Card>
  );
}

const SECTIONS = [
  { key: "property", label: "Property Details" },
  { key: "letterhead", label: "Letterhead & Documents" },
  { key: "commission", label: "Aggregator Commission" },
  { key: "numbering", label: "Document Numbering" },
  { key: "edition", label: "Edition" },
  { key: "barmode", label: "Bar Operating Mode" },
  { key: "kds", label: "Kitchen Display" },
  { key: "entitlements", label: "Edition Entitlements" },
  { key: "users", label: "Users & Roles" },
  { key: "audit", label: "Audit Log" },
  { key: "currency", label: "Currency", group: "Masters" },
  { key: "departments", label: "Departments", group: "Masters" },
  { key: "designations", label: "Designations", group: "Masters" },
  { key: "tenders", label: "Payment Methods", group: "Masters" },
  { key: "kitchenstations", label: "Kitchen Stations", group: "Masters" },
] as const;
type SectionKey = (typeof SECTIONS)[number]["key"];

export function Settings() {
  const { property, refreshProperty } = useApp();
  const [saving, setSaving] = useState<string | null>(null);
  // ?section= deep-links straight to a panel (e.g. the audit alert
  // sends /settings?section=audit).
  const [params] = useSearchParams();
  const [section, setSection] = useState<SectionKey>(() => {
    const requested = params.get("section");
    return SECTIONS.some((s) => s.key === requested)
      ? (requested as SectionKey) : "property";
  });
  const hasBar = !!property?.entitlement.restaurant;
  const visibleSections = SECTIONS.filter((s) => (s.key !== "barmode" && s.key !== "commission") || hasBar);
  const activeSection = (section === "barmode" || section === "commission") && !hasBar ? "property" : section;

  async function toggle(flag: keyof Entitlement) {
    if (!property) return;
    setSaving(flag);
    try {
      await api.patch("/auth/entitlements/", { [flag]: !property.entitlement[flag] });
      await refreshProperty();
    } finally {
      setSaving(null);
    }
  }

  async function setEdition(edition: string) {
    setSaving(edition);
    try {
      await api.post("/auth/setup/", { edition });
      await refreshProperty();
    } finally {
      setSaving(null);
    }
  }

  async function setBarMode(mode: "separate" | "combined") {
    setSaving(`bar_mode:${mode}`);
    try {
      await api.patch("/auth/entitlements/", { bar_mode: mode });
      await refreshProperty();
    } finally {
      setSaving(null);
    }
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle={`${property?.name} · edition: ${property?.edition}`} />

      <div className="flex flex-col md:flex-row gap-4 items-start">
        <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible md:w-44 md:shrink-0 pb-1 md:pb-0">
          {visibleSections.map((s, i) => (
            <div key={s.key} className="contents">
              {"group" in s && s.group && (!("group" in (visibleSections[i - 1] ?? {})) ) && (
                <div className="hidden md:block text-[10px] font-semibold uppercase tracking-wider text-muted px-3 pt-3 pb-1">
                  {s.group}
                </div>
              )}
              <button
                onClick={() => setSection(s.key)}
                className={`whitespace-nowrap md:w-full text-left rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  activeSection === s.key ? "bg-pine text-white" : "text-body hover:bg-hairline/60"
                }`}
              >
                {s.label}
              </button>
            </div>
          ))}
        </nav>

        <div className="flex-1 min-w-0 space-y-4">
          {activeSection === "property" && <PropertyPanel />}

          {activeSection === "letterhead" && <LetterheadPanel />}

          {activeSection === "commission" && hasBar && <CommissionPanel />}

          {activeSection === "numbering" && <DocumentNumberingPanel />}

          {activeSection === "edition" && (
            <Card>
              <div className="font-semibold mb-1">Edition</div>
              <div className="text-sm text-muted mb-3">
                Switch the whole property between Hotel, Restaurant, or both — this re-applies the
                module entitlements below.
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { k: "hotel", label: "Hotel only", desc: "Rooms, front office, distribution" },
                  { k: "restaurant", label: "Restaurant only", desc: "Standalone POS — no rooms" },
                  { k: "both", label: "Hotel + Restaurant", desc: "Everything on one core" },
                ].map((e) => (
                  <button key={e.k} onClick={() => setEdition(e.k)} disabled={saving === e.k}
                    className={`text-left rounded-card border p-4 ${property?.edition === e.k ? "border-pine bg-pine-50" : "border-hairline"}`}>
                    <div className="font-semibold">{e.label}</div>
                    <div className="text-sm text-muted mt-1">{e.desc}</div>
                  </button>
                ))}
              </div>
            </Card>
          )}

          {activeSection === "barmode" && hasBar && (
            <Card>
              <div className="font-semibold mb-1">Bar operating mode</div>
              <div className="text-sm text-muted mb-3">
                Changeable anytime. Separate gives the bar its own tables, menu, and Bar Captain/Bar
                Cashier logins. Combined folds drinks into the one restaurant POS as a Food/Bar tab —
                no separate bar desk.
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { k: "separate" as const, label: "Separate operation", desc: "Its own tables, menu, and bar-only logins" },
                  { k: "combined" as const, label: "Combined with restaurant", desc: "One POS, one set of roles, drinks in their own tab" },
                ].map((m) => (
                  <button key={m.k} onClick={() => setBarMode(m.k)} disabled={saving === `bar_mode:${m.k}`}
                    className={`text-left rounded-card border p-4 ${property?.entitlement.bar_mode === m.k ? "border-pine bg-pine-50" : "border-hairline"}`}>
                    <div className="font-semibold">{m.label}</div>
                    <div className="text-sm text-muted mt-1">{m.desc}</div>
                  </button>
                ))}
              </div>
            </Card>
          )}

          {activeSection === "kds" && (
            <Card>
              <div className="font-semibold mb-1">Kitchen Display</div>
              <div className="text-sm text-muted mb-3">
                Off: a ticket's items bump ready together — the whole course arrives at the table at
                once. On: the kitchen can mark individual items ready as they finish; the ticket itself
                auto-advances once every item on it is checked.
              </div>
              <button
                onClick={() => toggle("kds_partial_ready")}
                disabled={saving === "kds_partial_ready"}
                className={`text-left rounded-card border p-4 w-full max-w-md ${
                  property?.entitlement.kds_partial_ready ? "border-pine bg-pine-50" : "border-hairline"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Partial ready per item</span>
                  <span className={`pill ${property?.entitlement.kds_partial_ready ? "bg-pine text-white" : "bg-hairline text-muted"}`}>
                    {property?.entitlement.kds_partial_ready ? "On" : "Off"}
                  </span>
                </div>
                <div className="text-sm text-muted mt-1">
                  {property?.entitlement.kds_partial_ready
                    ? "Chef marks each dish ready as it's done — the ticket bumps itself once everything is checked."
                    : "Chef marks the whole ticket ready in one tap once every item is done."}
                </div>
              </button>
            </Card>
          )}

          {activeSection === "entitlements" && (
            <Card>
              <div className="font-semibold mb-1">Edition entitlements</div>
              <div className="text-sm text-muted mb-4">
                Toggling a flag hides its modules across the app (and blocks their APIs).
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {FLAGS.map((f) => {
                  const on = property?.entitlement[f.key];
                  return (
                    <button
                      key={f.key}
                      onClick={() => toggle(f.key)}
                      disabled={saving === f.key}
                      className={`text-left rounded-card border p-4 ${on ? "border-pine bg-pine-50" : "border-hairline"}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{f.label}</span>
                        <span className={`pill ${on ? "bg-pine text-white" : "bg-hairline text-muted"}`}>
                          {on ? "On" : "Off"}
                        </span>
                      </div>
                      <div className="text-sm text-muted mt-1">{f.desc}</div>
                    </button>
                  );
                })}
              </div>
            </Card>
          )}

          {activeSection === "users" && (
            <>
              <UsersPanel />
              <MfaPanel />
            </>
          )}

          {activeSection === "audit" && <AuditLogPanel />}

          {activeSection === "currency" && <CurrencyPanel />}
          {activeSection === "departments" && <DepartmentsPanel />}
          {activeSection === "designations" && <DesignationsPanel />}
          {activeSection === "tenders" && <PaymentMethodsPanel />}
          {activeSection === "kitchenstations" && <KitchenStationsPanel />}
        </div>
      </div>
    </div>
  );
}
