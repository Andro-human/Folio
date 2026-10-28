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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      api_tokens: {
        Row: {
          created_at: string
          id: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          scope: Database["public"]["Enums"]["token_scope"]
          token_hash: string
          token_hint: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
          scope?: Database["public"]["Enums"]["token_scope"]
          token_hash: string
          token_hint: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          scope?: Database["public"]["Enums"]["token_scope"]
          token_hash?: string
          token_hint?: string
          user_id?: string
        }
        Relationships: []
      }
      folders: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_id: string | null
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          position?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      lists: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          position: number
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          position?: number
          user_id?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
          user_id?: string
        }
        Relationships: []
      }
      page_links: {
        Row: {
          from_page_id: string
          to_page_id: string
          user_id: string
        }
        Insert: {
          from_page_id: string
          to_page_id: string
          user_id?: string
        }
        Update: {
          from_page_id?: string
          to_page_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_links_from_page_id_fkey"
            columns: ["from_page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_links_to_page_id_fkey"
            columns: ["to_page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          content: Json | null
          content_text: string
          created_at: string
          deleted_at: string | null
          folder_id: string | null
          id: string
          jot_date: string | null
          origin_page_id: string | null
          parent_page_id: string | null
          position: number
          search: unknown
          title: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          content?: Json | null
          content_text?: string
          created_at?: string
          deleted_at?: string | null
          folder_id?: string | null
          id?: string
          jot_date?: string | null
          origin_page_id?: string | null
          parent_page_id?: string | null
          position?: number
          search?: unknown
          title?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Update: {
          content?: Json | null
          content_text?: string
          created_at?: string
          deleted_at?: string | null
          folder_id?: string | null
          id?: string
          jot_date?: string | null
          origin_page_id?: string | null
          parent_page_id?: string | null
          position?: number
          search?: unknown
          title?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "pages_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_origin_page_id_fkey"
            columns: ["origin_page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_parent_page_id_fkey"
            columns: ["parent_page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          default_list_id: string | null
          timezone: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_list_id?: string | null
          timezone?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_list_id?: string | null
          timezone?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_list_fk"
            columns: ["default_list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      task_completions: {
        Row: {
          completed_at: string
          id: string
          page_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          page_id: string
          user_id?: string
        }
        Update: {
          completed_at?: string
          id?: string
          page_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_completions_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id?: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          deadline: string | null
          deadline_has_time: boolean
          gcal_dirty: boolean
          gcal_event_id: string | null
          list_id: string | null
          page_id: string
          priority: Database["public"]["Enums"]["task_priority"]
          remind_at: string | null
          reminded_at: string | null
          rrule: string | null
          status: Database["public"]["Enums"]["task_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          deadline_has_time?: boolean
          gcal_dirty?: boolean
          gcal_event_id?: string | null
          list_id?: string | null
          page_id: string
          priority?: Database["public"]["Enums"]["task_priority"]
          remind_at?: string | null
          reminded_at?: string | null
          rrule?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          updated_at?: string
          user_id?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          deadline_has_time?: boolean
          gcal_dirty?: boolean
          gcal_event_id?: string | null
          list_id?: string | null
          page_id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          remind_at?: string | null
          reminded_at?: string | null
          rrule?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: true
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      complete_task: {
        Args: {
          p_next_deadline?: string
          p_next_remind_at?: string
          p_page_id: string
        }
        Returns: undefined
      }
      create_task: {
        Args: {
          p_deadline?: string
          p_deadline_has_time?: boolean
          p_folder_id?: string
          p_id: string
          p_list_id?: string
          p_origin_page_id?: string
          p_parent_page_id?: string
          p_priority?: Database["public"]["Enums"]["task_priority"]
          p_rrule?: string
          p_title: string
        }
        Returns: undefined
      }
      register_push: {
        Args: { p_auth: string; p_endpoint: string; p_p256dh: string; p_user_agent: string }
        Returns: undefined
      }
      rename_page: {
        Args: { p_id: string; p_title: string }
        Returns: undefined
      }
      save_page: {
        Args: {
          p_base_version: number
          p_content: Json
          p_content_text: string
          p_id: string
          p_link_ids: string[]
          p_title: string
        }
        Returns: number
      }
      search_pages: {
        Args: { p_query: string }
        Returns: {
          id: string
          is_task: boolean
          jot_date: string
          rank: number
          snippet: string
          title: string
        }[]
      }
    }
    Enums: {
      task_priority: "high" | "medium" | "low"
      task_status: "todo" | "deferred" | "done"
      token_scope: "capture" | "mcp"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      task_priority: ["high", "medium", "low"],
      task_status: ["todo", "deferred", "done"],
    },
  },
} as const
