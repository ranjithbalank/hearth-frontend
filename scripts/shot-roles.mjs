// Screenshot the Role Mapping matrix (logged in as gm) to inspect the freeze panes.
import { chromium } from "playwright";

const API = "http://localhost:8010";
const APP = "http://localhost:5177";

const res = await fetch(`${API}/api/auth/token/`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: "gm", password: "hearth123" }),
});
const { access, refresh } = await res.json();

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(APP);
await page.evaluate(([a, r]) => {
  localStorage.setItem("hearth_access", a);
  localStorage.setItem("hearth_refresh", r);
}, [access, refresh]);
await page.goto(`${APP}/config/roles`);
await page.waitForSelector("table", { timeout: 15000 });
await page.waitForTimeout(800);
await page.screenshot({ path: "scripts/roles-1-initial.png" });

// Scroll the matrix container horizontally and vertically.
await page.evaluate(() => {
  const el = document.querySelector("table")?.parentElement;
  if (el) { el.scrollLeft = 500; el.scrollTop = 300; }
});
await page.waitForTimeout(400);
await page.screenshot({ path: "scripts/roles-2-scrolled.png" });

await page.evaluate(() => {
  const el = document.querySelector("table")?.parentElement;
  if (el) { el.scrollLeft = 1200; el.scrollTop = 800; }
});
await page.waitForTimeout(400);
await page.screenshot({ path: "scripts/roles-3-far.png" });

await browser.close();
console.log("done");
