# 学習アプリ（仮称）

問題と答えの組（カード）をまとめた「学習セット」を作り、いろいろな形式で取り組んで覚える Web アプリ。科目は問わない。
授業「ソフトウェアクリエイション1」の制作物。

- 公開URL：（Vercel で公開したら書く）
- 技術：React + Vite + TypeScript / Supabase / Vercel

## 今できること

- ログイン・新規登録・ログアウト（メールアドレスとパスワード）。学習セットは作った本人だけが見られる
- 学習セットを作る：タイトル・説明と、問題と答えの組を何枚でも入力できる
  - 最後のカードの「答え」で Tab を押すと次のカードが増える。Ctrl+Enter で保存
- 学習セットを編集する：タイトル・説明の変更、カードの追加・削除・書き換え
  - 並べ替えは ⠿ をつかんでドラッグするか、↑↓ ボタン
- 学習セットを削除する（確認つき。カードも一緒に消える）
- 学習セットの一覧と中身を見る
- カードで学ぶ：クリックか Space でめくる、← → で前後に移動、シャッフル、答えを先に出す

## これから（SC1 の必須）

- 入力：問題を見てキーボードで答えを入力する
- 4択：4つの選択肢から答えを選ぶ
- マッチ：いくつかの問題と答えを並べ、正しい組み合わせを選ぶ

## 初めて公開するまでの手順

### 1. Supabase（データの保存先）

1. https://supabase.com でプロジェクトを作る（Region は Tokyo 推奨）
2. SQL Editor で `supabase/migrations/` の SQL を**ファイル名の順に**貼り付けて Run する
   - `20261001000000_create_items.sql`（最初の版。次のファイルで消える）
   - `20261001120000_study_sets_and_cards.sql`
   - `20261005120000_owners_and_editing.sql`（ログインと編集）
   - 実行済みのファイルは飛ばして、まだのものだけを順に実行する
3. Connect（または Project Settings → API Keys）で次の2つを控える
   - Project URL（`https://xxxx.supabase.co`）
   - Publishable key（`sb_publishable_` で始まる）。Secret key は使わない

### 1-2. ログインの設定（Supabase）

1. Authentication の Sign In / Providers（Auth Providers）ページで Email を開き、**Confirm email をオフ**にする（画面の名前は変わることがある）
   - Supabase 標準のメール送信は、プロジェクトのメンバー以外には送れず、1時間に2通まで。
     オンのままだと、先生や友だちがアカウントを作れない
   - オフにすると、メールアドレスの持ち主かどうかは確かめずに登録できる（授業での利用なので許容）
2. アプリでアカウントを作る
3. ログイン導入前に作ったセットは持ち主が空なので、誰からも見えない。自分のものにするには、SQL Editor で1回だけ実行する

```sql
update public.study_sets
set user_id = (select id from auth.users where email = 'あなたのメールアドレス')
where user_id is null;
```

### 2. ローカルで動かす（任意）

```bash
npm install
cp .env.example .env.local   # Windows なら copy .env.example .env.local
# .env.local に 1-3 で控えた URL と publishable key を書く
npm run dev
```

### 3. GitHub と Vercel（公開）

1. このフォルダを GitHub のリポジトリに push する
2. https://vercel.com に GitHub アカウントでサインアップし、Add New → Project でそのリポジトリを Import
3. Environment Variables に `VITE_SUPABASE_URL` と `VITE_SUPABASE_PUBLISHABLE_KEY` を入れて Deploy
4. 以後は main に push するたびに自動で型チェック・ビルド・公開される

## よく使うコマンド

| コマンド         | 内容                                                    |
| ---------------- | ------------------------------------------------------- |
| `npm run dev`    | 開発用サーバーを起動                                    |
| `npm run check`  | 型チェック・lint・テストをまとめて実行（push 前に必ず） |
| `npm run test`   | テストだけ実行                                          |
| `npm run build`  | 公開用にビルド（Vercel もこれを実行する）               |
| `npm run format` | Prettier でコードを整形                                 |

## フォルダ構成

```
src/
  main.tsx                    起動。Supabase 版のリポジトリを作って App に渡す
  App.tsx                     URL の # を見てページを切り替える
  pages/
    HomePage.tsx              学習セットの一覧
    LoginPage.tsx             ログイン・新規登録
    NewSetPage.tsx            学習セットを作る
    EditSetPage.tsx           学習セットを編集する
    SetPage.tsx               学習セットの中身・学習形式の選択・削除
    FlashcardsPage.tsx        カードで学ぶ
    LoadStatus.tsx            読み込み中・失敗・見つからないの表示
  components/
    SetEditor.tsx             入力フォーム（作る・編集で共通）。ドラッグと ↑↓ で並べ替え
  lib/
    auth.ts                   ログインの窓口（Supabase 版とテスト用）
    useSession.ts             ログインしているかを画面で使うフック
    reorder.ts                並べ替えの計算（純粋な関数）
    studySet.ts               型と、作成・編集フォームの検証・整形（純粋な関数）
    deck.ts                   カード学習の状態と操作（純粋な関数）
    router.ts                 URL と画面の対応（純粋な関数）
    studySetRepository.ts     保存先とのやり取り（Supabase 版とテスト用のメモリ版）
    useHashRoute.ts           URL の変化で画面を描き直すフック
    useStudySet.ts            学習セットを1つ読み込むフック
    supabaseClient.ts         Supabase への接続
    database.types.ts         DB の型（Supabase CLI で自動生成したものに置き換える）
  *.test.ts(x)                テスト
supabase/migrations/          DB の変更履歴（SQL）
AGENTS.md                     AI エージェント向けのルール
```
