import { expect, type Page } from '@playwright/test';

/** Records every request that leaves localhost, so each test can assert the app stayed offline. */
export function watchExternal(page: Page): string[] {
  const hits: string[] = [];
  page.on('request', (req) => {
    const host = new URL(req.url()).hostname;
    if (!['127.0.0.1', 'localhost'].includes(host) && !req.url().startsWith('data:')) hits.push(req.url());
  });
  return hits;
}

export async function openRank(page: Page) {
  await page.goto('./');
  await expect(page.getByTestId('rank-summary')).toContainText('schools');
}

export async function firstRowName(page: Page): Promise<string> {
  const row = page.locator('[data-testid^="school-row-"]').first();
  const label = await row.getAttribute('aria-label');
  return label!.replace(/^Rank 1, /, '').replace(/, score .*$/, '');
}

export const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1000) < 960;

export async function openControls(page: Page) {
  if (isMobile(page)) await page.getByTestId('open-controls').click();
}

export async function closeControls(page: Page) {
  if (isMobile(page)) await page.getByTestId('close-controls').click();
}
