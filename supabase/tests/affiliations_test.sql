-- Affiliation lifecycle, email policy, and RLS. Run with `supabase test db`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(58);

create function pg_temp.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;
create function pg_temp.as_admin() returns void language sql as $$
  select set_config('role', 'postgres', true);
  select set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.new_user(uid uuid, addr text, confirmed boolean default false) returns void language sql as $$
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data,
                          raw_user_meta_data, created_at, updated_at)
  values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', addr,
          case when confirmed then now() end, '{}', '{}', now(), now());
$$;
create function pg_temp.status(uid uuid) returns text language sql as $$
  select status from public.school_affiliations where user_id = uid and status in ('pending', 'active')
$$;

-- A review body long enough to pass the length check.
create function pg_temp.review_sql(school integer, title text default 'Solid school overall') returns text language sql as $$
  select format($f$insert into public.reviews (school_id, relationship, grad_year, rating_overall, rating_academics,
    rating_social, rating_career, rating_housing, rating_safety, rating_value, title, body)
    values (%s, 'current_student', 2027, 4, 5, 3, 4, 3, 4, 4, %L,
    'Classes are demanding, advisors answer email, and the dining hall is fine most days.')$f$, school, title)
$$;

-- Domain mapping
select is(public.school_for_email('alice@bu.edu'), 164988, 'bu.edu maps to Boston University');
select is(public.school_for_email('Alice@CS.BU.EDU'), 164988, 'subdomains and case map to the parent school');
select is(public.school_for_email('alice@gmail.com'), null, 'gmail maps to nothing');
select is(public.school_for_email('alice@notbu.edu'), null, 'a suffix that is not a label boundary does not match');
select is(public.school_for_email('student@umn.edu'), 174066, 'hand-reviewed extra: umn.edu -> Twin Cities');
select ok(public.hook_before_user_created('{"user":{"email":"x@gmail.com"}}') ? 'error', 'hook rejects gmail');
select is(public.hook_before_user_created('{"user":{"email":"x@bu.edu"}}'), '{}'::jsonb, 'hook accepts bu.edu');
set local role anon;
select is(public.is_school_email('x@umich.edu'), true, 'anon can precheck a school email');
select is(public.is_school_email('x@yahoo.com'), false, 'precheck rejects other domains');
reset role;

-- Signup: pending until confirmation
select pg_temp.new_user('11111111-1111-1111-1111-111111111111', 'alice@bu.edu');
select is(pg_temp.status('11111111-1111-1111-1111-111111111111'), 'pending', 'new user starts pending');
select is((select role from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 'student', 'profile created');
select throws_ok(
  $$select pg_temp.new_user('99999999-9999-9999-9999-999999999999', 'mallory@gmail.com')$$,
  'P0001', null, 'a user with an unmapped email cannot be created at all');

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select throws_ok(pg_temp.review_sql(164988), '42501', null, 'pending user cannot review');
select pg_temp.as_admin();

update auth.users set email_confirmed_at = now() where id = '11111111-1111-1111-1111-111111111111';
select is(pg_temp.status('11111111-1111-1111-1111-111111111111'), 'active', 'confirmation activates');

select pg_temp.new_user('22222222-2222-2222-2222-222222222222', 'bob@umich.edu', true);
select is(pg_temp.status('22222222-2222-2222-2222-222222222222'), 'active', 'already-confirmed user is active on insert');

-- Reviews under an active affiliation
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select lives_ok(pg_temp.review_sql(164988), 'active user reviews their own school');
select is((select status from public.reviews where school_id = 164988), 'published', 'clean review is published');
select throws_ok(pg_temp.review_sql(170976), '42501', null, 'cannot review another school');
select throws_ok(
  $$update public.reviews set status = 'published', moderation_reason = null where school_id = 164988$$,
  '42501', null, 'status is not writable by users');
select throws_ok(
  $$update public.school_affiliations set school_id = 170976$$, '42501', null, 'affiliations are not writable');
select throws_ok(
  $$insert into public.school_affiliations (user_id, school_id, verified_email, status, verified_at)
    values ('11111111-1111-1111-1111-111111111111', 170976, 'x@umich.edu', 'active', now())$$,
  '42501', null, 'users cannot grant themselves an affiliation');
select throws_ok($$update public.profiles set role = 'admin'$$, '42501', null, 'users cannot change their role');
select throws_ok($$select public.moderate_review(1, 'remove')$$, '42501', null, 'students cannot moderate');
select pg_temp.as_admin();

-- Email policy on auth.users
select throws_ok(
  $$update auth.users set email_change = 'alice@gmail.com' where id = '11111111-1111-1111-1111-111111111111'$$,
  'P0001', null, 'requesting a change to gmail is rejected at request time');
select throws_ok(
  $$update auth.users set email = 'alice@gmail.com' where id = '11111111-1111-1111-1111-111111111111'$$,
  'P0001', null, 'writing a gmail email directly is rejected by the backstop');
select lives_ok(
  $$update auth.users set email_change = '' where id = '11111111-1111-1111-1111-111111111111'$$,
  'clearing email_change (what GoTrue does on confirm) is allowed');
select is((select email from auth.users where id = '11111111-1111-1111-1111-111111111111'), 'alice@bu.edu', 'email unchanged');

-- Same school, different address: affiliation kept
update auth.users set email = 'alice@cs.bu.edu' where id = '11111111-1111-1111-1111-111111111111';
select is((select count(*)::integer from public.school_affiliations where user_id = '11111111-1111-1111-1111-111111111111'), 1,
  'a change within the same school keeps the affiliation');

-- School-to-school move: old revoked, new active, old reviews back to pending
update auth.users set email = 'alice@umich.edu' where id = '11111111-1111-1111-1111-111111111111';
select is((select status from public.school_affiliations where user_id = '11111111-1111-1111-1111-111111111111' and school_id = 164988),
  'revoked', 'old school affiliation revoked');
select is((select school_id from public.school_affiliations where user_id = '11111111-1111-1111-1111-111111111111' and status = 'active'),
  170976, 'new school affiliation active');
select is((select status from public.reviews where author_id = '11111111-1111-1111-1111-111111111111' and school_id = 164988),
  'pending', 'reviews for the old school go back to pending');
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select throws_ok(pg_temp.review_sql(164988, 'Second try'), '42501', null, 'cannot review the old school any more');
select pg_temp.as_admin();

-- Auto-moderation, reports and moderator RPC
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select lives_ok(replace(pg_temp.review_sql(170976), 'the dining hall', 'see www.example.com, the dining hall'), 'review with a link is accepted');
select is((select status from public.reviews where author_id = '22222222-2222-2222-2222-222222222222'), 'flagged', 'links are held for moderation');
select pg_temp.as_admin();
update public.profiles set role = 'moderator' where id = '22222222-2222-2222-2222-222222222222';
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select lives_ok(
  format('select public.moderate_review(%s, %L)', (select id from public.reviews where author_id = '22222222-2222-2222-2222-222222222222'), 'publish'),
  'moderator can publish');
select pg_temp.as_admin();
select is((select status from public.reviews where author_id = '22222222-2222-2222-2222-222222222222'), 'published', 'moderated review is published');

-- Three distinct reporters flag a published review; the same reporter can't count twice.
select pg_temp.new_user('33333333-3333-3333-3333-333333333333', 'c@umich.edu', true);
select pg_temp.new_user('44444444-4444-4444-4444-444444444444', 'd@umich.edu', true);
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select lives_ok($$insert into public.review_reports (review_id, reason) select id, 'spam' from public.reviews where author_id = '22222222-2222-2222-2222-222222222222'$$, 'report accepted');
select throws_ok(
  format('insert into public.review_reports (review_id, reason) values (%s, %L)',
    (select id from public.reviews where author_id = '22222222-2222-2222-2222-222222222222' and status = 'published'), 'spam again'),
  '23505', null, 'one report per person per review');
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
select lives_ok($$insert into public.review_reports (review_id, reason) select id, 'spam' from public.reviews where author_id = '22222222-2222-2222-2222-222222222222' and status = 'published'$$, 'report accepted');
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select lives_ok($$insert into public.review_reports (review_id, reason) select id, 'spam' from public.reviews where author_id = '22222222-2222-2222-2222-222222222222' and status = 'published'$$, 'report accepted');
select pg_temp.as_admin();
select is((select status from public.reviews where author_id = '22222222-2222-2222-2222-222222222222'), 'flagged',
  'three distinct reports flag a review');

-- A person's decision survives the author's edits.
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select lives_ok(
  $$update public.reviews set body = body || ' Edited to look innocent, with nothing new in it.' where author_id = auth.uid()$$,
  'author can still edit a reported review');
select pg_temp.as_admin();
select is((select status from public.reviews where author_id = '22222222-2222-2222-2222-222222222222'), 'flagged',
  'a review flagged by reports stays flagged after an author edit');
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select throws_ok(
  format('insert into public.review_reports (review_id, reason) values (%s, %L)',
    (select id from public.reviews where author_id = auth.uid()), 'self report'),
  '42501', null, 'reports can only target published reviews');
select pg_temp.as_admin();

-- One account per mailbox: plus-addressed aliases are the same person.
select throws_ok(
  $$select pg_temp.new_user('55555555-5555-5555-5555-555555555555', 'C+alt@umich.edu', true)$$,
  '23505', null, 'a plus-addressed alias of an existing account is refused');

-- Aggregates count only published reviews
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select lives_ok(pg_temp.review_sql(170976), 'another verified student reviews');
set local role anon;
select is((select n from public.school_rating_aggregates where school_id = 170976), 1, 'aggregates count published reviews only');
select is((select count(*)::integer from public.public_reviews where school_id = 170976), 1, 'anon sees only the published review');
select throws_ok($$select author_id from public.reviews$$, '42501', null, 'anon cannot read the reviews table');
reset role;
select hasnt_column('public', 'public_reviews', 'author_id', 'the public view has no author id');

-- Authors withdraw instead of deleting.
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select throws_ok($$delete from public.reviews where author_id = auth.uid()$$, '42501', null, 'authors cannot hard-delete');
select lives_ok(
  format('select public.withdraw_review(%s)', (select id from public.reviews where author_id = auth.uid())),
  'authors can withdraw');
select throws_ok(pg_temp.review_sql(170976, 'Posting again'), '23505', null, 'a withdrawn review still holds the one-per-school slot');
select pg_temp.as_admin();
select is((select status from public.reviews where author_id = '33333333-3333-3333-3333-333333333333'), 'withdrawn', 'withdrawn, not deleted');

-- Unmapping a domain later leaves existing affiliations alone (admins revoke explicitly).
delete from public.school_domains where domain = 'umich.edu';
select is(pg_temp.status('33333333-3333-3333-3333-333333333333'), 'active', 'unmapping a domain does not revoke');
update public.profiles set role = 'admin' where id = '44444444-4444-4444-4444-444444444444';
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
select lives_ok($$select public.admin_revoke_affiliation('33333333-3333-3333-3333-333333333333', 'domain retired')$$, 'admin can revoke');
select pg_temp.as_admin();
select is(pg_temp.status('33333333-3333-3333-3333-333333333333'), null, 'revoked by admin');
insert into public.school_domains (domain, school_id) values ('umich.edu', 170976);
update auth.users set email = 'c.alias@umich.edu' where id = '33333333-3333-3333-3333-333333333333';
select is(pg_temp.status('33333333-3333-3333-3333-333333333333'), null, 'an admin revoke survives a later email change');

select * from finish();
rollback;
