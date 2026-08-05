// Screenshot the Dashboard at several viewports to inspect layout/fit.
import { chromium } from "playwright";

const API = "http://localhost:8010";
const APP = process.env.APP ?? "http://localhost:5173";
const USER = process.env.USER_NAME ?? "gm";

const res = await fetch(`${API}/api/auth/token/`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: USER, password: "hearth123" }),
});
const { access, refresh } = await res.json();
if (!access) throw new Error("login failed: " + JSON.stringify(await res.text?.()));

const browser = await chromium.launch();
const sizes = [
  { w: 1920, h: 1080, tag: "1920" },
  { w: 1536, h: 864, tag: "1536" },
  { w: 1366, h: 768, tag: "1366" },
];

for (const s of sizes) {
  const page = await browser.newPage({ viewport: { width: s.w, height: s.h } });
  await page.goto(APP);
  await page.evaluate(([a, r, u]) => {
    localStorage.setItem("hearth_access", a);
    localStorage.setItem("hearth_refresh", r);
    // Mark the onboarding tour as seen — otherwise every shot is a modal.
    localStorage.setItem(`hearth_tour_seen_${u}`, JSON.stringify({ finishedAt: Date.now() }));
  }, [access, refresh, USER]);
  await page.goto(`${APP}/dashboard`);
  await page.waitForTimeout(3500);

  // Above the fold — what actually "fits the screen".
  await page.screenshot({ path: `scripts/dash-${s.tag}-fold.png` });
  // Whole page — to see the ragged bottom / total height.
  await page.screenshot({ path: `scripts/dash-${s.tag}-full.png`, fullPage: true });

  const m = await page.evaluate(() => {
    const main = document.querySelector("main");
    const q = (sel) => document.querySelector(sel);
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), w: Math.round(r.width) };
    };
    // the 3-col row: left stack (col-span-2) vs right TodayPanel
    const row = [...document.querySelectorAll("div")].find(
      (d) => d.className?.includes?.("lg:grid-cols-3") && d.className?.includes?.("items-start")
    );
    const kids = row ? [...row.children] : [];
    return {
      viewport: { w: innerWidth, h: innerHeight },
      docScrollH: document.documentElement.scrollHeight,
      mainScrollH: main?.scrollHeight ?? null,
      mainClientH: main?.clientHeight ?? null,
      mainScrollW: main?.scrollWidth ?? null,
      mainClientW: main?.clientWidth ?? null,
      row: box(row),
      leftCol: box(kids[0]),
      rightCol: box(kids[1]),
      header: box(q("h1")),
    };
  });
  console.log(s.tag, JSON.stringify(m, null, 1));
  await page.close();
}

await browser.close();
console.log("done");
