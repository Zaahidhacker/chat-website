-- Evaluate stable account identity once per statement instead of once per row.
alter policy members_read on public.universe_members using((select public.universe_is_member()));
alter policy prefs_read on public.universe_preferences using(user_id=(select auth.uid()));
alter policy favorites_own on public.universe_favorites using(user_id=(select auth.uid()) and (select public.universe_is_member())) with check(user_id=(select auth.uid()) and (select public.universe_is_member()) and exists(select 1 from public.universe_messages where id=message_id));
alter policy hidden_own on public.universe_hidden using(user_id=(select auth.uid()) and (select public.universe_is_member())) with check(user_id=(select auth.uid()) and (select public.universe_is_member()));
alter policy reactions_read on public.universe_reactions using((select public.universe_is_member()) and exists(select 1 from public.universe_messages where id=message_id));
alter policy reactions_own on public.universe_reactions with check(user_id=(select auth.uid()) and (select public.universe_is_member()) and exists(select 1 from public.universe_messages where id=message_id and not deleted));
alter policy reactions_delete on public.universe_reactions using(user_id=(select auth.uid()));
alter policy messages_read on public.universe_messages using(
 (select public.universe_is_member())
 and not exists(select 1 from public.universe_hidden h where h.user_id=(select auth.uid()) and h.message_id=universe_messages.id)
 and (seq>coalesce((select cleared_through from public.universe_preferences where user_id=(select auth.uid())),0)
 or exists(select 1 from public.universe_favorites f where f.user_id=(select auth.uid()) and f.message_id=universe_messages.id))
);
