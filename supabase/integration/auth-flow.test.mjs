// End-to-end checks against the local Supabase stack (Auth API + PostgREST + Mailpit).
// Run through scripts/supabase-test.sh, which starts the local stack and passes
// SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY and MAILPIT_URL.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;
const mailpit = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';
const run = Date.now().toString(36);

const client = () => createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function codes(address, { since = 0, want = 1, timeoutMs = 15000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const res = await fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}`);
    const list = (await res.json()).messages ?? [];
    const fresh = list.filter((m) => Date.parse(m.Created) >= since);
    if (fresh.length >= want || Date.now() > deadline) {
      const out = [];
      for (const m of fresh) {
        const body = await (await fetch(`${mailpit}/api/v1/message/${m.ID}`)).json();
        const code = (body.Text ?? '').match(/\b(\d{6})\b/)?.[1];
        if (code) out.push(code);
      }
      return out;
    }
    await sleep(400);
  }
}

async function affiliations(userId) {
  const { data, error } = await admin
    .from('school_affiliations')
    .select('school_id,status,verified_email')
    .eq('user_id', userId)
    .order('id');
  assert.ifError(error);
  return data;
}

const review = (school_id) => ({
  school_id,
  relationship: 'current_student',
  grad_year: 2027,
  rating_overall: 4,
  rating_academics: 4,
  rating_social: 3,
  rating_career: 4,
  rating_housing: 3,
  rating_safety: 4,
  rating_value: 3,
  title: 'Integration test review',
  body: 'Written by the integration test. Long enough to pass the fifty character minimum.',
});

describe('school-email accounts', () => {
  const alice = `alice.${run}@bu.edu`;
  const aliceNew = `alice.${run}@umich.edu`;
  let session;
  let userId;

  before(async () => {
    assert.ok(url && anonKey && serviceKey, 'SUPABASE_URL / keys must be set');
  });

  test('precheck RPC answers for anon', async () => {
    const c = client();
    assert.equal((await c.rpc('is_school_email', { email: 'x@bu.edu' })).data, true);
    assert.equal((await c.rpc('is_school_email', { email: 'x@gmail.com' })).data, false);
  });

  test('signup with a non-school email is refused by the hook', async () => {
    const { error } = await client().auth.signInWithOtp({ email: `mallory.${run}@gmail.com` });
    assert.ok(error, 'expected an error');
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
    assert.ok(!data.users.some((u) => u.email === `mallory.${run}@gmail.com`));
  });

  test('school signup is pending until the OTP is confirmed, then active', async () => {
    const since = Date.now() - 1000;
    const c = client();
    const { error } = await c.auth.signInWithOtp({ email: alice });
    assert.ifError(error);
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    userId = list.users.find((u) => u.email === alice).id;
    assert.deepEqual((await affiliations(userId)).map((a) => a.status), ['pending']);

    const [code] = await codes(alice, { since });
    assert.ok(code, 'OTP email arrived in Mailpit');
    const verified = await c.auth.verifyOtp({ email: alice, token: code, type: 'email' });
    assert.ifError(verified.error);
    session = verified.data.session;
    assert.deepEqual((await affiliations(userId)).map((a) => [a.school_id, a.status]), [[164988, 'active']]);
  });

  test('a plus-addressed alias of an existing account cannot sign up', async () => {
    const alias = alice.replace('@', '+second@');
    const { error } = await client().auth.signInWithOtp({ email: alias });
    assert.ok(error, 'alias signup must fail');
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
    assert.ok(!data.users.some((u) => u.email === alias));
  });

  test('anon reads reviews without author ids', async () => {
    const c = client();
    const table = await c.from('reviews').select('author_id').limit(1);
    assert.ok(table.error, 'the reviews table is not readable by anon');
    const view = await c.from('public_reviews').select('*').limit(1);
    assert.ifError(view.error);
    for (const row of view.data) assert.ok(!('author_id' in row));
  });

  test('an unconfirmed password account cannot get a session at all', async () => {
    const email = `pending.${run}@bu.edu`;
    const { error: ce } = await admin.auth.admin.createUser({ email, password: 'correct-horse-battery', email_confirm: false });
    assert.ifError(ce);
    const { error } = await client().auth.signInWithPassword({ email, password: 'correct-horse-battery' });
    assert.ok(error, 'sign-in must fail before confirmation');
  });

  test('verified student can review their school, and only their school', async () => {
    const c = client();
    await c.auth.setSession(session);
    const ok = await c.from('reviews').insert(review(164988)).select('status').single();
    assert.ifError(ok.error);
    assert.equal(ok.data.status, 'published');
    const other = await c.from('reviews').insert(review(170976));
    assert.ok(other.error, 'reviewing another school must fail');
  });

  test('direct tampering with affiliations, roles or review status is denied', async () => {
    const c = client();
    await c.auth.setSession(session);
    const upd = await c.from('school_affiliations').update({ school_id: 170976 }).eq('user_id', userId).select();
    assert.ok(upd.error || upd.data.length === 0, 'affiliation update must not apply');
    const ins = await c
      .from('school_affiliations')
      .insert({ user_id: userId, school_id: 170976, verified_email: 'x@umich.edu', status: 'active', verified_at: new Date().toISOString() });
    assert.ok(ins.error, 'affiliation insert must fail');
    const status = await c.from('reviews').update({ status: 'published' }).eq('author_id', userId);
    assert.ok(status.error, 'status column is not writable');
    const role = await c.from('profiles').update({ role: 'admin' }).eq('id', userId);
    assert.ok(role.error, 'role is not writable');
    assert.deepEqual((await affiliations(userId)).map((a) => [a.school_id, a.status]), [[164988, 'active']]);
  });

  test('changing the account email to gmail is rejected and leaves the email unchanged', async () => {
    const since = Date.now() - 1000;
    const c = client();
    await c.auth.setSession(session);
    const gmail = `alice.${run}@gmail.com`;
    const { error } = await c.auth.updateUser({ email: gmail });
    assert.ok(error, 'updateUser must fail');
    const { data } = await admin.auth.admin.getUserById(userId);
    assert.equal(data.user.email, alice);
    assert.ok(!data.user.new_email, 'no pending change stored');
    // GoTrue may have mailed a code before the database refused the write. It must be dead.
    for (const code of await codes(gmail, { since, timeoutMs: 3000 })) {
      const v = await client().auth.verifyOtp({ email: gmail, token: code, type: 'email_change' });
      assert.ok(v.error, 'a code for the gmail address must not verify');
    }
    assert.equal((await admin.auth.admin.getUserById(userId)).data.user.email, alice);
  });

  test('admin API cannot set a non-school email either', async () => {
    const { error } = await admin.auth.admin.updateUserById(userId, { email: `alice2.${run}@gmail.com`, email_confirm: true });
    assert.ok(error, 'backstop trigger rejects the write');
    assert.equal((await admin.auth.admin.getUserById(userId)).data.user.email, alice);
  });

  test('moving to another school needs both confirmations, then revokes the old affiliation', async () => {
    const since = Date.now() - 1000;
    const c = client();
    await c.auth.setSession(session);
    await sleep(1200); // max_frequency between emails
    const { error } = await c.auth.updateUser({ email: aliceNew });
    assert.ifError(error);
    const [newCode] = await codes(aliceNew, { since });
    const [oldCode] = await codes(alice, { since });
    assert.ok(newCode && oldCode, 'both addresses got a code');

    // Only the new address confirms: nothing changes yet.
    const first = await client().auth.verifyOtp({ email: aliceNew, token: newCode, type: 'email_change' });
    assert.ifError(first.error);
    assert.equal((await admin.auth.admin.getUserById(userId)).data.user.email, alice);
    assert.deepEqual((await affiliations(userId)).map((a) => [a.school_id, a.status]), [[164988, 'active']]);

    // The old address confirms too: the change lands and the affiliation moves.
    const second = await client().auth.verifyOtp({ email: alice, token: oldCode, type: 'email_change' });
    assert.ifError(second.error);
    assert.equal((await admin.auth.admin.getUserById(userId)).data.user.email, aliceNew);
    assert.deepEqual((await affiliations(userId)).map((a) => [a.school_id, a.status]), [
      [164988, 'revoked'],
      [170976, 'active'],
    ]);
    const { data: rv } = await admin.from('reviews').select('status').eq('author_id', userId).eq('school_id', 164988).single();
    assert.equal(rv.status, 'pending', 'old-school review back to moderation');
  });

  after(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId).catch(() => {});
  });
});

describe('concurrent reports', () => {
  const ids = [];

  async function signedIn(email) {
    const password = `pw-${run}-long-enough`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    assert.ifError(error);
    ids.push(data.user.id);
    const c = client();
    const s = await c.auth.signInWithPassword({ email, password });
    assert.ifError(s.error);
    return c;
  }

  test('three reporters at once all succeed and flag the review (no deadlock)', async () => {
    const author = await signedIn(`author.${run}@bu.edu`);
    const posted = await author.from('reviews').insert(review(164988)).select('id,status').single();
    assert.ifError(posted.error);
    assert.equal(posted.data.status, 'published');
    const reporters = await Promise.all([1, 2, 3].map((n) => signedIn(`reporter${n}.${run}@umich.edu`)));
    // Separate sessions, separate PostgREST connections, fired together.
    const results = await Promise.all(
      reporters.map((c) => c.from('review_reports').insert({ review_id: posted.data.id, reason: 'spam' })),
    );
    for (const r of results) assert.ifError(r.error);
    const { data } = await admin.from('reviews').select('status,moderation_source').eq('id', posted.data.id).single();
    assert.deepEqual(data, { status: 'flagged', moderation_source: 'reports' });
  });

  after(async () => {
    for (const id of ids) await admin.auth.admin.deleteUser(id).catch(() => {});
  });
});
