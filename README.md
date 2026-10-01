# 覚えたいこと（学習アプリ・仮称）

勉強中に出会った「覚えたいこと」をその場で保存し、それを答えにした問題を自分で作って覚える Web アプリ。
授業「ソフトウェアクリエイション1」の制作物。

- 公開URL：（Vercel で公開したら書く）
- 技術：React + Vite + TypeScript / Supabase / Vercel

## 今できること（第1週）

- 用語・科目・説明・出会った場所を入力して保存する（用語だけでも保存できる）
- 保存したものを新しい順に一覧表示する。再読み込みしても消えない
- 同じ科目に同じ用語は二重に保存しない
- 前回保存した科目を、次の入力の初期値にする

## 初めて公開するまでの手順

### 1. Supabase（データの保存先）

1. https://supabase.com にサインアップし、New project でプロジェクトを作る（Region は Tokyo 推奨）
2. 左メニューの SQL Editor を開き、`supabase/migrations/20261001000000_create_items.sql` の中身を貼り付けて Run
3. 画面上部の Connect（または Project Settings → API Keys）で次の2つを控える
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
  main.tsx                 起動。Supabase 版のリポジトリを作って App に渡す
  App.tsx                  画面全体。一覧の読み込みと保存処理
  components/
    ItemForm.tsx           入力フォーム
    ItemList.tsx           一覧
  lib/
    items.ts               型と、入力の検証・整形（純粋な関数）
    itemRepository.ts      保存先とのやり取り（Supabase 版とテスト用のメモリ版）
    supabaseClient.ts      Supabase への接続
    database.types.ts      DB の型（Supabase CLI で自動生成したものに置き換える）
    lastSubject.ts         前回の科目を覚える
  items.test.ts / App.test.tsx   テスト
supabase/migrations/       DB の変更履歴（SQL）
AGENTS.md                  AI エージェント向けのルール
```
