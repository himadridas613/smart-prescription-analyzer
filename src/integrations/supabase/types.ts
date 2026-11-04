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
      admin_audit_logs: {
        Row: {
          action: string
          admin_email: string | null
          admin_id: string | null
          created_at: string
          id: string
          ip: string | null
          metadata: Json
          new_value: Json | null
          previous_value: Json | null
          target_email: string | null
          target_user_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_email?: string | null
          admin_id?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          metadata?: Json
          new_value?: Json | null
          previous_value?: Json | null
          target_email?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_email?: string | null
          admin_id?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          metadata?: Json
          new_value?: Json | null
          previous_value?: Json | null
          target_email?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      announcements: {
        Row: {
          audience: string
          body: string
          created_at: string
          created_by: string | null
          id: string
          published_at: string | null
          status: string
          title: string
          type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          audience?: string
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string | null
          status?: string
          title: string
          type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      notification_logs: {
        Row: {
          announcement_id: string | null
          channel: string
          created_at: string
          error: string | null
          id: string
          notification_id: string | null
          recipient_email: string | null
          retry_count: number
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          announcement_id?: string | null
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          notification_id?: string | null
          recipient_email?: string | null
          retry_count?: number
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          announcement_id?: string | null
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          notification_id?: string | null
          recipient_email?: string | null
          retry_count?: number
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          read: boolean
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      prescriptions: {
        Row: {
          ai_model: string | null
          blur_score: number | null
          created_at: string
          error: string | null
          error_type: string | null
          file_name: string | null
          file_size: number | null
          file_type: string | null
          id: string
          image_quality: number | null
          json_valid: boolean | null
          ocr_confidence: number | null
          processing_ms: number | null
          retry_count: number
          stage: string
          status: string
          storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_model?: string | null
          blur_score?: number | null
          created_at?: string
          error?: string | null
          error_type?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          image_quality?: number | null
          json_valid?: boolean | null
          ocr_confidence?: number | null
          processing_ms?: number | null
          retry_count?: number
          stage?: string
          status?: string
          storage_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_model?: string | null
          blur_score?: number | null
          created_at?: string
          error?: string | null
          error_type?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          image_quality?: number | null
          json_valid?: boolean | null
          ocr_confidence?: number | null
          processing_ms?: number | null
          retry_count?: number
          stage?: string
          status?: string
          storage_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          deactivated_at: string | null
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          last_login_at: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          deactivated_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          last_login_at?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          deactivated_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      report_access_log: {
        Row: {
          access_type: string
          created_at: string
          id: string
          ip: string | null
          owner_id: string | null
          report_id: string | null
          status: string
          token_id: string | null
          user_agent: string | null
          viewer_id: string | null
        }
        Insert: {
          access_type?: string
          created_at?: string
          id?: string
          ip?: string | null
          owner_id?: string | null
          report_id?: string | null
          status?: string
          token_id?: string | null
          user_agent?: string | null
          viewer_id?: string | null
        }
        Update: {
          access_type?: string
          created_at?: string
          id?: string
          ip?: string | null
          owner_id?: string | null
          report_id?: string | null
          status?: string
          token_id?: string | null
          user_agent?: string | null
          viewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_access_log_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_access_log_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "shared_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_grants: {
        Row: {
          created_at: string
          expires_at: string | null
          grantee_id: string
          grantee_role: Database["public"]["Enums"]["app_role"]
          id: string
          note: string | null
          owner_id: string
          report_id: string
          revoked_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          grantee_id: string
          grantee_role: Database["public"]["Enums"]["app_role"]
          id?: string
          note?: string | null
          owner_id: string
          report_id: string
          revoked_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          grantee_id?: string
          grantee_role?: Database["public"]["Enums"]["app_role"]
          id?: string
          note?: string | null
          owner_id?: string
          report_id?: string
          revoked_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_grants_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          confidence: number | null
          created_at: string
          doctor_name: string | null
          duplicates: Json
          id: string
          interactions: Json
          medicines: Json
          patient_name: string | null
          prescription_id: string
          risk_level: string | null
          summary: string | null
          user_id: string
          warnings: Json
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          doctor_name?: string | null
          duplicates?: Json
          id?: string
          interactions?: Json
          medicines?: Json
          patient_name?: string | null
          prescription_id: string
          risk_level?: string | null
          summary?: string | null
          user_id: string
          warnings?: Json
        }
        Update: {
          confidence?: number | null
          created_at?: string
          doctor_name?: string | null
          duplicates?: Json
          id?: string
          interactions?: Json
          medicines?: Json
          patient_name?: string | null
          prescription_id?: string
          risk_level?: string | null
          summary?: string | null
          user_id?: string
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "reports_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_reports: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          report_id: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          report_id: string
          token?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          report_id?: string
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_reports_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      system_logs: {
        Row: {
          action: string
          actor_email: string | null
          created_at: string
          id: string
          ip: string | null
          metadata: Json | null
          role: string | null
          status: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          metadata?: Json | null
          role?: string | null
          status?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          metadata?: Json | null
          role?: string | null
          status?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_report_grant: {
        Args: { _report_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "user" | "doctor" | "pharmacist" | "admin"
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
      app_role: ["user", "doctor", "pharmacist", "admin"],
    },
  },
} as const
