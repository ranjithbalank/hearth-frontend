import { chromium } from "playwright";

const API = "http://localhost:8010";
const APP = "http://localhost:5177";
const res = await fetch(`${API}/api/auth/token/`, {
  method: "POST", headers: { "Content-Type": "application/json" },
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
await page.waitForTimeout(600);

const info = await page.evaluate(() => {
  const table = document.querySelector("table");
  const container = table.parentElement;
  container.scrollTop = 300; container.scrollLeft = 500;
  const th = table.querySelector("thead th");
  const cs = getComputedStyle(th);
  const cc = getComputedStyle(container);
  return {
    containerTag: container.tagName, containerClass: container.className,
    containerRect: container.getBoundingClientRect(),
    containerOverflow: cc.overflow + "/" + cc.overflowY,
    thPosition: cs.position, thTop: cs.top,
    thRect: th.getBoundingClientRect(),
    scrollTop: container.scrollTop, scrollLeft: container.scrollLeft,
  };
});
console.log(JSON.stringify(info, null, 2));
await page.waitForTimeout(400);
await page.screenshot({ path: "scripts/roles-debug.png", clip: { x: 250, y: 180, width: 1350, height: 400 } });
await browser.close();
