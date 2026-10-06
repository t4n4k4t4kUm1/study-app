// Supabase のテーブル定義に対応する型。supabase-js に渡すと、select の結果などに型が付く。
// いまは手書き。Supabase CLI を入れたら、次のコマンドで実際の DB から自動生成したものに置き換える：
//   npx supabase gen types typescript --project-id <プロジェクトID> > src/lib/database.types.ts
// （手書きのまま DB を変更すると、型と DB がずれて型チェックが意味をなさなくなるため）

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      study_sets: {
        Row: {
          id: string
          title: string
          description: string | null
          created_at: string
          user_id: string | null
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          created_at?: string
          user_id?: string | null
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          created_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      cards: {
        Row: {
          id: string
          set_id: string
          position: number
          question: string
          answer: string
          created_at: string
        }
        Insert: {
          id?: string
          set_id: string
          position: number
          question: string
          answer: string
          created_at?: string
        }
        Update: {
          id?: string
          set_id?: string
          position?: number
          question?: string
          answer?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'cards_set_id_fkey'
            columns: ['set_id']
            isOneToOne: false
            referencedRelation: 'study_sets'
            referencedColumns: ['id']
          },
        ]
      }
      study_sessions: {
        Row: {
          id: string
          user_id: string
          set_id: string
          mode: string
          direction: string
          started_at: string
          finished_at: string
          first_round_correct: number
          first_round_total: number
        }
        Insert: {
          id?: string
          user_id?: string
          set_id: string
          mode: string
          direction: string
          started_at: string
          finished_at?: string
          first_round_correct: number
          first_round_total: number
        }
        Update: Partial<Database['public']['Tables']['study_sessions']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'study_sessions_set_id_fkey'
            columns: ['set_id']
            isOneToOne: false
            referencedRelation: 'study_sets'
            referencedColumns: ['id']
          },
        ]
      }
      scratch_notes: {
        Row: { user_id: string; body: string; updated_at: string }
        Insert: { user_id?: string; body?: string; updated_at?: string }
        Update: { user_id?: string; body?: string; updated_at?: string }
        Relationships: []
      }
      answer_logs: {
        Row: {
          id: string
          session_id: string
          card_id: string
          round: number
          given: string
          judged_correct: boolean
          overridden: boolean
          answered_at: string
        }
        Insert: {
          id?: string
          session_id: string
          card_id: string
          round: number
          given: string
          judged_correct: boolean
          overridden?: boolean
          answered_at?: string
        }
        Update: Partial<Database['public']['Tables']['answer_logs']['Insert']>
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      create_study_set: {
        Args: { p_title: string; p_description: string | null; p_cards: Json }
        Returns: string
      }
      update_study_set: {
        Args: { p_id: string; p_title: string; p_description: string | null; p_cards: Json }
        Returns: undefined
      }
      save_scratch_note: {
        Args: { p_body: string; p_base_updated_at: string | null }
        Returns: string
      }
      record_study_session: {
        Args: { p_set_id: string; p_mode: string; p_direction: string; p_started_at: string; p_attempts: Json }
        Returns: string
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
