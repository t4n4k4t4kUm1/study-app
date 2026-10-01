-- 中核を「学習セットを作り、いろいろな形式で取り組む」に変更したための DB 変更。
-- 第1週の最初の版で作った items テーブル（中身は空）をやめ、
-- 学習セット（study_sets）と、その中のカード（cards）の2つのテーブルにする。

drop table if exists public.items;

-- 学習セット：カードをまとめる単位（例：「線形代数 第3章」「韓国語 動詞」）
create table public.study_sets (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 100),
  description text check (description is null or char_length(description) <= 500),
  created_at timestamptz not null default now()
);

create index study_sets_created_at_idx on public.study_sets (created_at desc);

-- カード：問題と答えの1組。position はセット内の並び順（0 から）
create table public.cards (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.study_sets (id) on delete cascade,
  position integer not null check (position >= 0),
  question text not null check (char_length(btrim(question)) between 1 and 500),
  answer text not null check (char_length(btrim(answer)) between 1 and 500),
  created_at timestamptz not null default now(),
  -- 同じセットで同じ順番は1つだけ。この制約が (set_id, position) の索引も兼ねる
  unique (set_id, position)
);

-- 行単位セキュリティ（RLS）。ログインを入れるまでは「誰でも読める・追加できる」だけを許す。
-- 変更（update）と削除（delete）のポリシーは作らないので、どちらもできない。
alter table public.study_sets enable row level security;
alter table public.cards enable row level security;

create policy "anyone can read study_sets" on public.study_sets for select to anon using (true);
create policy "anyone can create study_sets" on public.study_sets for insert to anon with check (true);
create policy "anyone can read cards" on public.cards for select to anon using (true);
create policy "anyone can create cards" on public.cards for insert to anon with check (true);

-- 2026-05-30 以降に作った Supabase プロジェクトでは、テーブルに明示的に権限を与えないと API から見えない
grant select, insert on public.study_sets to anon;
grant select, insert on public.cards to anon;

-- セットとカードを「1回の処理（トランザクション）」でまとめて作る関数。
-- 画面から別々に insert すると、カードの保存だけ失敗したときに「カードのない空のセット」が残ってしまう。
-- 関数の中なら、途中で失敗すると全部が取り消される。
-- security invoker：呼び出した人（anon）の権限で動くので、上の RLS とGRANT がそのまま効く。
create function public.create_study_set(p_title text, p_description text, p_cards jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if p_cards is null or jsonb_typeof(p_cards) <> 'array' or jsonb_array_length(p_cards) = 0 then
    raise exception 'カードを1枚以上入力してください' using errcode = '22023';
  end if;
  if jsonb_array_length(p_cards) > 500 then
    raise exception 'カードは500枚までです' using errcode = '22023';
  end if;

  insert into public.study_sets (title, description)
  values (p_title, p_description)
  returning id into new_id;

  insert into public.cards (set_id, position, question, answer)
  select new_id, (c.ord - 1)::integer, c.elem ->> 'question', c.elem ->> 'answer'
  from jsonb_array_elements(p_cards) with ordinality as c (elem, ord);

  return new_id;
end;
$$;

-- 関数は既定で誰でも（PUBLIC）実行できるので、いったん取り消してから anon にだけ許す
revoke execute on function public.create_study_set (text, text, jsonb) from public;
grant execute on function public.create_study_set (text, text, jsonb) to anon;
