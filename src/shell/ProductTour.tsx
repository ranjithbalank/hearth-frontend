import { useMemo } from "react";
import { EVENTS, Joyride, type EventData } from "react-joyride";

import { buildTourSteps } from "../lib/tours";
import { useApp } from "../lib/app-context";

/** Role-based first-login orientation tour — a short spotlight walkthrough
 *  of the sidebar groups a role can see, the notifications bell, and one
 *  highlight on that role's landing screen. `run`/`onDone` are owned by
 *  AppShell (not this component) so the header's "?" Help button can
 *  trigger a replay without a dedicated context for one boolean. */
export function ProductTour({ run, onDone }: { run: boolean; onDone: () => void }) {
  const { user, canAccess, landing } = useApp();
  const steps = useMemo(
    () => (user ? buildTourSteps(user.role, canAccess, landing()) : []),
    [user], // eslint-disable-line react-hooks/exhaustive-deps
  );

  function handleEvent(data: EventData) {
    if (data.type === EVENTS.TOUR_END) onDone();
  }

  if (!user || !steps.length) return null;

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      scrollToFirstStep
      onEvent={handleEvent}
      options={{
        zIndex: 80,
        primaryColor: "#2563EB",
        overlayColor: "rgba(15, 30, 51, 0.4)", // matches the app's modal backdrop (bg-ink/40)
        targetWaitTimeout: 4000,
        arrowColor: "#FFFFFF",
        spotlightRadius: 10, // matches the app's rounded-lg buttons/cards
        width: 340, // fixed — matches Prompt.tsx's modal width so the tooltip
                    // doesn't balloon to fit a long nav-group item list
        // Extra clearance so a scrolled-to target lands below the app's
        // sticky header (~57px) instead of partly hidden underneath it.
        scrollOffset: 80,
      }}
      styles={{
        tooltip: {
          borderRadius: 12, // rounded-card
          border: "1px solid #E2E8F0", // hairline
          boxShadow: "0 1px 2px rgba(15,30,51,0.06)", // shadow-card
          padding: 20, // p-5, matches Prompt.tsx
          fontFamily: "Inter, system-ui, sans-serif",
        },
        tooltipContainer: { textAlign: "left" },
        tooltipTitle: { fontSize: 18, fontWeight: 600, color: "#0F1E33", marginBottom: 8 },
        tooltipContent: { fontSize: 14, color: "#334155", lineHeight: 1.5, padding: 0 },
        tooltipFooter: { marginTop: 16 },
        buttonPrimary: {
          backgroundColor: "#2563EB", color: "#FFFFFF", borderRadius: 12,
          fontWeight: 600, fontSize: 14, padding: "8px 16px",
        },
        buttonBack: {
          color: "#334155", fontWeight: 600, fontSize: 14, padding: "8px 16px", marginRight: 8,
        },
        buttonSkip: { color: "#64748B", fontSize: 14 },
        buttonClose: { color: "#64748B" },
      }}
    />
  );
}
