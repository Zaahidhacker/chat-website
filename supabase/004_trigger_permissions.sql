-- This existing platform helper is an event trigger, not an application RPC.
-- Trigger execution does not depend on these public EXECUTE grants.
revoke execute on function public.rls_auto_enable() from public,anon,authenticated;
