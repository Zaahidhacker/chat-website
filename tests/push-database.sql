-- Safe against an in-use conversation. No real messages/users/settings are mutated.
begin;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select user_id from public.universe_members where slot=1),'role','authenticated')::text,true);
set local role authenticated;
select public.universe_push_register(jsonb_build_object('endpoint','https://fcm.googleapis.com/fcm/send/universe-rollback-test','keys',jsonb_build_object('p256dh',repeat('A',87),'auth',repeat('B',22))));
do $$declare blocked boolean:=false;begin
 if public.universe_push_key() is null then raise exception 'Push public key missing'; end if;
 if (select count(*) from public.universe_push_subscriptions where endpoint='https://fcm.googleapis.com/fcm/send/universe-rollback-test')<>1 then raise exception 'Own subscription missing'; end if;
 begin perform public.universe_push_register('{"endpoint":"https://attacker.invalid/push","keys":{"p256dh":"invalid","auth":"invalid"}}'::jsonb); exception when others then blocked:=true;end;
 if not blocked then raise exception 'Untrusted push host accepted';end if;
 if has_function_privilege('authenticated','public.universe_push_server_config()','execute') or has_function_privilege('anon','public.universe_push_server_config()','execute') then raise exception 'Server keys exposed';end if;
 if has_function_privilege('anon','public.universe_push_register(jsonb)','execute') then raise exception 'Anonymous registration exposed';end if;
end$$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select user_id from public.universe_members where slot=2),'role','authenticated')::text,true);
set local role authenticated;
do $$declare blocked boolean:=false;begin
 if exists(select 1 from public.universe_push_subscriptions where endpoint='https://fcm.googleapis.com/fcm/send/universe-rollback-test') then raise exception 'Partner subscription leaked';end if;
 delete from public.universe_push_subscriptions where endpoint='https://fcm.googleapis.com/fcm/send/universe-rollback-test';
 begin perform public.universe_push_register(jsonb_build_object('endpoint','https://fcm.googleapis.com/fcm/send/universe-rollback-test','keys',jsonb_build_object('p256dh',repeat('A',87),'auth',repeat('B',22)))); exception when others then blocked:=true;end;
 if not blocked then raise exception 'Partner subscription stolen';end if;
end$$;
reset role;
select set_config('request.jwt.claims','{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}',true);
set local role authenticated;
do $$declare blocked boolean:=false;begin
 if public.universe_push_key() is not null then raise exception 'Nonmember can obtain key';end if;
 begin perform public.universe_push_register('{}'::jsonb);exception when others then blocked:=true;end;
 if not blocked then raise exception 'Nonmember can register';end if;
end$$;
reset role;
-- At most one sender per (message,device), even if a webhook repeats.
do $$declare mid uuid;begin
 select id into mid from public.universe_messages order by seq limit 1;
 if mid is null then raise exception 'Need a real message id for rollback-only claim verification';end if;
 if not public.universe_push_claim(mid,'rollback-test-device') then raise exception 'First claim failed';end if;
 if public.universe_push_claim(mid,'rollback-test-device') then raise exception 'Duplicate claim accepted';end if;
 perform public.universe_push_finish(mid,'rollback-test-device',false);
 if not public.universe_push_claim(mid,'rollback-test-device') then raise exception 'Failed delivery cannot retry';end if;
 perform public.universe_push_finish(mid,'rollback-test-device',true);
 if public.universe_push_claim(mid,'rollback-test-device') then raise exception 'Successful delivery duplicated';end if;
end$$;
rollback;
