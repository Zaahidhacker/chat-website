-- Additive only. Existing messages, accounts and preferences are never rewritten.
create extension if not exists pg_net with schema extensions;
create table public.universe_push_subscriptions (
 endpoint text primary key check(length(endpoint) between 20 and 2048),
 user_id uuid not null references public.universe_members(user_id) on delete cascade,
 p256dh text not null,
 auth text not null,
 created_at timestamptz not null default now()
);
create index universe_push_owner on public.universe_push_subscriptions(user_id);
alter table public.universe_push_subscriptions enable row level security;
revoke all on public.universe_push_subscriptions from public,anon,authenticated;
grant select,delete on public.universe_push_subscriptions to authenticated;
grant all on public.universe_push_subscriptions to service_role;
create policy push_own_select on public.universe_push_subscriptions for select to authenticated using(user_id=(select auth.uid()) and (select public.universe_is_member()));
create policy push_own_delete on public.universe_push_subscriptions for delete to authenticated using(user_id=(select auth.uid()));
create table universe_private.push_config (
 id boolean primary key default true check(id),
 public_key text not null,
 private_secret uuid not null references vault.secrets(id),
 webhook_secret uuid not null references vault.secrets(id),
 enabled boolean not null default false
);
alter table universe_private.push_config enable row level security;
revoke all on universe_private.push_config from public,anon,authenticated;
create table universe_private.push_deliveries (
 message_id uuid not null references public.universe_messages(id) on delete cascade,
 endpoint_hash text not null,
 state text not null check(state in ('sending','sent','failed')),
 updated_at timestamptz not null default now(),
 primary key(message_id,endpoint_hash)
);
alter table universe_private.push_deliveries enable row level security;
revoke all on universe_private.push_deliveries from public,anon,authenticated;
create function public.universe_push_key() returns text language sql stable security definer set search_path='' as $$
 select public_key from universe_private.push_config where enabled and (select public.universe_is_member())
$$;
revoke all on function public.universe_push_key() from public,anon;
grant execute on function public.universe_push_key() to authenticated;
create function public.universe_push_register(sub jsonb) returns void language plpgsql security definer set search_path='' as $$
declare ep text:=sub->>'endpoint'; uid uuid:=auth.uid(); begin
 if not public.universe_is_member() then raise exception 'Access denied'; end if;
 -- Only browser push providers; arbitrary hosts and credentials cannot become SSRF targets.
 if ep is null or length(ep)>2048 or ep !~ '^https://(fcm\.googleapis\.com|[a-zA-Z0-9.-]+\.push\.apple\.com|updates\.push\.services\.mozilla\.com|[a-zA-Z0-9.-]+\.notify\.windows\.com)/[^[:space:]]+$'
 or coalesce(sub->'keys'->>'p256dh','') !~ '^[A-Za-z0-9_-]{87}=?$'
 or coalesce(sub->'keys'->>'auth','') !~ '^[A-Za-z0-9_-]{22}={0,2}$'
 then raise exception 'Invalid push subscription'; end if;
 perform pg_advisory_xact_lock(hashtext(uid::text));
 if exists(select 1 from public.universe_push_subscriptions where endpoint=ep and user_id<>uid) then raise exception 'Subscription belongs to another account. Disable notifications, then enable again.'; end if;
 if not exists(select 1 from public.universe_push_subscriptions where endpoint=ep) and (select count(*) from public.universe_push_subscriptions where user_id=uid)>=5 then raise exception 'Five devices are already enabled. Disable an older device first.'; end if;
 insert into public.universe_push_subscriptions(endpoint,user_id,p256dh,auth) values(ep,uid,sub->'keys'->>'p256dh',sub->'keys'->>'auth')
 on conflict(endpoint) do update set p256dh=excluded.p256dh,auth=excluded.auth where universe_push_subscriptions.user_id=uid;
end$$;
revoke all on function public.universe_push_register(jsonb) from public,anon;
grant execute on function public.universe_push_register(jsonb) to authenticated;
-- Service-only helper. Private key material never reaches the browser.
create function public.universe_push_server_config() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('publicKey',c.public_key,'privateKey',p.decrypted_secret,'webhookSecret',w.decrypted_secret,'enabled',c.enabled)
 from universe_private.push_config c join vault.decrypted_secrets p on p.id=c.private_secret join vault.decrypted_secrets w on w.id=c.webhook_secret
$$;
revoke all on function public.universe_push_server_config() from public,anon,authenticated;
grant execute on function public.universe_push_server_config() to service_role;
create function public.universe_push_claim(mid uuid,ep text) returns boolean language plpgsql security definer set search_path='' as $$
declare n integer; begin
 insert into universe_private.push_deliveries(message_id,endpoint_hash,state) values(mid,md5(ep),'sending')
 on conflict(message_id,endpoint_hash) do update set state='sending',updated_at=now()
 where push_deliveries.state='failed' or (push_deliveries.state='sending' and push_deliveries.updated_at<now()-interval '2 minutes');
 get diagnostics n=row_count;return n=1;
end$$;
revoke all on function public.universe_push_claim(uuid,text) from public,anon,authenticated;
grant execute on function public.universe_push_claim(uuid,text) to service_role;
create function public.universe_push_finish(mid uuid,ep text,ok boolean) returns void language sql security definer set search_path='' as $$
 update universe_private.push_deliveries set state=case when ok then 'sent' else 'failed' end,updated_at=now() where message_id=mid and endpoint_hash=md5(ep)
$$;
revoke all on function public.universe_push_finish(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.universe_push_finish(uuid,text,boolean) to service_role;
create function universe_private.notify_new_message() returns trigger language plpgsql security definer set search_path='' as $$
declare token text; begin
 if not exists(select 1 from public.universe_push_subscriptions where user_id<>new.sender) then return new; end if;
 select s.decrypted_secret into token from universe_private.push_config c join vault.decrypted_secrets s on s.id=c.webhook_secret where c.enabled;
 if token is null then return new; end if;
 perform net.http_post(url:='https://jczsnrzqocstbpsgwkdy.supabase.co/functions/v1/universe-push',
 headers:=jsonb_build_object('Content-Type','application/json','x-universe-webhook',token),body:=jsonb_build_object('messageId',new.id),timeout_milliseconds:=5000);
 return new;
 exception when others then
 -- Push is optional; a provider fault must never roll back a person's message.
 raise log 'Universe push enqueue unavailable';return new;
end$$;
revoke all on function universe_private.notify_new_message() from public,anon,authenticated;
create trigger universe_push_insert after insert on public.universe_messages for each row execute function universe_private.notify_new_message();
