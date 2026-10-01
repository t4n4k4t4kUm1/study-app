import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { createSupabaseStudySetRepository } from './lib/studySetRepository'
import { supabase } from './lib/supabaseClient'
import './styles.css'

// 本番では Supabase 版のリポジトリを使う（テストではメモリ版を渡す）
const repository = supabase ? createSupabaseStudySetRepository(supabase) : null

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App repository={repository} />
  </StrictMode>,
)
