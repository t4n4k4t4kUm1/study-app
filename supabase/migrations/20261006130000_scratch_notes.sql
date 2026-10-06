-- 掃きだめメモ：思いついたことを何でも書いておく、1人1枚の大きなメモ帳。
-- 何度実行しても壊れないように、if not exists / if exists / or replace で書いている。

create table if not exists public.scratch_notes (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade, -- 1人1枚
  body text not null default '' check (char_length(body) <= 100000),
  updated_at timestamptz not null default now()
);

alter table public.scratch_notes enable row level security;

drop policy if exists "owner can read scratch_notes" on public.scratch_notes;
create policy "owner can read scratch_notes" on public.scratch_notes
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "owner can create scratch_notes" on public.scratch_notes;
create policy "owner can create scratch_notes" on public.scratch_notes
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "owner can update scratch_notes" on public.scratch_notes;
create policy "owner can update scratch_notes" on public.scratch_notes
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.scratch_notes from anon;
grant select, insert, update on public.scratch_notes to authenticated;

-- メモを保存する関数。
-- 2台の端末で同じメモを開いていると、片方の古い内容でもう片方の新しい内容を上書きしてしまう事故が起きる。
-- そこで「最後に読み込んだときの更新日時（p_base_updated_at）」を一緒に送ってもらい、
-- DB の更新日時と違っていたら（＝その間にほかの端末が保存していたら）保存せずにエラーにする。
-- 戻り値は新しい更新日時。次の保存のときに、これを p_base_updated_at として送る。
create or replace function public.save_scratch_note(p_body text, p_base_updated_at timestamptz)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_at timestamptz;
  saved_at timestamptz;
begin
  -- for update：読んでから書き終わるまで、ほかの保存を待たせる（同時に保存されても順番に処理される）
  select updated_at into current_at from public.scratch_notes where user_id = auth.uid() for update;

  if not found then
    -- はじめての保存
    insert into public.scratch_notes (user_id, body, updated_at)
    values (auth.uid(), p_body, clock_timestamp())
    returning updated_at into saved_at;
    return saved_at;
  end if;

  if p_base_updated_at is distinct from current_at then
    raise exception 'ほかの端末でメモが更新されています' using errcode = '40001';
  end if;

  update public.scratch_notes
  set body = p_body, updated_at = clock_timestamp()
  where user_id = auth.uid()
  returning updated_at into saved_at;
  return saved_at;
end;
$$;

revoke execute on function public.save_scratch_note (text, timestamptz) from public;
grant execute on function public.save_scratch_note (text, timestamptz) to authenticated;
