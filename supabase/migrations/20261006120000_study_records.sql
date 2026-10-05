-- 学習の記録を残すための DB 変更。
-- 「1回の学習（セッション）」と、その中の「1問ごとの答え（解答ログ）」の2つの表に分ける。
-- 何度実行しても壊れないように、if not exists / if exists / or replace で書いている。

-- 1. 1回の学習。いつ・どのセットを・どのモードで解いて、1周目に何問正解したか
create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  set_id uuid not null references public.study_sets (id) on delete cascade,
  mode text not null check (mode in ('normal', 'test', 'thorough')),
  direction text not null check (direction in ('forward', 'reverse')), -- forward：問題を見て答えを打つ
  started_at timestamptz not null,
  finished_at timestamptz not null default now(),
  first_round_correct integer not null check (first_round_correct >= 0),
  first_round_total integer not null check (first_round_total >= first_round_correct)
);

create index if not exists study_sessions_set_id_idx on public.study_sessions (set_id, finished_at desc);
create index if not exists study_sessions_user_id_idx on public.study_sessions (user_id);

-- 2. 1問ごとの答え。機械の判定（judged_correct）と、「正解にする」を押したか（overridden）を分けて残す。
--    分けておくと、あとで「どんな打ち間違いを人が正解にしたか」を見て、自動判定を作る材料にできる
create table if not exists public.answer_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.study_sessions (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  round integer not null check (round >= 1), -- 何周目の答えか
  given text not null check (char_length(given) <= 1000), -- 打った答え
  judged_correct boolean not null,
  overridden boolean not null default false,
  answered_at timestamptz not null default now()
);

create index if not exists answer_logs_session_id_idx on public.answer_logs (session_id);
create index if not exists answer_logs_card_id_idx on public.answer_logs (card_id);

-- 3. 行単位セキュリティ。自分の記録だけを読める・作れる（変更・削除はしない）
alter table public.study_sessions enable row level security;
alter table public.answer_logs enable row level security;

drop policy if exists "owner can read study_sessions" on public.study_sessions;
create policy "owner can read study_sessions" on public.study_sessions
  for select to authenticated using (user_id = (select auth.uid()));

-- 作るときは「自分の記録」であり、かつ「自分のセット」の記録であること
drop policy if exists "owner can create study_sessions" on public.study_sessions;
create policy "owner can create study_sessions" on public.study_sessions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.study_sets s where s.id = set_id and s.user_id = (select auth.uid()))
  );

drop policy if exists "owner can read answer_logs" on public.answer_logs;
create policy "owner can read answer_logs" on public.answer_logs
  for select to authenticated
  using (exists (select 1 from public.study_sessions ss where ss.id = session_id and ss.user_id = (select auth.uid())));

-- 答えのカードは、そのセッションで解いたセットのカードでなければならない
drop policy if exists "owner can create answer_logs" on public.answer_logs;
create policy "owner can create answer_logs" on public.answer_logs
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.study_sessions ss
      join public.cards c on c.set_id = ss.set_id
      where ss.id = session_id and c.id = card_id and ss.user_id = (select auth.uid())
    )
  );

revoke all on public.study_sessions from anon;
revoke all on public.answer_logs from anon;
grant select, insert on public.study_sessions to authenticated;
grant select, insert on public.answer_logs to authenticated;

-- 4. 学習が終わったときに、セッションと全部の答えを1回の処理でまとめて保存する関数。
--    1周目の点数は、送られてきた答えから DB 側で数える（画面から送られた点数をそのまま信じない）
--    p_attempts の例：[{"card_id":"…","round":1,"given":"食べる","judged_correct":true,"overridden":false,"answered_at":"2026-10-06T05:00:00Z"}, …]
create or replace function public.record_study_session(
  p_set_id uuid,
  p_mode text,
  p_direction text,
  p_started_at timestamptz,
  p_attempts jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_id uuid;
  correct_count integer;
  total_count integer;
begin
  if p_attempts is null or jsonb_typeof(p_attempts) <> 'array' or jsonb_array_length(p_attempts) = 0 then
    raise exception '答えが1つもありません' using errcode = '22023';
  end if;
  if jsonb_array_length(p_attempts) > 5000 then
    raise exception '答えが多すぎます' using errcode = '22023';
  end if;

  select
    count(*) filter (where (a.elem ->> 'judged_correct')::boolean or coalesce((a.elem ->> 'overridden')::boolean, false)),
    count(*)
  into correct_count, total_count
  from jsonb_array_elements(p_attempts) as a (elem)
  where (a.elem ->> 'round')::integer = 1;

  insert into public.study_sessions (set_id, mode, direction, started_at, first_round_correct, first_round_total)
  values (p_set_id, p_mode, p_direction, p_started_at, correct_count, total_count)
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

revoke execute on function public.record_study_session (uuid, text, text, timestamptz, jsonb) from public;
grant execute on function public.record_study_session (uuid, text, text, timestamptz, jsonb) to authenticated;
