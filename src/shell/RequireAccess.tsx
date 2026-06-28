import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useApp } from "../lib/app-context";

export function RequireAccess({ module, children }: { module: string; children: ReactNode }) {
  const { canAccess, user } = useApp();
  if (!canAccess(module)) {
    return <Navigate to={user?.role === "Managing Director" ? "/executive" : "/dashboard"} replace />;
  }
  return <>{children}</>;
}
