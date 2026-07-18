-- Hall of Deaths + King of the Hour.
-- Run in: Supabase Dashboard -> SQL Editor (bearded-wedding project) -> Run
-- https://supabase.com/dashboard/project/aavsizdzxxumxvrnuoom/sql/new

alter table public.button_scores
  add column if not exists cause text check (cause is null or cause in ('release','focus','stray','slip')),
  add column if not exists cause_detail text;

drop function if exists public.submit_button_score(text, bigint, text, text, text);

create or replace function public.submit_button_score(
  p_name text, p_ms bigint, p_country text default null, p_linkedin text default null,
  p_mode text default 'solo', p_cause text default null, p_detail text default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip text;
  v_name text;
  v_clean text;
  v_linkedin text;
  v_mode text;
  v_cause text;
  v_detail text;
  v_recent int;
  v_id uuid;
  v_rank bigint;
  v_bad text[] := array[
    'fuck','shit','cunt','twat','wank','bollock','bastard','bitch','dick',
    'cock','prick','piss','arse','asshole','fanny','slag','whore','slut',
    'nigger','nigga','faggot','fag','retard','spastic','paki','chink',
    'rape','nazi','hitler','penis','vagina','tits','boobs','anal','cum',
    'jizz','nonce','pedo','paedo','minge','knob','bellend','shag','tosser'
  ];
  w text;
begin
  v_name := trim(coalesce(p_name, ''));

  if char_length(v_name) < 3 or char_length(v_name) > 12 then
    raise exception 'NAME_LENGTH';
  end if;
  if v_name !~ '^[A-Za-z0-9 _\-\.]+$' then
    raise exception 'NAME_CHARS';
  end if;

  v_clean := lower(regexp_replace(v_name, '[^a-z0-9]', '', 'gi'));
  v_clean := translate(v_clean, '013457', 'oleast');
  foreach w in array v_bad loop
    if position(w in v_clean) > 0 then
      raise exception 'NAME_PROFANITY';
    end if;
  end loop;

  v_linkedin := trim(coalesce(p_linkedin, ''));
  if v_linkedin = '' then
    v_linkedin := null;
  else
    if char_length(v_linkedin) > 120
       or v_linkedin !~ '^https://(www\.)?linkedin\.com/in/[A-Za-z0-9\-_%\.]{3,100}/?$' then
      raise exception 'LINKEDIN_INVALID';
    end if;
  end if;

  v_mode := coalesce(p_mode, 'solo');
  if v_mode not in ('solo', 'duo') then
    raise exception 'MODE_INVALID';
  end if;

  -- Cause of death for the Hall of Deaths: constrained enum + sanitised detail
  v_cause := nullif(trim(coalesce(p_cause, '')), '');
  if v_cause is not null and v_cause not in ('release','focus','stray','slip') then
    v_cause := null;
  end if;
  v_detail := left(regexp_replace(coalesce(p_detail, ''), '[^A-Za-z0-9 _\-\.,:''!?()]', '', 'g'), 80);
  v_detail := nullif(trim(v_detail), '');
  if v_detail is not null then
    v_clean := lower(regexp_replace(v_detail, '[^a-z0-9]', '', 'gi'));
    v_clean := translate(v_clean, '013457', 'oleast');
    foreach w in array v_bad loop
      if position(w in v_clean) > 0 then
        v_detail := null;
        exit;
      end if;
    end loop;
  end if;

  if p_ms is null or p_ms < 1000 then
    raise exception 'TIME_TOO_SHORT';
  end if;
  if p_ms > 86400000 then
    raise exception 'TIME_TOO_LONG';
  end if;

  begin
    v_ip := coalesce(
      current_setting('request.headers', true)::json ->> 'cf-connecting-ip',
      current_setting('request.headers', true)::json ->> 'x-real-ip',
      split_part(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ',', 1),
      'unknown'
    );
  exception when others then
    v_ip := 'unknown';
  end;

  select count(*) into v_recent
  from button_rate_limit
  where ip = v_ip and created_at > now() - interval '10 minutes';
  if v_recent >= 6 then
    raise exception 'RATE_LIMITED';
  end if;
  insert into button_rate_limit (ip) values (v_ip);
  delete from button_rate_limit where created_at < now() - interval '1 hour';

  insert into button_scores (name, ms, country, linkedin, mode, cause, cause_detail)
  values (v_name, p_ms, nullif(trim(coalesce(p_country, '')), ''), v_linkedin, v_mode, v_cause, v_detail)
  returning id into v_id;

  select count(*) + 1 into v_rank from button_scores where ms > p_ms and mode = v_mode;

  return json_build_object('id', v_id, 'rank', v_rank);
end;
$$;

revoke all on function public.submit_button_score(text, bigint, text, text, text, text, text) from public;
grant execute on function public.submit_button_score(text, bigint, text, text, text, text, text) to anon, authenticated;

-- King of the Hour: last full hour's champion, plus whoever leads right now
create or replace function public.get_king_of_hour()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'prev', (
      select json_build_object('name', name, 'ms', ms)
      from button_scores
      where created_at >= date_trunc('hour', now()) - interval '1 hour'
        and created_at < date_trunc('hour', now())
      order by ms desc limit 1
    ),
    'current', (
      select json_build_object('name', name, 'ms', ms)
      from button_scores
      where created_at >= date_trunc('hour', now())
      order by ms desc limit 1
    )
  );
$$;
grant execute on function public.get_king_of_hour() to anon, authenticated;
