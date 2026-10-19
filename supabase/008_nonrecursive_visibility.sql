-- Keep the cross-table saved/hidden lookup behind the existing, account-checked
-- helper. A direct message-policy -> favorites-policy -> message reference can
-- recurse while Postgres expands INSERT checks, even with split policies.
alter policy messages_read on public.universe_messages using((select public.universe_is_member()) and public.universe_can_view(id,seq));
