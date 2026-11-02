import { test as base, expect, type Page } from '@playwright/test';

const MOCK = 'http://127.0.0.1:4000';

export type Ctl = {
  /** Promjena zalihe "kao da ju je promijenila blagajna". */
  setStock(sku: string, qty: number): Promise<void>;
  setPrice(sku: string, cents: number): Promise<void>;
};

type Fixtures = { ctl: Ctl; consoleErrors: string[] };

export const test = base.extend<Fixtures>({
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));
    await use(errors);
  },
  ctl: async ({ page, request }, use, info) => {
    const demo = info.project.name === 'demo';
    // čisto stanje: prazna košarica u pregledniku i svjež backend
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    if (demo) {
      await page.waitForFunction(() => '__cs' in window);
      await page.evaluate(() => (window as unknown as { __cs: { reset(): void } }).__cs.reset());
    }
    else expect((await request.post(`${MOCK}/__dev/reset`)).ok()).toBe(true);

    await use({
      async setStock(sku, qty) {
        if (demo) await page.evaluate(([s, q]) => (window as unknown as { __cs: { setStock(a: string, b: number): void } }).__cs.setStock(s as string, q as number), [sku, qty]);
        else expect((await request.post(`${MOCK}/__dev/stock`, { data: { sku, qty } })).ok()).toBe(true);
      },
      async setPrice(sku, cents) {
        if (demo) await page.evaluate(([s, c]) => (window as unknown as { __cs: { setPrice(a: string, b: number): void } }).__cs.setPrice(s as string, c as number), [sku, cents]);
        else expect((await request.post(`${MOCK}/__dev/price`, { data: { sku, amount: cents } })).ok()).toBe(true);
      },
    });
  },
});

export { expect };

export async function openCart(page: Page) {
  await page.locator('.cartp').click();
  const d = page.getByRole('dialog', { name: /Košarica/ });
  await expect(d).toBeVisible();
  return d;
}

export async function cartLines(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('cs.cart.v1') ?? '{"lines":[]}').lines as { sku: string; qty: number }[]);
}

/** Na stranici plaćanja (demo /dev/checkout/ ili FAKE mock-servera) klikni gumb. */
export async function onPaymentPage(page: Page, action: 'Plati (test)' | 'Odustani') {
  await page.getByRole('button', { name: action }).click();
}
