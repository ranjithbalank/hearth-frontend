import { useEffect, useState } from "react";

import { getQueue, syncQueue } from "./offline";

/** Tracks connectivity and the offline-bill queue; auto-syncs on reconnect. */
export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  const [queued, setQueued] = useState(getQueue().length);

  async function sync() {
    const n = await syncQueue();
    setQueued(getQueue().length);
    return n;
  }

  useEffect(() => {
    const refresh = () => setQueued(getQueue().length);
    const goOnline = () => {
      setOnline(true);
      sync().catch(() => {});
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return { online, queued, setQueued, sync };
}
