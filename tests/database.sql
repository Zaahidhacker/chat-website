begin;
delete from universe_private.invites;
insert into universe_private.invites(email,token_hash,slot,name) values
('one@test.invalid',encode(extensions.digest('test-token-one','sha256'),'hex'),1,'One'),
('two@test.invalid',encode(extensions.digest('test-token-two','sha256'),'hex'),2,'Two');
insert into auth.users(id,email,raw_user_meta_data) values
('10000000-0000-0000-0000-000000000001','one@test.invalid','{"universe_invite":"test-token-one"}'),
('10000000-0000-0000-0000-000000000002','two@test.invalid','{"universe_invite":"test-token-two"}');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","email":"one@test.invalid","role":"authenticated"}',true);
select public.universe_send('20000000-0000-0000-0000-000000000001','A private hello',null);
select public.universe_send('20000000-0000-0000-0000-000000000001','A private hello',null);
do $$begin if (select count(*) from public.universe_messages)<>1 then raise exception 'Deduplication failed';end if; end$$;
insert into public.universe_favorites(user_id,message_id) values(auth.uid(),'20000000-0000-0000-0000-000000000001');
select public.universe_clear();
do $$begin if (select count(*) from public.universe_messages)<>1 then raise exception 'Saved keepsake lost';end if;end$$;
delete from public.universe_favorites where user_id=auth.uid();
do $$begin if (select count(*) from public.universe_messages)<>0 then raise exception 'Cleared history leaked';end if;end$$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000002","email":"two@test.invalid","role":"authenticated"}',true);
do $$begin if (select count(*) from public.universe_messages)<>1 then raise exception 'Partner history lost';end if;end$$;
select public.universe_send('20000000-0000-0000-0000-000000000002','A new hello',null);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","email":"one@test.invalid","role":"authenticated"}',true);
do $$begin if (select count(*) from public.universe_messages)<>1 then raise exception 'New message visibility failed';end if;end$$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000003","email":"outsider@test.invalid","role":"authenticated"}',true);
do $$begin if (select count(*) from public.universe_messages)<>0 then raise exception 'Outsider could read conversation';end if;end$$;
reset role;
rollback;
