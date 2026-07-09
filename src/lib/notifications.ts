// Which screen an alert's module should deep-link to when clicked —
// shared between the Notifications list and the header bell's toast popups.
export const NOTIFICATION_ROUTES: Record<string, string> = {
  inventory: "/inventory",
  engineering: "/engineering",
  channel: "/channel",
  procurement: "/procurement",
  banquets: "/banquets",
  reports: "/reports",
  recipes: "/recipes?tab=pending",
};
