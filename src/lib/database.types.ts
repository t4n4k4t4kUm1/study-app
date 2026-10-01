// Supabase のテーブル定義に対応する型。
// Supabase のプロジェクトを作ったあとは、次のコマンドで実際の DB から自動生成した内容に置き換える：
//   npx supabase gen types typescript --project-id <プロジェクトID> > src/lib/database.types.ts
// （手書きのまま DB を変更すると、型と DB がずれて型チェックが意味をなさなくなるため）

export type Database = {
  public: {
    Tables: {
      items: {
        Row: {
          id: string
          term: string
          note: string | null
          subject: string
          source: string | null
          created_at: string
        }
        Insert: {
          id?: string
          term: string
          note?: string | null
          subject?: string
          source?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          term?: string
          note?: string | null
          subject?: string
          source?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
