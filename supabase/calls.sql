-- Additive calling upgrade. Existing messages, accounts, push keys and audio stay intact.
create table public.universe_calls (
 id uuid primary key,
 caller uuid not null references public.universe_members(user_id),
 recipient uuid not null references public.universe_members(user_id),
 caller_device uuid not null, recipient_device uuid,
 state text not null default 'calling' check(state in ('calling','accepted','declined','ended','missed')),
 offer jsonb, answer jsonb,
 ring_device uuid, ring_until timestamptz,
 caller_seen timestamptz not null default now(), recipient_seen timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '60 seconds',
 check(caller<>recipient),
 check(octet_length(offer::text)<20000 and octet_length(answer::text)<20000)
);
create index universe_calls_active on public.universe_calls(created_at desc) where state in ('calling','accepted');
alter table public.universe_calls enable row level security;
revoke all on public.universe_calls from public,anon,authenticated;
grant select on public.universe_calls to authenticated;
grant all on public.universe_calls to service_role;
create policy calls_participants on public.universe_calls for select to authenticated
 using ((select public.universe_is_member()) and (caller=(select auth.uid()) or recipient=(select auth.uid())));
alter publication supabase_realtime add table public.universe_calls;

-- All writes validate membership, role, the owning tab and the call's lease.
create function public.universe_call_start(mid uuid,device uuid,sdp jsonb) returns public.universe_calls
 language plpgsql security definer set search_path='' as $$
declare c public.universe_calls; partner uuid; begin
 if not public.universe_is_member() or device is null or mid is null then raise exception 'Access denied'; end if;
 if sdp->>'type' is distinct from 'offer' or coalesce(length(sdp->>'sdp'),0) not between 1 and 19000 then raise exception 'Invalid call offer'; end if;
 perform pg_advisory_xact_lock(739112);
 select * into c from public.universe_calls where id=mid;
 if found then
  if c.caller=auth.uid() and c.caller_device=device then return c; end if;
  raise exception 'Call conflict';
 end if;
 update public.universe_calls set state='missed',offer=null,answer=null,updated_at=clock_timestamp()
 where state in ('calling','accepted') and expires_at<=now();
 if exists(select 1 from public.universe_calls where state in ('calling','accepted')) then raise exception 'A call is already in progress. Open it or wait for it to end.'; end if;
 if (select count(*) from public.universe_calls where caller=auth.uid() and created_at>now()-interval '1 minute')>=4 then raise exception 'Please wait a moment before calling again.'; end if;
 select user_id into partner from public.universe_members where user_id<>auth.uid() limit 1;
 if partner is null then raise exception 'Your person has not joined yet.'; end if;
 insert into public.universe_calls(id,caller,recipient,caller_device,offer) values(mid,auth.uid(),partner,device,sdp) returning * into c;
 return c;
end$$;

create function public.universe_call_update(mid uuid,device uuid,action text,sdp jsonb default null) returns public.universe_calls
 language plpgsql security definer set search_path='' as $$
declare c public.universe_calls; uid uuid:=auth.uid(); begin
 if not public.universe_is_member() or device is null then raise exception 'Access denied'; end if;
 select * into c from public.universe_calls where id=mid for update;
 if not found or uid not in (c.caller,c.recipient) then raise exception 'Call unavailable'; end if;
 if c.state not in ('calling','accepted') then return c; end if;
 if c.expires_at<=now() then
  update public.universe_calls set state='missed',offer=null,answer=null,updated_at=clock_timestamp() where id=mid returning * into c;return c;
 end if;
 if action in ('ring','away') and uid=c.recipient and c.state='calling' then
  if action='ring' then c.ring_device:=device;c.ring_until:=now()+interval '25 seconds';
  elsif c.ring_device=device then c.ring_until:=null;end if;
 elsif action='accept' and uid=c.recipient and c.state='calling' then
  if sdp->>'type' is distinct from 'answer' or coalesce(length(sdp->>'sdp'),0) not between 1 and 19000 then raise exception 'Invalid call answer';end if;
  c.state:='accepted';c.answer:=sdp;c.recipient_device:=device;c.caller_seen:=now();c.recipient_seen:=now();c.expires_at:=now()+interval '90 seconds';
 elsif action='accept' and uid=c.recipient and c.state='accepted' and c.recipient_device=device then return c;
 elsif action='decline' and uid=c.recipient and c.state='calling' then c.state:='declined';
 elsif action='end' and ((uid=c.caller and c.caller_device=device) or (uid=c.recipient and c.recipient_device=device)) then c.state:='ended';
 elsif action='heartbeat' and c.state='accepted' and ((uid=c.caller and c.caller_device=device) or (uid=c.recipient and c.recipient_device=device)) then
  if uid=c.caller then c.caller_seen:=now();else c.recipient_seen:=now();end if;
  c.expires_at:=least(c.caller_seen,c.recipient_seen)+interval '90 seconds';
 else raise exception 'This call was answered elsewhere or is no longer available';end if;
 if c.state not in ('calling','accepted') then c.offer:=null;c.answer:=null;c.ring_until:=null;end if;
 update public.universe_calls set state=c.state,answer=c.answer,offer=c.offer,recipient_device=c.recipient_device,
 ring_device=c.ring_device,ring_until=c.ring_until,caller_seen=c.caller_seen,recipient_seen=c.recipient_seen,
 expires_at=c.expires_at,updated_at=clock_timestamp() where id=mid returning * into c;
 return c;
end$$;

-- Replace legacy unbound signal writes with call-scoped, device-scoped ICE writes.
revoke insert on public.universe_call_signals from authenticated;
revoke usage on sequence public.universe_call_signals_id_seq from authenticated;
create index universe_call_signal_replay on public.universe_call_signals(call_id,id);
create function public.universe_call_signal(mid uuid,device uuid,candidate jsonb) returns void
 language plpgsql security definer set search_path='' as $$
declare c public.universe_calls;begin
 if not public.universe_is_member() then raise exception 'Access denied';end if;
 select * into c from public.universe_calls where id=mid for update;
 if not found or c.state not in ('calling','accepted') or c.expires_at<=now()
 or not ((c.caller=auth.uid() and c.caller_device=device) or (c.recipient=auth.uid() and c.recipient_device=device)) then raise exception 'Call unavailable';end if;
 if jsonb_typeof(candidate)<>'object' or coalesce(length(candidate->>'candidate'),0) not between 1 and 2000 or octet_length(candidate::text)>3000 then raise exception 'Invalid connection candidate';end if;
 if (select count(*) from public.universe_call_signals where call_id=mid and sender=auth.uid())>=128 then raise exception 'Too many connection candidates';end if;
 insert into public.universe_call_signals(sender,recipient,call_id,payload) values(auth.uid(),case when c.caller=auth.uid() then c.recipient else c.caller end,mid,jsonb_build_object('candidate',candidate));
end$$;

-- Optional TURN REST relay. The shared signing secret stays in Vault; clients
-- receive only a short-lived credential. STUN alone cannot traverse every network.
create table universe_private.call_config (
 id boolean primary key default true check(id), turn_urls text[] not null, turn_secret uuid not null references vault.secrets(id)
);
alter table universe_private.call_config enable row level security;
revoke all on universe_private.call_config from public,anon,authenticated;
create function public.universe_call_ice() returns jsonb language plpgsql security definer set search_path='' as $$
declare servers jsonb:='[{"urls":["stun:stun.l.google.com:19302","stun:stun1.l.google.com:19302"]}]'; config record; username text;begin
 if not public.universe_is_member() then raise exception 'Access denied';end if;
 select c.turn_urls,s.decrypted_secret into config from universe_private.call_config c join vault.decrypted_secrets s on s.id=c.turn_secret where c.id;
 if found then
  username:=floor(extract(epoch from now()+interval '1 hour'))::bigint::text||':'||auth.uid()::text;
  servers:=servers||jsonb_build_array(jsonb_build_object('urls',config.turn_urls,'username',username,'credential',encode(extensions.hmac(username,config.decrypted_secret,'sha1'),'base64')));
 end if;
 return jsonb_build_object('iceServers',servers,'relayConfigured',jsonb_array_length(servers)>1);
end$$;

create table universe_private.call_push_deliveries (
 call_id uuid not null references public.universe_calls(id) on delete cascade, endpoint_hash text not null,
 kind text not null check(kind in ('invite','end')),state text not null,updated_at timestamptz not null default now(),
 primary key(call_id,endpoint_hash,kind)
);
alter table universe_private.call_push_deliveries enable row level security;
revoke all on universe_private.call_push_deliveries from public,anon,authenticated;
create function public.universe_call_push_claim(mid uuid,ep text,event_kind text) returns boolean
 language plpgsql security definer set search_path='' as $$
declare n integer;begin
 insert into universe_private.call_push_deliveries(call_id,endpoint_hash,kind,state) values(mid,md5(ep),event_kind,'sending')
 on conflict(call_id,endpoint_hash,kind) do update set state='sending',updated_at=now()
 where call_push_deliveries.state='failed' or (call_push_deliveries.state='sending' and call_push_deliveries.updated_at<now()-interval '2 minutes');
 get diagnostics n=row_count;return n=1;
end$$;
create function public.universe_call_push_finish(mid uuid,ep text,event_kind text,ok boolean) returns void
 language sql security definer set search_path='' as $$
 update universe_private.call_push_deliveries set state=case when ok then 'sent' else 'failed' end,updated_at=now()
 where call_id=mid and endpoint_hash=md5(ep) and kind=event_kind
$$;
create function universe_private.notify_call() returns trigger language plpgsql security definer set search_path='' as $$
declare token text;begin
 if tg_op='UPDATE' and (old.state=new.state or new.state='calling') then return new;end if;
 if not exists(select 1 from public.universe_push_subscriptions where user_id=new.recipient) then return new;end if;
 select s.decrypted_secret into token from universe_private.push_config c join vault.decrypted_secrets s on s.id=c.webhook_secret where c.enabled;
 if token is not null then
  perform net.http_post(url:='https://jczsnrzqocstbpsgwkdy.supabase.co/functions/v1/universe-push',headers:=jsonb_build_object('Content-Type','application/json','x-universe-webhook',token),body:=jsonb_build_object('callId',new.id),timeout_milliseconds:=5000);
 end if;
 return new;
 exception when others then raise log 'Universe call push enqueue unavailable';return new;
end$$;
create trigger universe_call_push after insert or update of state on public.universe_calls for each row execute function universe_private.notify_call();

revoke all on function public.universe_call_start(uuid,uuid,jsonb),public.universe_call_update(uuid,uuid,text,jsonb),public.universe_call_signal(uuid,uuid,jsonb),public.universe_call_ice() from public,anon;
grant execute on function public.universe_call_start(uuid,uuid,jsonb),public.universe_call_update(uuid,uuid,text,jsonb),public.universe_call_signal(uuid,uuid,jsonb),public.universe_call_ice() to authenticated;
revoke all on function public.universe_call_push_claim(uuid,text,text),public.universe_call_push_finish(uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.universe_call_push_claim(uuid,text,text),public.universe_call_push_finish(uuid,text,text,boolean) to service_role;
revoke all on function universe_private.notify_call() from public,anon,authenticated;
select cron.schedule('universe-call-expiry','* * * * *',$$update public.universe_calls set state='missed',offer=null,answer=null,ring_until=null,updated_at=now() where state in ('calling','accepted') and expires_at<=now();delete from public.universe_calls where state not in ('calling','accepted') and updated_at<now()-interval '1 day';$$);
notify pgrst,'reload schema';
