-- New location fixtures only; no existing personal tables are written.
begin;
do $$begin if exists(select 1 from public.universe_locations) then raise exception 'Real location rows exist: do not run fixture suite';end if;end$$;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select user_id from public.universe_members where slot=1),'role','authenticated')::text,true);
set local role authenticated;
do $$declare r public.universe_locations;denied boolean:=false;begin
 begin perform public.universe_location_act('position','{"session":"99000000-0000-0000-0000-000000000001","latitude":1,"longitude":2,"accuracy":5}');exception when others then denied:=true;end;if not denied then raise exception 'Position without consent accepted';end if;
 r:=public.universe_location_act('start','{"session":"99000000-0000-0000-0000-000000000001","minutes":15}');if r.latitude is not null or r.mode<>'active' then raise exception 'Start exposed old coordinates';end if;
 denied:=false;begin perform public.universe_location_act('position',jsonb_build_object('session',r.session_id,'latitude',91,'longitude',2,'accuracy',10,'sampled_at',now()));exception when others then denied:=true;end;if not denied then raise exception 'Invalid latitude accepted';end if;
 denied:=false;begin perform public.universe_location_act('position',jsonb_build_object('session',r.session_id,'latitude',1,'longitude',2,'accuracy',10,'sampled_at',now()-interval '1 hour'));exception when others then denied:=true;end;if not denied then raise exception 'Old fix accepted';end if;
 r:=public.universe_location_act('position',jsonb_build_object('session',r.session_id,'latitude',1,'longitude',2,'accuracy',10,'sampled_at',now()));if r.latitude<>1 then raise exception 'Position not saved';end if;
 r:=public.universe_location_act('position',jsonb_build_object('session',r.session_id,'latitude',3,'longitude',4,'accuracy',10,'sampled_at',now()+interval '1 second'));if r.latitude<>1 then raise exception 'Rate limit bypassed';end if;
 denied:=false;begin update public.universe_locations set latitude=10;exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Direct coordinate writes allowed';end if;
end$$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select user_id from public.universe_members where slot=2),'role','authenticated')::text,true);
set local role authenticated;
do $$begin if (select count(*) from public.universe_locations where latitude=1)<>1 then raise exception 'Partner cannot see shared point';end if;end$$;
-- An account's stop never changes the partner's row.
select public.universe_location_act('stop','{}');
do $$begin if (select count(*) from public.universe_locations where latitude=1)<>1 then raise exception 'Partner point changed by other account';end if;end$$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select user_id from public.universe_members where slot=1),'role','authenticated')::text,true);
set local role authenticated;
do $$declare r public.universe_locations;denied boolean:=false;begin
 r:=public.universe_location_act('pause','{"session":"99000000-0000-0000-0000-000000000001"}');if r.mode<>'paused' or r.latitude<>1 then raise exception 'Pause did not preserve last point';end if;
 denied:=false;begin perform public.universe_location_act('position',jsonb_build_object('session',r.session_id,'latitude',3,'longitude',4,'accuracy',10,'sampled_at',now()));exception when others then denied:=true;end;if not denied then raise exception 'Paused GPS published';end if;
 r:=public.universe_location_act('stop','{}');if r.latitude is not null or r.sampled_at is not null or r.mode<>'stopped' then raise exception 'Stop left shared coordinates';end if;
 denied:=false;begin perform public.universe_location_act('resume','{"session":"99000000-0000-0000-0000-000000000001"}');exception when others then denied:=true;end;if not denied then raise exception 'Stopped session resumed';end if;
 perform public.universe_location_act('start','{"session":"99000000-0000-0000-0000-000000000002","minutes":60}');
 denied:=false;begin perform public.universe_location_act('position',jsonb_build_object('session','99000000-0000-0000-0000-000000000001','latitude',3,'longitude',4,'accuracy',10,'sampled_at',now()));exception when others then denied:=true;end;if not denied then raise exception 'Old-device GPS accepted';end if;
end$$;
reset role;
-- Expired data is unreadable by the other member through direct table access.
update public.universe_locations set latitude=1,longitude=2,accuracy=5,sampled_at=now(),expires_at=now()-interval '1 second';
select set_config('request.jwt.claims',jsonb_build_object('sub',(select user_id from public.universe_members where slot=2),'role','authenticated')::text,true);
set local role authenticated;
do $$begin if exists(select 1 from public.universe_locations where latitude=1) then raise exception 'Expired partner coordinates leaked';end if;end$$;
reset role;
select set_config('request.jwt.claims','{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}',true);
set local role authenticated;
do $$declare denied boolean:=false;begin
 if exists(select 1 from public.universe_locations) then raise exception 'Outsider location leaked';end if;
 begin perform public.universe_location_act('start','{"session":"99000000-0000-0000-0000-000000000003","minutes":15}');exception when others then denied:=true;end;if not denied then raise exception 'Outsider tracking allowed';end if;
 if has_function_privilege('anon','public.universe_location_act(text,jsonb)','execute') or has_table_privilege('anon','public.universe_locations','select') then raise exception 'Anonymous location access';end if;
end$$;
reset role;
rollback;
select true as location_consent_privacy_stop_throttle_expiry_tests_passed;
