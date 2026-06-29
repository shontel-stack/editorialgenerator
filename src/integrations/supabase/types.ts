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
      brand_fonts: {
        Row: {
          created_at: string
          family_name: string
          file_name: string
          file_path: string
          format: string
          id: string
          publication_id: string
          size_bytes: number
          style: string
          updated_at: string
          user_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          family_name: string
          file_name: string
          file_path: string
          format: string
          id?: string
          publication_id: string
          size_bytes?: number
          style?: string
          updated_at?: string
          user_id: string
          weight?: number
        }
        Update: {
          created_at?: string
          family_name?: string
          file_name?: string
          file_path?: string
          format?: string
          id?: string
          publication_id?: string
          size_bytes?: number
          style?: string
          updated_at?: string
          user_id?: string
          weight?: number
        }
        Relationships: []
      }
      brand_swatches: {
        Row: {
          created_at: string
          hex: string
          id: string
          name: string
          position: number
          publication_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hex: string
          id?: string
          name?: string
          position?: number
          publication_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          hex?: string
          id?: string
          name?: string
          position?: number
          publication_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      issue_attachments: {
        Row: {
          created_at: string
          extracted_text: string | null
          file_name: string
          file_path: string
          id: string
          issue_id: string | null
          kind: string
          mime_type: string
          page_id: string | null
          position_x: number | null
          position_y: number | null
          publication_id: string | null
          region: string | null
          size_bytes: number
          user_id: string
        }
        Insert: {
          created_at?: string
          extracted_text?: string | null
          file_name: string
          file_path: string
          id?: string
          issue_id?: string | null
          kind: string
          mime_type: string
          page_id?: string | null
          position_x?: number | null
          position_y?: number | null
          publication_id?: string | null
          region?: string | null
          size_bytes: number
          user_id: string
        }
        Update: {
          created_at?: string
          extracted_text?: string | null
          file_name?: string
          file_path?: string
          id?: string
          issue_id?: string | null
          kind?: string
          mime_type?: string
          page_id?: string | null
          position_x?: number | null
          position_y?: number | null
          publication_id?: string | null
          region?: string | null
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
      issue_drafts: {
        Row: {
          client_updated_at: string
          created_at: string
          data: Json
          id: string
          issue_id: string
          issue_label: string | null
          publication_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_updated_at?: string
          created_at?: string
          data: Json
          id?: string
          issue_id: string
          issue_label?: string | null
          publication_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_updated_at?: string
          created_at?: string
          data?: Json
          id?: string
          issue_id?: string
          issue_label?: string | null
          publication_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      issue_templates: {
        Row: {
          created_at: string
          data: Json
          description: string | null
          id: string
          name: string
          publication_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data: Json
          description?: string | null
          id?: string
          name: string
          publication_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          description?: string | null
          id?: string
          name?: string
          publication_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      issue_versions: {
        Row: {
          created_at: string
          id: string
          issue_id: string
          label: string | null
          snapshot: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          issue_id: string
          label?: string | null
          snapshot: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          issue_id?: string
          label?: string | null
          snapshot?: Json
          user_id?: string
        }
        Relationships: []
      }
      layout_presets: {
        Row: {
          column_widths: Json
          created_at: string
          gutter_in: number
          id: string
          layout: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          column_widths: Json
          created_at?: string
          gutter_in?: number
          id?: string
          layout: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          column_widths?: Json
          created_at?: string
          gutter_in?: number
          id?: string
          layout?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      page_comment_replies: {
        Row: {
          body: string
          comment_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          body: string
          comment_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          body?: string
          comment_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_comment_replies_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "page_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      page_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          issue_id: string
          page_id: string
          resolved: boolean
          updated_at: string
          user_id: string
          x: number
          y: number
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          issue_id: string
          page_id: string
          resolved?: boolean
          updated_at?: string
          user_id: string
          x: number
          y: number
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          issue_id?: string
          page_id?: string
          resolved?: boolean
          updated_at?: string
          user_id?: string
          x?: number
          y?: number
        }
        Relationships: []
      }
      page_status: {
        Row: {
          assignee_role: string | null
          column_widths: Json | null
          created_at: string
          due_date: string | null
          gutter_in: number | null
          id: string
          issue_id: string
          layout: string
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
          column_widths?: Json | null
          created_at?: string
          due_date?: string | null
          gutter_in?: number | null
          id?: string
          issue_id: string
          layout?: string
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
          column_widths?: Json | null
          created_at?: string
          due_date?: string | null
          gutter_in?: number | null
          id?: string
          issue_id?: string
          layout?: string
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
          display_font_custom_id: string | null
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
          sans_font_custom_id: string | null
          serif_font_custom_id: string | null
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
          display_font_custom_id?: string | null
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
          sans_font_custom_id?: string | null
          serif_font_custom_id?: string | null
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
          display_font_custom_id?: string | null
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
          sans_font_custom_id?: string | null
          serif_font_custom_id?: string | null
          slug?: string
          tagline?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publications_display_font_custom_id_fkey"
            columns: ["display_font_custom_id"]
            isOneToOne: false
            referencedRelation: "brand_fonts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publications_sans_font_custom_id_fkey"
            columns: ["sans_font_custom_id"]
            isOneToOne: false
            referencedRelation: "brand_fonts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publications_serif_font_custom_id_fkey"
            columns: ["serif_font_custom_id"]
            isOneToOne: false
            referencedRelation: "brand_fonts"
            referencedColumns: ["id"]
          },
        ]
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
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          active_publication_id: string | null
          last_positions: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          active_publication_id?: string | null
          last_positions?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          active_publication_id?: string | null
          last_positions?: Json
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
