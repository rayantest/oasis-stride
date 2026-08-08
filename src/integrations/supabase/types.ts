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
      body_scans: {
        Row: {
          bmi: number | null
          bmr_kcal: number | null
          body_fat_mass_kg: number | null
          body_fat_percent: number | null
          created_at: string
          id: string
          muscle_mass_kg: number | null
          scan_date: string
          source: string
          visceral_fat_level: number | null
          waist_hip_ratio: number | null
          weight_kg: number | null
        }
        Insert: {
          bmi?: number | null
          bmr_kcal?: number | null
          body_fat_mass_kg?: number | null
          body_fat_percent?: number | null
          created_at?: string
          id?: string
          muscle_mass_kg?: number | null
          scan_date?: string
          source?: string
          visceral_fat_level?: number | null
          waist_hip_ratio?: number | null
          weight_kg?: number | null
        }
        Update: {
          bmi?: number | null
          bmr_kcal?: number | null
          body_fat_mass_kg?: number | null
          body_fat_percent?: number | null
          created_at?: string
          id?: string
          muscle_mass_kg?: number | null
          scan_date?: string
          source?: string
          visceral_fat_level?: number | null
          waist_hip_ratio?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      exercise_entries: {
        Row: {
          created_at: string
          exercise: string
          id: string
          reps: number
        }
        Insert: {
          created_at?: string
          exercise: string
          id?: string
          reps: number
        }
        Update: {
          created_at?: string
          exercise?: string
          id?: string
          reps?: number
        }
        Relationships: []
      }
      fitness_rings: {
        Row: {
          active_calories: number
          created_at: string
          date: string
          exercise_minutes: number
          id: string
          stand_hours: number
          steps: number
        }
        Insert: {
          active_calories?: number
          created_at?: string
          date: string
          exercise_minutes?: number
          id?: string
          stand_hours?: number
          steps?: number
        }
        Update: {
          active_calories?: number
          created_at?: string
          date?: string
          exercise_minutes?: number
          id?: string
          stand_hours?: number
          steps?: number
        }
        Relationships: []
      }
      food_entries: {
        Row: {
          carbs_g: number
          created_at: string
          fat_g: number
          id: string
          kcal: number
          label: string
          protein_g: number
        }
        Insert: {
          carbs_g?: number
          created_at?: string
          fat_g?: number
          id?: string
          kcal: number
          label: string
          protein_g?: number
        }
        Update: {
          carbs_g?: number
          created_at?: string
          fat_g?: number
          id?: string
          kcal?: number
          label?: string
          protein_g?: number
        }
        Relationships: []
      }
      movement_entries: {
        Row: {
          created_at: string
          id: string
          kcal: number
          label: string
          minutes: number
          source: string
        }
        Insert: {
          created_at?: string
          id?: string
          kcal: number
          label: string
          minutes: number
          source: string
        }
        Update: {
          created_at?: string
          id?: string
          kcal?: number
          label?: string
          minutes?: number
          source?: string
        }
        Relationships: []
      }
      profile: {
        Row: {
          active_burn_goal_kcal: number
          activity_level: string
          age: number
          caution_flag: boolean
          caution_note: string
          fat_loss_pace: string
          gender: string
          goal_answers: Json
          height_cm: number
          id: number
          resting_hr: number
          updated_at: string
          weight_kg: number
        }
        Insert: {
          active_burn_goal_kcal?: number
          activity_level?: string
          age?: number
          caution_flag?: boolean
          caution_note?: string
          fat_loss_pace?: string
          gender?: string
          goal_answers?: Json
          height_cm?: number
          id?: number
          resting_hr?: number
          updated_at?: string
          weight_kg?: number
        }
        Update: {
          active_burn_goal_kcal?: number
          activity_level?: string
          age?: number
          caution_flag?: boolean
          caution_note?: string
          fat_loss_pace?: string
          gender?: string
          goal_answers?: Json
          height_cm?: number
          id?: number
          resting_hr?: number
          updated_at?: string
          weight_kg?: number
        }
        Relationships: []
      }
      saved_foods: {
        Row: {
          breakdown: Json | null
          carbs_g: number
          created_at: string
          fat_g: number
          grams: number | null
          id: string
          kcal: number
          label: string
          protein_g: number
        }
        Insert: {
          breakdown?: Json | null
          carbs_g?: number
          created_at?: string
          fat_g?: number
          grams?: number | null
          id?: string
          kcal?: number
          label: string
          protein_g?: number
        }
        Update: {
          breakdown?: Json | null
          carbs_g?: number
          created_at?: string
          fat_g?: number
          grams?: number | null
          id?: string
          kcal?: number
          label?: string
          protein_g?: number
        }
        Relationships: []
      }
      strength_targets: {
        Row: {
          created_at: string
          effective_date: string
          id: string
          note: string
          pullups: number
          pushups: number
          situps: number
          source: string
          squats: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          effective_date: string
          id?: string
          note?: string
          pullups?: number
          pushups?: number
          situps?: number
          source?: string
          squats?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          effective_date?: string
          id?: string
          note?: string
          pullups?: number
          pushups?: number
          situps?: number
          source?: string
          squats?: number
          updated_at?: string
        }
        Relationships: []
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
