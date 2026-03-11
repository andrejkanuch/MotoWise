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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      articles: {
        Row: {
          category: Database["public"]["Enums"]["article_category"]
          content_json: Json
          difficulty: Database["public"]["Enums"]["article_difficulty"]
          flag_count: number
          generated_at: string
          id: string
          is_hidden: boolean
          is_safety_critical: boolean
          is_seed_content: boolean
          is_verified: boolean
          raw_text: string
          read_time_minutes: number | null
          search_vector: unknown
          slug: string
          summary: string | null
          title: string
          updated_at: string
          version: number
          view_count: number
        }
        Insert: {
          category?: Database["public"]["Enums"]["article_category"]
          content_json: Json
          difficulty?: Database["public"]["Enums"]["article_difficulty"]
          flag_count?: number
          generated_at?: string
          id?: string
          is_hidden?: boolean
          is_safety_critical?: boolean
          is_seed_content?: boolean
          is_verified?: boolean
          raw_text?: string
          read_time_minutes?: number | null
          search_vector?: unknown
          slug: string
          summary?: string | null
          title: string
          updated_at?: string
          version?: number
          view_count?: number
        }
        Update: {
          category?: Database["public"]["Enums"]["article_category"]
          content_json?: Json
          difficulty?: Database["public"]["Enums"]["article_difficulty"]
          flag_count?: number
          generated_at?: string
          id?: string
          is_hidden?: boolean
          is_safety_critical?: boolean
          is_seed_content?: boolean
          is_verified?: boolean
          raw_text?: string
          read_time_minutes?: number | null
          search_vector?: unknown
          slug?: string
          summary?: string | null
          title?: string
          updated_at?: string
          version?: number
          view_count?: number
        }
        Relationships: []
      }
      content_flags: {
        Row: {
          article_id: string
          comment: string
          created_at: string
          id: string
          section_reference: string | null
          status: Database["public"]["Enums"]["flag_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          article_id: string
          comment: string
          created_at?: string
          id?: string
          section_reference?: string | null
          status?: Database["public"]["Enums"]["flag_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          article_id?: string
          comment?: string
          created_at?: string
          id?: string
          section_reference?: string | null
          status?: Database["public"]["Enums"]["flag_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_flags_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_flags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      content_generation_log: {
        Row: {
          content_id: string | null
          content_type: string
          cost_cents: number | null
          created_at: string
          error_message: string | null
          id: string
          input_tokens: number | null
          model: string | null
          output_tokens: number | null
          status: string
          user_id: string | null
        }
        Insert: {
          content_id?: string | null
          content_type: string
          cost_cents?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          input_tokens?: number | null
          model?: string | null
          output_tokens?: number | null
          status?: string
          user_id?: string | null
        }
        Update: {
          content_id?: string | null
          content_type?: string
          cost_cents?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          input_tokens?: number | null
          model?: string | null
          output_tokens?: number | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_generation_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_photos: {
        Row: {
          diagnostic_id: string
          file_size_bytes: number | null
          id: string
          original_filename: string | null
          storage_path: string
          uploaded_at: string
        }
        Insert: {
          diagnostic_id: string
          file_size_bytes?: number | null
          id?: string
          original_filename?: string | null
          storage_path: string
          uploaded_at?: string
        }
        Update: {
          diagnostic_id?: string
          file_size_bytes?: number | null
          id?: string
          original_filename?: string | null
          storage_path?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_photos_diagnostic_id_fkey"
            columns: ["diagnostic_id"]
            isOneToOne: false
            referencedRelation: "diagnostics"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostics: {
        Row: {
          confidence: number | null
          created_at: string
          data_sharing_opted_in: boolean
          id: string
          motorcycle_id: string
          related_article_id: string | null
          result_json: Json
          severity: Database["public"]["Enums"]["diagnostic_severity"] | null
          status: string
          user_id: string
          wizard_answers: Json | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          data_sharing_opted_in?: boolean
          id?: string
          motorcycle_id: string
          related_article_id?: string | null
          result_json: Json
          severity?: Database["public"]["Enums"]["diagnostic_severity"] | null
          status?: string
          user_id: string
          wizard_answers?: Json | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          data_sharing_opted_in?: boolean
          id?: string
          motorcycle_id?: string
          related_article_id?: string | null
          result_json?: Json
          severity?: Database["public"]["Enums"]["diagnostic_severity"] | null
          status?: string
          user_id?: string
          wizard_answers?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "diagnostics_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "motorcycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostics_related_article_id_fkey"
            columns: ["related_article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_progress: {
        Row: {
          article_id: string
          article_read: boolean
          first_read_at: string | null
          id: string
          last_read_at: string | null
          quiz_best_score: number | null
          quiz_completed: boolean
          user_id: string
        }
        Insert: {
          article_id: string
          article_read?: boolean
          first_read_at?: string | null
          id?: string
          last_read_at?: string | null
          quiz_best_score?: number | null
          quiz_completed?: boolean
          user_id: string
        }
        Update: {
          article_id?: string
          article_read?: boolean
          first_read_at?: string | null
          id?: string
          last_read_at?: string | null
          quiz_best_score?: number | null
          quiz_completed?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_progress_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_task_photos: {
        Row: {
          created_at: string
          file_size_bytes: number | null
          id: string
          mime_type: string
          storage_path: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string
          storage_path: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string
          storage_path?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_task_photos_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "maintenance_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_tasks: {
        Row: {
          completed_at: string | null
          completed_mileage: number | null
          cost: number | null
          created_at: string
          currency: string | null
          deleted_at: string | null
          description: string | null
          due_date: string | null
          id: string
          interval_days: number | null
          interval_km: number | null
          is_recurring: boolean
          labor_cost: number | null
          motorcycle_id: string
          notes: string | null
          oem_schedule_id: string | null
          parts_cost: number | null
          parts_needed: string[] | null
          priority: string
          source: string
          status: string
          target_mileage: number | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_mileage?: number | null
          cost?: number | null
          created_at?: string
          currency?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          interval_days?: number | null
          interval_km?: number | null
          is_recurring?: boolean
          labor_cost?: number | null
          motorcycle_id: string
          notes?: string | null
          oem_schedule_id?: string | null
          parts_cost?: number | null
          parts_needed?: string[] | null
          priority?: string
          source?: string
          status?: string
          target_mileage?: number | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completed_mileage?: number | null
          cost?: number | null
          created_at?: string
          currency?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          interval_days?: number | null
          interval_km?: number | null
          is_recurring?: boolean
          labor_cost?: number | null
          motorcycle_id?: string
          notes?: string | null
          oem_schedule_id?: string | null
          parts_cost?: number | null
          parts_needed?: string[] | null
          priority?: string
          source?: string
          status?: string
          target_mileage?: number | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_tasks_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "motorcycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tasks_oem_schedule_id_fkey"
            columns: ["oem_schedule_id"]
            isOneToOne: false
            referencedRelation: "oem_maintenance_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      motorcycles: {
        Row: {
          created_at: string
          current_mileage: number | null
          deleted_at: string | null
          engine_cc: number | null
          id: string
          is_primary: boolean
          make: string
          metadata: Json | null
          mileage_unit: string | null
          mileage_updated_at: string | null
          model: string
          nickname: string | null
          primary_photo_url: string | null
          purchase_date: string | null
          type: Database["public"]["Enums"]["motorcycle_type"] | null
          updated_at: string
          user_id: string
          vin: string | null
          year: number
        }
        Insert: {
          created_at?: string
          current_mileage?: number | null
          deleted_at?: string | null
          engine_cc?: number | null
          id?: string
          is_primary?: boolean
          make: string
          metadata?: Json | null
          mileage_unit?: string | null
          mileage_updated_at?: string | null
          model: string
          nickname?: string | null
          primary_photo_url?: string | null
          purchase_date?: string | null
          type?: Database["public"]["Enums"]["motorcycle_type"] | null
          updated_at?: string
          user_id: string
          vin?: string | null
          year: number
        }
        Update: {
          created_at?: string
          current_mileage?: number | null
          deleted_at?: string | null
          engine_cc?: number | null
          id?: string
          is_primary?: boolean
          make?: string
          metadata?: Json | null
          mileage_unit?: string | null
          mileage_updated_at?: string | null
          model?: string
          nickname?: string | null
          primary_photo_url?: string | null
          purchase_date?: string | null
          type?: Database["public"]["Enums"]["motorcycle_type"] | null
          updated_at?: string
          user_id?: string
          vin?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "motorcycles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      oem_maintenance_schedules: {
        Row: {
          created_at: string
          description: string | null
          engine_cc_max: number | null
          engine_cc_min: number | null
          engine_type: string | null
          id: string
          interval_days: number | null
          interval_km: number | null
          make: string
          model: string | null
          priority: string
          sort_order: number | null
          task_name: string
          year_from: number | null
          year_to: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          engine_cc_max?: number | null
          engine_cc_min?: number | null
          engine_type?: string | null
          id?: string
          interval_days?: number | null
          interval_km?: number | null
          make: string
          model?: string | null
          priority?: string
          sort_order?: number | null
          task_name: string
          year_from?: number | null
          year_to?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          engine_cc_max?: number | null
          engine_cc_min?: number | null
          engine_type?: string | null
          id?: string
          interval_days?: number | null
          interval_km?: number | null
          make?: string
          model?: string | null
          priority?: string
          sort_order?: number | null
          task_name?: string
          year_from?: number | null
          year_to?: number | null
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          answers_json: Json
          completed_at: string
          id: string
          quiz_id: string
          score: number
          total_questions: number
          user_id: string
        }
        Insert: {
          answers_json: Json
          completed_at?: string
          id?: string
          quiz_id: string
          score: number
          total_questions: number
          user_id: string
        }
        Update: {
          answers_json?: Json
          completed_at?: string
          id?: string
          quiz_id?: string
          score?: number
          total_questions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          article_id: string
          generated_at: string
          id: string
          questions_json: Json
        }
        Insert: {
          article_id: string
          generated_at?: string
          id?: string
          questions_json: Json
        }
        Update: {
          article_id?: string
          generated_at?: string
          id?: string
          questions_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: true
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      share_links: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          motorcycle_id: string
          revoked_at: string | null
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          motorcycle_id: string
          revoked_at?: string | null
          token?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          motorcycle_id?: string
          revoked_at?: string | null
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_links_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "motorcycles"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          onboarding_completed_at: string | null
          preferences: Json | null
          revenuecat_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          subscription_expires_at: string | null
          subscription_status: string | null
          subscription_tier: string
          trial_started_at: string | null
          updated_at: string
          years_riding: number | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          onboarding_completed_at?: string | null
          preferences?: Json | null
          revenuecat_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          subscription_expires_at?: string | null
          subscription_status?: string | null
          subscription_tier?: string
          trial_started_at?: string | null
          updated_at?: string
          years_riding?: number | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          onboarding_completed_at?: string | null
          preferences?: Json | null
          revenuecat_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          subscription_expires_at?: string | null
          subscription_status?: string | null
          subscription_tier?: string
          trial_started_at?: string | null
          updated_at?: string
          years_riding?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_uid_check: { Args: never; Returns: string }
      complete_onboarding:
        | {
            Args: {
              p_bike_make?: string
              p_bike_mileage?: number
              p_bike_model?: string
              p_bike_nickname?: string
              p_bike_type?: Database["public"]["Enums"]["motorcycle_type"]
              p_bike_year?: number
              p_preferences: Json
              p_user_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_annual_repair_spend?: string
              p_bike_make?: string
              p_bike_mileage?: number
              p_bike_model?: string
              p_bike_nickname?: string
              p_bike_photo_url?: string
              p_bike_type?: Database["public"]["Enums"]["motorcycle_type"]
              p_bike_year?: number
              p_last_service_date?: string
              p_maintenance_reminders?: boolean
              p_mileage_unit?: string
              p_preferences: Json
              p_recall_alerts?: boolean
              p_reminder_channel?: string
              p_seasonal_tips?: boolean
              p_user_id: string
              p_weekly_summary?: boolean
            }
            Returns: Json
          }
      increment_article_view_count: {
        Args: { p_article_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      mark_article_read: {
        Args: { p_article_id: string; p_user_id: string }
        Returns: {
          article_id: string
          article_read: boolean
          first_read_at: string | null
          id: string
          last_read_at: string | null
          quiz_best_score: number | null
          quiz_completed: boolean
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "learning_progress"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      soft_delete_maintenance_task: {
        Args: { task_id: string }
        Returns: boolean
      }
      soft_delete_motorcycle: {
        Args: { motorcycle_id: string }
        Returns: boolean
      }
    }
    Enums: {
      article_category:
        | "engine"
        | "brakes"
        | "electrical"
        | "suspension"
        | "drivetrain"
        | "tires"
        | "fuel"
        | "general"
      article_difficulty: "beginner" | "intermediate" | "advanced"
      diagnostic_severity: "low" | "medium" | "high" | "critical"
      flag_status: "pending" | "reviewed" | "resolved" | "dismissed"
      motorcycle_type:
        | "cruiser"
        | "sportbike"
        | "standard"
        | "touring"
        | "dual_sport"
        | "dirt_bike"
        | "scooter"
        | "other"
      user_role: "user" | "admin"
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
      article_category: [
        "engine",
        "brakes",
        "electrical",
        "suspension",
        "drivetrain",
        "tires",
        "fuel",
        "general",
      ],
      article_difficulty: ["beginner", "intermediate", "advanced"],
      diagnostic_severity: ["low", "medium", "high", "critical"],
      flag_status: ["pending", "reviewed", "resolved", "dismissed"],
      motorcycle_type: [
        "cruiser",
        "sportbike",
        "standard",
        "touring",
        "dual_sport",
        "dirt_bike",
        "scooter",
        "other",
      ],
      user_role: ["user", "admin"],
    },
  },
} as const
