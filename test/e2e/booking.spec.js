import { expect, test } from "@playwright/test";

// Tuesday 24 November 2026, 10:00 in India (04:30 UTC).
const TUESDAY_10AM_IST = new Date("2026-11-24T04:30:00Z");
// 20:25 in India.
const TUESDAY_825PM_IST = new Date("2026-11-24T14:55:00Z");

async function openAt(page, instant) {
  await page.clock.install({ time: instant });
  await page.goto("/test/fixture.html");
}

const slotButtons = (page) => page.locator(".cbw-slots button");
const dayButtons = (page) => page.locator(".cbw-days button");

test("TC-01: lists only free future slots inside opening hours", async ({ page }) => {
  await openAt(page, TUESDAY_10AM_IST);
  const labels = await slotButtons(page).allTextContents();
  expect(labels[0]).toBe("11:30 am"); // 11:00 is booked; nothing starts before 11:00
  expect(labels.at(-1)).toBe("8:00 pm");
  expect(labels).toHaveLength(18);
  expect(labels).not.toContain("11:00 am");
  await expect(dayButtons(page).first()).toHaveText("Today");
});

test("TC-02: when no slot is left today, the first offered day is tomorrow", async ({ page }) => {
  await openAt(page, TUESDAY_825PM_IST);
  await expect(dayButtons(page).first()).toHaveText("Wed 25 Nov");
  await expect(dayButtons(page).filter({ hasText: "Today" })).toHaveCount(0);
  await expect(slotButtons(page).first()).toHaveText("9:30 am");
});

test("TC-03: choosing a slot fills in the summary", async ({ page }) => {
  await openAt(page, TUESDAY_10AM_IST);
  await page.getByRole("button", { name: "6:30 pm" }).click();
  await page.getByLabel("Treatment").selectOption("consult");
  await expect(page.locator(".cbw-summary")).toHaveText("Tue 24 Nov, 6:30 pm - Consultation");
});

test("TC-04: the WhatsApp link is pre-filled and nothing is sent automatically", async ({ page }) => {
  await openAt(page, TUESDAY_10AM_IST);
  await page.getByRole("button", { name: "6:30 pm" }).click();
  await page.getByLabel("Your name").fill("Asha");
  await page.getByLabel("Mobile number").fill("98765 43210");

  const link = page.getByRole("link", { name: "Send request on WhatsApp" });
  const href = await link.getAttribute("href");
  expect(href).toMatch(/^https:\/\/wa\.me\/919000000000\?text=/);
  const message = decodeURIComponent(href.split("?text=")[1]);
  expect(message).toContain("Name: Asha");
  expect(message).toContain("Phone: 919876543210");
  expect(message).toContain("Treatment: Consultation (Rs 500)");
  expect(message).toContain("Date: Tue 24 Nov 2026");
  expect(message).toContain("Time: 6:30 pm");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /noopener/);
});

test("TC-06: a booked slot cannot be chosen", async ({ page }) => {
  await openAt(page, TUESDAY_10AM_IST);
  await expect(page.getByRole("button", { name: "11:00 am" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "11:30 am" })).toBeVisible();
});

test("TC-09: changing the day clears the chosen time", async ({ page }) => {
  await openAt(page, TUESDAY_10AM_IST);
  await page.getByRole("button", { name: "6:30 pm" }).click();
  await expect(page.getByRole("button", { name: "6:30 pm" })).toHaveAttribute("aria-pressed", "true");
  await dayButtons(page).nth(1).click();
  await expect(page.locator('.cbw-slots [aria-pressed="true"]')).toHaveCount(0);
  await expect(page.locator(".cbw-summary")).toHaveText("");
});

test("TC-10: slot times follow the clinic's time zone, not the visitor's", async ({ browser }) => {
  const context = await browser.newContext({ timezoneId: "America/New_York" });
  const page = await context.newPage();
  await openAt(page, TUESDAY_10AM_IST);
  await expect(slotButtons(page).first()).toHaveText("11:30 am");
  await expect(page.locator(".cbw-zone")).toContainText("India time (IST)");
  await context.close();
});

test("TC-11: an invalid phone number blocks sending and explains why", async ({ page }) => {
  await openAt(page, TUESDAY_10AM_IST);
  await page.getByRole("button", { name: "6:30 pm" }).click();
  await page.getByLabel("Your name").fill("Asha");
  await page.getByLabel("Mobile number").fill("98ab");

  const link = page.getByRole("link", { name: "Send request on WhatsApp" });
  await expect(link).not.toHaveAttribute("href", /.+/);
  await expect(link).toHaveAttribute("aria-disabled", "true");
  await link.click({ force: true });
  await expect(page.getByRole("alert")).toContainText("valid 10-digit Indian mobile number");
});

test("TC-11b: a missing time and name are reported together", async ({ page }) => {
  await openAt(page, TUESDAY_10AM_IST);
  await page.getByRole("link", { name: "Send request on WhatsApp" }).click({ force: true });
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("Choose a day and a time.");
  await expect(alert).toContainText("Enter your name.");
});

test("TC-12: the form can be completed with the keyboard", async ({ page }) => {
  await openAt(page, TUESDAY_10AM_IST);
  const slot = page.getByRole("button", { name: "6:30 pm" });
  await slot.focus();
  await page.keyboard.press("Enter");
  await expect(slot).toHaveAttribute("aria-pressed", "true");

  await page.getByLabel("Your name").focus();
  await page.keyboard.type("Asha");
  await page.keyboard.press("Tab"); // moves to the mobile number
  await page.keyboard.type("9876543210");
  await expect(page.getByRole("link", { name: "Send request on WhatsApp" })).toHaveAttribute("href", /wa\.me/);
});

test("the demo page loads and shows the form", async ({ page }) => {
  await page.goto("/index.html");
  await expect(page.getByRole("heading", { name: "Book an appointment" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Today" }).or(dayButtons(page).first())).toBeVisible();
});
