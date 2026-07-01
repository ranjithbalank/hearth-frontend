import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useApp } from "../lib/app-context";

export function RequireAccess({ module, children }: { module: string; children: ReactNode }) {
  const { canAccess, landing } = useApp();
  if (!canAccess(module)) {
    return <Navigate to={landing()} replace />;
  }
  return <>{children}</>;
}
