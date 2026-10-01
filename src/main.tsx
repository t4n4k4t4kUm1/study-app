import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { createSupabaseItemRepository } from './lib/itemRepository'
import { supabase } from './lib/supabaseClient'
import './styles.css'

const repository = supabase ? createSupabaseItemRepository(supabase) : null

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App repository={repository} />
  </StrictMode>,
)
