/** Outline (line) icons for the sidebar, keyed by nav module. stroke=currentColor
 *  so each icon takes the colour set by its nav row. */
const P: Record<string, JSX.Element> = {
  execdashboard: <><path d="M4 19V5" /><path d="M4 15l4-4 3 3 5-6 4 4" /><path d="M4 19h16" /></>,
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  frontdesk: <><path d="M4 18h16" /><path d="M6 18v-3a6 6 0 0112 0v3" /><path d="M12 6V4" /><path d="M11 4h2" /></>,
  checkout: <><path d="M14 4h4a1 1 0 011 1v14a1 1 0 01-1 1h-4" /><path d="M11 16l4-4-4-4" /><path d="M15 12H4" /></>,
  livegrid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  reservations: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></>,
  folio: <><path d="M4 5a1 1 0 011-1h9l6 6v9a1 1 0 01-1 1H5a1 1 0 01-1-1z" /><path d="M14 4v6h6" /></>,
  housekeeping: <><path d="M6 4l3 3" /><path d="M9 7l-5 5 4 4 5-5" /><path d="M13 11l7 7" /><path d="M18 3l-2 2M21 6l-2 2M19 3l1 1" /></>,
  banquets: <><path d="M5 21l3-9 4 2 4-2 3 9" /><path d="M12 14V8" /><path d="M9 5l3-2 3 2-3 2z" /></>,
  revenue: <><path d="M4 18l5-5 3 3 7-8" /><path d="M16 8h4v4" /></>,
  channel: <><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6" /></>,
  booking: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a14 14 0 010 18 14 14 0 010-18" /></>,
  pos: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8M8 11h8M8 15h4" /></>,
  kds: <><path d="M7 21h10" /><path d="M6 13h12v3a3 3 0 01-3 3H9a3 3 0 01-3-3z" /><path d="M8 13a4 4 0 018 0" /><path d="M12 5v3" /></>,
  online: <><path d="M3 7l9-4 9 4-9 4z" /><path d="M3 7v10l9 4 9-4V7" /><path d="M12 11v10" /></>,
  inventory: <><rect x="3" y="8" width="8" height="6" rx="1" /><rect x="13" y="8" width="8" height="6" rx="1" /><rect x="8" y="15" width="8" height="6" rx="1" /></>,
  procurement: <><path d="M3 4h2l2.5 12h10L20 8H6" /><circle cx="9" cy="20" r="1.3" /><circle cx="17" cy="20" r="1.3" /></>,
  matreq: <><rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9 4V3h6v1" /><path d="M9 10h6M9 14h4" /></>,
  recipes: <><path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3z" /><path d="M8 20a3 3 0 01-3-3" /><path d="M9 8h7M9 11h7" /></>,
  accounting: <><path d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1z" /><path d="M8 4v16" /><path d="M12 9h5M12 13h5" /></>,
  tax: <><circle cx="12" cy="12" r="9" /><path d="M8.5 8.5l7 7" /><circle cx="9" cy="9" r="1" /><circle cx="15" cy="15" r="1" /></>,
  engineering: <><path d="M14 6a3.5 3.5 0 00-4.7 4.3L4 15.6 6.4 18l5.3-5.3A3.5 3.5 0 0016 8l-2 2-2-2z" /></>,
  hr: <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0112 0" /><path d="M16 6a3 3 0 010 6" /><path d="M17 14a6 6 0 014 6" /></>,
  crm: <><circle cx="12" cy="8" r="3.2" /><path d="M5 20a7 7 0 0114 0" /><path d="M12 11v3" /></>,
  notifications: <><path d="M6 9a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6Z" /><path d="M10 19a2 2 0 004 0" /></>,
  reports: <><path d="M4 20V4" /><rect x="7" y="11" width="3" height="7" /><rect x="12" y="7" width="3" height="11" /><rect x="17" y="13" width="3" height="5" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 00-.1-1.3l2-1.5-2-3.4-2.3 1a7 7 0 00-2.3-1.3L14 3h-4l-.3 2.2A7 7 0 007.4 6.5l-2.3-1-2 3.4 2 1.5A7 7 0 005 12c0 .4 0 .9.1 1.3l-2 1.5 2 3.4 2.3-1c.7.6 1.5 1 2.3 1.3L10 21h4l.3-2.2c.8-.3 1.6-.7 2.3-1.3l2.3 1 2-3.4-2-1.5c.1-.4.1-.9.1-1.3Z" /></>,
  customers: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0114 0" /></>,
  suppliers: <><rect x="2" y="7" width="12" height="9" rx="1" /><path d="M14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.5" /><circle cx="17" cy="18" r="1.5" /></>,
  vendors: <><rect x="5" y="3" width="14" height="18" rx="1.5" /><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" /><path d="M10 21v-3h4v3" /></>,
  employees: <><circle cx="12" cy="8" r="3" /><path d="M6 20a6 6 0 0112 0" /><rect x="3" y="3" width="18" height="18" rx="3" /></>,
  pomanage: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /><path d="M9 12h6M9 16h6" /></>,
  roommaster: <><path d="M4 20v-7l8-5 8 5v7" /><rect x="9" y="13" width="6" height="7" /><path d="M3 13h18" /></>,
  menumaster: <><path d="M7 3v8a2 2 0 002 2v8M9 3v6M5 3v6" /><path d="M16 3c-1.5 0-2 2-2 5s.5 4 2 4v9" /></>,
  tablemaster: <><rect x="4" y="7" width="16" height="3" rx="1" /><path d="M6 10v9M18 10v9M9 10v4h6v-4" /></>,
  gstmaster: <><circle cx="12" cy="12" r="9" /><path d="M8.5 8.5l7 7" /><circle cx="9" cy="9" r="1" /><circle cx="15" cy="15" r="1" /></>,
  roles: <><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" /><path d="M9.5 12l1.8 1.8 3.2-3.4" /></>,
};

export function NavIcon({ name }: { name: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {P[name] ?? <circle cx="12" cy="12" r="8" />}
    </svg>
  );
}
