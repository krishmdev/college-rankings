-- Schools, school email domains, and verified affiliations.
--
-- Policy: an account's email is on a mapped school domain for the account's whole life. Signup is
-- gated by the before_user_created hook, email changes by triggers on auth.users, and the only
-- thing RLS trusts is a server-written affiliation with status 'active'.

create table public.schools (
  id integer primary key,
  name text not null,
  state text not null
);

create table public.school_domains (
  domain text primary key check (domain = lower(domain) and domain !~ '^www\.' and domain ~ '^[a-z0-9.-]+$'),
  school_id integer not null references public.schools (id) on delete cascade
);
create index on public.school_domains (school_id);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'student' check (role in ('student', 'moderator', 'admin')),
  created_at timestamptz not null default now()
);

create table public.school_affiliations (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  school_id integer not null references public.schools (id),
  verified_email text not null,
  status text not null check (status in ('pending', 'active', 'revoked')),
  verified_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (status <> 'active' or (verified_at is not null and revoked_at is null)),
  check (status <> 'revoked' or revoked_at is not null)
);
-- At most one live affiliation per user.
create unique index school_affiliations_one_live on public.school_affiliations (user_id)
  where status in ('pending', 'active');

-- Domain of an address, lowercased; null if it doesn't look like an email.
create function public.email_domain(email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then lower(split_part(email, '@', 2)) end
$$;

-- The school an address belongs to: exact domain match, or a subdomain of a mapped domain
-- (cs.bu.edu -> bu.edu). The longest matching domain wins.
create function public.school_for_email(email text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select d.school_id
  from public.school_domains d
  where public.email_domain(email) = d.domain
     or public.email_domain(email) like '%.' || d.domain
  order by length(d.domain) desc
  limit 1
$$;

-- Public precheck the app calls before signup and before updateUser({ email }). GoTrue sends the
-- change-confirmation email before it writes to auth.users, so without this the user would get a
-- code that can never work. Rate limiting is left to the API gateway defaults.
create function public.is_school_email(email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.school_for_email(email) is not null
$$;

revoke all on function public.school_for_email(text) from public, anon, authenticated;
revoke all on function public.is_school_email(text) from public;
grant execute on function public.is_school_email(text) to anon, authenticated;

-- Auth hook: reject signups from unmapped domains before GoTrue creates the user.
create function public.hook_before_user_created(event jsonb)
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
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Use your school email address. This domain isn''t on the list of supported schools.'
      )
    );
  end if;
  return '{}'::jsonb;
end;
$$;

revoke all on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;
grant select on public.school_domains to supabase_auth_admin;

-- New user: create the profile and a pending affiliation. If the address is already confirmed
-- (admin-created users, or confirmations turned off), activate straight away.
create function public.on_auth_user_created()
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

-- Request time: `updateUser({ email })` stores the pending address in email_change. Reject it
-- before any confirmation exists. The column is also rewritten on confirm (to '') and on unrelated
-- updates (unchanged), so only a new, non-empty value is checked.
create function public.on_auth_email_change_requested()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.email_change, '') <> ''
     and new.email_change is distinct from old.email_change
     and public.school_for_email(new.email_change) is null then
    raise exception 'email % is not on a supported school domain', new.email_change using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Backstop: whatever path writes auth.users.email (confirmation, admin API, SQL), it can't become
-- a non-school address.
create function public.on_auth_email_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email and public.school_for_email(new.email) is null then
    raise exception 'email % is not on a supported school domain', new.email using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- After an update: activate on first confirmation, and move the affiliation when a confirmed
-- email change lands on another school's domain.
create function public.on_auth_user_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_sid integer;
  live public.school_affiliations%rowtype;
begin
  select * into live from public.school_affiliations
  where user_id = new.id and status in ('pending', 'active')
  for update;

  if old.email_confirmed_at is null and new.email_confirmed_at is not null and live.status = 'pending' then
    update public.school_affiliations
       set status = 'active', verified_at = new.email_confirmed_at, verified_email = lower(new.email)
     where id = live.id;
    live.status := 'active';
  end if;

  if new.email is distinct from old.email then
    new_sid := public.school_for_email(new.email);
    if live.id is not null and live.school_id = new_sid then
      update public.school_affiliations set verified_email = lower(new.email) where id = live.id;
    else
      if live.id is not null then
        update public.school_affiliations
           set status = 'revoked', revoked_at = now()
         where id = live.id;
        -- Reviews written under the old affiliation go back to moderation. app.moderating stops
        -- the reviews trigger from auto-publishing them again.
        perform set_config('app.moderating', 'on', true);
        update public.reviews
           set status = 'pending', moderation_reason = 'author left this school'
         where author_id = new.id and school_id = live.school_id and status <> 'removed';
        perform set_config('app.moderating', 'off', true);
      end if;
      -- GoTrue only writes a new email after it has been confirmed, so the new school is verified.
      insert into public.school_affiliations (user_id, school_id, verified_email, status, verified_at)
      values (new.id, new_sid, lower(new.email), 'active', now());
    end if;
  end if;
  return new;
end;
$$;

-- Unmapping a domain later (a school_domains row deleted) does not revoke anyone. Affiliations
-- were verified when they were made; an admin revokes explicitly with this function.
create function public.admin_revoke_affiliation(target uuid, reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'admins only' using errcode = '42501';
  end if;
  update public.school_affiliations set status = 'revoked', revoked_at = now()
   where user_id = target and status in ('pending', 'active');
  perform set_config('app.moderating', 'on', true);
  update public.reviews set status = 'pending', moderation_reason = left(reason, 200)
   where author_id = target and status <> 'removed';
  perform set_config('app.moderating', 'off', true);
end;
$$;

revoke all on function public.on_auth_user_created() from public, anon, authenticated;
revoke all on function public.on_auth_email_change_requested() from public, anon, authenticated;
revoke all on function public.on_auth_email_write() from public, anon, authenticated;
revoke all on function public.on_auth_user_updated() from public, anon, authenticated;
revoke all on function public.admin_revoke_affiliation(uuid, text) from public, anon;
grant execute on function public.admin_revoke_affiliation(uuid, text) to authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.on_auth_user_created();

create trigger on_auth_email_change_requested
  before update of email_change on auth.users
  for each row execute function public.on_auth_email_change_requested();

create trigger on_auth_email_write
  before update of email on auth.users
  for each row execute function public.on_auth_email_write();

create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function public.on_auth_user_updated();

-- RLS: schools are public; profiles and affiliations are readable by their owner and writable by
-- nobody except the definer functions above.
alter table public.schools enable row level security;
alter table public.school_domains enable row level security;
alter table public.profiles enable row level security;
alter table public.school_affiliations enable row level security;

create policy "schools are public" on public.schools for select using (true);
create policy "domains are public" on public.school_domains for select using (true);
create policy "read own profile" on public.profiles for select using (id = (select auth.uid()));
create policy "read own affiliations" on public.school_affiliations for select using (user_id = (select auth.uid()));

revoke insert, update, delete, truncate on public.schools, public.school_domains, public.profiles,
  public.school_affiliations from anon, authenticated;
grant select on public.schools, public.school_domains to anon, authenticated;
grant select on public.profiles, public.school_affiliations to authenticated;

create function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('moderator', 'admin'))
$$;

create function public.active_school(uid uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select school_id from public.school_affiliations where user_id = uid and status = 'active'
$$;

revoke all on function public.is_moderator() from public, anon;
revoke all on function public.active_school(uuid) from public, anon;
grant execute on function public.is_moderator() to authenticated;
grant execute on function public.active_school(uuid) to authenticated;
