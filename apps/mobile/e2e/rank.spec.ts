import { expect, test } from '@playwright/test';

import { closeControls, firstRowName, openControls, openRank, watchExternal } from './helpers';

test('ranks all 1,532 schools offline with the default preset', async ({ page }) => {
  const external = watchExternal(page);
  await openRank(page);
  await expect(page.getByTestId('rank-summary')).toHaveText('1,532 schools');
  await expect(page.locator('[data-testid^="school-row-"]').first()).toBeVisible();
  expect(external).toEqual([]);
});

test('switching presets reorders the list', async ({ page }) => {
  await openRank(page);
  const balanced = await firstRowName(page);
  await page.getByTestId('preset-research').first().click();
  await expect.poll(() => firstRowName(page)).not.toBe(balanced);
  expect(await firstRowName(page)).toBe('Johns Hopkins University');
});

test('a research-only weight puts the biggest R&D spender first', async ({ page }) => {
  await openRank(page);
  await openControls(page);
  // Zero every weight the Balanced preset sets, then weight research alone.
  for (const key of ['grad_rate', 'retention_rate', 'median_earnings_10y', 'net_price', 'median_debt', 'earnings_to_price']) {
    await page.getByTestId(`weight-${key}`).fill('0');
  }
  await page.getByTestId('weight-student_faculty_ratio').fill('0');
  await page.getByTestId('weight-research_total').fill('10');
  await page.getByTestId('weight-clubs_per_1k_ug').fill('0');
  await closeControls(page);
  await expect.poll(() => firstRowName(page)).toBe('Johns Hopkins University');
});

test('a net price cap shrinks the list', async ({ page }) => {
  await openRank(page);
  await openControls(page);
  await page.getByTestId('price-cap-15000').click();
  await closeControls(page);
  const text = await page.getByTestId('rank-summary').textContent();
  const n = Number(text!.replace(/,/g, '').match(/\d+/)![0]);
  expect(n).toBeLessThan(1532);
  expect(n).toBeGreaterThan(100);
});

test('search narrows the list but keeps real ranks', async ({ page }) => {
  await openRank(page);
  await page.getByTestId('search').first().fill('Boston University');
  const row = page.locator('[data-testid="school-row-164988"]');
  await expect(row).toBeVisible();
  expect(await row.getAttribute('aria-label')).toMatch(/^Rank \d+, Boston University/);
});
