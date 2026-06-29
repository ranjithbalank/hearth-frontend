import { api } from "./api";
import type { MenuItem } from "./types";

const QUEUE_KEY = "hearth_offline_queue";
const MENU_KEY = "hearth_menu_cache";

export interface OfflineBill {
  client_uuid: string;
  mode: string;
  table: number | null;
  lines: { menu_item: number; qty: number; unit_price: string; name: string }[];
  tender: string;
  settled: boolean;
  total: number;
}

export function getQueue(): OfflineBill[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function enqueue(bill: OfflineBill) {
  const q = getQueue();
  q.push(bill);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export async function syncQueue(): Promise<number> {
  const q = getQueue();
  if (!q.length) return 0;
  // The server dedupes by client_uuid, so re-sending is safe (NFR-002).
  await api.post("/pos/orders/sync/", { orders: q });
  localStorage.removeItem(QUEUE_KEY);
  return q.length;
}

export function cacheMenu(items: MenuItem[]) {
  localStorage.setItem(MENU_KEY, JSON.stringify(items));
}
export function getCachedMenu(): MenuItem[] {
  try {
    return JSON.parse(localStorage.getItem(MENU_KEY) || "[]");
  } catch {
    return [];
  }
}

export function uuid(): string {
  return (crypto as any).randomUUID
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });
}
