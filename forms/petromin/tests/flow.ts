import { expect, type Page } from '@playwright/test';

// The form's four steps (2026-11-11): the night, the rider, the bikes (companions as cards, each written in a centred
// dialog), then everything on one page with the Privacy Notice and waiver boxes above "Agree and register". The specs
// walk them through these, so a change of flow is changed here once.

export const json = (body: unknown, status = 200) => ({ status, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' }, body: JSON.stringify(body) });

/** Step 1: the night at `index`, then Continue. */
export async function pickNight(page: Page, index = 0) {
  await page.locator('#sessions .session').nth(index).click();
  await page.click('#next');
}

/** Step 2: company, badge, name and phone, then Continue. */
export async function details(page: Page, d: { company?: string; badge?: string; name?: string; phone?: string } = {}) {
  await page.click(`#companies .company[data-v="${d.company ?? 'Petromin'}"]`);
  await page.fill('#badge', d.badge ?? 'A-12');
  await page.fill('#name', d.name ?? 'Amal Booked');
  await page.fill('#phone', d.phone ?? '512345678');
  await page.click('#next');
}

/** Step 3: the rider's own height and bike (Continue is the caller's). */
export async function bike(page: Page, height = '175', type = 'Hybrid') {
  await page.fill('#height', height);
  await page.click(`#types .tile[data-v="${type}"]`);
}

/** A companion through the dialog: Save closes it when every box is right. */
export async function addRider(page: Page, r: { name: string; height: string | number; type?: string }) {
  await page.click('#add-rider');
  await expect(page.locator('#rider-dialog')).toBeVisible();
  await page.fill('#rd-name', r.name);
  await page.fill('#rd-height', String(r.height));
  if (r.type) await page.click(`#rd-types .tile[data-v="${r.type}"]`);
  await page.click('#rd-save');
}

/** Step 3 to step 4 (Check and agree). */
export async function toCheck(page: Page) {
  await page.click('#next');
  await expect(page.locator('.step[data-step="4"]')).toBeVisible();
}

/** Step 4: the boxes (the Privacy Notice only on a new registration). */
export async function agree(page: Page, privacy = true) {
  if (privacy) await page.check('#privacy');
  await page.check('#waiver');
}

/** The whole way to a registration sent: night, rider, bike, boxes, Agree and register. */
export async function register(page: Page, d: Parameters<typeof details>[1] & { height?: string; type?: string } = {}) {
  await pickNight(page);
  await details(page, d);
  await bike(page, d.height, d.type);
  await toCheck(page);
  await agree(page);
  await page.click('#submit');
}
