-- Additive private websocket authorization. No message/photo/progress rows change.
create policy universe_presence_receive on realtime.messages for select to authenticated
 using ((select realtime.topic())='universe-presence:two' and extension='presence' and (select public.universe_is_member()));
create policy universe_presence_publish on realtime.messages for insert to authenticated
 with check ((select realtime.topic())='universe-presence:two' and extension='presence' and (select public.universe_is_member()));
create function public.universe_presence_leave() returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.universe_is_member() then raise exception 'Access denied';end if;
 update public.universe_members set last_seen=clock_timestamp(),typing_until=null
 where user_id=auth.uid() and share_presence;
end$$;
revoke all on function public.universe_presence_leave() from public,anon;
grant execute on function public.universe_presence_leave() to authenticated;
notify pgrst,'reload schema';
