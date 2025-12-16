import { expect, test } from '@playwright/test';

test('compare two schools side by side', async ({ page }) => {
  await page.goto('./school/164988');
  await page.getByTestId('toggle-compare').click();
  await page.goto('./school/170976');
  await page.getByTestId('toggle-compare').click();
  await page.goto('./compare');
  const table = page.getByTestId('compare-table');
  await expect(table).toContainText('Boston University');
  await expect(table).toContainText('University of Michigan-Ann Arbor');
  await expect(table).toContainText('best');
  await page.getByTestId('search').fill('Georgia Inst');
  await page.getByTestId('add-compare-139755').click();
  await expect(table).toContainText('Georgia Institute of Technology');
});
