import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { createSupabaseAuth } from './lib/auth'
import { createSupabaseScratchNoteRepository } from './lib/scratchNoteRepository'
import { createSupabaseStudySetRepository } from './lib/studySetRepository'
import { supabase } from './lib/supabaseClient'
import './styles.css'

// 本番では Supabase 版のリポジトリとログイン窓口を使う（テストではメモリ版を渡す）。
// ログインすると supabase がその人の「通行証」を自動で付けて通信するので、リポジトリ側は何も変えなくてよい
const repository = supabase ? createSupabaseStudySetRepository(supabase) : null
const auth = supabase ? createSupabaseAuth(supabase) : null
const notes = supabase ? createSupabaseScratchNoteRepository(supabase) : null

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App repository={repository} auth={auth} notes={notes} />
  </StrictMode>,
)
