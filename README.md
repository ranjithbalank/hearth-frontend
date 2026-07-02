# Hearth — Frontend

React + TypeScript + Vite + Tailwind frontend for **Hearth**, a Hotel & Restaurant OS.
Includes the table-first restaurant POS (KOT rounds, final-bill flow, captain mobile view),
kitchen display, front desk, folios, inventory and reports.

Pairs with the [hearth-backend](https://github.com/ranjithbalank/hearth-backend) Django API.

## Run locally

```bash
npm install
npm run dev            # add -- --host to open from a phone on the same Wi-Fi
```

The dev server proxies `/api` to the backend (see `vite.config.ts`, default `127.0.0.1:8010`).

- Typecheck: `npx tsc --noEmit`
- Build: `npm run build`
