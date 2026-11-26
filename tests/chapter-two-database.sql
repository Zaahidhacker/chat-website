-- Run against an isolated Postgres test database with the two fixture accounts.
begin;
update chapter_two_private.events
set story = '{"title":"Fixture Chapter","steps":[]}', release_at = clock_timestamp() + interval '1 minute'
where id = 'anniversary_2026_11_27';

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
do $$
begin
  assert public.chapter_two_event() ->> 'access' = 'sender';
  assert public.chapter_two_event('preview') #>> '{story,title}' = 'Fixture Chapter';
  begin
    perform public.chapter_two_event('start', gen_random_uuid());
    raise exception 'Sender could start an automatic attempt';
  exception when insufficient_privilege then null;
  end;
  begin
    perform story from chapter_two_private.events;
    raise exception 'Direct story read was allowed';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
do $$
begin
  assert public.chapter_two_event() = '{"access":"none"}';
  assert public.chapter_two_event('preview') = '{"access":"none"}';
  assert public.chapter_two_event('replay') = '{"access":"none"}';
end $$;

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
do $$
begin
  assert public.chapter_two_event() ->> 'ready' = 'false';
  assert not (public.chapter_two_event() ? 'story');
  begin
    perform public.chapter_two_event('start', gen_random_uuid());
    raise exception 'Started before release';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.chapter_two_event('preview');
    raise exception 'Recipient could see preview';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
update chapter_two_private.events set release_at = clock_timestamp() where id = 'anniversary_2026_11_27';
set local role authenticated;
do $$
declare
  first_id uuid := gen_random_uuid();
  next_id uuid := gen_random_uuid();
  finished jsonb;
begin
  assert public.chapter_two_event() ->> 'ready' = 'true';
  assert not (public.chapter_two_event() ? 'progress');
  assert public.chapter_two_event('start', first_id) ? 'story';
  assert public.chapter_two_event('start', first_id) ? 'story';
  assert public.chapter_two_event('letter', first_id) ->> 'saved' = 'true';
  assert public.chapter_two_event('start', next_id) ? 'story';
  begin
    perform public.chapter_two_event('final', next_id);
    raise exception 'An earlier attempt counted toward the next attempt';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.chapter_two_event('complete', first_id);
    raise exception 'Completed before the final scene';
  exception when invalid_parameter_value then null;
  end;
  assert public.chapter_two_event('letter', next_id) ->> 'saved' = 'true';
  assert public.chapter_two_event('final', next_id) ->> 'saved' = 'true';
  assert public.chapter_two_event() ->> 'completed' = 'false';
  finished := public.chapter_two_event('complete', next_id);
  assert finished ->> 'completed' = 'true';
  assert finished ->> 'completed_at' is not null;
  assert public.chapter_two_event('complete', next_id) ->> 'completed_at' = finished ->> 'completed_at';
  assert not (public.chapter_two_event('start', gen_random_uuid()) ? 'story');
  assert public.chapter_two_event('replay') ? 'story';
end $$;

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
do $$
declare
  progress jsonb := public.chapter_two_event() -> 'progress';
begin
  assert progress ->> 'attempts' = '2';
  assert progress ->> 'first_opened_at' is not null;
  assert progress ->> 'last_opened_at' is not null;
  assert progress ->> 'letter_reached_at' is not null;
  assert progress ->> 'final_reached_at' is not null;
  assert progress ->> 'completed_at' is not null;
end $$;

reset role;
set local role anon;
do $$
begin
  begin
    perform public.chapter_two_event();
    raise exception 'Unauthenticated request was allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
