// Supabase への接続を1か所で作る。
// URL と publishable key は環境変数から読む（ローカルは .env.local、公開環境は Vercel の環境変数画面）。
// publishable key（sb_publishable_...）はブラウザに渡ってよい鍵で、データは DB 側の行単位セキュリティ（RLS）で守る。
// secret key（sb_secret_...）や service_role key は絶対にここ（画面側のコード）に置かない。
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

/** 環境変数が設定されていなければ null（画面に設定手順を出す） */
export const supabase: SupabaseClient<Database> | null =
  url && publishableKey ? createClient<Database>(url, publishableKey) : null
