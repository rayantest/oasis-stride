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
    PostgrestVersion: "14.17"
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
          user_id: string | null
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
          user_id?: string | null
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
          user_id?: string | null
          visceral_fat_level?: number | null
          waist_hip_ratio?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      diet_targets: {
        Row: {
          active_burn: number
          calories: number
          carbs_g: number
          created_at: string
          effective_date: string
          fat_g: number
          id: string
          primary_goal: string
          protein_g: number
          source: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active_burn?: number
          calories?: number
          carbs_g?: number
          created_at?: string
          effective_date: string
          fat_g?: number
          id?: string
          primary_goal?: string
          protein_g?: number
          source?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active_burn?: number
          calories?: number
          carbs_g?: number
          created_at?: string
          effective_date?: string
          fat_g?: number
          id?: string
          primary_goal?: string
          protein_g?: number
          source?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      exercise_entries: {
        Row: {
          created_at: string
          exercise: string
          id: string
          reps: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          exercise: string
          id?: string
          reps: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          exercise?: string
          id?: string
          reps?: number
          user_id?: string | null
        }
        Relationships: []
      }
      exercise_library: {
        Row: {
          created_at: string
          id: string
          is_custom: boolean
          mode: string
          muscle_group: string
          name: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_custom?: boolean
          mode?: string
          muscle_group?: string
          name: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_custom?: boolean
          mode?: string
          muscle_group?: string
          name?: string
          user_id?: string | null
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
          user_id: string | null
        }
        Insert: {
          active_calories?: number
          created_at?: string
          date: string
          exercise_minutes?: number
          id?: string
          stand_hours?: number
          steps?: number
          user_id?: string | null
        }
        Update: {
          active_calories?: number
          created_at?: string
          date?: string
          exercise_minutes?: number
          id?: string
          stand_hours?: number
          steps?: number
          user_id?: string | null
        }
        Relationships: []
      }
      food_entries: {
        Row: {
          animal_protein_g: number | null
          carbs_g: number
          cholesterol_mg: number | null
          created_at: string
          fat_g: number
          fiber_g: number | null
          id: string
          kcal: number
          label: string
          monounsaturated_fat_g: number | null
          plant_protein_g: number | null
          polyunsaturated_fat_g: number | null
          protein_g: number
          saturated_fat_g: number | null
          sodium_mg: number | null
          starch_g: number | null
          sugar_g: number | null
          trans_fat_g: number | null
          user_id: string | null
        }
        Insert: {
          animal_protein_g?: number | null
          carbs_g?: number
          cholesterol_mg?: number | null
          created_at?: string
          fat_g?: number
          fiber_g?: number | null
          id?: string
          kcal: number
          label: string
          monounsaturated_fat_g?: number | null
          plant_protein_g?: number | null
          polyunsaturated_fat_g?: number | null
          protein_g?: number
          saturated_fat_g?: number | null
          sodium_mg?: number | null
          starch_g?: number | null
          sugar_g?: number | null
          trans_fat_g?: number | null
          user_id?: string | null
        }
        Update: {
          animal_protein_g?: number | null
          carbs_g?: number
          cholesterol_mg?: number | null
          created_at?: string
          fat_g?: number
          fiber_g?: number | null
          id?: string
          kcal?: number
          label?: string
          monounsaturated_fat_g?: number | null
          plant_protein_g?: number | null
          polyunsaturated_fat_g?: number | null
          protein_g?: number
          saturated_fat_g?: number | null
          sodium_mg?: number | null
          starch_g?: number | null
          sugar_g?: number | null
          trans_fat_g?: number | null
          user_id?: string | null
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
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kcal: number
          label: string
          minutes: number
          source: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kcal?: number
          label?: string
          minutes?: number
          source?: string
          user_id?: string | null
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
          display_name: string
          fat_loss_pace: string
          gender: string
          goal_answers: Json
          height_cm: number
          onboarded_at: string | null
          resting_hr: number
          sync_token: string
          updated_at: string
          user_id: string | null
          weight_kg: number
        }
        Insert: {
          active_burn_goal_kcal?: number
          activity_level?: string
          age?: number
          caution_flag?: boolean
          caution_note?: string
          display_name?: string
          fat_loss_pace?: string
          gender?: string
          goal_answers?: Json
          height_cm?: number
          onboarded_at?: string | null
          resting_hr?: number
          sync_token?: string
          updated_at?: string
          user_id?: string | null
          weight_kg?: number
        }
        Update: {
          active_burn_goal_kcal?: number
          activity_level?: string
          age?: number
          caution_flag?: boolean
          caution_note?: string
          display_name?: string
          fat_loss_pace?: string
          gender?: string
          goal_answers?: Json
          height_cm?: number
          onboarded_at?: string | null
          resting_hr?: number
          sync_token?: string
          updated_at?: string
          user_id?: string | null
          weight_kg?: number
        }
        Relationships: []
      }
      saved_foods: {
        Row: {
          animal_protein_g: number | null
          breakdown: Json | null
          carbs_g: number
          cholesterol_mg: number | null
          created_at: string
          fat_g: number
          fiber_g: number | null
          grams: number | null
          id: string
          kcal: number
          label: string
          monounsaturated_fat_g: number | null
          plant_protein_g: number | null
          polyunsaturated_fat_g: number | null
          protein_g: number
          saturated_fat_g: number | null
          sodium_mg: number | null
          starch_g: number | null
          sugar_g: number | null
          trans_fat_g: number | null
          user_id: string | null
        }
        Insert: {
          animal_protein_g?: number | null
          breakdown?: Json | null
          carbs_g?: number
          cholesterol_mg?: number | null
          created_at?: string
          fat_g?: number
          fiber_g?: number | null
          grams?: number | null
          id?: string
          kcal?: number
          label: string
          monounsaturated_fat_g?: number | null
          plant_protein_g?: number | null
          polyunsaturated_fat_g?: number | null
          protein_g?: number
          saturated_fat_g?: number | null
          sodium_mg?: number | null
          starch_g?: number | null
          sugar_g?: number | null
          trans_fat_g?: number | null
          user_id?: string | null
        }
        Update: {
          animal_protein_g?: number | null
          breakdown?: Json | null
          carbs_g?: number
          cholesterol_mg?: number | null
          created_at?: string
          fat_g?: number
          fiber_g?: number | null
          grams?: number | null
          id?: string
          kcal?: number
          label?: string
          monounsaturated_fat_g?: number | null
          plant_protein_g?: number | null
          polyunsaturated_fat_g?: number | null
          protein_g?: number
          saturated_fat_g?: number | null
          sodium_mg?: number | null
          starch_g?: number | null
          sugar_g?: number | null
          trans_fat_g?: number | null
          user_id?: string | null
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
          user_id: string | null
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
          user_id?: string | null
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
          user_id?: string | null
        }
        Relationships: []
      }
      workout_exercises: {
        Row: {
          created_at: string
          id: string
          library_id: string | null
          mode: string
          name: string
          position: number
          reps: number
          rest_seconds: number
          rounds: number
          seconds: number
          user_id: string
          weight_kg: number
          workout_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          library_id?: string | null
          mode?: string
          name: string
          position?: number
          reps?: number
          rest_seconds?: number
          rounds?: number
          seconds?: number
          user_id: string
          weight_kg?: number
          workout_id: string
        }
        Update: {
          created_at?: string
          id?: string
          library_id?: string | null
          mode?: string
          name?: string
          position?: number
          reps?: number
          rest_seconds?: number
          rounds?: number
          seconds?: number
          user_id?: string
          weight_kg?: number
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercises_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "exercise_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercises_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sets: {
        Row: {
          completed_at: string
          date: string
          exercise_name: string
          id: string
          reps: number
          round_index: number
          seconds: number
          user_id: string
          weight_kg: number
          workout_exercise_id: string
        }
        Insert: {
          completed_at?: string
          date?: string
          exercise_name: string
          id?: string
          reps?: number
          round_index?: number
          seconds?: number
          user_id: string
          weight_kg?: number
          workout_exercise_id: string
        }
        Update: {
          completed_at?: string
          date?: string
          exercise_name?: string
          id?: string
          reps?: number
          round_index?: number
          seconds?: number
          user_id?: string
          weight_kg?: number
          workout_exercise_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sets_workout_exercise_id_fkey"
            columns: ["workout_exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_templates: {
        Row: {
          created_at: string
          id: string
          name: string
          payload: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          payload?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          payload?: Json
          user_id?: string
        }
        Relationships: []
      }
      workouts: {
        Row: {
          completed_at: string | null
          created_at: string
          date: string
          id: string
          name: string
          template_key: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          date?: string
          id?: string
          name?: string
          template_key?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          date?: string
          id?: string
          name?: string
          template_key?: string | null
          updated_at?: string
          user_id?: string
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
