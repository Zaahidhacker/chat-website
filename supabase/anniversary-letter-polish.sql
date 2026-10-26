-- Only the owner-requested phrase in paragraph one changes. Refuse an unexpected letter.
do $$begin
 update public.anniversary_2026_content set letter=overlay(letter placing 'oneee monthhh' from position('one-month' in letter) for length('one-month')) where id and md5(letter)='ee5d61ea2edb62219f0ca2757c4c22a5';
 if not found and not exists(select 1 from public.anniversary_2026_content where id and md5(letter)='fe2185ca40501cfc0c3536ef2c382969') then raise exception 'Letter differs: review before editing';end if;
end $$;
