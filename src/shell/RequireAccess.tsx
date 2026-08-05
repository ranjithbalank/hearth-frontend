import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useApp } from "../lib/app-context";

/** Gate a route on a module. An array means "any of these" — Settings is
 *  reachable either by "settings" (the full configuration screen) or by the
 *  narrower "users" that HR holds, which shows only the Users & Roles panel. */
export function RequireAccess({ module, children }: { module: string | string[]; children: ReactNode }) {
  const { canAccess, landing } = useApp();
  const modules = Array.isArray(module) ? module : [module];
  if (!modules.some(canAccess)) {
    return <Navigate to={landing()} replace />;
  }
  return <>{children}</>;
}
