// Which screen an alert's module should deep-link to when clicked —
// shared between the Notifications list and the header bell's toast popups.
export const NOTIFICATION_ROUTES: Record<string, string> = {
  inventory: "/store/low-stock",
  engineering: "/engineering",
  channel: "/channel",
  procurement: "/procurement",
  banquets: "/banquets",
  reports: "/reports",
  recipes: "/recipes?tab=pending",
  housekeeping: "/housekeeping",
  livegrid: "/livegrid",
  frontdesk: "/frontdesk",
  barpos: "/barpos",
  matreq: "/material-requests",
  settings: "/settings?section=audit",
};
