-- Reviews, reports, votes, moderation, and the aggregates the ranking engine reads.

create table public.reviews (
  id bigint generated always as identity primary key,
  school_id integer not null references public.schools (id),
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  relationship text not null check (relationship in ('current_student', 'recent_alum')),
  grad_year smallint not null check (grad_year between 2000 and 2040),
  rating_overall smallint not null check (rating_overall between 1 and 5),
  rating_academics smallint not null check (rating_academics between 1 and 5),
  rating_social smallint not null check (rating_social between 1 and 5),
  rating_career smallint not null check (rating_career between 1 and 5),
  rating_housing smallint not null check (rating_housing between 1 and 5),
  rating_safety smallint not null check (rating_safety between 1 and 5),
  rating_value smallint not null check (rating_value between 1 and 5),
  title text not null check (char_length(title) between 3 and 120),
  body text not null check (char_length(body) between 50 and 5000),
  status text not null default 'pending' check (status in ('pending', 'published', 'flagged', 'removed')),
  moderation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, author_id)
);
create index on public.reviews (school_id, status);
create index on public.reviews (author_id, created_at);

create table public.review_reports (
  review_id bigint not null references public.reviews (id) on delete cascade,
  reporter_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 500),
  created_at timestamptz not null default now(),
  -- One report per person per review, so three reports means three different people.
  primary key (review_id, reporter_id)
);

create table public.review_votes (
  review_id bigint not null references public.reviews (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  helpful boolean not null,
  primary key (review_id, user_id)
);

create table public.saved_profiles (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  payload text not null check (payload ~ '^v1\.[A-Za-z0-9_-]+$' and char_length(payload) < 2000),
  created_at timestamptz not null default now()
);

create table public.moderation_terms (
  term text primary key
);
insert into public.moderation_terms (term) values
  ('fuck'), ('shit'), ('bitch'), ('cunt'), ('retard'), ('faggot'), ('nigger'), ('kill yourself');

-- Returns a reason if the text should wait for a moderator, else null.
create function public.auto_moderation_reason(title text, body text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  txt text := lower(title || ' ' || body);
  hit text;
begin
  if txt ~ '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' then return 'contains an email address'; end if;
  if txt ~ '(\+?1[ .-]?)?\(?[0-9]{3}\)?[ .-]?[0-9]{3}[ .-]?[0-9]{4}' then return 'contains a phone number'; end if;
  if txt ~ '(https?://|www\.)' then return 'contains a link'; end if;
  select term into hit from public.moderation_terms where position(term in txt) > 0 limit 1;
  if hit is not null then return 'contains a banned term'; end if;
  return null;
end;
$$;

-- Status is never taken from the client: every insert and every author edit is re-moderated.
-- moderate_review() sets app.moderating so its own status changes pass through.
create function public.reviews_before_write()
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
    select count(*) into recent from public.reviews
     where author_id = new.author_id and created_at > now() - interval '1 day';
    if recent >= 5 then
      raise exception 'review limit reached: 5 per day' using errcode = 'P0001';
    end if;
  elsif old.status = 'removed' then
    raise exception 'removed reviews cannot be edited' using errcode = '42501';
  end if;
  new.updated_at := now();
  reason := public.auto_moderation_reason(new.title, new.body);
  if reason is not null then
    new.status := 'flagged';
    new.moderation_reason := reason;
  else
    new.status := 'published';
    new.moderation_reason := null;
  end if;
  return new;
end;
$$;

create trigger reviews_before_write
  before insert or update on public.reviews
  for each row execute function public.reviews_before_write();

create function public.review_reports_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.review_reports where review_id = new.review_id) >= 3 then
    perform set_config('app.moderating', 'on', true);
    update public.reviews
       set status = 'flagged', moderation_reason = 'reported by 3 people'
     where id = new.review_id and status = 'published';
    perform set_config('app.moderating', 'off', true);
  end if;
  return new;
end;
$$;

create trigger review_reports_after_insert
  after insert on public.review_reports
  for each row execute function public.review_reports_after_insert();

create function public.moderate_review(review_id bigint, action text, reason text default null)
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
         moderation_reason = reason
   where id = review_id;
  perform set_config('app.moderating', 'off', true);
end;
$$;

revoke all on function public.auto_moderation_reason(text, text) from public, anon, authenticated;
revoke all on function public.reviews_before_write() from public, anon, authenticated;
revoke all on function public.review_reports_after_insert() from public, anon, authenticated;
revoke all on function public.moderate_review(bigint, text, text) from public, anon;
grant execute on function public.moderate_review(bigint, text, text) to authenticated;

-- Aggregates over published reviews only. The view runs as its owner so it can count reviews the
-- caller can't read individually; it only exposes counts and averages.
create view public.school_rating_aggregates as
select
  school_id,
  count(*)::integer as n,
  avg(rating_overall)::real as overall,
  avg(rating_academics)::real as academics,
  avg(rating_social)::real as social,
  avg(rating_career)::real as career,
  avg(rating_housing)::real as housing,
  avg(rating_safety)::real as safety,
  avg(rating_value)::real as value
from public.reviews
where status = 'published'
group by school_id;

-- RLS
alter table public.reviews enable row level security;
alter table public.review_reports enable row level security;
alter table public.review_votes enable row level security;
alter table public.saved_profiles enable row level security;
alter table public.moderation_terms enable row level security;

create policy "published reviews are public" on public.reviews
  for select using (status = 'published');
create policy "authors read their own" on public.reviews
  for select to authenticated using (author_id = (select auth.uid()));
create policy "moderators read everything" on public.reviews
  for select to authenticated using ((select public.is_moderator()));
-- The only thing that makes a review possible: an active, verified affiliation with this school.
create policy "review your own school" on public.reviews
  for insert to authenticated
  with check (author_id = (select auth.uid()) and school_id = (select public.active_school(auth.uid())));
create policy "edit while still affiliated" on public.reviews
  for update to authenticated
  using (author_id = (select auth.uid()) and school_id = (select public.active_school(auth.uid())))
  with check (author_id = (select auth.uid()) and school_id = (select public.active_school(auth.uid())));
create policy "delete your own" on public.reviews
  for delete to authenticated using (author_id = (select auth.uid()));

create policy "report once" on public.review_reports
  for insert to authenticated with check (reporter_id = (select auth.uid()));
create policy "see own reports" on public.review_reports
  for select to authenticated using (reporter_id = (select auth.uid()) or (select public.is_moderator()));

create policy "vote" on public.review_votes
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "change vote" on public.review_votes
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "see own votes" on public.review_votes
  for select to authenticated using (user_id = (select auth.uid()));

create policy "own saved profiles" on public.saved_profiles
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Column-level grants: users can write review content, never status or authorship.
revoke all on public.reviews, public.review_reports, public.review_votes, public.saved_profiles,
  public.moderation_terms from anon, authenticated;
grant select on public.reviews to anon, authenticated;
grant insert (school_id, relationship, grad_year, rating_overall, rating_academics, rating_social,
  rating_career, rating_housing, rating_safety, rating_value, title, body) on public.reviews to authenticated;
grant update (relationship, grad_year, rating_overall, rating_academics, rating_social, rating_career,
  rating_housing, rating_safety, rating_value, title, body) on public.reviews to authenticated;
grant delete on public.reviews to authenticated;
grant select, insert (review_id, reason) on public.review_reports to authenticated;
grant select, insert (review_id, helpful), update (helpful) on public.review_votes to authenticated;
grant select, insert (name, payload), delete on public.saved_profiles to authenticated;
grant select on public.school_rating_aggregates to anon, authenticated;
