-- Integration against the actual database. Everything rolls back, including auth users.
-- Run on an empty/prelaunch conversation; never removes real users or messages.
begin;
select pg_advisory_xact_lock(739103);
do $$begin if exists(select 1 from public.universe_members) or exists(select 1 from public.universe_messages) then raise exception 'Refusing fixture setup: conversation already in use'; end if; end$$;
delete from universe_private.invites;
insert into universe_private.invites(email,token_hash,slot,name) values
('one@test.invalid',encode(extensions.digest('test-token-one','sha256'),'hex'),1,'One'),
('two@test.invalid',encode(extensions.digest('test-token-two','sha256'),'hex'),2,'Two');
insert into auth.users(id,email,raw_user_meta_data) values
('10000000-0000-0000-0000-000000000001','one@test.invalid','{"universe_invite":"test-token-one"}'),
('10000000-0000-0000-0000-000000000002','two@test.invalid','{"universe_invite":"test-token-two"}');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","email":"one@test.invalid","role":"authenticated"}',true);
select public.universe_send('20000000-0000-0000-0000-000000000001','Zaahid sends to Layaana',null);
select public.universe_send('20000000-0000-0000-0000-000000000001','Zaahid sends to Layaana',null);
do $$begin
 if (select count(*) from public.universe_messages)<>1 then raise exception 'Deduplication failed';end if;
 if (public.universe_sync_state()->>'revision')::bigint<1 then raise exception 'Revision checkpoint missing';end if;
end$$;
insert into public.universe_favorites(user_id,message_id) values(auth.uid(),'20000000-0000-0000-0000-000000000001');
select public.universe_change('20000000-0000-0000-0000-000000000001','An edited hello');
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000002","email":"two@test.invalid","role":"authenticated"}',true);
do $$begin
 if (select body from public.universe_messages where id='20000000-0000-0000-0000-000000000001')<>'An edited hello' then raise exception 'Receiver did not get sender edit';end if;
end$$;
select public.universe_send('20000000-0000-0000-0000-000000000002','Layaana replies to Zaahid','20000000-0000-0000-0000-000000000001');
do $$declare denied boolean=false;begin
 begin perform public.universe_change('20000000-0000-0000-0000-000000000001','Unauthorized edit');exception when others then denied=true;end;
 if not denied then raise exception 'Partner was able to edit the other sender';end if;
end$$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","email":"one@test.invalid","role":"authenticated"}',true);
do $$begin if (select count(*) from public.universe_messages)<>2 then raise exception 'Reverse delivery failed';end if;end$$;
select public.universe_clear();
do $$begin
 if (select count(*) from public.universe_messages)<>1 then raise exception 'Saved keepsake lost';end if;
 if not exists(select 1 from public.universe_messages where body='An edited hello') then raise exception 'Wrong saved message';end if;
end$$;
delete from public.universe_favorites where user_id=auth.uid();
do $$begin if (select count(*) from public.universe_messages)<>0 then raise exception 'Cleared history leaked';end if;end$$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000002","email":"two@test.invalid","role":"authenticated"}',true);
do $$begin if (select count(*) from public.universe_messages)<>2 then raise exception 'Partner history lost';end if;end$$;
select public.universe_send('20000000-0000-0000-0000-000000000003','After the personal clear',null);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","email":"one@test.invalid","role":"authenticated"}',true);
do $$declare checkpoint bigint; latest bigint; old_ctid tid; own_mid uuid=gen_random_uuid();begin
 if (select count(*) from public.universe_messages)<>1 then raise exception 'New message visibility failed';end if;
 perform public.universe_send(own_mid,'Own earlier message',null);
 select revision into checkpoint from public.universe_messages where id=own_mid;
 perform public.universe_receipt((select max(seq) from public.universe_messages),0);
 select last_read,ctid into latest,old_ctid from public.universe_members where user_id=auth.uid();
 if latest<>0 then raise exception 'Delivery incorrectly marked a message as read';end if;
 perform public.universe_receipt((select max(seq) from public.universe_messages),0);
 if old_ctid<>(select ctid from public.universe_members where user_id=auth.uid()) then raise exception 'Redundant receipt wrote a row';end if;
 -- Catch-up > one page, then an old message edit gets its own new revision.
 for i in 1..120 loop perform public.universe_send(gen_random_uuid(),'Catch-up message '||i,null);end loop;
 perform public.universe_change(own_mid,'Offline edit included in catch-up');
 if (select count(*) from public.universe_messages where revision>checkpoint)<>121 then raise exception 'Incremental catch-up lost messages or edits';end if;
end$$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000003","email":"outsider@test.invalid","role":"authenticated"}',true);
do $$declare denied boolean=false;begin
 if (select count(*) from public.universe_messages)<>0 then raise exception 'Outsider could read conversation';end if;
 if public.universe_sync_state() is not null then raise exception 'Outsider metadata leaked';end if;
 begin perform public.universe_send(gen_random_uuid(),'Unauthorized',null);exception when others then denied=true;end;
 if not denied then raise exception 'Outsider could send';end if;
end$$;
reset role;
set local role anon;
do $$begin
 if has_table_privilege('anon','public.universe_messages','SELECT') then raise exception 'Anonymous table grant';end if;
 if has_function_privilege('anon','public.universe_send(uuid,text,uuid)','EXECUTE') then raise exception 'Anonymous send grant';end if;
 if has_function_privilege('anon','public.universe_sync_state()','EXECUTE') then raise exception 'Anonymous metadata grant';end if;
end$$;
reset role;
rollback;
select 'PASS: two-way database delivery, replies, edits, idempotency, clear isolation, keepsakes, >100-message delta replay, receipt semantics, no-op receipt suppression, outsider denial, anonymous privilege checks. All fixtures rolled back.' as verification;
