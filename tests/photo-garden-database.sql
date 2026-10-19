-- Test-only metadata/claim fixtures. All table changes roll back; never resets
-- accounts or rewrites existing message records. Storage bytes are not uploaded.
begin;
do $$begin if exists(select 1 from public.universe_photos where id='90000000-0000-0000-0000-000000000001') or exists(select 1 from public.universe_messages where id='90000000-0000-0000-0000-000000000001') then raise exception 'Fixture id already used';end if;end$$;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select user_id from public.universe_members where slot=1),'role','authenticated')::text,true);
set local role authenticated;
select public.universe_photo_reserve('90000000-0000-0000-0000-000000000001',1024,128,1200,800);
do $$declare denied boolean:=false;begin
 begin perform public.universe_photo_reserve('90000000-0000-0000-0000-000000000002',524289,128,1200,800);exception when others then denied:=true;end;
 if not denied then raise exception 'Oversized photo accepted';end if;
 if public.universe_photo_upload_allowed('forged/path.jpg') then raise exception 'Unreserved upload allowed';end if;
end$$;
insert into storage.objects(bucket_id,name,metadata) select 'universe-photos',path,'{"size":1024,"mimetype":"image/jpeg"}' from public.universe_photos where id='90000000-0000-0000-0000-000000000001';
insert into storage.objects(bucket_id,name,metadata) select 'universe-thumbs',path,'{"size":128,"mimetype":"image/jpeg"}' from public.universe_photos where id='90000000-0000-0000-0000-000000000001';
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select user_id from public.universe_members where slot=2),'role','authenticated')::text,true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.universe_photos where id='90000000-0000-0000-0000-000000000001') then raise exception 'Unsent photo metadata leaked';end if;
 if exists(select 1 from storage.objects where name like '%90000000-0000-0000-0000-000000000001%') then raise exception 'Unsent photo leaked';end if;
end$$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select user_id from public.universe_members where slot=1),'role','authenticated')::text,true);
set local role authenticated;
select (public.universe_send_photo('90000000-0000-0000-0000-000000000001','Rollback-only photo',null)).id;
select (public.universe_send_photo('90000000-0000-0000-0000-000000000001','Rollback-only photo',null)).id;
do $$begin
 if (select count(*) from public.universe_messages where id='90000000-0000-0000-0000-000000000001')<>1 then raise exception 'Photo retry duplicated message';end if;
 if public.universe_photo_upload_allowed((select path from public.universe_photos where id='90000000-0000-0000-0000-000000000001')) then raise exception 'Published photo can be overwritten';end if;
end$$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select user_id from public.universe_members where slot=2),'role','authenticated')::text,true);
set local role authenticated;
do $$begin if (select count(*) from storage.objects where name like '%90000000-0000-0000-0000-000000000001%')<>2 then raise exception 'Recipient cannot read published photo';end if;end$$;
insert into public.universe_hidden(user_id,message_id) values(auth.uid(),'90000000-0000-0000-0000-000000000001');
do $$begin if exists(select 1 from storage.objects where name like '%90000000-0000-0000-0000-000000000001%') then raise exception 'Hidden photo still readable';end if;end$$;
reset role;
select set_config('request.jwt.claims','{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}',true);
set local role authenticated;
do $$declare denied boolean:=false;begin
 if exists(select 1 from public.universe_photos) then raise exception 'Nonmember metadata leak';end if;
 if exists(select 1 from storage.objects where bucket_id in ('universe-photos','universe-thumbs')) then raise exception 'Nonmember photo leak';end if;
 begin perform public.universe_photo_reserve('90000000-0000-0000-0000-000000000002',100,100,10,10);exception when others then denied:=true;end;
 if not denied then raise exception 'Nonmember upload authorized';end if;
 if has_function_privilege('anon','public.universe_send_photo(uuid,text,uuid)','execute') then raise exception 'Anonymous photo publication enabled';end if;
 if has_function_privilege('anon','public.universe_garden_act(text,text)','execute') then raise exception 'Anonymous game writes enabled';end if;
 denied:=false;begin perform public.universe_garden_state();exception when others then denied:=true;end;if not denied then raise exception 'Nonmember garden read allowed';end if;
end$$;
reset role;
-- Game writes are only exercised before any real garden activity exists.
do $$begin if exists(select 1 from universe_private.garden_events) or exists(select 1 from universe_private.garden_answers) then raise exception 'Refusing game fixtures: real garden already in use';end if;end$$;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select user_id from public.universe_members where slot=1),'role','authenticated')::text,true);
set local role authenticated;
select public.universe_garden_act('water');select public.universe_garden_act('water');
select public.universe_garden_act('question','A rollback-only little note');
do $$begin if (public.universe_garden_state()->>'xp')::integer<>8 then raise exception 'Reward duplicated';end if;end$$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select user_id from public.universe_members where slot=2),'role','authenticated')::text,true);
set local role authenticated;
do $$begin if jsonb_array_length(public.universe_garden_state()->'answers')<>0 then raise exception 'Sealed answer leaked';end if;end$$;
select public.universe_garden_act('question','The other rollback-only note');
do $$begin if jsonb_array_length(public.universe_garden_state()->'answers')<>2 then raise exception 'Mutual answers unavailable';end if;end$$;
reset role;
-- Independent storage cap checks: all additional reservations remain in this tx.
insert into public.universe_photos(id,owner_id,path,bytes,thumb_bytes,width,height)
select md5('rollback-photo-cap-'||g)::uuid,(select user_id from public.universe_members where slot=1),'rollback-photo-cap-'||g||'.jpg',1,1,1,1 from generate_series(1,1000-(select count(*)::integer from public.universe_photos)) g;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select user_id from public.universe_members where slot=1),'role','authenticated')::text,true);
set local role authenticated;
do $$declare denied boolean:=false;begin begin perform public.universe_photo_reserve('90000000-0000-0000-0000-000000000003',100,100,10,10);exception when others then denied:=true;end;if not denied then raise exception 'Free storage cap bypassed';end if;end$$;
reset role;
rollback;
