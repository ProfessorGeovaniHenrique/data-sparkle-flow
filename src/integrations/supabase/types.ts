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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      artists: {
        Row: {
          created_at: string | null
          genre: string | null
          id: string
          name: string
          normalized_name: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          genre?: string | null
          id?: string
          name: string
          normalized_name?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          genre?: string | null
          id?: string
          name?: string
          normalized_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      songs: {
        Row: {
          artist_id: string
          composer: string | null
          confidence_score: number | null
          created_at: string | null
          enrichment_source: string | null
          id: string
          lyrics: string | null
          normalized_title: string | null
          raw_data: Json | null
          release_year: string | null
          status: string | null
          title: string
          updated_at: string | null
          upload_id: string | null
          youtube_url: string | null
        }
        Insert: {
          artist_id: string
          composer?: string | null
          confidence_score?: number | null
          created_at?: string | null
          enrichment_source?: string | null
          id?: string
          lyrics?: string | null
          normalized_title?: string | null
          raw_data?: Json | null
          release_year?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
          upload_id?: string | null
          youtube_url?: string | null
        }
        Update: {
          artist_id?: string
          composer?: string | null
          confidence_score?: number | null
          created_at?: string | null
          enrichment_source?: string | null
          id?: string
          lyrics?: string | null
          normalized_title?: string | null
          raw_data?: Json | null
          release_year?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          upload_id?: string | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "songs_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "songs_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      uploads: {
        Row: {
          created_at: string | null
          filename: string
          id: string
          processed_rows: number | null
          status: string | null
          total_rows: number | null
        }
        Insert: {
          created_at?: string | null
          filename: string
          id?: string
          processed_rows?: number | null
          status?: string | null
          total_rows?: number | null
        }
        Update: {
          created_at?: string | null
          filename?: string
          id?: string
          processed_rows?: number | null
          status?: string | null
          total_rows?: number | null
        }
        Relationships: []
      }
      youtube_cache: {
        Row: {
          channel_title: string
          created_at: string | null
          description: string | null
          hits_count: number | null
          id: string
          publish_date: string
          search_query: string
          updated_at: string | null
          video_id: string
          video_title: string
        }
        Insert: {
          channel_title: string
          created_at?: string | null
          description?: string | null
          hits_count?: number | null
          id?: string
          publish_date: string
          search_query: string
          updated_at?: string | null
          video_id: string
          video_title: string
        }
        Update: {
          channel_title?: string
          created_at?: string | null
          description?: string | null
          hits_count?: number | null
          id?: string
          publish_date?: string
          search_query?: string
          updated_at?: string | null
          video_id?: string
          video_title?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      normalize_text: { Args: { "": string }; Returns: string }
      unaccent: { Args: { "": string }; Returns: string }
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
