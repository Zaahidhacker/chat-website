-- Run only before real island activity. Fixtures live in the new schema and
-- rollback; original messages/photos/accounts/garden rows are never written.
begin;
do $$begin if exists(select 1 from island_private.completions) or exists(select 1 from island_private.surprises) or exists(select 1 from island_private.inventory) then raise exception 'Real island already in use: do not run fixture suite';end if;end$$;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select user_id from public.universe_members where slot=1),'role','authenticated')::text,true);
set local role authenticated;
do $$declare denied boolean:=false;begin
 begin perform * from island_private.surprises;exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Direct private table access';end if;
 denied:=false;begin perform public.universe_island_act('complete','{"id":"lantern-storm","proof":{"score":100,"seconds":45}}');exception when others then denied:=true;end;if not denied then raise exception 'Locked chapter accepted';end if;
 denied:=false;begin perform public.universe_island_act('complete','{"id":"first-fall","proof":{"score":1,"seconds":45}}');exception when others then denied:=true;end;if not denied then raise exception 'Failed round rewarded';end if;
 perform public.universe_island_act('complete','{"id":"first-fall","proof":{"score":30,"seconds":45}}');
 perform public.universe_island_act('complete','{"id":"first-fall","proof":{"score":30,"seconds":45}}');
 if (public.universe_island_state()->>'balance')::integer<>8 then raise exception 'Retry reward duplicated';end if;
 perform public.universe_island_act('complete','{"id":"keepers-desk","proof":{"matched":[0,1,2,3,4,5,6,7]}}');
 perform public.universe_island_act('complete','{"id":"forest-door","proof":{"answer":[0,1,3]}}');
 perform public.universe_island_act('complete','{"id":"little-kite","proof":{"edges":["0-1","1-2","2-3","0-3","3-4"]}}');
 if (public.universe_island_state()->>'balance')::integer<>32 then raise exception 'Four game rewards failed';end if;
 perform public.universe_island_act('buy','{"item":"fern"}');perform public.universe_island_act('buy','{"item":"fern"}');
 if (public.universe_island_state()->>'balance')::integer<>24 then raise exception 'Duplicate purchase charged';end if;
 perform public.universe_island_act('place','{"item":"fern","slot":"left","revision":0}');perform public.universe_island_act('place','{"item":"fern","slot":"left","revision":0}');
 denied:=false;begin perform public.universe_island_act('place','{"item":"fern","slot":"right","revision":0}');exception when others then denied:=true;end;if not denied then raise exception 'Furniture allowed in wrong slot';end if;
 perform public.universe_island_act('send','{"id":"98000000-0000-0000-0000-000000000001","note":"Rollback-only sealed note","location":"cottage"}');
 perform public.universe_island_act('send','{"id":"98000000-0000-0000-0000-000000000001","note":"Rollback-only sealed note","location":"cottage"}');
end$$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select user_id from public.universe_members where slot=2),'role','authenticated')::text,true);
set local role authenticated;
do $$declare denied boolean:=false;s jsonb;begin
 s:=public.universe_island_state();if s->'surprises'->0->>'note' is not null then raise exception 'Sealed note leaked';end if;
 if jsonb_array_length(s->'surprises')<>1 then raise exception 'Note retry duplicated';end if;
 begin perform public.universe_island_act('open','{"id":"98000000-0000-0000-0000-000000000001"}');exception when others then denied:=true;end;if not denied then raise exception 'Unearned surprise revealed';end if;
 denied:=false;begin perform public.universe_island_act('place','{"item":"fern","slot":"left","revision":0}');exception when others then denied:=true;end;if not denied then raise exception 'Stale edit overwrote partner';end if;
 perform public.universe_island_act('buy','{"item":"mugs"}');perform public.universe_island_act('place','{"item":"mugs","slot":"sill","revision":0}');
 if jsonb_array_length(public.universe_island_state()->'slots')<>2 then raise exception 'Different slot edits lost';end if;
 perform public.universe_island_act('complete','{"id":"keepers-desk","proof":{"matched":[0,1,2,3,4,5,6,7]}}');
 s:=public.universe_island_act('open','{"id":"98000000-0000-0000-0000-000000000001"}');if s->'surprises'->0->>'note'<>'Rollback-only sealed note' then raise exception 'Earned note not revealed';end if;
 denied:=false;begin perform public.universe_island_act('complete','{"id":"not-a-game","proof":{}}');exception when others then denied:=true;end;if not denied then raise exception 'Arbitrary reward allowed';end if;
end$$;
-- All twelve catalog proofs and daily retries are checked by actual Postgres.
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select user_id from public.universe_members where slot=1),'role','authenticated')::text,true);
set local role authenticated;
do $$declare before integer;denied boolean:=false;p jsonb;begin
 perform public.universe_island_act('complete','{"id":"first-fall","proof":{"score":18,"seconds":45}}'::jsonb);
 perform public.universe_island_act('complete','{"id":"keepers-desk","proof":{"matched":[0,1,2,3,4,5,6,7]}}'::jsonb);
 perform public.universe_island_act('complete','{"id":"forest-door","proof":{"answer":[0,1,3]}}'::jsonb);
 perform public.universe_island_act('complete','{"id":"little-kite","proof":{"edges":["0-1","1-2","2-3","0-3","3-4"]}}'::jsonb);
 perform public.universe_island_act('complete','{"id":"tide-lights","proof":{"score":28,"seconds":45}}'::jsonb);
 perform public.universe_island_act('complete','{"id":"moth-library","proof":{"matched":[0,1,2,3,4,5,6,7,8,9,10,11]}}'::jsonb);
 perform public.universe_island_act('complete','{"id":"tide-chest","proof":{"answer":[2,3,0,1]}}'::jsonb);
 perform public.universe_island_act('complete','{"id":"sailing-home","proof":{"edges":["0-1","1-2","2-3","0-3","4-5","1-4","0-4"]}}'::jsonb);
 perform public.universe_island_act('complete','{"id":"lantern-storm","proof":{"score":40,"seconds":45}}'::jsonb);
 perform public.universe_island_act('complete','{"id":"sea-archive","proof":{"matched":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]}}'::jsonb);
 perform public.universe_island_act('complete','{"id":"keeper-lock","proof":{"answer":[0,3,1]}}'::jsonb);
 perform public.universe_island_act('complete','{"id":"home-light","proof":{"edges":["0-1","1-2","2-3","3-4","0-4","0-2","5-6","5-7","6-7"]}}'::jsonb);
 before:=(public.universe_island_state()->>'balance')::integer;
 p:=jsonb_build_object('id','daily-stars','day',(now() at time zone 'Asia/Colombo')::date,'proof',jsonb_build_object('score',100,'seconds',45));
 perform public.universe_island_act('complete',p);perform public.universe_island_act('complete',p);
 if (public.universe_island_state()->>'balance')::integer<>before+5 then raise exception 'Daily reward duplicated';end if;
 begin perform public.universe_island_act('complete',jsonb_set(p,'{day}',to_jsonb(((now() at time zone 'Asia/Colombo')::date+1)::text)));exception when others then denied:=true;end;if not denied then raise exception 'Future daily reward allowed';end if;
 denied:=false;begin perform public.universe_island_act('complete','{"id":"keepers-desk","proof":{"matched":[0,0,0,0,0,0,0,0]}}');exception when others then denied:=true;end;if not denied then raise exception 'Invalid memory proof accepted';end if;
end$$;
reset role;
select set_config('request.jwt.claims','{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}',true);
set local role authenticated;
do $$declare denied boolean:=false;begin
 begin perform public.universe_island_state();exception when others then denied:=true;end;if not denied then raise exception 'Outsider state leaked';end if;
 denied:=false;begin perform public.universe_island_act('buy','{"item":"fern"}');exception when others then denied:=true;end;if not denied then raise exception 'Outsider action allowed';end if;
 if has_function_privilege('anon','public.universe_island_state()','execute') or has_function_privilege('anon','public.universe_island_act(text,jsonb)','execute') or has_function_privilege('anon','island_private.state()','execute') then raise exception 'Anonymous island API enabled';end if;
end$$;
reset role;
rollback;
select true as island_privacy_rewards_concurrency_tests_passed;
