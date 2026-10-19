-- Additive only. Existing chat, photo, auth and garden tables are never changed.
create schema island_private;
revoke all on schema island_private from public,anon;
grant usage on schema island_private to authenticated;
create table island_private.catalog(id text primary key,kind text not null,location text not null,chapter integer not null,reward integer not null,config jsonb not null);
create table island_private.completions(user_id uuid not null references public.universe_members(user_id),challenge_id text not null,day_key text not null,reward integer not null,created_at timestamptz not null default now(),primary key(user_id,challenge_id,day_key));
create index island_completed_challenge on island_private.completions(challenge_id);
create table island_private.wallet(id integer primary key check(id=1),balance integer not null default 0 check(balance>=0));
insert into island_private.wallet(id) values(1);
create table island_private.furniture(id text primary key,slot text not null,cost integer not null check(cost>0));
create table island_private.inventory(item_id text primary key references island_private.furniture(id),bought_by uuid not null references public.universe_members(user_id),created_at timestamptz not null default now());
create index island_inventory_buyer on island_private.inventory(bought_by);
create table island_private.placements(slot text primary key,item_id text references island_private.furniture(id),revision integer not null default 1,updated_by uuid not null references public.universe_members(user_id));
create index island_placement_updater on island_private.placements(updated_by);
create table island_private.surprises(id uuid primary key,sender uuid not null references public.universe_members(user_id),recipient uuid not null references public.universe_members(user_id),location text not null,note text not null check(length(note) between 1 and 600),opened boolean not null default false,created_at timestamptz not null default now(),check(sender<>recipient));
create index island_surprise_sender on island_private.surprises(sender,created_at);
create index island_surprise_recipient on island_private.surprises(recipient,location);
-- RLS is a second boundary: no direct client table privileges/policies exist.
alter table island_private.catalog enable row level security;
alter table island_private.completions enable row level security;
alter table island_private.wallet enable row level security;
alter table island_private.furniture enable row level security;
alter table island_private.inventory enable row level security;
alter table island_private.placements enable row level security;
alter table island_private.surprises enable row level security;
revoke all on all tables in schema island_private from public,anon,authenticated;
insert into island_private.catalog values
('first-fall','stars','observatory',0,8,'{"target":18,"seconds":45,"level":0}'::jsonb),
('keepers-desk','memory','cottage',0,8,'{"pairs":4,"seed":17,"level":0}'::jsonb),
('forest-door','code','forest',0,8,'{"symbols":["Leaf","Moon","Shell","Star"],"size":3,"clues":["The moon is in the middle.","A leaf comes immediately before the moon.","The star is somewhere after the leaf.","The shell stays outside."],"answer":[0,1,3]}'::jsonb),
('little-kite','constellation','garden',0,8,'{"nodes":[[20,28],[48,12],[75,31],[48,60],[48,85],[83,78]],"edges":[[0,1],[1,2],[2,3],[3,0],[3,4]],"edgeKeys":["0-1","1-2","2-3","0-3","3-4"]}'::jsonb),
('tide-lights','stars','cove',1,12,'{"target":28,"seconds":45,"level":1}'::jsonb),
('moth-library','memory','forest',1,12,'{"pairs":6,"seed":83,"level":1}'::jsonb),
('tide-chest','code','garden',1,12,'{"symbols":["Shell","Leaf","Moon","Star","Rain"],"size":4,"clues":["The shell sits immediately after the star.","The moon comes immediately before the star.","The leaf is after the shell.","Rain is not part of the chain."],"answer":[2,3,0,1]}'::jsonb),
('sailing-home','constellation','observatory',1,12,'{"nodes":[[13,65],[86,65],[68,86],[31,86],[48,17],[48,65],[18,20],[83,32]],"edges":[[0,1],[1,2],[2,3],[3,0],[4,5],[4,1],[0,4]],"edgeKeys":["0-1","1-2","2-3","0-3","4-5","1-4","0-4"]}'::jsonb),
('lantern-storm','stars','lighthouse',2,16,'{"target":40,"seconds":45,"level":2}'::jsonb),
('sea-archive','memory','cove',2,16,'{"pairs":8,"seed":211,"level":2}'::jsonb),
('keeper-lock','code','cottage',2,16,'{"symbols":["Leaf","Moon","Shell","Star"],"size":3,"unique":true,"clues":["The moon is first.","The leaf is second.","The moon is last.","Extra carvings: the shell is absent; the leaf comes somewhere before the moon."],"answer":[0,3,1],"truthPuzzle":true}'::jsonb),
('home-light','constellation','lighthouse',2,16,'{"nodes":[[15,43],[49,13],[84,43],[84,86],[15,86],[34,64],[64,64],[49,86],[91,12]],"edges":[[0,1],[1,2],[2,3],[3,4],[4,0],[0,2],[5,6],[5,7],[6,7]],"edgeKeys":["0-1","1-2","2-3","3-4","0-4","0-2","5-6","5-7","6-7"]}'::jsonb),
('find-sea-glass','find','cove',1,3,'{}'::jsonb),
('find-lost-key','find','cottage',0,3,'{}'::jsonb),
('find-moth-stamp','find','forest',0,3,'{}'::jsonb),
('find-moon-petal','find','garden',0,3,'{}'::jsonb),
('find-tiny-orbit','find','observatory',0,3,'{}'::jsonb),
('find-lantern-feather','find','lighthouse',2,3,'{}'::jsonb),
('find-tea-shell','find','cottage',0,3,'{}'::jsonb),
('find-sleepy-snail','find','garden',0,3,'{}'::jsonb);
insert into island_private.furniture values
('wall-dawn','wall',8),
('wall-night','wall',8),
('rug-rose','floor',10),
('rug-sea','floor',10),
('fern','left',8),
('books','left',12),
('sofa-sage','center',18),
('tea-table','center',14),
('flowers','right',10),
('telescope','right',24),
('lamp','light',12),
('stars','light',16),
('ivy','sill',8),
('mugs','sill',8);
create function island_private.state() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.universe_is_member() then raise exception 'Access denied';end if;
 return jsonb_build_object('day',(now() at time zone 'Asia/Colombo')::date,
 'balance',(select balance from island_private.wallet where id=1),
 'completions',(select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'challenge_id',challenge_id,'day_key',day_key)),'[]') from island_private.completions where day_key='story' or day_key>=((now() at time zone 'Asia/Colombo')::date-7)::text),
 'owned',(select coalesce(jsonb_agg(item_id),'[]') from island_private.inventory),
 'slots',(select coalesce(jsonb_agg(jsonb_build_object('slot',slot,'item_id',item_id,'revision',revision)),'[]') from island_private.placements),
 'surprises',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'sender',sender,'recipient',recipient,'location',location,'opened',opened,'note',case when sender=auth.uid() or opened then note else null end) order by created_at),'[]') from island_private.surprises),
 'bunnyPoints',(select coalesce(sum(points),0) from universe_private.garden_events));
end$$;
create function island_private.act(action text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
  if nullif(payload->>'item','') is not null and not exists(select 1 from island_private.inventory i join island_private.furniture f on f.id=i.item_id where i.item_id=payload->>'item' and f.slot=payload->>'slot') then raise exception 'Unlock a decoration for this spot first';end if;
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
  if not exists(select 1 from island_private.completions a join island_private.catalog c on c.id=a.challenge_id where a.user_id=own and c.location=s.location and c.kind<>'find') then raise exception 'Finish one story challenge here to open this surprise';end if;
  update island_private.surprises set opened=true where id=s.id;
 else raise exception 'Unknown island action';end if;
 return island_private.state();
end$$;
revoke all on function island_private.state(),island_private.act(text,jsonb) from public,anon;
grant execute on function island_private.state(),island_private.act(text,jsonb) to authenticated;
-- Exposed functions are invokers; authorization lives in the private functions.
create function public.universe_island_state() returns jsonb language sql security invoker set search_path='' as $$ select island_private.state() $$;
create function public.universe_island_act(action text,payload jsonb) returns jsonb language sql security invoker set search_path='' as $$ select island_private.act(action,payload) $$;
revoke all on function public.universe_island_state(),public.universe_island_act(text,jsonb) from public,anon;
grant execute on function public.universe_island_state(),public.universe_island_act(text,jsonb) to authenticated;
