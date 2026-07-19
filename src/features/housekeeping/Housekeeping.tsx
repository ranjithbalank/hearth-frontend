import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useToast } from "../../design/Toast";
import { Badge, Card, Field, PageHeader, Spinner, Stat } from "../../design/ui";
import { api } from "../../lib/api";
import { currencySymbol, money } from "../../lib/money";
import type { Room } from "../../lib/types";

/** Small two-field form modal — replaces the old chained window-prompt flow
 *  (Prompt.tsx is single-input by design). */
function FormModal({
  title,
  fields,
  submitLabel = "Save",
  onSubmit,
  onCancel,
}: {
  title: string;
  fields: { key: string; label: string; placeholder?: string; defaultValue?: string; inputMode?: "text" | "decimal"; required?: boolean }[];
  submitLabel?: string;
  onSubmit: (values: Record<string, string>) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, f.defaultValue ?? ""])),
  );
  const valid = fields.every((f) => !f.required || values[f.key].trim());
  const submit = () => valid && onSubmit(values);
  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-[70]" onClick={onCancel}>
      <div className="card p-5 w-[340px]" onClick={(e) => e.stopPropagation()}>
        <div className="font-display text-lg mb-3">{title}</div>
        <div className="space-y-3">
          {fields.map((f, idx) => (
            <Field key={f.key} label={f.label} required={f.required}>
              <input
                className="input"
                autoFocus={idx === 0}
                placeholder={f.placeholder}
                inputMode={f.inputMode}
                value={values[f.key]}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                  if (e.key === "Escape") onCancel();
                }}
              />
            </Field>
          ))}
        </div>
        <div className="flex gap-2 mt-4">
          <button className="btn-ghost flex-1" onClick={onCancel}>Cancel</button>
          <button className="btn-primary flex-1" disabled={!valid} onClick={submit}>{submitLabel}</button>
        </div>
      </div>
    </div>
  );
}

const STATUS_TONE: Record<string, "pine" | "clay" | "amber" | "info" | "muted"> = {
  vacant_clean: "pine",
  inspected: "pine",
  occupied: "clay",
  vacant_dirty: "amber",
  cleaning: "info",
  ooo: "muted",
};

// What the "advance" button does from each state — labels the next transition
// so staff know the outcome (Dirty → Cleaning → Clean → Inspected).
const NEXT_LABEL: Record<string, string> = {
  vacant_dirty: "Start cleaning",
  cleaning: "Mark clean",
  vacant_clean: "Mark inspected",
};
const CAN_ADVANCE = new Set(Object.keys(NEXT_LABEL));

export function Housekeeping() {
  const qc = useQueryClient();
  const toast = useToast();
  const [minibarRoom, setMinibarRoom] = useState<Room | null>(null);
  const { data: rooms, isLoading } = useQuery({
    queryKey: ["hk-rooms"],
    queryFn: async () => (await api.get<Room[]>("/housekeeping/")).data,
  });

  const advance = useMutation({
    mutationFn: async (room: Room) => (await api.patch(`/housekeeping/${room.id}/advance/`)).data as Room,
    onSuccess: (updated) => {
      toast(`Room ${updated.number} → ${updated.status_label}`);
      qc.invalidateQueries({ queryKey: ["hk-rooms"] });
      qc.invalidateQueries({ queryKey: ["rooms"] });
    },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not update room", "error"),
  });

  const minibar = useMutation({
    mutationFn: async ({ room, item, amount }: { room: Room; item: string; amount: number }) =>
      (await api.post(`/housekeeping/${room.id}/minibar/`, { item, amount })).data,
    onSuccess: (_d, v) => { toast(`Posted ${v.item} (${money(v.amount)}) to room ${v.room.number}`); qc.invalidateQueries({ queryKey: ["folios"] }); },
    onError: () => toast("No open folio for this room", "error"),
  });

  if (isLoading || !rooms) return <Spinner />;

  const n = (...st: string[]) => rooms.filter((r) => st.includes(r.status)).length;
  const toClean = n("vacant_dirty");
  const requested = rooms.filter((r) => r.cleaning_requested).length;
  // Front-desk requests jump the queue, then dirty rooms, then in-progress.
  const PRIORITY: Record<string, number> = {
    vacant_dirty: 0, cleaning: 1, inspected: 2, vacant_clean: 3, occupied: 4, ooo: 5,
  };
  const ordered = [...rooms].sort(
    (a, b) => Number(b.cleaning_requested) - Number(a.cleaning_requested)
      || (PRIORITY[a.status] ?? 9) - (PRIORITY[b.status] ?? 9)
      || a.number.localeCompare(b.number),
  );

  return (
    <div>
      <PageHeader title="Housekeeping" subtitle="Dirty → Cleaning → Clean → Inspected" />

      {/* Housekeeping dashboard — what needs attention right now. */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <Stat tone={toClean > 0 ? "dark" : "default"} label="To clean" value={toClean} sub="Vacated · needs service" />
        <Stat label="Cleaning" value={n("cleaning")} sub="In progress" />
        <Stat label="Ready to sell" value={n("vacant_clean", "inspected")} sub="Clean & inspected" />
        <Stat label="Occupied" value={n("occupied")} sub="In-house guests" />
        <Stat label="Out of order" value={n("ooo")} sub="Maintenance" />
      </div>

      {requested > 0 && (
        <div className="card p-3 mb-3 bg-clay/10 flex items-center gap-3">
          <Badge tone="clay">🔔 Requested</Badge>
          <span className="text-sm">{requested} cleaning request(s) from the front desk — shown first below.</span>
        </div>
      )}
      {toClean > 0 && (
        <div className="card p-3 mb-5 bg-amber-50 flex items-center gap-3">
          <Badge tone="amber">Priority</Badge>
          <span className="text-sm">{toClean} room(s) vacated and awaiting cleaning — shown first below.</span>
        </div>
      )}

      <div className="grid grid-cols-4 gap-3">
        {ordered.map((r) => (
          <div key={r.id} className={`card p-4 ${r.cleaning_requested ? "ring-2 ring-clay/60" : ""}`}>
            <div className="flex items-center justify-between">
              <div className="font-display text-lg">{r.number}</div>
              <Badge tone={STATUS_TONE[r.status] ?? "muted"}>{r.status_label}</Badge>
            </div>
            <div className="text-xs text-muted mt-1">{r.room_type_name}</div>
            {r.status === "ooo" && r.ooo_reason && (
              <div className="text-xs text-muted mt-1">🔧 {r.ooo_reason}</div>
            )}
            {r.cleaning_requested && (
              <div className="text-xs text-clay mt-1">
                🔔 Requested{r.cleaning_note ? ` — ${r.cleaning_note}` : ""}
              </div>
            )}
            {r.status === "occupied" && r.cleaning_requested && (
              <button
                className="btn-primary w-full mt-3 text-xs py-1.5"
                disabled={advance.isPending && advance.variables?.id === r.id}
                onClick={() => advance.mutate(r)}
              >
                Mark serviced
              </button>
            )}
            {CAN_ADVANCE.has(r.status) && (
              <button
                className="btn-outline w-full mt-3 text-xs py-1.5"
                disabled={advance.isPending && advance.variables?.id === r.id}
                onClick={() => advance.mutate(r)}
              >
                {NEXT_LABEL[r.status]}
              </button>
            )}
            {r.status === "occupied" && (
              <button
                className="btn-ghost w-full mt-3 text-xs py-1.5"
                disabled={minibar.isPending && minibar.variables?.room.id === r.id}
                onClick={() => setMinibarRoom(r)}
              >
                Post minibar
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8">
        <LostFound />
      </div>

      {minibarRoom && (
        <FormModal
          title={`Post minibar — room ${minibarRoom.number}`}
          submitLabel="Post"
          fields={[
            { key: "item", label: "Item consumed", placeholder: "e.g. Soft drink", required: true },
            { key: "amount", label: `Amount (${currencySymbol()})`, defaultValue: "150", inputMode: "decimal", required: true },
          ]}
          onCancel={() => setMinibarRoom(null)}
          onSubmit={(v) => {
            const amount = Number(v.amount);
            if (!amount || amount <= 0) { toast("Enter a valid amount", "error"); return; }
            minibar.mutate({ room: minibarRoom, item: v.item.trim(), amount });
            setMinibarRoom(null);
          }}
        />
      )}
    </div>
  );
}

interface LostItem { id: number; description: string; location: string; status: string }

function LostFound() {
  const qc = useQueryClient();
  const toast = useToast();
  const [logging, setLogging] = useState(false);
  const { data } = useQuery({
    queryKey: ["lost-found"],
    queryFn: async () => (await api.get<LostItem[]>("/housekeeping/lost_found/")).data,
  });
  const add = useMutation({
    mutationFn: async (body: object) => (await api.post("/housekeeping/lost_found/", body)).data,
    onSuccess: () => { toast("Item logged"); qc.invalidateQueries({ queryKey: ["lost-found"] }); },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not log item", "error"),
  });
  const claim = useMutation({
    mutationFn: async (id: number) => (await api.post(`/housekeeping/${id}/lost_found_claim/`, { status: "claimed" })).data,
    onSuccess: () => { toast("Marked as claimed"); qc.invalidateQueries({ queryKey: ["lost-found"] }); },
    onError: (e: any) => toast(e?.response?.data?.detail ?? "Could not update item", "error"),
  });

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold">Lost &amp; Found</div>
        <button className="btn-outline text-xs py-1" onClick={() => setLogging(true)}>
          + Log item
        </button>
        {logging && (
          <FormModal
            title="Log found item"
            submitLabel="Log item"
            fields={[
              { key: "description", label: "Description", placeholder: "e.g. Black umbrella", required: true },
              { key: "location", label: "Where was it found?", placeholder: "e.g. Lobby" },
            ]}
            onCancel={() => setLogging(false)}
            onSubmit={(v) => {
              add.mutate({ description: v.description.trim(), location: v.location.trim() });
              setLogging(false);
            }}
          />
        )}
      </div>
      {!data?.length ? (
        <div className="text-sm text-muted py-2">No items logged.</div>
      ) : (
        data.map((i) => (
          <div key={i.id} className="flex items-center gap-3 py-2 border-t border-line text-sm">
            <span className="flex-1">{i.description} <span className="text-muted">· {i.location || "—"}</span></span>
            <Badge tone={i.status === "stored" ? "amber" : "pine"}>{i.status}</Badge>
            {i.status === "stored" && (
              <button className="btn-ghost text-xs py-1" disabled={claim.isPending && claim.variables === i.id} onClick={() => claim.mutate(i.id)}>
                Mark claimed
              </button>
            )}
          </div>
        ))
      )}
    </Card>
  );
}
