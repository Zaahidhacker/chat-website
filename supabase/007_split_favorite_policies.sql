-- Separate read authorization from write validation to avoid recursive expansion
-- when message visibility includes a saved message.
drop policy favorites_own on public.universe_favorites;
create policy favorites_read on public.universe_favorites for select to authenticated using(user_id=(select auth.uid()) and (select public.universe_is_member()));
create policy favorites_insert on public.universe_favorites for insert to authenticated with check(user_id=(select auth.uid()) and (select public.universe_is_member()) and exists(select 1 from public.universe_messages where id=message_id));
create policy favorites_delete on public.universe_favorites for delete to authenticated using(user_id=(select auth.uid()) and (select public.universe_is_member()));
