-- カジノ（ブラックジャック）とクレジットをやめるための DB 変更。
-- 学習アプリが主役でなくなってしまうので、20261016120000_credits.sql と 20261016150000_blackjack.sql で作ったものを片付ける。
-- 残すもの：学習の記録（study_sessions・answer_logs）と、記録をブラウザから直接書けないようにした守り。
-- 何度実行しても壊れないように、if exists / or replace で書いている。

-- 1. ブラックジャックの関数と表
drop function if exists public.blackjack_state ();
drop function if exists public.blackjack_start (integer);
drop function if exists public.blackjack_hit (uuid);
drop function if exists public.blackjack_stand (uuid);
drop function if exists public.blackjack_double (uuid);
drop function if exists public._bj_deal (uuid, integer, smallint[]);
drop function if exists public._bj_lock_playing (uuid);
drop function if exists public._bj_settle (uuid, boolean);
drop function if exists public._bj_view (public.blackjack_rounds);
drop function if exists public._bj_balance (uuid);
drop function if exists public._bj_is_blackjack (smallint[]);
drop function if exists public._bj_total (smallint[]);

-- 2. クレジットの通帳と残高（通帳はブラックジャックの表を指しているので、先に消す）
drop function if exists public.credit_balance ();
drop table if exists public.credit_transactions;
drop table if exists public.blackjack_rounds;

-- 3. 学習の記録を保存する関数を、クレジットを付けない形に作り直す。
--    クレジットのために足した「本人のセットか・カードはそのセットのものか・1周目は1枚1回」の確かめは、記録を正しく保つために残す。
--    返すものは、前の前の版と同じく、新しい記録の id
drop function if exists public.record_study_session (uuid, text, text, timestamptz, jsonb);
drop function if exists public.answer_matches (text, text);

create function public.record_study_session(
  p_set_id uuid,
  p_mode text,
  p_direction text,
  p_started_at timestamptz,
  p_attempts jsonb
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

  insert into public.study_sessions (user_id, set_id, mode, direction, started_at, first_round_correct, first_round_total)
  values (uid, p_set_id, p_mode, p_direction, p_started_at, correct_count, total_count)
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

revoke execute on function public.record_study_session (uuid, text, text, timestamptz, jsonb) from public, anon;
grant execute on function public.record_study_session (uuid, text, text, timestamptz, jsonb) to authenticated;
