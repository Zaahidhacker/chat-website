create or replace function universe_private.guard_signup() returns trigger language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from universe_private.invites where lower(email)=lower(new.email) and token_hash=encode(extensions.digest(coalesce(new.raw_user_meta_data->>'universe_invite',''),'sha256'),'hex') and not used) then raise exception 'This space is invitation only'; end if;
 return new;
end$$;
create function universe_private.finish_signup() returns trigger language plpgsql security definer set search_path='' as $$declare invitation universe_private.invites; begin
 perform pg_advisory_xact_lock(739103);
 select * into invitation from universe_private.invites where lower(email)=lower(new.email) and not used for update;
 if not found then raise exception 'This space is invitation only'; end if;
 insert into public.universe_members(user_id,name,slot) values(new.id,invitation.name,invitation.slot);
 insert into public.universe_preferences(user_id) values(new.id);
 update universe_private.invites set used=true where email=invitation.email;
 return new;
end$$;
create trigger universe_finish_signup after insert on auth.users for each row execute function universe_private.finish_signup();
drop function public.universe_invitation_details(text,text);
drop function public.universe_redeem(text);
