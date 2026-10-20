-- Additive only: no existing conversation, photo, account or game writes.
create schema location_private;
revoke all on schema location_private from public,anon;
grant usage on schema location_private to authenticated;
create table public.universe_locations (
 user_id uuid primary key references public.universe_members(user_id),
 session_id uuid not null,
 mode text not null check(mode in ('active','paused','stopped')),
 latitude double precision check(latitude between -90 and 90),
 longitude double precision check(longitude between -180 and 180),
 accuracy double precision check(accuracy between 0 and 100000),
 sampled_at timestamptz,
 received_at timestamptz,
 expires_at timestamptz not null,
 revision bigint not null default 1,
 check((latitude is null and longitude is null and accuracy is null and sampled_at is null) or (latitude is not null and longitude is not null and accuracy is not null and sampled_at is not null)),
 check(mode<>'stopped' or latitude is null)
);
alter table public.universe_locations enable row level security;
revoke all on public.universe_locations from public,anon,authenticated;
grant select on public.universe_locations to authenticated;
grant all on public.universe_locations to service_role;
-- Stopped rows are visible tombstones with no coordinates, so realtime clears
-- a recipient's marker. Expired partner coordinates are not readable via REST.
create policy location_member_read on public.universe_locations for select to authenticated using((select public.universe_is_member()) and (user_id=(select auth.uid()) or mode='stopped' or expires_at>now()));
create function location_private.act(action text,payload jsonb) returns public.universe_locations language plpgsql security definer set search_path='' as $$
declare own uuid:=auth.uid();r public.universe_locations;session uuid;duration integer;lat double precision;lon double precision;acc double precision;sample timestamptz;begin
 if own is null or not public.universe_is_member() then raise exception 'Access denied';end if;
 if payload is null or jsonb_typeof(payload)<>'object' or octet_length(payload::text)>2000 then raise exception 'Invalid location request';end if;
 -- Per-account lock serializes start/stop/late GPS callbacks across devices.
 perform pg_advisory_xact_lock(hashtextextended(own::text,739210));
 select * into r from public.universe_locations where user_id=own;
 if action='stop' then
  if r.user_id is null then return null;end if;
  update public.universe_locations set mode='stopped',latitude=null,longitude=null,accuracy=null,sampled_at=null,received_at=null,expires_at=now(),revision=revision+1 where user_id=own returning * into r;
  return r;
 end if;
 session:=(payload->>'session')::uuid;
 if session is null then raise exception 'Choose Start sharing first';end if;
 if action='start' then
  duration:=(payload->>'minutes')::integer;
  if duration is null or duration not in (15,60,480) then raise exception 'Choose 15 minutes, 1 hour or 8 hours';end if;
  if r.session_id=session then return r;end if;
  insert into public.universe_locations(user_id,session_id,mode,expires_at)
  values(own,session,'active',now()+make_interval(mins=>duration))
  on conflict(user_id) do update set session_id=excluded.session_id,mode='active',latitude=null,longitude=null,accuracy=null,sampled_at=null,received_at=null,expires_at=excluded.expires_at,revision=public.universe_locations.revision+1 returning * into r;
  return r;
 end if;
 if r.user_id is null or r.session_id<>session or r.mode='stopped' or r.expires_at<=now() then raise exception 'Location session ended. Choose Start sharing to begin again.';end if;
 if action in ('pause','resume') then
  if r.mode<>(case when action='pause' then 'paused' else 'active' end) then
   update public.universe_locations set mode=case when action='pause' then 'paused' else 'active' end,revision=revision+1 where user_id=own returning * into r;
  end if;return r;
 end if;
 if action<>'position' or r.mode<>'active' then raise exception 'Location sharing is paused';end if;
 lat:=(payload->>'latitude')::double precision;lon:=(payload->>'longitude')::double precision;acc:=(payload->>'accuracy')::double precision;sample:=(payload->>'sampled_at')::timestamptz;
 if lat is null or lon is null or acc is null or sample is null or not(lat between -90 and 90) or not(lon between -180 and 180) or not(acc between 0 and 100000) or sample<now()-interval '45 seconds' or sample>now()+interval '10 seconds' then raise exception 'Location fix is invalid or too old';end if;
 if r.sampled_at is not null and sample<=r.sampled_at then return r;end if;
 -- Hard ceiling: six coordinate writes/minute within the active session.
 if r.received_at is not null and r.received_at>now()-interval '10 seconds' then return r;end if;
 update public.universe_locations set latitude=lat,longitude=lon,accuracy=acc,sampled_at=sample,received_at=now(),revision=revision+1 where user_id=own returning * into r;
 return r;
end$$;
revoke all on function location_private.act(text,jsonb) from public,anon;
grant execute on function location_private.act(text,jsonb) to authenticated;
create function public.universe_location_act(action text,payload jsonb) returns public.universe_locations language sql security invoker set search_path='' as $$select location_private.act(action,payload)$$;
revoke all on function public.universe_location_act(text,jsonb) from public,anon;
grant execute on function public.universe_location_act(text,jsonb) to authenticated;
alter publication supabase_realtime add table public.universe_locations;
