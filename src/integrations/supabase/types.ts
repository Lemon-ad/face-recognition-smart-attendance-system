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
      attendance: {
        Row: {
          attendance_id: string
          check_in_time: string | null
          check_out_time: string | null
          created_at: string | null
          location: string | null
          status: Database["public"]["Enums"]["attendance_status_enum"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          attendance_id?: string
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string | null
          location?: string | null
          status: Database["public"]["Enums"]["attendance_status_enum"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          attendance_id?: string
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string | null
          location?: string | null
          status?: Database["public"]["Enums"]["attendance_status_enum"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      attendance_history: {
        Row: {
          archived_at: string
          attendance_date: string
          attendance_id: string
          check_in_time: string | null
          check_out_time: string | null
          created_at: string | null
          history_id: string
          location: string | null
          status: Database["public"]["Enums"]["attendance_status_enum"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          archived_at?: string
          attendance_date: string
          attendance_id: string
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string | null
          history_id?: string
          location?: string | null
          status: Database["public"]["Enums"]["attendance_status_enum"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          archived_at?: string
          attendance_date?: string
          attendance_id?: string
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string | null
          history_id?: string
          location?: string | null
          status?: Database["public"]["Enums"]["attendance_status_enum"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      department: {
        Row: {
          created_at: string | null
          department_description: string | null
          department_id: string
          department_location: string | null
          department_name: string
          end_time: string | null
          start_time: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          department_description?: string | null
          department_id?: string
          department_location?: string | null
          department_name: string
          end_time?: string | null
          start_time?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          department_description?: string | null
          department_id?: string
          department_location?: string | null
          department_name?: string
          end_time?: string | null
          start_time?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      group: {
        Row: {
          created_at: string | null
          department_id: string | null
          end_time: string | null
          group_description: string | null
          group_id: string
          group_location: string | null
          group_name: string
          start_time: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          department_id?: string | null
          end_time?: string | null
          group_description?: string | null
          group_id?: string
          group_location?: string | null
          group_name: string
          start_time?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          department_id?: string | null
          end_time?: string | null
          group_description?: string | null
          group_id?: string
          group_location?: string | null
          group_name?: string
          start_time?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department"
            referencedColumns: ["department_id"]
          },
        ]
      }
      users: {
        Row: {
          auth_uuid: string
          created_at: string | null
          date_of_joining: string | null
          department_id: string | null
          email: string | null
          first_name: string | null
          group_id: string | null
          ic_number: string | null
          last_name: string | null
          middle_name: string | null
          phone_number: string | null
          photo_url: string | null
          position_name: string | null
          role: Database["public"]["Enums"]["user_role_enum"]
          updated_at: string | null
          user_id: string
          username: string | null
        }
        Insert: {
          auth_uuid: string
          created_at?: string | null
          date_of_joining?: string | null
          department_id?: string | null
          email?: string | null
          first_name?: string | null
          group_id?: string | null
          ic_number?: string | null
          last_name?: string | null
          middle_name?: string | null
          phone_number?: string | null
          photo_url?: string | null
          position_name?: string | null
          role: Database["public"]["Enums"]["user_role_enum"]
          updated_at?: string | null
          user_id?: string
          username?: string | null
        }
        Update: {
          auth_uuid?: string
          created_at?: string | null
          date_of_joining?: string | null
          department_id?: string | null
          email?: string | null
          first_name?: string | null
          group_id?: string | null
          ic_number?: string | null
          last_name?: string | null
          middle_name?: string | null
          phone_number?: string | null
          photo_url?: string | null
          position_name?: string | null
          role?: Database["public"]["Enums"]["user_role_enum"]
          updated_at?: string | null
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "users_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "group"
            referencedColumns: ["group_id"]
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
      attendance_status_enum:
        | "absent"
        | "present"
        | "late"
        | "early_out"
        | "no_checkout"
      user_role_enum: "admin" | "member"
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
      attendance_status_enum: [
        "absent",
        "present",
        "late",
        "early_out",
        "no_checkout",
      ],
      user_role_enum: ["admin", "member"],
    },
  },
} as const
