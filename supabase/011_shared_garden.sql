-- All game state is separate from conversations. Rewards are once per person/day.
create table universe_private.garden_events (
 user_id uuid not null references public.universe_members(user_id),
 day date not null,
 kind text not null check(kind in ('water','feed','question','pairs','code','moon')),
 points integer not null,
 created_at timestamptz not null default now(),
 primary key(user_id,day,kind)
);
create table universe_private.garden_answers (
 user_id uuid not null references public.universe_members(user_id),
 day date not null,
 answer text not null check(length(answer) between 1 and 600),
 created_at timestamptz not null default now(),
 primary key(user_id,day)
);
alter table universe_private.garden_events enable row level security;
alter table universe_private.garden_answers enable row level security;
revoke all on universe_private.garden_events,universe_private.garden_answers from public,anon,authenticated;
create function public.universe_garden_state() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare d date:=(now() at time zone 'Asia/Colombo')::date;begin
 if not public.universe_is_member() then raise exception 'Access denied';end if;
 return jsonb_build_object('day',d,'xp',(select coalesce(sum(points),0) from universe_private.garden_events),
 'done',(select coalesce(jsonb_agg(kind),'[]') from universe_private.garden_events where user_id=auth.uid() and day=d),
 'care',(select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'kind',kind)),'[]') from universe_private.garden_events where day=d and kind in ('feed','water')),
 'answers',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from universe_private.garden_answers a where a.day=d and (a.user_id=auth.uid() or exists(select 1 from universe_private.garden_answers own where own.user_id=auth.uid() and own.day=d))),
 'partnerAnswered',exists(select 1 from universe_private.garden_answers where day=d and user_id<>auth.uid()),
 'memories',(select coalesce(jsonb_agg(to_jsonb(a) order by day desc,created_at),'[]') from (select a.* from universe_private.garden_answers a where a.day<d and exists(select 1 from universe_private.garden_answers own where own.user_id=auth.uid() and own.day=a.day) order by a.day desc,a.created_at limit 20) a));
end$$;
revoke all on function public.universe_garden_state() from public,anon;
grant execute on function public.universe_garden_state() to authenticated;
create function public.universe_garden_act(activity text,note text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare d date:=(now() at time zone 'Asia/Colombo')::date; pts integer;begin
 if not public.universe_is_member() then raise exception 'Access denied';end if;
 pts:=case activity when 'feed' then 3 when 'water' then 3 when 'question' then 5 when 'pairs' then 4 when 'code' then 4 when 'moon' then 1 else null end;
 if pts is null then raise exception 'Unknown activity';end if;
 if activity='question' then
  if note is null or length(trim(note)) not between 1 and 600 then raise exception 'Write 1–600 characters';end if;
  insert into universe_private.garden_answers(user_id,day,answer) values(auth.uid(),d,trim(note)) on conflict do nothing;
 end if;
 insert into universe_private.garden_events(user_id,day,kind,points) values(auth.uid(),d,activity,pts) on conflict do nothing;
 return public.universe_garden_state();
end$$;
revoke all on function public.universe_garden_act(text,text) from public,anon;
grant execute on function public.universe_garden_act(text,text) to authenticated;
