-- Additive: no ALTER/UPDATE/DELETE of existing messages, members or accounts.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('universe-photos','universe-photos',false,524288,array['image/jpeg']),
 ('universe-thumbs','universe-thumbs',false,32768,array['image/jpeg']);
create table public.universe_photos (
 id uuid primary key,
 owner_id uuid not null references public.universe_members(user_id),
 path text not null unique,
 bytes integer not null check(bytes between 1 and 524288),
 thumb_bytes integer not null check(thumb_bytes between 1 and 32768),
 width integer not null check(width between 1 and 1600),
 height integer not null check(height between 1 and 1600),
 sent boolean not null default false,
 created_at timestamptz not null default now()
);
create index universe_photo_owner on public.universe_photos(owner_id);
alter table public.universe_photos enable row level security;
revoke all on public.universe_photos from public,anon,authenticated;
grant select on public.universe_photos to authenticated;
grant all on public.universe_photos to service_role;
create policy photos_read on public.universe_photos for select to authenticated using(
 (select public.universe_is_member()) and
 ((owner_id=(select auth.uid()) and not sent) or (sent and exists(select 1 from public.universe_messages m where m.id=universe_photos.id and not m.deleted)))
);
create function public.universe_photo_reserve(mid uuid,full_bytes integer,preview_bytes integer,w integer,h integer) returns public.universe_photos language plpgsql security definer set search_path='' as $$
declare p public.universe_photos;begin
 if not public.universe_is_member() then raise exception 'Access denied';end if;
 if mid is null or full_bytes is null or preview_bytes is null or w is null or h is null or full_bytes not between 1 and 524288 or preview_bytes not between 1 and 32768 or w not between 1 and 1600 or h not between 1 and 1600 then raise exception 'Invalid photo dimensions or size';end if;
 perform pg_advisory_xact_lock(739104);
 select * into p from public.universe_photos where id=mid;
 if found then
  if p.owner_id<>auth.uid() or p.bytes<>full_bytes or p.thumb_bytes<>preview_bytes or p.width<>w or p.height<>h then raise exception 'Photo reservation mismatch';end if;
  return p;
 end if;
 if exists(select 1 from public.universe_messages where id=mid) then raise exception 'Message id already used';end if;
 -- Even spoofed byte declarations cannot exceed ~557MB: 1,000 slots x two
 -- separately limited immutable bucket objects. Leave the rest of Free unused.
 if (select count(*) from public.universe_photos)>=1000 or
 (select coalesce(sum(bytes::bigint+thumb_bytes),0) from public.universe_photos)+full_bytes+preview_bytes>450000000 then
 raise exception 'Our free photo space is full. Existing photos are safe; new uploads are paused.';end if;
 insert into public.universe_photos(id,owner_id,path,bytes,thumb_bytes,width,height)
 values(mid,auth.uid(),auth.uid()::text||'/'||mid::text||'.jpg',full_bytes,preview_bytes,w,h) returning * into p;
 return p;
end$$;
revoke all on function public.universe_photo_reserve(uuid,integer,integer,integer,integer) from public,anon;
grant execute on function public.universe_photo_reserve(uuid,integer,integer,integer,integer) to authenticated;
create function public.universe_photo_upload_allowed(object_path text) returns boolean language sql stable security definer set search_path='' as $$
 select public.universe_is_member() and exists(select 1 from public.universe_photos where path=object_path and owner_id=auth.uid() and not sent)
$$;
revoke all on function public.universe_photo_upload_allowed(text) from public,anon;
grant execute on function public.universe_photo_upload_allowed(text) to authenticated;
create policy universe_photo_insert on storage.objects for insert to authenticated with check(bucket_id in ('universe-photos','universe-thumbs') and (select public.universe_photo_upload_allowed(name)));
create policy universe_photo_read on storage.objects for select to authenticated using(bucket_id in ('universe-photos','universe-thumbs') and exists(select 1 from public.universe_photos p where p.path=name));
-- No object UPDATE or DELETE client policy: retries cannot overwrite a photo.
create function public.universe_send_photo(mid uuid,caption text default '',reply uuid default null) returns public.universe_messages language plpgsql security definer set search_path='' as $$
declare p public.universe_photos;result public.universe_messages;actual bigint;begin
 if not public.universe_is_member() then raise exception 'Access denied';end if;
 if caption is null or length(caption)>1000 then raise exception 'Caption must be at most 1000 characters';end if;
 perform pg_advisory_xact_lock(739102);
 select * into p from public.universe_photos where id=mid and owner_id=auth.uid();
 if not found then raise exception 'Reserve a photo first';end if;
 select * into result from public.universe_messages where id=mid;
 if found then
  if result.sender<>auth.uid() or not p.sent then raise exception 'Message id already used';end if;
  return result;
 end if;
 select (metadata->>'size')::bigint into actual from storage.objects where bucket_id='universe-photos' and name=p.path and metadata->>'mimetype'='image/jpeg';
 if actual is null or actual<>p.bytes then raise exception 'Photo upload is incomplete';end if;
 select (metadata->>'size')::bigint into actual from storage.objects where bucket_id='universe-thumbs' and name=p.path and metadata->>'mimetype'='image/jpeg';
 if actual is null or actual<>p.thumb_bytes then raise exception 'Photo preview upload is incomplete';end if;
 result:=public.universe_send(mid,'📷 '||coalesce(nullif(trim(caption),''),'Photo'),reply);
 update public.universe_photos set sent=true where id=mid;
 return result;
end$$;
revoke all on function public.universe_send_photo(uuid,text,uuid) from public,anon;
grant execute on function public.universe_send_photo(uuid,text,uuid) to authenticated;
alter publication supabase_realtime add table public.universe_photos;
