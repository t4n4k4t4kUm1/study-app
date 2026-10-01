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
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          created_at?: string
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
    }
    Views: { [_ in never]: never }
    Functions: {
      create_study_set: {
        Args: { p_title: string; p_description: string | null; p_cards: Json }
        Returns: string
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
