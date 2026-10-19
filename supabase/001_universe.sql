-- A single private conversation with exactly two administrator-approved members.
create schema if not exists universe_private;
revoke all on schema universe_private from public, anon, authenticated;
create table public.universe_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 name text not null check (length(name) between 1 and 40),
 slot smallint not null unique check (slot in (1,2)),
 last_seen timestamptz,
 typing_until timestamptz,
 share_presence boolean not null default true,
 last_delivered bigint not null default 0,
 last_read bigint not null default 0
);
create table public.universe_preferences (
 user_id uuid primary key references public.universe_members(user_id) on delete cascade,
 cleared_through bigint not null default 0,
 theme text not null default 'dark' check(theme in ('dark','light'))
);
create table public.universe_messages (
 id uuid primary key,
 seq bigint generated always as identity unique,
 sender uuid not null references public.universe_members(user_id),
 body text not null check(length(body) <= 8000),
 created_at timestamptz not null default now(),
 edited_at timestamptz,
 deleted boolean not null default false,
 reply_to uuid references public.universe_messages(id)
);
create index universe_messages_seq on public.universe_messages(seq desc);
create table public.universe_favorites (
 user_id uuid not null references public.universe_members(user_id) on delete cascade,
 message_id uuid not null references public.universe_messages(id) on delete cascade,
 primary key(user_id,message_id)
);
create table public.universe_hidden (
 user_id uuid not null references public.universe_members(user_id) on delete cascade,
 message_id uuid not null references public.universe_messages(id) on delete cascade,
 primary key(user_id,message_id)
);
create table public.universe_reactions (
 user_id uuid not null references public.universe_members(user_id) on delete cascade,
 message_id uuid not null references public.universe_messages(id) on delete cascade,
 emoji text not null check(emoji in ('❤️','🥹','✨','😂','💋')),
 primary key(user_id,message_id)
);
create table universe_private.invites (
 email text primary key, token_hash text not null unique, slot smallint unique check(slot in(1,2)), name text not null,
 used boolean not null default false
);
create function public.universe_is_member() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.universe_members where user_id=auth.uid())$$;
create function public.universe_can_view(mid uuid, n bigint) returns boolean language sql stable security definer set search_path='' as $$
 select public.universe_is_member() and not exists(select 1 from public.universe_hidden where user_id=auth.uid() and message_id=mid)
 and (n > coalesce((select cleared_through from public.universe_preferences where user_id=auth.uid()),0)
 or exists(select 1 from public.universe_favorites where user_id=auth.uid() and message_id=mid))
$$;
alter table public.universe_members enable row level security;
alter table public.universe_preferences enable row level security;
alter table public.universe_messages enable row level security;
alter table public.universe_favorites enable row level security;
alter table public.universe_hidden enable row level security;
alter table public.universe_reactions enable row level security;
create policy members_read on public.universe_members for select to authenticated using(public.universe_is_member());
create policy prefs_read on public.universe_preferences for select to authenticated using(user_id=auth.uid());
create policy messages_read on public.universe_messages for select to authenticated using(public.universe_can_view(id,seq));
create policy favorites_own on public.universe_favorites for all to authenticated using(user_id=auth.uid() and public.universe_is_member()) with check(user_id=auth.uid() and public.universe_is_member() and exists(select 1 from public.universe_messages where id=message_id));
create policy hidden_own on public.universe_hidden for all to authenticated using(user_id=auth.uid() and public.universe_is_member()) with check(user_id=auth.uid() and public.universe_is_member());
create policy reactions_read on public.universe_reactions for select to authenticated using(public.universe_is_member() and exists(select 1 from public.universe_messages where id=message_id));
create policy reactions_own on public.universe_reactions for insert to authenticated with check(user_id=auth.uid() and public.universe_is_member() and exists(select 1 from public.universe_messages where id=message_id and not deleted));
create policy reactions_update on public.universe_reactions for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid() and public.universe_is_member());
create policy reactions_delete on public.universe_reactions for delete to authenticated using(user_id=auth.uid());
create function public.universe_send(mid uuid, content text, reply uuid default null) returns public.universe_messages language plpgsql security definer set search_path='' as $$
declare result public.universe_messages;
begin
 if not public.universe_is_member() then raise exception 'Access denied'; end if;
 if length(trim(content))=0 or length(content)>8000 then raise exception 'Message must contain 1–8000 characters'; end if;
 perform pg_advisory_xact_lock(739102);
 select * into result from public.universe_messages where id=mid;
 if found then
  if result.sender <> auth.uid() then raise exception 'Access denied'; end if;
  return result;
 end if;
 if reply is not null and not exists(select 1 from public.universe_messages where id=reply and public.universe_can_view(id,seq)) then raise exception 'Reply unavailable'; end if;
 insert into public.universe_messages(id,sender,body,reply_to) values(mid,auth.uid(),content,reply) returning * into result;
 return result;
end$$;
create function public.universe_clear() returns bigint language plpgsql security definer set search_path='' as $$
declare cutoff bigint;
begin
 if not public.universe_is_member() then raise exception 'Access denied'; end if;
 perform pg_advisory_xact_lock(739102);
 select coalesce(max(seq),0) into cutoff from public.universe_messages;
 update public.universe_preferences set cleared_through=cutoff where user_id=auth.uid();
 return cutoff;
end$$;
create function public.universe_profile(display_name text, presence boolean, selected_theme text) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.universe_is_member() or length(trim(display_name)) not between 1 and 40 or selected_theme not in ('dark','light') then raise exception 'Invalid settings'; end if;
 update public.universe_members set name=trim(display_name),share_presence=presence,last_seen=case when presence then now() else null end where user_id=auth.uid();
 update public.universe_preferences set theme=selected_theme where user_id=auth.uid();
end$$;
create function public.universe_receipt(delivered bigint, seen bigint) returns void language plpgsql security definer set search_path='' as $$declare latest bigint; begin
 if not public.universe_is_member() then raise exception 'Access denied'; end if;
 select coalesce(max(seq),0) into latest from public.universe_messages;
 update public.universe_members set last_delivered=greatest(last_delivered,least(delivered,latest)),last_read=greatest(last_read,least(seen,latest)),last_seen=case when share_presence then now() else null end where user_id=auth.uid();
end$$;
create function public.universe_change(mid uuid, content text default null) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.universe_is_member() then raise exception 'Access denied'; end if;
 if content is not null and (length(trim(content))=0 or length(content)>8000) then raise exception 'Invalid message'; end if;
 update public.universe_messages set body=coalesce(content,''),deleted=content is null,edited_at=now() where id=mid and sender=auth.uid() and not deleted;
 if not found then raise exception 'Message cannot be changed'; end if;
end$$;
-- Admission requires an administrator-issued, high-entropy single-use invitation.
create function public.universe_redeem(invite_token text) returns void language plpgsql security definer set search_path='' as $$
declare invitation universe_private.invites;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 perform pg_advisory_xact_lock(739103);
 select * into invitation from universe_private.invites where token_hash=encode(extensions.digest(invite_token,'sha256'),'hex') and lower(email)=lower(auth.jwt()->>'email') and not used for update;
 if not found then raise exception 'Invitation is invalid or already used'; end if;
 insert into public.universe_members(user_id,name,slot) values(auth.uid(),invitation.name,invitation.slot);
 insert into public.universe_preferences(user_id) values(auth.uid());
 update universe_private.invites set used=true where email=invitation.email;
end$$;
-- Allow only the approved addresses to register with Supabase Auth.
create function universe_private.guard_signup() returns trigger language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from universe_private.invites where lower(email)=lower(new.email) and not used) then raise exception 'This space is invitation only'; end if;
 return new;
end$$;
create trigger universe_guard_signup before insert on auth.users for each row execute function universe_private.guard_signup();
revoke all on function public.universe_is_member(),public.universe_can_view(uuid,bigint),public.universe_send(uuid,text,uuid),public.universe_clear(),public.universe_profile(text,boolean,text),public.universe_receipt(bigint,bigint),public.universe_change(uuid,text),public.universe_redeem(text) from public,anon;
grant execute on function public.universe_is_member(),public.universe_can_view(uuid,bigint),public.universe_send(uuid,text,uuid),public.universe_clear(),public.universe_profile(text,boolean,text),public.universe_receipt(bigint,bigint),public.universe_change(uuid,text),public.universe_redeem(text) to authenticated;
grant select on public.universe_members,public.universe_preferences,public.universe_messages to authenticated;
grant select,insert,update,delete on public.universe_favorites,public.universe_hidden,public.universe_reactions to authenticated;
alter publication supabase_realtime add table public.universe_messages,public.universe_members,public.universe_reactions;

create function public.universe_typing() returns void language sql security definer set search_path='' as $$update public.universe_members set typing_until=now()+interval '3 seconds' where user_id=auth.uid() and share_presence$$;
revoke all on function public.universe_typing() from public,anon;
grant execute on function public.universe_typing() to authenticated;
create function public.universe_invitation_details(invite_token text, address text) returns table(email text) language sql security definer set search_path='' as $$select email from universe_private.invites where lower(email)=lower(address) and token_hash=encode(extensions.digest(invite_token,'sha256'),'hex') and not used$$;
revoke all on function public.universe_invitation_details(text,text) from public,anon,authenticated;
grant execute on function public.universe_invitation_details(text,text) to service_role;
