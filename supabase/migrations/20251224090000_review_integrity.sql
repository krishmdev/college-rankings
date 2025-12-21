-- Review integrity fixes from review:
--   * moderation decisions by reporters or moderators survive author edits,
--   * authors withdraw instead of deleting (a delete + re-post used to clear flags and reports),
--   * an admin revoke is sticky across later email changes,
--   * one account per mailbox: plus-addressed aliases (alice+2@bu.edu) are the same person,
--   * anon can't see who wrote a review; reports and votes only target visible reviews,
--   * the 3-report threshold is counted under a row lock, so concurrent reports can't race past it.

-- Moderation provenance and a soft-delete status.
alter table public.reviews
  add column moderation_source text check (moderation_source in ('auto', 'reports', 'moderator', 'affiliation'));
alter table public.reviews drop constraint reviews_status_check;
alter table public.reviews
  add constraint reviews_status_check check (status in ('pending', 'published', 'flagged', 'removed', 'withdrawn'));

create or replace function public.reviews_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  reason text;
  recent integer;
begin
  if current_setting('app.moderating', true) = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    -- Withdrawn reviews still count, so withdrawing and re-posting doesn't reset the limit.
    select count(*) into recent from public.reviews
     where author_id = new.author_id and created_at > now() - interval '1 day';
    if recent >= 5 then
      raise exception 'review limit reached: 5 per day' using errcode = 'P0001';
    end if;
  elsif old.status in ('removed', 'withdrawn') then
    raise exception '% reviews cannot be edited', old.status using errcode = '42501';
  end if;
  new.updated_at := now();
  reason := public.auto_moderation_reason(new.title, new.body);
  if reason is not null then
    new.status := 'flagged';
    new.moderation_reason := reason;
    new.moderation_source := 'auto';
  elsif tg_op = 'UPDATE' and old.status in ('flagged', 'pending')
        and old.moderation_source in ('reports', 'moderator', 'affiliation') then
    -- A person decided this one; an edit doesn't undo it. It stays in the queue.
    new.status := old.status;
    new.moderation_reason := old.moderation_reason;
    new.moderation_source := old.moderation_source;
  else
    new.status := 'published';
    new.moderation_reason := null;
    new.moderation_source := null;
  end if;
  return new;
end;
$$;

create or replace function public.review_reports_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Serialize reports on the same review: the second of two concurrent reporters waits here and
  -- then counts with a fresh snapshot that includes the first.
  perform 1 from public.reviews where id = new.review_id for update;
  if (select count(*) from public.review_reports where review_id = new.review_id) >= 3 then
    perform set_config('app.moderating', 'on', true);
    update public.reviews
       set status = 'flagged', moderation_reason = 'reported by 3 people', moderation_source = 'reports'
     where id = new.review_id and status = 'published';
    perform set_config('app.moderating', 'off', true);
  end if;
  return new;
end;
$$;

create or replace function public.moderate_review(review_id bigint, action text, reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_moderator() then
    raise exception 'moderators only' using errcode = '42501';
  end if;
  if action not in ('publish', 'flag', 'remove') then
    raise exception 'unknown action %', action using errcode = '22023';
  end if;
  perform set_config('app.moderating', 'on', true);
  update public.reviews
     set status = case action when 'publish' then 'published' when 'flag' then 'flagged' else 'removed' end,
         moderation_reason = reason,
         moderation_source = 'moderator'
   where id = review_id;
  perform set_config('app.moderating', 'off', true);
end;
$$;

-- Authors withdraw; they can't hard-delete (which would drop reports and flags with the row).
create function public.withdraw_review(review_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  perform set_config('app.moderating', 'on', true);
  update public.reviews set status = 'withdrawn'
   where id = review_id and author_id = auth.uid() and status <> 'removed';
  get diagnostics n = row_count;
  perform set_config('app.moderating', 'off', true);
  if n = 0 then
    raise exception 'no such review of yours' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.withdraw_review(bigint) from public, anon;
grant execute on function public.withdraw_review(bigint) to authenticated;

drop policy "delete your own" on public.reviews;
revoke delete on public.reviews from authenticated;

-- Affiliation moves and admin revokes mark their reviews so edits keep them in the queue.
alter table public.school_affiliations add column revoked_by_admin boolean not null default false;

create or replace function public.admin_revoke_affiliation(target uuid, reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'admins only' using errcode = '42501';
  end if;
  update public.school_affiliations
     set status = 'revoked', revoked_at = now(), revoked_by_admin = true
   where user_id = target and status in ('pending', 'active');
  perform set_config('app.moderating', 'on', true);
  update public.reviews
     set status = 'pending', moderation_reason = left(reason, 200), moderation_source = 'affiliation'
   where author_id = target and status not in ('removed', 'withdrawn');
  perform set_config('app.moderating', 'off', true);
end;
$$;

-- One account per mailbox. The local part is lowercased and anything after a '+' is dropped,
-- so alice+2@bu.edu and Alice@bu.edu are the same person as alice@bu.edu.
create function public.normalize_email(email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when email like '%@%'
    then split_part(lower(split_part(email, '@', 1)), '+', 1) || '@' || lower(split_part(email, '@', 2))
  end
$$;

create table public.account_emails (
  user_id uuid primary key references auth.users (id) on delete cascade,
  normalized_email text not null unique
);
alter table public.account_emails enable row level security;
revoke all on public.account_emails from anon, authenticated;
grant select on public.account_emails to supabase_auth_admin;

insert into public.account_emails (user_id, normalized_email)
select id, public.normalize_email(email) from auth.users where email is not null
on conflict do nothing;

create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  addr text := event -> 'user' ->> 'email';
begin
  if addr is null or public.school_for_email(addr) is null then
    return jsonb_build_object('error', jsonb_build_object('http_code', 403,
      'message', 'Use your school email address. This domain isn''t on the list of supported schools.'));
  end if;
  if exists (select 1 from public.account_emails where normalized_email = public.normalize_email(addr)) then
    return jsonb_build_object('error', jsonb_build_object('http_code', 409,
      'message', 'An account already exists for this mailbox. Sign in with it instead.'));
  end if;
  return '{}'::jsonb;
end;
$$;

create or replace function public.on_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sid integer := public.school_for_email(new.email);
begin
  if sid is null then
    raise exception 'email % is not on a supported school domain', new.email using errcode = 'P0001';
  end if;
  -- Unique on the normalized address: a second account for the same mailbox fails here.
  insert into public.account_emails (user_id, normalized_email) values (new.id, public.normalize_email(new.email));
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  insert into public.school_affiliations (user_id, school_id, verified_email, status, verified_at)
  values (
    new.id, sid, lower(new.email),
    case when new.email_confirmed_at is not null then 'active' else 'pending' end,
    new.email_confirmed_at
  );
  return new;
end;
$$;

-- email_change requests also can't point at another account's mailbox.
create or replace function public.on_auth_email_change_requested()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.email_change, '') <> '' and new.email_change is distinct from old.email_change then
    if public.school_for_email(new.email_change) is null then
      raise exception 'email % is not on a supported school domain', new.email_change using errcode = 'P0001';
    end if;
    if exists (select 1 from public.account_emails
                where normalized_email = public.normalize_email(new.email_change) and user_id <> new.id) then
      raise exception 'another account already uses this mailbox' using errcode = '23505';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.on_auth_user_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_sid integer;
  live public.school_affiliations%rowtype;
  banned boolean;
begin
  select * into live from public.school_affiliations
  where user_id = new.id and status in ('pending', 'active')
  for update;
  select exists (select 1 from public.school_affiliations where user_id = new.id and revoked_by_admin) into banned;

  if old.email_confirmed_at is null and new.email_confirmed_at is not null and live.status = 'pending' then
    update public.school_affiliations
       set status = 'active', verified_at = new.email_confirmed_at, verified_email = lower(new.email)
     where id = live.id;
    live.status := 'active';
  end if;

  if new.email is distinct from old.email then
    update public.account_emails set normalized_email = public.normalize_email(new.email) where user_id = new.id;
    new_sid := public.school_for_email(new.email);
    if live.id is not null and live.school_id = new_sid then
      update public.school_affiliations set verified_email = lower(new.email) where id = live.id;
    else
      if live.id is not null then
        update public.school_affiliations set status = 'revoked', revoked_at = now() where id = live.id;
        perform set_config('app.moderating', 'on', true);
        update public.reviews
           set status = 'pending', moderation_reason = 'author left this school', moderation_source = 'affiliation'
         where author_id = new.id and school_id = live.school_id and status not in ('removed', 'withdrawn');
        perform set_config('app.moderating', 'off', true);
      end if;
      -- An admin revoke is a decision about the person, not the address: no new affiliation.
      if not banned then
        insert into public.school_affiliations (user_id, school_id, verified_email, status, verified_at)
        values (new.id, new_sid, lower(new.email), 'active', now());
      end if;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.normalize_email(text) from public, anon, authenticated;

-- Anonymous readers get reviews without author ids, through a view. The table itself is readable
-- only by its author and by moderators.
drop policy "published reviews are public" on public.reviews;
revoke select on public.reviews from anon;
create view public.public_reviews as
select id, school_id, relationship, grad_year, rating_overall, rating_academics, rating_social, rating_career,
       rating_housing, rating_safety, rating_value, title, body, created_at
from public.reviews
where status = 'published';
grant select on public.public_reviews to anon, authenticated;

create function public.review_is_published(rid bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.reviews where id = rid and status = 'published')
$$;
revoke all on function public.review_is_published(bigint) from public, anon;
grant execute on function public.review_is_published(bigint) to authenticated;

drop policy "report once" on public.review_reports;
create policy "report visible reviews" on public.review_reports
  for insert to authenticated
  with check (reporter_id = (select auth.uid()) and public.review_is_published(review_id));
drop policy "vote" on public.review_votes;
create policy "vote on visible reviews" on public.review_votes
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.review_is_published(review_id));
