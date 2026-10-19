-- Resolve PL/pgSQL record/alias ambiguity in new island-only actions.
create or replace function island_private.act(action text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c island_private.catalog; f island_private.furniture; s island_private.surprises; key text; d date; need integer; n integer; p jsonb; expected jsonb; current_revision integer; note_id uuid; own uuid:=auth.uid();begin
 if own is null or not public.universe_is_member() then raise exception 'Access denied';end if;
 if payload is null or jsonb_typeof(payload)<>'object' or octet_length(payload::text)>8000 then raise exception 'Invalid action';end if;
 -- Short game-only transaction lock, independent of chat and garden locks.
 perform pg_advisory_xact_lock(739190);
 if action='complete' then
  key:=payload->>'id';d:=(now() at time zone 'Asia/Colombo')::date;
  if key in ('daily-stars','daily-memory','daily-code','daily-constellation') then
   d:=(payload->>'day')::date;if d is null or d>(now() at time zone 'Asia/Colombo')::date or d<(now() at time zone 'Asia/Colombo')::date-7 then raise exception 'This daily reward has expired; story progress is safe';end if;
   n:=case key when 'daily-stars' then 0 when 'daily-memory' then 1 when 'daily-code' then 2 else 3 end;
   select * into c from island_private.catalog where kind=substring(key from 7) and chapter=mod((d-date '1970-01-01')+n,3);c.reward:=5;
  else select * into c from island_private.catalog where id=key;end if;
  if c.id is null then raise exception 'Unknown challenge';end if;
  select count(distinct a.challenge_id) into n from island_private.completions a join island_private.catalog b on b.id=a.challenge_id where b.kind<>'find';
  if key not like 'daily-%' and n<c.chapter*4 then raise exception 'Explore the previous chapter first';end if;
  p:=payload->'proof';
  if c.kind='code' then
   if p->'answer' is distinct from c.config->'answer' then raise exception 'The lock is still closed';end if;
  elsif c.kind='constellation' then
   if jsonb_typeof(p->'edges') is distinct from 'array' then raise exception 'Connect all the stars';end if;
   select jsonb_agg(value order by value) into expected from jsonb_array_elements(c.config->'edgeKeys');
   if (select jsonb_agg(value order by value) from jsonb_array_elements(p->'edges')) is distinct from expected then raise exception 'The sky chart is incomplete';end if;
  elsif c.kind='memory' then
   if jsonb_typeof(p->'matched') is distinct from 'array' then raise exception 'Find every pair';end if;
   select jsonb_agg(i) into expected from generate_series(0,(c.config->>'pairs')::integer*2-1) i;
   if (select jsonb_agg(value order by value) from jsonb_array_elements(p->'matched')) is distinct from expected then raise exception 'Find every pair';end if;
  elsif c.kind='stars' then
   if (p->>'score') is null or (p->>'score')::numeric<>(p->>'score')::integer or (p->>'score')::integer not between (c.config->>'target')::integer and 5000 or (p->>'seconds') is null or (p->>'seconds')::integer not between 30 and 60 then raise exception 'Catch more wandering light';end if;
  elsif c.kind='find' then
   if p->>'found' is distinct from 'true' then raise exception 'Look a little closer';end if;
  end if;
  insert into island_private.completions(user_id,challenge_id,day_key,reward) values(own,key,case when key like 'daily-%' then d::text else 'story' end,c.reward) on conflict do nothing;
  get diagnostics n=row_count;
  if n=1 then update island_private.wallet set balance=balance+c.reward where id=1;end if;
 elsif action='buy' then
  select * into f from island_private.furniture where id=payload->>'item';if not found then raise exception 'Unknown decoration';end if;
  if not exists(select 1 from island_private.inventory where item_id=f.id) then
   update island_private.wallet set balance=balance-f.cost where id=1 and balance>=f.cost;
   if not found then raise exception 'A few more stars will bring this home';end if;
   insert into island_private.inventory(item_id,bought_by) values(f.id,own);
  end if;
 elsif action='place' then
  if payload->>'slot' not in ('wall','floor','left','center','right','light','sill') or payload->>'slot' is null then raise exception 'Unknown cottage spot';end if;
  select coalesce(revision,0) into current_revision from island_private.placements where slot=payload->>'slot';current_revision:=coalesce(current_revision,0);
  -- An acknowledgement-lost retry may return the existing placement safely.
  if exists(select 1 from island_private.placements where slot=payload->>'slot' and item_id is not distinct from nullif(payload->>'item','') and revision=(payload->>'revision')::integer+1 and updated_by=own) then return island_private.state();end if;
  if (payload->>'revision') is null or current_revision<>(payload->>'revision')::integer then raise exception 'Your person changed this spot. Refresh to see their choice before saving yours.';end if;
  if nullif(payload->>'item','') is not null and not exists(select 1 from island_private.inventory i join island_private.furniture furniture_choice on furniture_choice.id=i.item_id where i.item_id=payload->>'item' and furniture_choice.slot=payload->>'slot') then raise exception 'Unlock a decoration for this spot first';end if;
  insert into island_private.placements(slot,item_id,revision,updated_by) values(payload->>'slot',nullif(payload->>'item',''),current_revision+1,own) on conflict(slot) do update set item_id=excluded.item_id,revision=excluded.revision,updated_by=excluded.updated_by;
 elsif action='send' then
  note_id:=(payload->>'id')::uuid;
  if note_id is null or payload->>'location' not in ('cottage','garden','forest','observatory','cove','lighthouse') or payload->>'location' is null or length(trim(payload->>'note')) not between 1 and 600 or payload->>'note' is null then raise exception 'Choose a place and write 1–600 characters';end if;
  select * into s from island_private.surprises where id=note_id;
  if found then
   if s.sender<>own or s.note<>trim(payload->>'note') or s.location<>payload->>'location' then raise exception 'Surprise id already used';end if;
   return island_private.state();
  end if;
  if (select count(*) from island_private.surprises)>=200 or (select count(*) from island_private.surprises where sender=own and created_at>=date_trunc('day',now() at time zone 'Asia/Colombo') at time zone 'Asia/Colombo')>=3 then raise exception 'Leave a little room for tomorrow. Three surprises a day, up to 200 kept safely.';end if;
  insert into island_private.surprises(id,sender,recipient,location,note) select note_id,own,user_id,payload->>'location',trim(payload->>'note') from public.universe_members where user_id<>own;
 elsif action='open' then
  select * into s from island_private.surprises where id=(payload->>'id')::uuid and recipient=own;
  if not found then raise exception 'This surprise is for your person';end if;
  if not exists(select 1 from island_private.completions a join island_private.catalog challenge_catalog on challenge_catalog.id=a.challenge_id where a.user_id=own and challenge_catalog.location=s.location and challenge_catalog.kind<>'find') then raise exception 'Finish one story challenge here to open this surprise';end if;
  update island_private.surprises set opened=true where id=s.id;
 else raise exception 'Unknown island action';end if;
 return island_private.state();
end$$;
