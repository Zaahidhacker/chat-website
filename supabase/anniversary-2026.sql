-- Additive anniversary installation. Existing Project 28 content and release are untouched.
create table public.anniversary_2026_content(id boolean primary key default true check(id),letter text not null check(length(letter)<20000));
alter table public.anniversary_2026_content enable row level security;
create policy anniversary_content_read on public.anniversary_2026_content for select to authenticated using(exists(select 1 from public.universe_members where user_id=(select auth.uid()) and (slot=1 or (slot=2 and now()>='2026-10-27 00:00:00 Asia/Colombo'::timestamptz))));
grant select on public.anniversary_2026_content to authenticated;
create table public.anniversary_2026_progress(user_id uuid primary key references auth.users(id),scene smallint not null default 0 check(scene between 0 and 22),completed boolean not null default false,updated_at timestamptz not null default now());
alter table public.anniversary_2026_progress enable row level security;
create policy anniversary_progress_read on public.anniversary_2026_progress for select to authenticated using(user_id=(select auth.uid()) or exists(select 1 from public.universe_members where user_id=(select auth.uid()) and slot=1));
create policy anniversary_progress_insert on public.anniversary_2026_progress for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.universe_members where user_id=(select auth.uid()) and slot=2) and now()>='2026-10-27 00:00:00 Asia/Colombo'::timestamptz);
create policy anniversary_progress_update on public.anniversary_2026_progress for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and exists(select 1 from public.universe_members where user_id=(select auth.uid()) and slot=2) and now()>='2026-10-27 00:00:00 Asia/Colombo'::timestamptz);
grant select,insert,update on public.anniversary_2026_progress to authenticated;
create function public.anniversary_2026_status() returns jsonb language plpgsql security invoker set search_path='' as $$
declare member_slot integer;begin
select slot into member_slot from public.universe_members where user_id=auth.uid();
if member_slot is null or member_slot not in (1,2) then raise exception 'Not available' using errcode='42501';end if;
return jsonb_build_object('server_now',clock_timestamp(),'release_at','2026-10-27 00:00:00 Asia/Colombo'::timestamptz,'slot',member_slot,'available',now()>='2026-10-27 00:00:00 Asia/Colombo'::timestamptz,'letter',(select letter from public.anniversary_2026_content where id),'progress',coalesce((select to_jsonb(p) from public.anniversary_2026_progress p where user_id=auth.uid()),'{}'::jsonb));end $$;
revoke all on function public.anniversary_2026_status() from public,anon;grant execute on function public.anniversary_2026_status() to authenticated;
insert into public.anniversary_2026_content(id,letter) values(true,'Hellllloooo myy lovee, I know I''ve never called you this before, but this is what my heart decided to call you at 12 in the night while I''m typing this message for our one-month annnnivvverssaryy ❤️.

Ik it''s just 1 month, and it might not seem like a big deal, but it really is a big deal for me. I am soo glad and happy that we''ve made it this far. I can still remember the time when Haroon came up to me and bro was like, "Zaahid, she likes you. Do you like her back?" And I was very hesitant cuz I always wanted a girl who would be by my side no matter what, a girl who would support me in whatever I do, and most importantly, a girl who would bring me closer to Allah. And I am sooo glad that I said yes.

Yk why? As I said before, you''re like that one needle I''ve been searching for in a pile of hay. That''s how special you are to me, mama 🤭❤️.

This is just one month, and I hope that one day, Insha''Allah, I''ll be telling our story to ur mami and ofc to my mami too. I luuvvvvv uuuuuuuu more than words could ever say, ma.

And plssss, from now on, don''t ever say that you''re the worst person or that you''re worthless. Plsss don''t. Because you''re not. You are sooo special to me and to everyone else as well. I never see you walking alone, you always have someone beside you, and that itself shows how much you mean to the people around you. And I hope you know that you''ll always have me by your side too ❤️.

And I am sorry for all the dumb shi- I''ve done, especially the things I did even when u asked me not to, and for the times when you were at your lowest and I wasn''t being the person you needed me to be. I am reallyyy reallllyy sorryyy, ma. I promise I''ll tryyy my absolute best to not piss you off anymore, my darling.

I luvvv uuuu a lottttt, more than you could ever imagine. And I reallyyy hope this is just the first of many, many months and years together, Insha''Allah. ❤️

Happyyyy one-month annnnivvverssaryyy, my princesssss!!! ❤️🤭

Mwwwaahhhhhhh ❤️');
notify pgrst,'reload schema';
create function public.anniversary_2026_save(p_scene smallint,p_completed boolean default false) returns jsonb language sql security invoker set search_path='' as $$
 insert into public.anniversary_2026_progress as saved(user_id,scene,completed,updated_at) values(auth.uid(),p_scene,p_completed,clock_timestamp())
 on conflict(user_id) do update set scene=case when saved.completed then saved.scene else excluded.scene end,completed=saved.completed or excluded.completed,updated_at=clock_timestamp()
 returning to_jsonb(saved);
$$;
revoke all on function public.anniversary_2026_save(smallint,boolean) from public,anon;grant execute on function public.anniversary_2026_save(smallint,boolean) to authenticated;
notify pgrst,'reload schema';
-- Extend only the new anniversary record; no existing website data is changed.
alter table public.anniversary_2026_progress
 add column started boolean not null default false,
 add column last_scene smallint not null default -1 check(last_scene between -1 and 22),
 add column last_dialogue smallint not null default -1 check(last_dialogue between -1 and 21),
 add column letter_progress real not null default 0 check(letter_progress between 0 and 1),
 add column completed_at timestamptz;
create function public.anniversary_2026_checkpoint(p_scene smallint,p_last_scene smallint default -1,p_dialogue smallint default -1,p_letter real default null,p_done boolean default false,p_restart boolean default false) returns jsonb language sql security invoker set search_path='' as $$
 insert into public.anniversary_2026_progress as saved(user_id,scene,started,last_scene,last_dialogue,letter_progress,completed,completed_at,updated_at)
 values(auth.uid(),p_scene,true,p_last_scene,p_dialogue,coalesce(p_letter,0),p_done and p_scene=22 and p_dialogue=21,case when p_done and p_scene=22 and p_dialogue=21 then clock_timestamp() end,clock_timestamp())
 on conflict(user_id) do update set
 scene=case when saved.completed then saved.scene else excluded.scene end,
 started=true,
 last_scene=case when saved.completed then saved.last_scene when p_restart then -1 else greatest(saved.last_scene,excluded.last_scene) end,
 last_dialogue=case when saved.completed then saved.last_dialogue when p_restart then -1 else greatest(saved.last_dialogue,excluded.last_dialogue) end,
 letter_progress=case when saved.completed then saved.letter_progress when p_restart then 0 else coalesce(p_letter,saved.letter_progress) end,
 completed=saved.completed or excluded.completed,
 completed_at=coalesce(saved.completed_at,excluded.completed_at),
 updated_at=clock_timestamp()
 returning to_jsonb(saved);
$$;
revoke all on function public.anniversary_2026_checkpoint(smallint,smallint,smallint,real,boolean,boolean) from public,anon;
grant execute on function public.anniversary_2026_checkpoint(smallint,smallint,smallint,real,boolean,boolean) to authenticated;
-- Preserve the old RPC signature without allowing it to bypass the final dialogue checkpoint.
create or replace function public.anniversary_2026_save(p_scene smallint,p_completed boolean default false) returns jsonb language sql security invoker set search_path='' as $$
 select public.anniversary_2026_checkpoint(p_scene);
$$;
notify pgrst,'reload schema';
