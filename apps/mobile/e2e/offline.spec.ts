import { expect, test } from '@playwright/test';

// Only meaningful inside `make e2e-offline`, where the preview server runs under offline-run.
test('the server process cannot reach the internet', async ({ request }) => {
  test.skip(process.env.EXPECT_OFFLINE !== '1', 'run via make e2e-offline');
  const res = await request.get('/__egress');
  const body = await res.json();
  expect(body.blocked).toBe(true);
  expect(body.results.length).toBeGreaterThan(0);
});
