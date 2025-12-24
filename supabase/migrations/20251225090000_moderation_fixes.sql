-- Follow-ups to 20251224090000_review_integrity.sql:
--   * a human moderation decision is checked before auto-moderation, so an author can't launder a
--     reporters'/moderator's flag through an auto flag (add a URL, then remove it),
--   * the report lock is FOR NO KEY UPDATE: the report insert's foreign-key check already holds
--     FOR KEY SHARE on the review, and FOR UPDATE conflicts with that across concurrent reporters
--     (deadlock), while FOR NO KEY UPDATE doesn't.

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
    select count(*) into recent from public.reviews
     where author_id = new.author_id and created_at > now() - interval '1 day';
    if recent >= 5 then
      raise exception 'review limit reached: 5 per day' using errcode = 'P0001';
    end if;
  elsif old.status in ('removed', 'withdrawn') then
    raise exception '% reviews cannot be edited', old.status using errcode = '42501';
  end if;
  new.updated_at := now();
  if tg_op = 'UPDATE' and old.status in ('flagged', 'pending')
     and old.moderation_source in ('reports', 'moderator', 'affiliation') then
    -- A person decided this one. No edit, clean or not, changes its status or why it's held.
    new.status := old.status;
    new.moderation_reason := old.moderation_reason;
    new.moderation_source := old.moderation_source;
    return new;
  end if;
  reason := public.auto_moderation_reason(new.title, new.body);
  if reason is not null then
    new.status := 'flagged';
    new.moderation_reason := reason;
    new.moderation_source := 'auto';
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
  -- Serialize reporters on the same review; the next one counts with a fresh snapshot.
  perform 1 from public.reviews where id = new.review_id for no key update;
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

comment on view public.public_reviews is
  'Deliberately runs with the owner''s rights (not security_invoker) so anonymous readers can see '
  'published reviews without read access to public.reviews. It exposes only status = published '
  'rows and has no author_id column.';
