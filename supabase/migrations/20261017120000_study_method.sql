-- 4択モードを入れるための DB 変更。
-- 学習の記録に「どの形式で学んだか」（typing：入力 / choice：4択）の列を足し、記録を保存する関数がそれを受け取れるようにする。
-- 何度実行しても壊れないように、if not exists / if exists で書いている。

-- 1. 形式の列。これまでの記録は全部「入力」なので、初期値を typing にする
alter table public.study_sessions
  add column if not exists method text not null default 'typing' check (method in ('typing', 'choice'));

-- 2. 記録を保存する関数を作り直す。p_method を最後に足す（省略したら typing。古い画面から呼ばれても動く）。
--    中身は 20261017090000_remove_casino_and_credits.sql の版に、形式を保存する1か所を足しただけ
drop function if exists public.record_study_session (uuid, text, text, timestamptz, jsonb);
drop function if exists public.record_study_session (uuid, text, text, timestamptz, jsonb, text);

create function public.record_study_session(
  p_set_id uuid,
  p_mode text,
  p_direction text,
  p_started_at timestamptz,
  p_attempts jsonb,
  p_method text default 'typing'
)
returns uuid
language plpgsql
security definer -- ブラウザには記録の表へ直接書く権限を渡していないので、この関数が代わりに書く（中で本人かを確かめる）
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  new_id uuid;
  correct_count integer;
  total_count integer;
  distinct_count integer;
begin
  if uid is null then
    raise exception 'ログインしていません' using errcode = '42501';
  end if;
  if not exists (select 1 from public.study_sets s where s.id = p_set_id and s.user_id = uid) then
    raise exception '学習セットが見つかりません' using errcode = 'P0002';
  end if;
  if p_attempts is null or jsonb_typeof(p_attempts) <> 'array' or jsonb_array_length(p_attempts) = 0 then
    raise exception '答えが1つもありません' using errcode = '22023';
  end if;
  if jsonb_array_length(p_attempts) > 5000 then
    raise exception '答えが多すぎます' using errcode = '22023';
  end if;

  -- 答えのカードは、どれもこのセットのカードでなければならない
  if exists (
    select 1
    from jsonb_array_elements(p_attempts) as a (elem)
    left join public.cards c on c.id = (a.elem ->> 'card_id')::uuid and c.set_id = p_set_id
    where c.id is null
  ) then
    raise exception 'このセットにないカードの答えが含まれています' using errcode = '22023';
  end if;

  -- 1周目は1枚につき1回だけ。点数は画面と同じく「正解にする」も正解に数える
  select
    count(*),
    count(distinct a.elem ->> 'card_id'),
    count(*) filter (
      where coalesce((a.elem ->> 'judged_correct')::boolean, false) or coalesce((a.elem ->> 'overridden')::boolean, false)
    )
  into total_count, distinct_count, correct_count
  from jsonb_array_elements(p_attempts) as a (elem)
  where (a.elem ->> 'round')::integer = 1;
  if total_count = 0 then
    raise exception '1周目の答えがありません' using errcode = '22023';
  end if;
  if total_count <> distinct_count then
    raise exception '1周目に同じカードの答えが2回あります' using errcode = '22023';
  end if;

  insert into public.study_sessions (user_id, set_id, mode, direction, method, started_at, first_round_correct, first_round_total)
  values (uid, p_set_id, p_mode, p_direction, coalesce(p_method, 'typing'), p_started_at, correct_count, total_count)
  returning id into new_id;

  insert into public.answer_logs (session_id, card_id, round, given, judged_correct, overridden, answered_at)
  select
    new_id,
    (a.elem ->> 'card_id')::uuid,
    (a.elem ->> 'round')::integer,
    a.elem ->> 'given',
    (a.elem ->> 'judged_correct')::boolean,
    coalesce((a.elem ->> 'overridden')::boolean, false),
    coalesce((a.elem ->> 'answered_at')::timestamptz, now())
  from jsonb_array_elements(p_attempts) as a (elem);

  return new_id;
end;
$$;

revoke execute on function public.record_study_session (uuid, text, text, timestamptz, jsonb, text) from public, anon;
grant execute on function public.record_study_session (uuid, text, text, timestamptz, jsonb, text) to authenticated;
