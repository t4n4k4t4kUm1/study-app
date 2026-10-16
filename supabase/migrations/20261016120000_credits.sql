-- アプリ内通貨「クレジット」を入れるための DB 変更。
-- 残高の数字を1つ持つのではなく、増えた・減った記録を1行ずつ残す「通帳」の表を作り、その合計を残高にする。
-- 何度実行しても壊れないように、if not exists / if exists / or replace で書いている。

-- 1. クレジットの通帳。1行が「いつ・いくら・なぜ増えた（減った）か」
create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  amount integer not null check (amount <> 0), -- 増えたらプラス、減ったらマイナス（カジノで使う）
  kind text not null check (kind in ('study')), -- なぜ増えたか。今は「学習」だけ。カジノを作るときに種類を足す
  -- どの学習でもらったか。学習セットを消すと学習の記録も消えるが、もらったクレジットは消さない（set null）。
  -- unique なので、同じ学習で2回もらうことはできない
  session_id uuid unique references public.study_sessions (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists credit_transactions_user_id_idx on public.credit_transactions (user_id, created_at desc);

-- 2. 行単位セキュリティ。自分の通帳を「読む」ことだけできる。
--    書き込みの権限はブラウザに渡さない（渡すと「+100万」と自分で書けてしまう）。書くのは下の関数だけ
alter table public.credit_transactions enable row level security;

drop policy if exists "owner can read credit_transactions" on public.credit_transactions;
create policy "owner can read credit_transactions" on public.credit_transactions
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.credit_transactions from anon, authenticated;
grant select on public.credit_transactions to authenticated;

-- 3. 学習の記録も、ブラウザから直接は書けないようにする。
--    直接書けると「100問中100問正解」という記録を作って、クレジットをもらえてしまうため。
--    記録は下の record_study_session 関数を通したときだけ作られる
drop policy if exists "owner can create study_sessions" on public.study_sessions;
drop policy if exists "owner can create answer_logs" on public.answer_logs;
revoke insert on public.study_sessions from authenticated;
revoke insert on public.answer_logs from authenticated;

-- 4. 答えが「完全一致」かを DB で確かめる関数。画面の src/lib/judge.ts の exactJudge と同じ決まりにしてある：
--    正解の中の改行は空白1つにし、前後の空白（全角スペースなども含む。JavaScript の trim と同じ文字）を取って比べる
create or replace function public.answer_matches(p_expected text, p_given text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    regexp_replace(
      regexp_replace(p_expected, '\r?\n', ' ', 'g'),
      '^[\t\n\v\f\r    -     　﻿]+|[\t\n\v\f\r    -     　﻿]+$',
      '', 'g'
    )
    = regexp_replace(
      p_given,
      '^[\t\n\v\f\r    -     　﻿]+|[\t\n\v\f\r    -     　﻿]+$',
      '', 'g'
    )
$$;

revoke execute on function public.answer_matches (text, text) from public, anon, authenticated;

-- 5. 学習が終わったときに、記録とクレジットを1回の処理でまとめて保存する関数（前の版を作り直す）。
--    返すもの：{"session_id": "…", "credits": 1950}
--
--    クレジットの決まり（src/lib/credits.ts と同じ）：
--      1周目の1問ごとに、
--        DB で確かめても完全一致の正解      → 100
--        画面では正解（「正解にする」など）  → 50（自己申告なので半分）
--        不正解                             → 0
--      その合計 ×（0.5 ＋ 1周目の正答率）を四捨五入したもの。全問正解で1.5倍、半分正解で1倍になる
--
--    security definer：この関数は「作った人（管理者）」の権限で動く。
--    ブラウザには表へ直接書く権限を渡していないので、そのかわりに中で「本人のセットか」などを自分で確かめる
drop function if exists public.record_study_session (uuid, text, text, timestamptz, jsonb);

create function public.record_study_session(
  p_set_id uuid,
  p_mode text,
  p_direction text,
  p_started_at timestamptz,
  p_attempts jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  new_id uuid;
  correct_count integer;
  total_count integer;
  distinct_count integer;
  base_credits integer;
  earned integer;
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

  -- 1周目は1枚につき1回だけ（同じカードの1周目を何回も送って、クレジットを増やせないように）
  select count(*), count(distinct a.elem ->> 'card_id')
  into total_count, distinct_count
  from jsonb_array_elements(p_attempts) as a (elem)
  where (a.elem ->> 'round')::integer = 1;
  if total_count = 0 then
    raise exception '1周目の答えがありません' using errcode = '22023';
  end if;
  if total_count <> distinct_count then
    raise exception '1周目に同じカードの答えが2回あります' using errcode = '22023';
  end if;

  -- 1周目の点数（画面と同じく「正解にする」も正解に数える）と、クレジットのもと
  select
    count(*) filter (where r.claimed),
    coalesce(sum(case when r.claimed and r.verified then 100 when r.claimed then 50 else 0 end), 0)
  into correct_count, base_credits
  from (
    select
      coalesce((a.elem ->> 'judged_correct')::boolean, false)
        or coalesce((a.elem ->> 'overridden')::boolean, false) as claimed,
      -- 「完全一致の正解」と認めるのは、画面でも正解と判定され、「正解にする」を使っておらず、DB で比べても一致したとき
      coalesce((a.elem ->> 'judged_correct')::boolean, false)
        and not coalesce((a.elem ->> 'overridden')::boolean, false)
        and public.answer_matches(case when p_direction = 'reverse' then c.question else c.answer end, a.elem ->> 'given')
        as verified
    from jsonb_array_elements(p_attempts) as a (elem)
    join public.cards c on c.id = (a.elem ->> 'card_id')::uuid
    where (a.elem ->> 'round')::integer = 1
  ) as r;

  -- 合計 ×（0.5 ＋ 正答率）＝ 合計 ×（問題数 ＋ 2×正解数）÷（2×問題数）。小数で計算してから四捨五入する
  earned := round(base_credits::numeric * (total_count + 2 * correct_count) / (2 * total_count))::integer;

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

  if earned > 0 then
    insert into public.credit_transactions (user_id, amount, kind, session_id)
    values (uid, earned, 'study', new_id);
  end if;

  return jsonb_build_object('session_id', new_id, 'credits', earned);
end;
$$;

revoke execute on function public.record_study_session (uuid, text, text, timestamptz, jsonb) from public, anon;
grant execute on function public.record_study_session (uuid, text, text, timestamptz, jsonb) to authenticated;

-- 6. 自分の残高（通帳の合計）。security invoker なので、行単位セキュリティで自分の行だけが足される
create or replace function public.credit_balance()
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(amount), 0)::bigint from public.credit_transactions where user_id = (select auth.uid())
$$;

revoke execute on function public.credit_balance () from public, anon;
grant execute on function public.credit_balance () to authenticated;
