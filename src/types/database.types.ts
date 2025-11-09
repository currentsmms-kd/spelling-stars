export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      parental_settings: {
        Row: {
          id: string;
          parent_id: string;
          pin_code: string;
          show_hints_on_first_miss: boolean;
          enforce_case_sensitivity: boolean;
          auto_readback_spelling: boolean;
          daily_session_limit_minutes: number;
          default_tts_voice: string;
          color_theme: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          parent_id: string;
          pin_code: string;
          show_hints_on_first_miss?: boolean;
          enforce_case_sensitivity?: boolean;
          auto_readback_spelling?: boolean;
          daily_session_limit_minutes?: number;
          default_tts_voice?: string;
          color_theme?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          parent_id?: string;
          pin_code?: string;
          show_hints_on_first_miss?: boolean;
          enforce_case_sensitivity?: boolean;
          auto_readback_spelling?: boolean;
          daily_session_limit_minutes?: number;
          default_tts_voice?: string;
          color_theme?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "parental_settings_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      session_analytics: {
        Row: {
          id: string;
          child_id: string;
          session_date: string;
          session_duration_seconds: number;
          words_practiced: number;
          correct_on_first_try: number;
          total_attempts: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          child_id: string;
          session_date?: string;
          session_duration_seconds?: number;
          words_practiced?: number;
          correct_on_first_try?: number;
          total_attempts?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          child_id?: string;
          session_date?: string;
          session_duration_seconds?: number;
          words_practiced?: number;
          correct_on_first_try?: number;
          total_attempts?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "session_analytics_child_id_fkey";
            columns: ["child_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      badges: {
        Row: {
          id: string;
          badge_key: string;
          name: string;
          description: string;
          icon: string;
          required_stars: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          badge_key: string;
          name: string;
          description: string;
          icon: string;
          required_stars?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          badge_key?: string;
          name?: string;
          description?: string;
          icon?: string;
          required_stars?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      user_badges: {
        Row: {
          id: string;
          child_id: string;
          badge_id: string;
          earned_at: string;
        };
        Insert: {
          id?: string;
          child_id: string;
          badge_id: string;
          earned_at?: string;
        };
        Update: {
          id?: string;
          child_id?: string;
          badge_id?: string;
          earned_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_badges_child_id_fkey";
            columns: ["child_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_badges_badge_id_fkey";
            columns: ["badge_id"];
            isOneToOne: false;
            referencedRelation: "badges";
            referencedColumns: ["id"];
          },
        ];
      };
      attempts: {
        Row: {
          audio_url: string | null;
          child_id: string;
          correct: boolean;
          duration_ms: number | null;
          id: string;
          mode: string;
          started_at: string | null;
          typed_answer: string | null;
          word_id: string;
        };
        Insert: {
          audio_url?: string | null;
          child_id: string;
          correct: boolean;
          duration_ms?: number | null;
          id?: string;
          mode: string;
          started_at?: string | null;
          typed_answer?: string | null;
          word_id: string;
        };
        Update: {
          audio_url?: string | null;
          child_id?: string;
          correct?: boolean;
          duration_ms?: number | null;
          id?: string;
          mode?: string;
          started_at?: string | null;
          typed_answer?: string | null;
          word_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attempts_child_id_fkey";
            columns: ["child_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attempts_word_id_fkey";
            columns: ["word_id"];
            isOneToOne: false;
            referencedRelation: "words";
            referencedColumns: ["id"];
          },
        ];
      };
      list_words: {
        Row: {
          list_id: string;
          sort_index: number;
          word_id: string;
        };
        Insert: {
          list_id: string;
          sort_index: number;
          word_id: string;
        };
        Update: {
          list_id?: string;
          sort_index?: number;
          word_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "list_words_list_id_fkey";
            columns: ["list_id"];
            isOneToOne: false;
            referencedRelation: "word_lists";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "list_words_word_id_fkey";
            columns: ["word_id"];
            isOneToOne: false;
            referencedRelation: "words";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string | null;
          display_name: string | null;
          id: string;
          role: string;
          color_theme: string;
          updated_at: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string | null;
          display_name?: string | null;
          id: string;
          role: string;
          color_theme?: string;
          updated_at?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string | null;
          display_name?: string | null;
          id?: string;
          role?: string;
          color_theme?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      rewards: {
        Row: {
          badges: Json | null;
          child_id: string;
          stars_total: number | null;
          streak_current: number | null;
        };
        Insert: {
          badges?: Json | null;
          child_id: string;
          stars_total?: number | null;
          streak_current?: number | null;
        };
        Update: {
          badges?: Json | null;
          child_id?: string;
          stars_total?: number | null;
          streak_current?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "rewards_child_id_fkey";
            columns: ["child_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      srs: {
        Row: {
          id: string;
          child_id: string;
          word_id: string;
          ease: number;
          interval_days: number;
          due_date: string;
          reps: number;
          lapses: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          child_id: string;
          word_id: string;
          ease?: number;
          interval_days?: number;
          due_date?: string;
          reps?: number;
          lapses?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          child_id?: string;
          word_id?: string;
          ease?: number;
          interval_days?: number;
          due_date?: string;
          reps?: number;
          lapses?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "srs_child_id_fkey";
            columns: ["child_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "srs_word_id_fkey";
            columns: ["word_id"];
            isOneToOne: false;
            referencedRelation: "words";
            referencedColumns: ["id"];
          },
        ];
      };
      word_lists: {
        Row: {
          created_at: string | null;
          created_by: string;
          id: string;
          title: string;
          week_start_date: string | null;
        };
        Insert: {
          created_at?: string | null;
          created_by: string;
          id?: string;
          title: string;
          week_start_date?: string | null;
        };
        Update: {
          created_at?: string | null;
          created_by?: string;
          id?: string;
          title?: string;
          week_start_date?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "word_lists_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      words: {
        Row: {
          created_at: string | null;
          id: string;
          phonetic: string | null;
          prompt_audio_url: string | null;
          text: string;
          tts_voice: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          phonetic?: string | null;
          prompt_audio_url?: string | null;
          text: string;
          tts_voice?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          phonetic?: string | null;
          prompt_audio_url?: string | null;
          text?: string;
          tts_voice?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      fn_add_stars: {
        Args: {
          p_child: string;
          p_amount: number;
        };
        Returns: number;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
