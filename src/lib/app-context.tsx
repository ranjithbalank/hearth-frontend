import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { api, clearTokens, setTokens } from "./api";
import { MODULE_ENTITLEMENT, NAV } from "./modules";
import type { Entitlement, Property, User } from "./types";

interface AppState {
  user: User | null;
  property: Property | null;
  loading: boolean;
  login: (username: string, password: string, otp?: string) => Promise<User>;
  logout: () => void;
  refreshProperty: () => Promise<void>;
  setup: (edition: string, name?: string) => Promise<void>;
  canAccess: (module: string) => boolean;
  landing: () => string;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshProperty() {
    const { data } = await api.get<Property>("/auth/property/");
    setProperty(data);
  }

  useEffect(() => {
    (async () => {
      try {
        await refreshProperty();
        if (localStorage.getItem("hearth_access")) {
          const { data } = await api.get<User>("/auth/me/");
          setUser(data);
        }
      } catch {
        /* not logged in / no setup yet */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function login(username: string, password: string, otp?: string) {
    const { data } = await api.post("/auth/token/", { username, password, otp });
    setTokens(data.access, data.refresh);
    setUser(data.user);
    await refreshProperty();
    return data.user as User;
  }

  function logout() {
    clearTokens();
    setUser(null);
  }

  async function setup(edition: string, name?: string) {
    await api.post("/auth/setup/", { edition, name });
    await refreshProperty();
  }

  function canAccess(module: string) {
    if (!user) return false;
    const allowed = user.allowed_modules;
    const roleOk = allowed === "*" || allowed.includes(module);
    if (!roleOk) return false;
    // The bar's own screens only make sense when the property runs the bar
    // as a separate operation — in Combined mode drinks live in the one
    // restaurant POS instead, so hide Bar POS / Bar Table / Bar Menu Master.
    if (module === "barpos" && property?.entitlement.bar_mode === "combined") return false;
    const flag = MODULE_ENTITLEMENT[module];
    if (!flag) return true;
    const ent: Entitlement | undefined = property?.entitlement;
    return ent ? Boolean(ent[flag]) : true;
  }

  /** Role-appropriate landing page after login. Falls back to the first screen
   *  the user can actually reach if their preferred one isn't enabled. */
  function landing(): string {
    const prefs: Record<string, [string, string]> = {
      "Super Admin": ["execdashboard", "/executive"],
      "Admin": ["settings", "/settings"],
      "Managing Director": ["execdashboard", "/executive"],
      "CEO": ["execdashboard", "/executive"],
      "General Manager": ["dashboard", "/dashboard"],
      "Finance": ["accounting", "/accounting"],
      "Restaurant Manager": ["pos", "/pos"],
      "Hotel Manager": ["dashboard", "/dashboard"],
      "Front Office": ["frontdesk", "/frontdesk"],
      "F&B Cashier": ["pos", "/pos"],
      "Captain": ["pos", "/pos"],
      "Housekeeping": ["housekeeping", "/housekeeping"],
      "Chef / Kitchen": ["kds", "/kds"],
      "Store Keeper": ["inventory", "/store"],
    };
    const pref = user ? prefs[user.role] : undefined;
    if (pref && canAccess(pref[0])) return pref[1];
    if (canAccess("dashboard")) return "/dashboard";
    for (const g of NAV) for (const i of g.items) if (canAccess(i.module ?? i.key)) return i.path;
    return "/dashboard";
  }

  const value = useMemo<AppState>(
    () => ({ user, property, loading, login, logout, refreshProperty, setup, canAccess, landing }),
    [user, property, loading],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
