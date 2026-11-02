-- Additive audio data; no existing conversation rows are changed.
create table public.universe_voice (
 id uuid primary key, owner_id uuid not null references public.universe_members(user_id),
 mime text not null check(mime in ('audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4')),
 audio text not null check(length(audio) between 1 and 260000),
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '48 hours'
);
alter table public.universe_voice enable row level security;
revoke all on public.universe_voice from public,anon,authenticated;
grant select on public.universe_voice to authenticated;
create policy voice_read on public.universe_voice for select to authenticated using(public.universe_is_member() and expires_at>now() and exists(select 1 from public.universe_messages m where m.id=universe_voice.id and not m.deleted));
create function public.universe_send_voice(mid uuid,mime_type text,encoded text,reply uuid default null) returns public.universe_messages language plpgsql security definer set search_path='' as $$
declare result public.universe_messages;begin
 if not public.universe_is_member() then raise exception 'Access denied';end if;
 perform pg_advisory_xact_lock(739111);
 select * into result from public.universe_messages where id=mid;
 if found then
 if result.sender<>auth.uid() or not exists(select 1 from public.universe_voice where id=mid and owner_id=auth.uid()) then raise exception 'Message conflict';end if;
 return result;end if;
 if (select count(*) from public.universe_voice)>=200 then raise exception 'Voice-note space is full. Please wait for older recordings to expire.';end if;
 insert into public.universe_voice(id,owner_id,mime,audio) values(mid,auth.uid(),mime_type,encoded);
 result:=public.universe_send(mid,'🎙 Voice note · expires in 48 hours',reply);return result;
end$$;
revoke all on function public.universe_send_voice(uuid,text,text,uuid) from public,anon;
grant execute on function public.universe_send_voice(uuid,text,text,uuid) to authenticated;
create table public.universe_call_signals (
 id bigint generated always as identity primary key,
 sender uuid not null default auth.uid() references public.universe_members(user_id),
 recipient uuid not null references public.universe_members(user_id),
 call_id uuid not null, payload jsonb not null check(octet_length(payload::text)<20000),
 created_at timestamptz not null default now()
);
alter table public.universe_call_signals enable row level security;
revoke all on public.universe_call_signals from public,anon,authenticated;
grant select,insert on public.universe_call_signals to authenticated;
grant usage on sequence public.universe_call_signals_id_seq to authenticated;
create policy call_read on public.universe_call_signals for select to authenticated using(public.universe_is_member() and (sender=auth.uid() or recipient=auth.uid()) and created_at>now()-interval '2 minutes');
create policy call_send on public.universe_call_signals for insert to authenticated with check(public.universe_is_member() and sender=auth.uid() and recipient<>auth.uid() and created_at between now()-interval '5 seconds' and now()+interval '5 seconds');
alter publication supabase_realtime add table public.universe_call_signals;
create extension if not exists pg_cron;
select cron.schedule('universe-audio-expiry','* * * * *',$$delete from public.universe_voice where expires_at<=now();delete from public.universe_call_signals where created_at<now()-interval '2 minutes';$$);
notify pgrst,'reload schema';
