-- Acquire the conversation lock before taking any message row lock.
create or replace function public.universe_change(mid uuid, content text default null) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.universe_is_member() then raise exception 'Access denied'; end if;
 if content is not null and (length(trim(content))=0 or length(content)>8000) then raise exception 'Invalid message'; end if;
 perform pg_advisory_xact_lock(739102);
 update public.universe_messages set body=coalesce(content,''),deleted=content is null,edited_at=now() where id=mid and sender=auth.uid() and not deleted;
 if not found then raise exception 'Message cannot be changed'; end if;
end$$;
