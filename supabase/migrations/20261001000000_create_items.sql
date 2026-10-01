-- 第1週：「覚えたいこと」を保存する items テーブル
-- Supabase の SQL Editor に貼り付けて実行する（あとで Supabase CLI のマイグレーションとしても使える）

create table public.items (
  id uuid primary key default gen_random_uuid(),
  term text not null check (char_length(btrim(term)) between 1 and 200),      -- 用語（問題の答えになるもの）
  note text check (note is null or char_length(note) <= 2000),               -- 説明
  subject text not null default '' check (char_length(subject) <= 50),       -- 科目（未分類は空文字）
  source text check (source is null or char_length(source) <= 200),         -- 出会った場所
  created_at timestamptz not null default now()
);

-- 同じ科目に同じ用語を二重に登録しない
create unique index items_subject_term_key on public.items (subject, term);

-- 一覧は新しい順に読むので、その順の索引を作っておく
create index items_created_at_idx on public.items (created_at desc);

-- 行単位セキュリティ（RLS）を有効にする。ポリシーで許可した操作以外はすべて拒否される
alter table public.items enable row level security;

-- 第1〜4週はログインがないため、ブラウザ（anon ロール）に「読む」と「追加する」だけを許す。
-- 更新・削除のポリシーは作らない ＝ 公開URLを知った第三者でも消したり書き換えたりはできない。
-- 第5週にログインを入れたら、user_id 列を足して「自分の行だけ」に絞る。
create policy "week1: anyone can read items"
  on public.items for select to anon using (true);

create policy "week1: anyone can add items"
  on public.items for insert to anon with check (true);

-- 2026年5月30日以降に作った Supabase プロジェクトでは、テーブルは自動では Data API（supabase-js）に公開されない。
-- 明示的に権限を与える（RLS と組み合わさって、実際にできるのは上のポリシーで許可した操作だけ）
grant select, insert on public.items to anon;
