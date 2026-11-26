-- Bind the event to the same enrolled accounts used by Chapter I.
create schema chapter_two_private;
revoke all on schema chapter_two_private from public;
grant usage on schema chapter_two_private to authenticated;

create table chapter_two_private.events (
  id text primary key,
  sender_id uuid not null references auth.users(id),
  recipient_id uuid not null references auth.users(id),
  release_at timestamptz not null,
  story jsonb check (jsonb_typeof(story) = 'object'),
  check (sender_id <> recipient_id),
  unique (id, recipient_id)
);

insert into chapter_two_private.events (id, sender_id, recipient_id, release_at)
select 'anniversary_2026_11_27', sender.user_id, recipient.user_id,
       '2026-11-27 00:00:00 Asia/Colombo'::timestamptz
from public.universe_members sender
cross join public.universe_members recipient
where sender.slot = 1 and recipient.slot = 2;

create table chapter_two_private.progress (
  event_id text not null,
  recipient_id uuid not null,
  first_opened_at timestamptz not null,
  last_opened_at timestamptz not null,
  attempts integer not null check (attempts > 0),
  letter_reached_at timestamptz,
  final_reached_at timestamptz,
  completed_at timestamptz,
  primary key (event_id, recipient_id),
  foreign key (event_id, recipient_id) references chapter_two_private.events (id, recipient_id),
  check (last_opened_at >= first_opened_at),
  check (final_reached_at is null or letter_reached_at is not null),
  check (completed_at is null or final_reached_at is not null)
);

-- An attempt ID deduplicates network retries and scopes milestones to the tab
-- that reached them. A fresh opening generates a new ID.
create table chapter_two_private.attempts (
  event_id text not null,
  recipient_id uuid not null,
  attempt_id uuid not null,
  reached_letter boolean not null default false,
  reached_final boolean not null default false,
  primary key (event_id, recipient_id, attempt_id),
  foreign key (event_id, recipient_id) references chapter_two_private.progress (event_id, recipient_id),
  check (not reached_final or reached_letter)
);

alter table chapter_two_private.events enable row level security;
alter table chapter_two_private.progress enable row level security;
alter table chapter_two_private.attempts enable row level security;
revoke all on all tables in schema chapter_two_private from public, anon, authenticated;

create function chapter_two_private.access_event(p_action text, p_attempt uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  caller uuid := auth.uid();
  event chapter_two_private.events;
  state chapter_two_private.progress;
  attempt chapter_two_private.attempts;
  stamp timestamptz;
  is_sender boolean;
  is_released boolean;
  new_attempt integer;
  new_progress integer;
begin
  select * into event from chapter_two_private.events where id = 'anniversary_2026_11_27';
  if caller is null or event.id is null or caller not in (event.sender_id, event.recipient_id) then
    return jsonb_build_object('access', 'none');
  end if;

  stamp := clock_timestamp();
  is_sender := caller = event.sender_id;
  is_released := stamp >= event.release_at;

  if p_action = 'status' then
    select * into state from chapter_two_private.progress
      where event_id = event.id and recipient_id = event.recipient_id;
    if is_sender then
      return jsonb_build_object(
        'access', 'sender', 'ready', event.story is not null, 'progress',
        jsonb_build_object('first_opened_at', state.first_opened_at, 'last_opened_at', state.last_opened_at,
                           'attempts', coalesce(state.attempts, 0), 'letter_reached_at', state.letter_reached_at,
                           'final_reached_at', state.final_reached_at, 'completed_at', state.completed_at));
    end if;
    return jsonb_build_object(
      'access', 'recipient', 'ready', event.story is not null and is_released,
      'server_now', stamp, 'release_at', event.release_at, 'completed', state.completed_at is not null);
  end if;

  if p_action = 'preview' and is_sender and event.story is not null then
    return jsonb_build_object('story', event.story);
  end if;
  if is_sender or not is_released or event.story is null then
    raise exception 'This chapter is unavailable.' using errcode = '42501';
  end if;

  if p_action = 'replay' then
    if exists (select 1 from chapter_two_private.progress where event_id = event.id
               and recipient_id = caller and completed_at is not null) then
      return jsonb_build_object('story', event.story);
    end if;
    raise exception 'This chapter is unavailable.' using errcode = '42501';
  end if;

  if p_attempt is null or p_action is null or p_action not in ('start', 'letter', 'final', 'complete') then
    raise exception 'Invalid chapter action.' using errcode = '22023';
  end if;

  if p_action = 'start' then
    insert into chapter_two_private.progress
      (event_id, recipient_id, first_opened_at, last_opened_at, attempts)
    values (event.id, caller, stamp, stamp, 1)
    on conflict do nothing;
    get diagnostics new_progress = row_count;
  end if;

  -- Serialize updates for all concurrent tabs of the recipient.
  select * into state from chapter_two_private.progress
    where event_id = event.id and recipient_id = caller for update;
  if state.event_id is null then
    raise exception 'Start this chapter first.' using errcode = '22023';
  end if;
  if state.completed_at is not null then
    return jsonb_build_object('completed', true, 'completed_at', state.completed_at);
  end if;

  if p_action = 'start' then
    insert into chapter_two_private.attempts (event_id, recipient_id, attempt_id)
      values (event.id, caller, p_attempt) on conflict do nothing;
    get diagnostics new_attempt = row_count;
    -- Start each attempt exactly once. The first transaction created the progress row.
    if new_attempt = 1 then
      update chapter_two_private.progress
        set attempts = attempts + 1 - new_progress,
            last_opened_at = greatest(last_opened_at, stamp)
        where event_id = event.id and recipient_id = caller;
    end if;
    return jsonb_build_object('story', event.story, 'completed', false);
  end if;

  select * into attempt from chapter_two_private.attempts
    where event_id = event.id and recipient_id = caller and attempt_id = p_attempt;
  if attempt.attempt_id is null
     or (p_action = 'final' and not attempt.reached_letter)
     or (p_action = 'complete' and not attempt.reached_final) then
    raise exception 'Reach the preceding scene first.' using errcode = '22023';
  end if;

  stamp := clock_timestamp();
  if p_action = 'letter' then
    update chapter_two_private.attempts set reached_letter = true
      where event_id = event.id and recipient_id = caller and attempt_id = p_attempt;
    update chapter_two_private.progress set letter_reached_at = coalesce(letter_reached_at, stamp)
      where event_id = event.id and recipient_id = caller;
  elsif p_action = 'final' then
    update chapter_two_private.attempts set reached_final = true
      where event_id = event.id and recipient_id = caller and attempt_id = p_attempt;
    update chapter_two_private.progress set final_reached_at = coalesce(final_reached_at, stamp)
      where event_id = event.id and recipient_id = caller;
  else
    update chapter_two_private.progress set completed_at = stamp
      where event_id = event.id and recipient_id = caller;
  end if;
  return jsonb_build_object('saved', true, 'completed', p_action = 'complete',
                            'completed_at', case when p_action = 'complete' then stamp end);
end
$function$;

revoke all on function chapter_two_private.access_event(text, uuid) from public, anon;
grant execute on function chapter_two_private.access_event(text, uuid) to authenticated;

create function public.chapter_two_event(p_action text default 'status', p_attempt uuid default null)
returns jsonb language sql security invoker set search_path = ''
as $function$
  select chapter_two_private.access_event(p_action, p_attempt);
$function$;
revoke all on function public.chapter_two_event(text, uuid) from public, anon;
grant execute on function public.chapter_two_event(text, uuid) to authenticated;

notify pgrst, 'reload schema';
