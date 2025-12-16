import { expect, test } from '@playwright/test';

import { watchExternal } from './helpers';

test('school page explains the rank and shows provenance', async ({ page }) => {
  const external = watchExternal(page);
  await page.goto('./school/164988');
  await expect(page.getByTestId('school-name')).toHaveText('Boston University');
  await expect(page.getByTestId('school-rank')).toContainText('#');
  await expect(page.getByTestId('why-card')).toContainText('Why #');
  await expect(page.getByTestId('metric-faculty_count')).toContainText('1,994');
  await expect(page.getByTestId('metric-research_total')).toContainText('$784.4M');
  await expect(page.getByTestId('metric-research_total')).toContainText('NSF HERD FY2024');
  await page.getByTestId('show-sensitivity').click();
  await expect(page.getByTestId('why-card')).toContainText('drop it: #');
  expect(external).toEqual([]);
});

test('a school outside HERD says under $150K, never $0', async ({ page }) => {
  await page.goto('./school/164748'); // Berklee: reviewed, no HERD row
  const research = page.getByTestId('metric-research_total');
  await expect(research).toContainText('Under $150K (not in NSF HERD)');
  await expect(research).not.toContainText('$0');
});

test('a campus inside a joint HERD row points at its parent', async ({ page }) => {
  await page.goto('./school/163259'); // UMD Baltimore, reported with College Park
  await expect(page.getByTestId('metric-research_total')).toContainText('Counted with University of Maryland-College Park');
});

test('an unknown id shows a not-found state', async ({ page }) => {
  await page.goto('./school/999999999');
  await expect(page.getByText('School not found')).toBeVisible();
});

test('offline reviews are labeled synthetic and feed the crowd weights', async ({ page }) => {
  await page.goto('./school/104179'); // University of Arizona has 12 synthetic reviews
  const card = page.getByTestId('reviews-card');
  await expect(card).toContainText('Synthetic demo data');
  await expect(card).toContainText('12 reviews');
  await expect(card).not.toContainText('Write a review');
});
