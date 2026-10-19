-- Bounded incremental catch-up, including offline edits and tombstones.
-- All mutations share the send/clear lock so a later revision never commits first.
create sequence universe_private.message_revision;
alter table public.universe_messages add column revision bigint;
update public.universe_messages set revision=nextval('universe_private.message_revision');
create function universe_private.stamp_message_revision() returns trigger language plpgsql security definer set search_path='' as $$begin
 perform pg_advisory_xact_lock(739102);
 new.revision=nextval('universe_private.message_revision');
 return new;
end$$;
create trigger universe_revision before insert or update on public.universe_messages for each row execute function universe_private.stamp_message_revision();
alter table public.universe_messages alter column revision set not null;
create unique index universe_message_revision on public.universe_messages(revision);
create index universe_message_sender on public.universe_messages(sender);
create index universe_message_reply on public.universe_messages(reply_to) where reply_to is not null;
create index universe_reaction_message on public.universe_reactions(message_id);
create index universe_favorite_message on public.universe_favorites(message_id);
create index universe_hidden_message on public.universe_hidden(message_id);
create function public.universe_sync_state() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'members',(select coalesce(jsonb_agg(to_jsonb(m)),'[]') from public.universe_members m),
 'preferences',(select to_jsonb(p) from public.universe_preferences p where user_id=auth.uid()),
 'favorites',(select coalesce(jsonb_agg(message_id),'[]') from public.universe_favorites where user_id=auth.uid()),
 'hidden',(select coalesce(jsonb_agg(message_id),'[]') from public.universe_hidden where user_id=auth.uid()),
 'revision',(select coalesce(max(revision),0) from public.universe_messages))
 where (select public.universe_is_member())
$$;
revoke all on function public.universe_sync_state() from public,anon;
grant execute on function public.universe_sync_state() to authenticated;
create or replace function public.universe_receipt(delivered bigint, seen bigint) returns void language plpgsql security definer set search_path='' as $$declare latest bigint; begin
 if not public.universe_is_member() then raise exception 'Access denied'; end if;
 select coalesce(max(seq),0) into latest from public.universe_messages;
 update public.universe_members set
 last_delivered=greatest(last_delivered,least(delivered,latest)),
 last_read=greatest(last_read,least(seen,delivered,latest)),
 last_seen=case when share_presence then now() else null end
 where user_id=auth.uid() and (
 last_delivered<least(delivered,latest) or last_read<least(seen,delivered,latest)
 or (share_presence and (last_seen is null or last_seen<now()-interval '25 seconds')));
end$$;
create or replace function public.universe_profile(display_name text, presence boolean, selected_theme text) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.universe_is_member() or display_name is null or presence is null or selected_theme is null or length(trim(display_name)) not between 1 and 40 or selected_theme not in ('dark','light') then raise exception 'Invalid settings'; end if;
 update public.universe_members set name=trim(display_name),share_presence=presence,last_seen=case when presence then now() else null end,typing_until=null
 where user_id=auth.uid() and (name<>trim(display_name) or share_presence<>presence);
 update public.universe_preferences set theme=selected_theme where user_id=auth.uid() and theme<>selected_theme;
end$$;
create or replace function public.universe_typing() returns void language sql security definer set search_path='' as $$
 update public.universe_members set typing_until=now()+interval '4 seconds'
 where user_id=auth.uid() and share_presence and (typing_until is null or typing_until<now()+interval '1 second')
$$;
-- Explicit minimal grants in addition to row policies.
revoke all on public.universe_members,public.universe_preferences,public.universe_messages,public.universe_favorites,public.universe_hidden,public.universe_reactions from anon,authenticated;
grant select on public.universe_members,public.universe_preferences,public.universe_messages to authenticated;
grant select,insert,delete on public.universe_favorites to authenticated;
grant select,insert on public.universe_hidden to authenticated;
grant select,insert,update,delete on public.universe_reactions to authenticated;
drop policy reactions_update on public.universe_reactions;
create policy reactions_update on public.universe_reactions for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and (select public.universe_is_member()) and exists(select 1 from public.universe_messages where id=message_id and not deleted));
alter table universe_private.invites enable row level security;
alter publication supabase_realtime add table public.universe_favorites,public.universe_hidden;
