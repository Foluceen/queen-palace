/* eslint-disable @typescript-eslint/no-require-imports */
// Browser end-to-end checks against a running mock-mode server (fresh start recommended).
//   npm run build && npx next start -p 3100
//   node scripts/e2e.cjs http://localhost:3100 /tmp
const { chromium } = require("playwright");
const BASE = process.argv[2] || "http://localhost:3100";
const OUT = process.argv[3] || ".";
const log = (...a) => console.log(...a);
let failures = 0;
const check = (cond, msg) => {
  log(cond ? "PASS" : "FAIL", msg);
  if (!cond) failures++;
};

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const watch = (page, tag) => {
    page.on("console", (m) => m.type() === "error" && !/401|404 \(Not Found\)|422/.test(m.text()) && errors.push(`${tag}: ${m.text().slice(0, 240)}`));
    page.on("pageerror", (e) => errors.push(`${tag}: ${String(e).slice(0, 240)}`));
  };

  /* ---------- Theme: persisted, applied before paint, toggle works ---------- */
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, colorScheme: "light" });
    const p = await ctx.newPage();
    watch(p, "theme");
    await p.goto(BASE + "/", { waitUntil: "networkidle" });
    check((await p.evaluate(() => document.documentElement.dataset.theme)) === "light", "system light resolves to light");
    await p.getByRole("button", { name: /theme|appearance/i }).first().click();
    await p.getByRole("menuitemradio", { name: "Dark" }).click();
    await p.waitForTimeout(500);
    check((await p.evaluate(() => document.documentElement.dataset.theme)) === "dark", "toggle switches to dark");
    const bg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
    check(bg === "rgb(14, 11, 12)", `dark body background (${bg})`);
    // Reload: the inline script must set dark before any paint.
    await p.goto(BASE + "/collections", { waitUntil: "commit" });
    const early = await p.evaluate(() => document.documentElement.dataset.theme);
    check(early === "dark", "dark applied at first commit after navigation (no flash)");
    await p.goto(BASE + "/admin/login", { waitUntil: "networkidle" });
    check((await p.evaluate(() => document.documentElement.dataset.theme)) === "dark", "admin shares the saved theme");
    await ctx.close();
  }

  /* ---------- Shopper (mobile, dark): PDP → Buy now → checkout in Ilesha → POD ---------- */
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: "dark" });
    const p = await ctx.newPage();
    watch(p, "shop");
    await p.goto(BASE + "/products/care-silk-bonnet", { waitUntil: "networkidle" });
    check((await p.locator(".pdp-details .specs").count()) === 1, "hair care product shows its own details table");
    check(!(await p.locator(".pdp-details dt").allTextContents()).includes("Lace"), "no wig fields on a bonnet");
    const sku = await p.locator(".pdp__sku").textContent();
    check(/SKU QP-/.test(sku), `variant SKU shown (${sku.trim()})`);
    check((await p.locator(".pdp__wa").count()) === 0, "no WhatsApp button while no number is configured");
    await p.getByRole("button", { name: "Buy now" }).click();
    await p.waitForURL("**/checkout", { timeout: 10000 });
    await p.waitForSelector("#co-contact");
    await p.getByRole("textbox", { name: "Email" }).fill("ada@example.com");
    await p.getByRole("textbox", { name: "Phone" }).first().fill("12345");
    await p.getByLabel("First name").fill("Ada");
    await p.getByLabel("Last name").fill("Okafor");
    await p.getByLabel("Street address").fill("4 Ijoka Road");
    await p.getByLabel("Town or city").fill("Ilesha");
    await p.getByRole("combobox", { name: "State" }).selectOption("Osun");
    await p.waitForSelector(".choice input[name=rate]", { timeout: 8000 });
    const rateTitles = await p.locator("label.choice .choice__title").allTextContents();
    check(rateTitles.includes("Pick up in store") && rateTitles.includes("Ilesha delivery"), `Ilesha options: ${rateTitles.join(", ")}`);
    await p.locator("label.choice", { hasText: "Pay on delivery" }).click();
    await p.getByRole("button", { name: /Place order/ }).click();
    await p.waitForSelector("text=Enter a Nigerian mobile number", { timeout: 8000 });
    check(true, "invalid phone rejected by backend with a clear message");
    await p.getByRole("textbox", { name: "Phone" }).first().fill("0803 123 4567");
    await p.getByRole("button", { name: /Place order/ }).click();
    await p.waitForURL("**/order/**", { timeout: 10000 });
    await p.waitForTimeout(800);
    const body = await p.locator("main").textContent();
    check(/QP-\d+/.test(body), "confirmation shows a QP- order number");
    check(!/payment (received|successful)/i.test(body) && !/\bPaid\b/.test(body.replace(/Pay on delivery/g, "")), "confirmation never claims payment was taken");
    await p.screenshot({ path: `${OUT}/e2e-confirm-dark.png`, fullPage: true });
    await ctx.close();
  }

  /* ---------- Customer account: register, address, checkout prefill ---------- */
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    watch(p, "account");
    await p.goto(BASE + "/account?mode=register", { waitUntil: "networkidle" });
    const email = `e2e${Date.now()}@example.com`;
    await p.getByLabel("First name").fill("Bisi");
    await p.getByLabel("Last name").fill("Ade");
    await p.getByLabel("Email", { exact: true }).fill(email);
    await p.getByLabel("Password", { exact: true }).fill("longenough1");
    await p.getByRole("button", { name: "Create account" }).last().click();
    await p.waitForSelector("text=Hello, Bisi", { timeout: 8000 });
    check(true, "registered and signed in");
    await p.getByRole("button", { name: "Add address" }).click();
    await p.getByLabel("Phone", { exact: true }).fill("08091234567");
    await p.getByLabel("First name").fill("Bisi");
    await p.getByLabel("Last name").fill("Ade");
    await p.getByLabel("Street address").fill("9 Market Street");
    await p.getByRole("combobox", { name: "State" }).selectOption("Osun");
    await p.getByLabel("Town or city").fill("Ilesha");
    await p.getByRole("button", { name: "Save address" }).click();
    await p.waitForSelector("text=9 Market Street", { timeout: 6000 });
    check(true, "saved an address");
    await p.goto(BASE + "/products/care-edge-control", { waitUntil: "networkidle" });
    await p.locator(".buy__btn").click();
    await p.waitForSelector(".drawer[open]", { timeout: 8000 });
    await p.goto(BASE + "/checkout", { waitUntil: "networkidle" });
    await p.waitForTimeout(1200);
    check((await p.getByLabel("Street address").inputValue()) === "9 Market Street", "checkout prefilled with the default address");
    check((await p.getByRole("textbox", { name: "Email" }).inputValue()) === email, "checkout prefilled with account email");
    await ctx.close();
  }

  /* ---------- Admin owner: create product with a type, duplicate, delete collection ---------- */
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    watch(p, "admin");
    await p.goto(BASE + "/admin/login", { waitUntil: "networkidle" });
    await p.getByRole("button", { name: "Use Owner, full access" }).click();
    await p.getByRole("button", { name: "Sign in" }).click();
    await p.waitForSelector(".astat__value", { timeout: 10000 });
    await p.goto(BASE + "/admin/products/new", { waitUntil: "networkidle" });
    await p.getByLabel("Name", { exact: true }).fill("E2E Shine Serum");
    await p.getByLabel("Short description").fill("Light shine for wigs");
    await p.getByLabel("Product type").selectOption({ label: "Hair care" });
    await p.waitForTimeout(300);
    const fieldLabels = await p.locator(".aeditor__main .field__label").allTextContents();
    check(fieldLabels.some((l) => /How to use/.test(l)), "hair care type shows its own fields in the editor");
    await p.getByLabel("Visibility").selectOption("published");
    await p.locator("label.checkbox", { hasText: "Hair Maintains" }).click();
    const optValues = p.getByLabel("Values").first();
    await optValues.fill("50ml");
    await p.waitForTimeout(300);
    await p.locator('input[aria-label="SKU"]').first().fill("QP-E2E-SERUM");
    await p.locator('input[aria-label="Price"]').first().fill("5500");
    await p.getByRole("button", { name: "Create product" }).click();
    await p.waitForURL(/\/admin\/products\/(?!new)/, { timeout: 10000 });
    check(true, "product created from the admin UI");
    await p.getByRole("button", { name: "Duplicate" }).click();
    await p.waitForTimeout(1500);
    check((await p.getByLabel("Visibility").inputValue()) === "draft", "duplicate opens as a draft");
    const res = await p.request.get(BASE + "/api/mock/collections/hair-maintains?pageSize=48");
    const json = await res.json();
    check(json.listing.items.some((i) => i.title === "E2E Shine Serum"), "new product appears in its collection on the storefront API");
    await p.goto(BASE + "/admin/collections", { waitUntil: "networkidle" });
    const row = p.locator(".acoll", { hasText: "Braids Extensions" });
    await row.getByRole("button", { name: "Delete" }).click();
    const dlg = p.locator("dialog[open]");
    await dlg.waitFor();
    check((await dlg.textContent()).includes("Products are never deleted with a collection"), "delete dialog explains products are kept");
    await dlg.getByRole("button", { name: "Delete collection" }).click();
    await p.waitForSelector("text=now in no collection", { timeout: 6000 });
    check(true, "deleting a collection reports unassigned products");
    await p.goto(BASE + "/admin/products?collection=none", { waitUntil: "networkidle" });
    await p.waitForTimeout(800);
    check((await p.locator(".atable tbody tr").count()) >= 3, "unassigned products are listed under No collection");
    await p.goto(BASE + "/admin/analytics", { waitUntil: "networkidle" });
    check((await p.locator("text=demo data, not real sales").count()) === 1, "analytics labelled as demo data");
    await p.locator(".asearch__input").fill("QP-104");
    await p.waitForSelector(".asearch__hit", { timeout: 5000 });
    check((await p.locator(".asearch__hit").count()) > 0, "global admin search finds orders");
    await ctx.close();
  }

  /* ---------- Fulfilment: permission-aware nav ---------- */
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    watch(p, "fulfil");
    await p.goto(BASE + "/admin/login", { waitUntil: "networkidle" });
    await p.getByRole("button", { name: "Use Fulfilment" }).click();
    await p.getByRole("button", { name: "Sign in" }).click();
    await p.waitForSelector(".astat__value", { timeout: 10000 });
    const nav = await p.locator(".ashell__link").allTextContents();
    check(!nav.includes("Analytics") && !nav.includes("Shipping and payments") && nav.includes("Customers"), `fulfilment nav: ${nav.join(" | ")}`);
    await ctx.close();
  }

  /* ---------- Reduced motion ---------- */
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    const p = await ctx.newPage();
    await p.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(300);
    const tf = await p.locator("[data-hero-word]").first().evaluate((el) => getComputedStyle(el).transform);
    check(tf === "none", `reduced motion: hero visible immediately (${tf})`);
    await ctx.close();
  }

  log(errors.length ? `CONSOLE ERRORS (${errors.length}):\n` + errors.join("\n") : "No console or hydration errors.");
  log(failures ? `${failures} FAILED` : "ALL E2E CHECKS PASSED");
  await browser.close();
  process.exit(failures || errors.length ? 1 : 0);
})().catch((e) => {
  console.error("E2E FAILED:", e.message);
  process.exit(1);
});
