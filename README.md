# 学習アプリ（仮称）

問題と答えの組（カード）をまとめた「学習セット」を作り、いろいろな形式で取り組んで覚える Web アプリ。科目は問わない。
授業「ソフトウェアクリエイション1」の制作物。

- 公開URL：（Vercel で公開したら書く）
- 技術：React + Vite + TypeScript / Supabase / Vercel

## 今できること（第1週）

- 学習セットを作る：タイトル・説明と、問題と答えの組を何枚でも入力できる
  - 最後のカードの「答え」で Tab を押すと次のカードが増える。Ctrl+Enter で作成
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
   - すでに1つ目を実行済みなら、2つ目だけでよい
3. Connect（または Project Settings → API Keys）で次の2つを控える
   - Project URL（`https://xxxx.supabase.co`）
   - Publishable key（`sb_publishable_` で始まる）。Secret key は使わない

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
    NewSetPage.tsx            学習セットを作る
    SetPage.tsx               学習セットの中身・学習形式の選択
    FlashcardsPage.tsx        カードで学ぶ
    LoadStatus.tsx            読み込み中・失敗・見つからないの表示
  lib/
    studySet.ts               型と、作成フォームの検証・整形（純粋な関数）
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
