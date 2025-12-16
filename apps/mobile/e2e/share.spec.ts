import { expect, test } from '@playwright/test';

import { firstRowName, openRank } from './helpers';

test('a share link reproduces the ranking in a fresh browser', async ({ page, browser }) => {
  await openRank(page);
  const before = await firstRowName(page);
  await page.getByTestId('preset-value').first().click();
  await expect.poll(() => firstRowName(page)).not.toBe(before);
  const top = await firstRowName(page);
  await page.goto('./profiles');
  const url = (await page.getByTestId('share-url').textContent())!.trim();
  expect(url).toContain('?p=v1.');

  const fresh = await browser.newContext();
  const other = await fresh.newPage();
  await other.goto(url);
  await expect(other.getByRole('alert')).toContainText('Loaded a shared profile');
  await expect.poll(() => firstRowName(other)).toBe(top);
  await fresh.close();
});

test('a corrupted link is rejected with a message', async ({ page }) => {
  await page.goto('./?p=v1.garbage!!');
  await expect(page.getByRole('alert')).toContainText('didn’t work');
});

test('saved profiles survive a reload', async ({ page }) => {
  await page.goto('./profiles');
  await page.getByTestId('profile-name').fill('My test profile');
  await page.getByTestId('save-profile').click();
  await page.reload();
  await expect(page.getByTestId('saved-My test profile')).toBeVisible();
});
