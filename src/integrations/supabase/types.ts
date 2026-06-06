export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      issue_attachments: {
        Row: {
          created_at: string
          extracted_text: string | null
          file_name: string
          file_path: string
          id: string
          issue_id: string
          kind: string
          mime_type: string
          page_id: string | null
          publication_id: string | null
          size_bytes: number
          user_id: string
        }
        Insert: {
          created_at?: string
          extracted_text?: string | null
          file_name: string
          file_path: string
          id?: string
          issue_id: string
          kind: string
          mime_type: string
          page_id?: string | null
          publication_id?: string | null
          size_bytes: number
          user_id: string
        }
        Update: {
          created_at?: string
          extracted_text?: string | null
          file_name?: string
          file_path?: string
          id?: string
          issue_id?: string
          kind?: string
          mime_type?: string
          page_id?: string | null
          publication_id?: string | null
          size_bytes?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_attachments_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_chats: {
        Row: {
          created_at: string
          id: string
          issue_id: string
          parts: Json
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          issue_id: string
          parts: Json
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          issue_id?: string
          parts?: Json
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      page_status: {
        Row: {
          assignee_role: string | null
          created_at: string
          due_date: string | null
          id: string
          issue_id: string
          notes: string | null
          page_id: string
          page_label: string | null
          position: number
          publication_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assignee_role?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          issue_id: string
          notes?: string | null
          page_id: string
          page_label?: string | null
          position?: number
          publication_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assignee_role?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          issue_id?: string
          notes?: string | null
          page_id?: string
          page_label?: string | null
          position?: number
          publication_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_status_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
        ]
      }
      publications: {
        Row: {
          bleed_in: number | null
          body_font: string | null
          brand_voice: string | null
          created_at: string
          display_font: string | null
          id: string
          margin_bottom_in: number | null
          margin_left_in: number | null
          margin_right_in: number | null
          margin_top_in: number | null
          masthead: string | null
          name: string
          page_height_in: number | null
          page_width_in: number | null
          palette_key: string | null
          slug: string
          tagline: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bleed_in?: number | null
          body_font?: string | null
          brand_voice?: string | null
          created_at?: string
          display_font?: string | null
          id?: string
          margin_bottom_in?: number | null
          margin_left_in?: number | null
          margin_right_in?: number | null
          margin_top_in?: number | null
          masthead?: string | null
          name: string
          page_height_in?: number | null
          page_width_in?: number | null
          palette_key?: string | null
          slug: string
          tagline?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bleed_in?: number | null
          body_font?: string | null
          brand_voice?: string | null
          created_at?: string
          display_font?: string | null
          id?: string
          margin_bottom_in?: number | null
          margin_left_in?: number | null
          margin_right_in?: number | null
          margin_top_in?: number | null
          masthead?: string | null
          name?: string
          page_height_in?: number | null
          page_width_in?: number | null
          palette_key?: string | null
          slug?: string
          tagline?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      staff_messages: {
        Row: {
          created_at: string
          id: string
          message_id: string | null
          parts: Json
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id?: string | null
          parts: Json
          role: string
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string | null
          parts?: Json
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "staff_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_notes: {
        Row: {
          body: string | null
          created_at: string
          id: string
          issue_id: string
          page_id: string | null
          payload: Json
          publication_id: string | null
          resolved_at: string | null
          role: string
          status: string
          thread_id: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          issue_id: string
          page_id?: string | null
          payload?: Json
          publication_id?: string | null
          resolved_at?: string | null
          role: string
          status?: string
          thread_id?: string | null
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          issue_id?: string
          page_id?: string | null
          payload?: Json
          publication_id?: string | null
          resolved_at?: string | null
          role?: string
          status?: string
          thread_id?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_notes_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_threads: {
        Row: {
          created_at: string
          id: string
          issue_id: string
          publication_id: string | null
          role: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          issue_id: string
          publication_id?: string | null
          role: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          issue_id?: string
          publication_id?: string | null
          role?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_threads_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          active_publication_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active_publication_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active_publication_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_active_publication_id_fkey"
            columns: ["active_publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
