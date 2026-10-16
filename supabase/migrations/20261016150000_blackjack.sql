-- カジノのブラックジャック。
-- 山札・ディーラーの伏せカード・勝ち負け・払い戻しは、すべてこのファイルの関数の中で決める。
-- 画面は「始める（賭け金）」「ヒット」「スタンド」「ダブルダウン」を伝えるだけで、伏せカードや山札は受け取らない。
-- 決まりは src/lib/blackjack.ts と同じにしてある（6デッキ・ブラックジャックは 3:2・ディーラーはソフト17で止まる）。
-- 何度実行しても壊れないように、if not exists / if exists / or replace で書いている。
-- 先に 20261016120000_credits.sql（クレジット）を実行しておくこと。

-- 1. 勝負の表。1行が1回の勝負。カードは 0〜51 の番号（13枚ごとに ♠ ♥ ♦ ♣）
create table if not exists public.blackjack_rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  bet integer not null check (bet >= 100 and bet % 100 = 0), -- 最初に賭けた額（100 単位）
  doubled boolean not null default false, -- ダブルダウンしたか（したら賭けは2倍）
  deck smallint[] not null, -- 切り直した山札 312 枚。画面には決して渡さない
  next_index integer not null default 1, -- 次に配るカードの位置（1 から）
  player smallint[] not null default '{}',
  dealer smallint[] not null default '{}',
  status text not null default 'playing' check (status in ('playing', 'finished')),
  outcome text check (outcome in ('blackjack', 'win', 'push', 'lose')),
  payout integer not null default 0 check (payout >= 0), -- 戻ってくる額（賭け金を含む）
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

-- 途中の勝負は1人1つまで（2つ同時に始めて、片方だけ続ける、といったことをさせない）
create unique index if not exists blackjack_rounds_one_playing_idx
  on public.blackjack_rounds (user_id) where status = 'playing';
create index if not exists blackjack_rounds_user_id_idx on public.blackjack_rounds (user_id, created_at desc);

-- 2. 行単位セキュリティを有効にして、ブラウザには読む権限も渡さない（読めると山札と伏せカードが見えてしまう）。
--    見てよい部分だけを、下の関数が返す
alter table public.blackjack_rounds enable row level security;
revoke all on public.blackjack_rounds from anon, authenticated;

-- 3. クレジットの通帳に、ブラックジャックの「賭けた（マイナス）」「戻ってきた（プラス）」を書けるようにする
alter table public.credit_transactions drop constraint if exists credit_transactions_kind_check;
alter table public.credit_transactions
  add constraint credit_transactions_kind_check check (kind in ('study', 'blackjack_bet', 'blackjack_payout'));
alter table public.credit_transactions
  add column if not exists blackjack_round_id uuid references public.blackjack_rounds (id) on delete set null;

-- 4. 中で使う小さな関数（ブラウザからは呼べない）

-- 手の点数。J・Q・K は 10。A はまず 1 と数え、11 にしても 21 を超えないなら 11
create or replace function public._bj_total(p_cards smallint[])
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when bool_or(c % 13 = 0) and sum(least(c % 13 + 1, 10)) + 10 <= 21 then sum(least(c % 13 + 1, 10))::integer + 10
    else coalesce(sum(least(c % 13 + 1, 10)), 0)::integer
  end
  from unnest(p_cards) as c
$$;

create or replace function public._bj_is_blackjack(p_cards smallint[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_length(p_cards, 1), 0) = 2 and public._bj_total(p_cards) = 21
$$;

-- 画面に見せてよい形。勝負の途中は、ディーラーの2枚目を null（伏せたまま）にする。山札は入れない
create or replace function public._bj_view(r public.blackjack_rounds)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', r.id,
    'bet', r.bet,
    'doubled', r.doubled,
    'status', r.status,
    'player', to_jsonb(r.player),
    'dealer', case when r.status = 'playing' then jsonb_build_array(r.dealer[1], null) else to_jsonb(r.dealer) end,
    'outcome', r.outcome,
    'payout', r.payout
  )
$$;

-- 残高（通帳の合計）
create or replace function public._bj_balance(p_user_id uuid)
returns bigint
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(amount), 0)::bigint from public.credit_transactions where user_id = p_user_id
$$;

-- 決着をつける。p_dealer_plays が true なら、ディーラーが 17 以上になるまで引いてから比べる。
-- 戻ってくる額があれば通帳に書く
create or replace function public._bj_settle(p_round_id uuid, p_dealer_plays boolean)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  r public.blackjack_rounds;
  stake integer;
  player_total integer;
  dealer_total integer;
  result text;
begin
  select * into r from public.blackjack_rounds where id = p_round_id for update;

  if p_dealer_plays then
    while public._bj_total(r.dealer) < 17 loop
      r.dealer := r.dealer || r.deck[r.next_index];
      r.next_index := r.next_index + 1;
    end loop;
  end if;

  stake := r.bet * case when r.doubled then 2 else 1 end;
  player_total := public._bj_total(r.player);
  dealer_total := public._bj_total(r.dealer);

  if public._bj_is_blackjack(r.player) then
    result := case when public._bj_is_blackjack(r.dealer) then 'push' else 'blackjack' end;
  elsif public._bj_is_blackjack(r.dealer) then
    result := 'lose';
  elsif player_total > 21 then
    result := 'lose';
  elsif dealer_total > 21 or player_total > dealer_total then
    result := 'win';
  elsif player_total = dealer_total then
    result := 'push';
  else
    result := 'lose';
  end if;

  r.status := 'finished';
  r.outcome := result;
  r.payout := case result when 'blackjack' then stake * 5 / 2 when 'win' then stake * 2 when 'push' then stake else 0 end;
  r.finished_at := now();

  update public.blackjack_rounds
  set dealer = r.dealer, next_index = r.next_index, status = r.status, outcome = r.outcome,
      payout = r.payout, finished_at = r.finished_at
  where id = r.id;

  if r.payout > 0 then
    insert into public.credit_transactions (user_id, amount, kind, blackjack_round_id)
    values (r.user_id, r.payout, 'blackjack_payout', r.id);
  end if;

  return public._bj_view(r);
end;
$$;

-- 勝負を始める（山札を外から渡す版）。テストでは決まった山札を渡して、結果を確かめる
create or replace function public._bj_deal(p_user_id uuid, p_bet integer, p_deck smallint[])
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  r public.blackjack_rounds;
begin
  if p_bet is null or p_bet < 100 or p_bet % 100 <> 0 then
    raise exception '賭け金は 100 以上・100 単位にしてください' using errcode = '22023';
  end if;
  -- 同じ人の「賭ける」が同時に2つ走って、残高を2重に使わないように、その人の分だけ順番待ちにする
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  if exists (select 1 from public.blackjack_rounds where user_id = p_user_id and status = 'playing') then
    raise exception '終わっていない勝負があります' using errcode = '55000';
  end if;
  if public._bj_balance(p_user_id) < p_bet then
    raise exception 'クレジットが足りません' using errcode = '22023';
  end if;

  -- プレイヤー → ディーラー → プレイヤー → ディーラー の順に配る
  insert into public.blackjack_rounds (user_id, bet, deck, next_index, player, dealer)
  values (p_user_id, p_bet, p_deck, 5, array[p_deck[1], p_deck[3]], array[p_deck[2], p_deck[4]])
  returning * into r;

  insert into public.credit_transactions (user_id, amount, kind, blackjack_round_id)
  values (p_user_id, -p_bet, 'blackjack_bet', r.id);

  -- どちらかがブラックジャックなら、その場で決着（ディーラーは引かない）
  if public._bj_is_blackjack(r.player) or public._bj_is_blackjack(r.dealer) then
    return public._bj_settle(r.id, false);
  end if;
  return public._bj_view(r);
end;
$$;

-- 途中の自分の勝負を、書き換えるために鍵をかけて取り出す。無ければエラー
create or replace function public._bj_lock_playing(p_round_id uuid)
returns public.blackjack_rounds
language plpgsql
set search_path = ''
as $$
declare
  r public.blackjack_rounds;
begin
  select * into r from public.blackjack_rounds
  where id = p_round_id and user_id = (select auth.uid()) and status = 'playing'
  for update;
  if not found then
    raise exception '続けられる勝負が見つかりません' using errcode = 'P0002';
  end if;
  return r;
end;
$$;

revoke execute on function public._bj_total (smallint[]) from public, anon, authenticated;
revoke execute on function public._bj_is_blackjack (smallint[]) from public, anon, authenticated;
revoke execute on function public._bj_view (public.blackjack_rounds) from public, anon, authenticated;
revoke execute on function public._bj_balance (uuid) from public, anon, authenticated;
revoke execute on function public._bj_settle (uuid, boolean) from public, anon, authenticated;
revoke execute on function public._bj_deal (uuid, integer, smallint[]) from public, anon, authenticated;
revoke execute on function public._bj_lock_playing (uuid) from public, anon, authenticated;

-- 5. ブラウザから呼ぶ関数。どれも security definer（管理者の権限で動き、中で本人かを確かめる）で、見てよい形（_bj_view）だけを返す

-- 途中の勝負があれば返す（ページを開き直したときに続きから）。無ければ null
create or replace function public.blackjack_state()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public._bj_view(r)
  from public.blackjack_rounds r
  where r.user_id = (select auth.uid()) and r.status = 'playing'
$$;

-- 賭けて始める。山札は 6デッキを毎回切り直す
create or replace function public.blackjack_start(p_bet integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  shoe smallint[];
begin
  if uid is null then
    raise exception 'ログインしていません' using errcode = '42501';
  end if;
  select array_agg((g % 52)::smallint order by random()) into shoe from generate_series(0, 311) as g;
  return public._bj_deal(uid, p_bet, shoe);
end;
$$;

-- もう1枚引く。21 を超えたら負け、ちょうど 21 なら自動で止まる
create or replace function public.blackjack_hit(p_round_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.blackjack_rounds := public._bj_lock_playing(p_round_id);
  total integer;
begin
  update public.blackjack_rounds
  set player = player || deck[next_index], next_index = next_index + 1
  where id = r.id
  returning * into r;

  total := public._bj_total(r.player);
  if total > 21 then
    return public._bj_settle(r.id, false);
  elsif total = 21 then
    return public._bj_settle(r.id, true);
  end if;
  return public._bj_view(r);
end;
$$;

-- 止める。ディーラーが引いて決着
create or replace function public.blackjack_stand(p_round_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.blackjack_rounds := public._bj_lock_playing(p_round_id);
begin
  return public._bj_settle(r.id, true);
end;
$$;

-- ダブルダウン：最初の2枚のときだけ。同じ額をもう一度賭け、1枚だけ引いて自動で止まる
create or replace function public.blackjack_double(p_round_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.blackjack_rounds := public._bj_lock_playing(p_round_id);
begin
  if array_length(r.player, 1) <> 2 then
    raise exception 'ダブルダウンは最初の2枚のときだけできます' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(r.user_id::text, 0));
  if public._bj_balance(r.user_id) < r.bet then
    raise exception 'クレジットが足りません' using errcode = '22023';
  end if;

  insert into public.credit_transactions (user_id, amount, kind, blackjack_round_id)
  values (r.user_id, -r.bet, 'blackjack_bet', r.id);

  update public.blackjack_rounds
  set doubled = true, player = player || deck[next_index], next_index = next_index + 1
  where id = r.id
  returning * into r;

  return public._bj_settle(r.id, public._bj_total(r.player) <= 21);
end;
$$;

revoke execute on function public.blackjack_state () from public, anon;
revoke execute on function public.blackjack_start (integer) from public, anon;
revoke execute on function public.blackjack_hit (uuid) from public, anon;
revoke execute on function public.blackjack_stand (uuid) from public, anon;
revoke execute on function public.blackjack_double (uuid) from public, anon;
grant execute on function public.blackjack_state () to authenticated;
grant execute on function public.blackjack_start (integer) to authenticated;
grant execute on function public.blackjack_hit (uuid) to authenticated;
grant execute on function public.blackjack_stand (uuid) to authenticated;
grant execute on function public.blackjack_double (uuid) to authenticated;
