-- ログインと編集のための DB 変更。
-- これまで：ログインなしで、誰でも「読む・作る」ができ、「変える・消す」は誰にもできなかった。
-- これから：ログインした人だけが使え、自分のセットだけを「読む・作る・変える・消す」ことができる。

-- 1. 学習セットに「持ち主」の列を足す。
--    auth.users は Supabase が管理するユーザーの表。default auth.uid() で、作った人が自動で持ち主になる。
--    すでにあるセットは持ち主が空（null）になり、誰からも見えなくなる。
--    自分のものにするには、アカウントを作ったあとに README の SQL を1回実行する。
alter table public.study_sets
  add column user_id uuid references auth.users (id) on delete cascade default auth.uid();

create index study_sets_user_id_idx on public.study_sets (user_id);

-- 2. ログインなし（anon）に許していたことを全部取り消す
drop policy "anyone can read study_sets" on public.study_sets;
drop policy "anyone can create study_sets" on public.study_sets;
drop policy "anyone can read cards" on public.cards;
drop policy "anyone can create cards" on public.cards;
revoke all on public.study_sets from anon;
revoke all on public.cards from anon;
revoke execute on function public.create_study_set (text, text, jsonb) from anon;

-- 3. ログインした人（authenticated）は、自分のセットだけを扱える。
--    (select auth.uid()) と括弧で包むのは、行ごとに計算せず1回で済ませるため（Supabase 推奨の書き方）
create policy "owner can read study_sets" on public.study_sets
  for select to authenticated using (user_id = (select auth.uid()));
create policy "owner can create study_sets" on public.study_sets
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "owner can update study_sets" on public.study_sets
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "owner can delete study_sets" on public.study_sets
  for delete to authenticated using (user_id = (select auth.uid()));

-- カードには持ち主の列がないので、「そのカードが入っているセットの持ち主が自分か」で判断する
create policy "owner can read cards" on public.cards
  for select to authenticated
  using (exists (select 1 from public.study_sets s where s.id = set_id and s.user_id = (select auth.uid())));
create policy "owner can create cards" on public.cards
  for insert to authenticated
  with check (exists (select 1 from public.study_sets s where s.id = set_id and s.user_id = (select auth.uid())));
create policy "owner can update cards" on public.cards
  for update to authenticated
  using (exists (select 1 from public.study_sets s where s.id = set_id and s.user_id = (select auth.uid())))
  with check (exists (select 1 from public.study_sets s where s.id = set_id and s.user_id = (select auth.uid())));
create policy "owner can delete cards" on public.cards
  for delete to authenticated
  using (exists (select 1 from public.study_sets s where s.id = set_id and s.user_id = (select auth.uid())));

grant select, insert, update, delete on public.study_sets to authenticated;
grant select, insert, update, delete on public.cards to authenticated;
grant execute on function public.create_study_set (text, text, jsonb) to authenticated;

-- 4. 並べ替えのための準備。
--    「同じセットで同じ順番は1つだけ」という決まりは、1行ずつ確かめると入れ替えの途中で必ず引っかかる
--    （1番と2番を入れ替えるとき、一瞬だけ「1番が2枚」になる）。
--    deferrable initially deferred にすると、確かめるのを処理の最後まで待ってくれる。
alter table public.cards drop constraint cards_set_id_position_key;
alter table public.cards
  add constraint cards_set_id_position_key unique (set_id, position) deferrable initially deferred;

-- 5. セットを編集する関数。タイトル・説明と、カード全部（並び順どおり）を受け取る。
--    カードは id があれば「書き換え」、id がなければ「新しく追加」、送られてこなかったものは「削除」。
--    全部まとめて削除→追加し直さないのは、カードの id を変えないため
--    （あとで「間違えたカード」の記録をカードの id にひもづけるので、id が変わると記録が迷子になる）。
create function public.update_study_set(p_id uuid, p_title text, p_description text, p_cards jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  kept_ids uuid[];
  owned_count integer;
begin
  if p_cards is null or jsonb_typeof(p_cards) <> 'array' or jsonb_array_length(p_cards) = 0 then
    raise exception 'カードを1枚以上入力してください' using errcode = '22023';
  end if;
  if jsonb_array_length(p_cards) > 500 then
    raise exception 'カードは500枚までです' using errcode = '22023';
  end if;

  -- RLS により、自分のセットでなければ1行も更新されない＝「見つからない」
  update public.study_sets set title = p_title, description = p_description where id = p_id;
  if not found then
    raise exception '学習セットが見つかりません' using errcode = 'P0002';
  end if;

  -- 残すカード（id が付いているもの）
  select coalesce(array_agg((c.elem ->> 'id')::uuid), '{}')
  into kept_ids
  from jsonb_array_elements(p_cards) as c (elem)
  where c.elem ->> 'id' is not null;

  -- 送られてきた id が、本当にこのセットのカードかを確かめる（ほかのセットのカードを混ぜられないように）
  select count(*) into owned_count from public.cards where set_id = p_id and id = any (kept_ids);
  if owned_count <> cardinality(kept_ids) then
    raise exception 'このセットにないカードが含まれています' using errcode = '22023';
  end if;

  delete from public.cards where set_id = p_id and not (id = any (kept_ids));

  update public.cards as card
  set position = (c.ord - 1)::integer, question = c.elem ->> 'question', answer = c.elem ->> 'answer'
  from jsonb_array_elements(p_cards) with ordinality as c (elem, ord)
  where card.set_id = p_id and card.id = (c.elem ->> 'id')::uuid;

  insert into public.cards (set_id, position, question, answer)
  select p_id, (c.ord - 1)::integer, c.elem ->> 'question', c.elem ->> 'answer'
  from jsonb_array_elements(p_cards) with ordinality as c (elem, ord)
  where c.elem ->> 'id' is null;
end;
$$;

revoke execute on function public.update_study_set (uuid, text, text, jsonb) from public;
grant execute on function public.update_study_set (uuid, text, text, jsonb) to authenticated;
