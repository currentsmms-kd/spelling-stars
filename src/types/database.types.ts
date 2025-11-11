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
  public: {
    Tables: {
      attempts: {
        Row: {
          audio_url: string | null;
          child_id: string;
          correct: boolean;
          duration_ms: number | null;
          id: string;
          list_id: string;
          mode: string;
          quality: number | null;
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
          list_id: string;
          mode: string;
          quality?: number | null;
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
          list_id?: string;
          mode?: string;
          quality?: number | null;
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
            foreignKeyName: "attempts_list_id_fkey";
            columns: ["list_id"];
            isOneToOne: false;
            referencedRelation: "word_lists";
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
      badges: {
        Row: {
          badge_key: string;
          created_at: string | null;
          description: string;
          icon: string;
          id: string;
          name: string;
          required_stars: number | null;
        };
        Insert: {
          badge_key: string;
          created_at?: string | null;
          description: string;
          icon: string;
          id?: string;
          name: string;
          required_stars?: number | null;
        };
        Update: {
          badge_key?: string;
          created_at?: string | null;
          description?: string;
          icon?: string;
          id?: string;
          name?: string;
          required_stars?: number | null;
        };
        Relationships: [];
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
      parental_settings: {
        Row: {
          auto_readback_spelling: boolean | null;
          color_theme: string | null;
          created_at: string | null;
          daily_session_limit_minutes: number | null;
          default_tts_voice: string | null;
          enforce_case_sensitivity: boolean | null;
          id: string;
          parent_id: string;
          pin_code: string;
          show_hints_on_first_miss: boolean | null;
          strict_spaced_mode: boolean | null;
          updated_at: string | null;
        };
        Insert: {
          auto_readback_spelling?: boolean | null;
          color_theme?: string | null;
          created_at?: string | null;
          daily_session_limit_minutes?: number | null;
          default_tts_voice?: string | null;
          enforce_case_sensitivity?: boolean | null;
          id?: string;
          parent_id: string;
          pin_code: string;
          show_hints_on_first_miss?: boolean | null;
          strict_spaced_mode?: boolean | null;
          updated_at?: string | null;
        };
        Update: {
          auto_readback_spelling?: boolean | null;
          color_theme?: string | null;
          created_at?: string | null;
          daily_session_limit_minutes?: number | null;
          default_tts_voice?: string | null;
          enforce_case_sensitivity?: boolean | null;
          id?: string;
          parent_id?: string;
          pin_code?: string;
          show_hints_on_first_miss?: boolean | null;
          strict_spaced_mode?: boolean | null;
          updated_at?: string | null;
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
      profiles: {
        Row: {
          avatar_url: string | null;
          color_theme: string | null;
          created_at: string | null;
          display_name: string | null;
          equipped_avatar: string | null;
          equipped_theme: string | null;
          id: string;
          last_active: string | null;
          parent_id: string | null;
          role: string;
          stars: number | null;
          streak_days: number | null;
          updated_at: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          color_theme?: string | null;
          created_at?: string | null;
          display_name?: string | null;
          equipped_avatar?: string | null;
          equipped_theme?: string | null;
          id: string;
          last_active?: string | null;
          parent_id?: string | null;
          role: string;
          stars?: number | null;
          streak_days?: number | null;
          updated_at?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          color_theme?: string | null;
          created_at?: string | null;
          display_name?: string | null;
          equipped_avatar?: string | null;
          equipped_theme?: string | null;
          id?: string;
          last_active?: string | null;
          parent_id?: string | null;
          role?: string;
          stars?: number | null;
          streak_days?: number | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
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
      rewards_catalog: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          cost_stars: number;
          icon: string;
          type: "avatar" | "theme" | "coupon" | "badge";
          is_active: boolean;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          cost_stars: number;
          icon: string;
          type: "avatar" | "theme" | "coupon" | "badge";
          is_active?: boolean;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          cost_stars?: number;
          icon?: string;
          type?: "avatar" | "theme" | "coupon" | "badge";
          is_active?: boolean;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_rewards: {
        Row: {
          id: string;
          user_id: string;
          reward_id: string;
          acquired_at: string;
          equipped: boolean;
        };
        Insert: {
          id?: string;
          user_id: string;
          reward_id: string;
          acquired_at?: string;
          equipped?: boolean;
        };
        Update: {
          id?: string;
          user_id?: string;
          reward_id?: string;
          acquired_at?: string;
          equipped?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "user_rewards_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_rewards_reward_id_fkey";
            columns: ["reward_id"];
            isOneToOne: false;
            referencedRelation: "rewards_catalog";
            referencedColumns: ["id"];
          },
        ];
      };
      session_analytics: {
        Row: {
          child_id: string;
          correct_on_first_try: number | null;
          created_at: string | null;
          id: string;
          session_date: string;
          session_duration_seconds: number | null;
          total_attempts: number | null;
          updated_at: string | null;
          words_practiced: number | null;
        };
        Insert: {
          child_id: string;
          correct_on_first_try?: number | null;
          created_at?: string | null;
          id?: string;
          session_date?: string;
          session_duration_seconds?: number | null;
          total_attempts?: number | null;
          updated_at?: string | null;
          words_practiced?: number | null;
        };
        Update: {
          child_id?: string;
          correct_on_first_try?: number | null;
          created_at?: string | null;
          id?: string;
          session_date?: string;
          session_duration_seconds?: number | null;
          total_attempts?: number | null;
          updated_at?: string | null;
          words_practiced?: number | null;
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
      srs: {
        Row: {
          child_id: string;
          created_at: string;
          due_date: string;
          ease: number;
          id: string;
          interval_days: number;
          lapses: number;
          reps: number;
          updated_at: string;
          word_id: string;
        };
        Insert: {
          child_id: string;
          created_at?: string;
          due_date?: string;
          ease?: number;
          id?: string;
          interval_days?: number;
          lapses?: number;
          reps?: number;
          updated_at?: string;
          word_id: string;
        };
        Update: {
          child_id?: string;
          created_at?: string;
          due_date?: string;
          ease?: number;
          id?: string;
          interval_days?: number;
          lapses?: number;
          reps?: number;
          updated_at?: string;
          word_id?: string;
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
      user_badges: {
        Row: {
          badge_id: string;
          child_id: string;
          earned_at: string | null;
          id: string;
        };
        Insert: {
          badge_id: string;
          child_id: string;
          earned_at?: string | null;
          id?: string;
        };
        Update: {
          badge_id?: string;
          child_id?: string;
          earned_at?: string | null;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey";
            columns: ["badge_id"];
            isOneToOne: false;
            referencedRelation: "badges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_badges_child_id_fkey";
            columns: ["child_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
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
          updated_at: string | null;
          week_start_date: string | null;
        };
        Insert: {
          created_at?: string | null;
          created_by: string;
          id?: string;
          title: string;
          updated_at?: string | null;
          week_start_date?: string | null;
        };
        Update: {
          created_at?: string | null;
          created_by?: string;
          id?: string;
          title?: string;
          updated_at?: string | null;
          week_start_date?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "spelling_lists_parent_id_fkey";
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
          prompt_audio_path: string | null;
          prompt_audio_url: string | null;
          text: string;
          tts_voice: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          phonetic?: string | null;
          prompt_audio_path?: string | null;
          prompt_audio_url?: string | null;
          text: string;
          tts_voice?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          phonetic?: string | null;
          prompt_audio_path?: string | null;
          prompt_audio_url?: string | null;
          text?: string;
          tts_voice?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      view_child_mastery: {
        Row: {
          accuracy: number | null;
          child_id: string | null;
          last_practiced_at: string | null;
          list_id: string | null;
          list_title: string | null;
          mastered_count: number | null;
          mastery_percentage: number | null;
          total_words_in_list: number | null;
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
            foreignKeyName: "list_words_list_id_fkey";
            columns: ["list_id"];
            isOneToOne: false;
            referencedRelation: "word_lists";
            referencedColumns: ["id"];
          },
        ];
      };
      view_ngram_errors: {
        Row: {
          affected_word_ids: string[] | null;
          child_id: string | null;
          error_count: number | null;
          last_seen: string | null;
          ngram: string | null;
          ngram_length: number | null;
          typed_ngram: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      fn_add_stars: {
        Args: { p_amount: number; p_child: string };
        Returns: number;
      };
      get_children_for_parent: {
        Args: { p_parent_id: string };
        Returns: {
          created_at: string;
          display_name: string;
          email: string;
          id: string;
        }[];
      };
      get_parent_overview: {
        Args: { p_date_from?: string; p_date_to?: string; p_parent_id: string };
        Returns: Json;
      };
      is_word_mastered: {
        Args: { p_child_id: string; p_word_id: string };
        Returns: boolean;
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
  public: {
    Enums: {},
  },
} as const;
