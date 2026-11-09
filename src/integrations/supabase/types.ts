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
      family_applications: {
        Row: {
          applicant_name: string
          applicant_passport: string
          applicant_phone: string
          application_date: string
          client_signature: string
          created_at: string
          family_name: string
          fee: number
          house_number: string
          id: string
          lawyer_name: string
          lawyer_passport: string
          lawyer_phone: string
          lawyer_signature: string
          notes: string
          owner_id: string
          status: Database["public"]["Enums"]["application_status"]
          sworn_statement: boolean
          updated_at: string
        }
        Insert: {
          applicant_name: string
          applicant_passport: string
          applicant_phone: string
          application_date?: string
          client_signature?: string
          created_at?: string
          family_name: string
          fee?: number
          house_number: string
          id?: string
          lawyer_name: string
          lawyer_passport: string
          lawyer_phone: string
          lawyer_signature?: string
          notes?: string
          owner_id?: string
          status?: Database["public"]["Enums"]["application_status"]
          sworn_statement?: boolean
          updated_at?: string
        }
        Update: {
          applicant_name?: string
          applicant_passport?: string
          applicant_phone?: string
          application_date?: string
          client_signature?: string
          created_at?: string
          family_name?: string
          fee?: number
          house_number?: string
          id?: string
          lawyer_name?: string
          lawyer_passport?: string
          lawyer_phone?: string
          lawyer_signature?: string
          notes?: string
          owner_id?: string
          status?: Database["public"]["Enums"]["application_status"]
          sworn_statement?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          lawyer_type: Database["public"]["Enums"]["lawyer_type"]
          license_valid_until: string | null
          organization: string | null
          passport_number: string
          phone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          lawyer_type?: Database["public"]["Enums"]["lawyer_type"]
          license_valid_until?: string | null
          organization?: string | null
          passport_number?: string
          phone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          lawyer_type?: Database["public"]["Enums"]["lawyer_type"]
          license_valid_until?: string | null
          organization?: string | null
          passport_number?: string
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          client_name: string
          client_phone: string
          created_at: string
          description: string
          duration_minutes: number | null
          family_application_id: string | null
          fee: number
          id: string
          max_fee: number
          owner_id: string
          service_date: string
          service_type: Database["public"]["Enums"]["service_type"]
          updated_at: string
        }
        Insert: {
          client_name: string
          client_phone: string
          created_at?: string
          description?: string
          duration_minutes?: number | null
          family_application_id?: string | null
          fee?: number
          id?: string
          max_fee?: number
          owner_id?: string
          service_date?: string
          service_type: Database["public"]["Enums"]["service_type"]
          updated_at?: string
        }
        Update: {
          client_name?: string
          client_phone?: string
          created_at?: string
          description?: string
          duration_minutes?: number | null
          family_application_id?: string | null
          fee?: number
          id?: string
          max_fee?: number
          owner_id?: string
          service_date?: string
          service_type?: Database["public"]["Enums"]["service_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_family_application_id_fkey"
            columns: ["family_application_id"]
            isOneToOne: false
            referencedRelation: "family_applications"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ravo_max_fee: {
        Args: {
          _minutes: number
          _type: Database["public"]["Enums"]["service_type"]
        }
        Returns: number
      }
    }
    Enums: {
      application_status: "entwurf" | "eingereicht" | "genehmigt" | "abgelehnt"
      lawyer_type: "rechtsanwalt" | "orgaanwalt"
      service_type:
        | "beratung"
        | "verteidigung"
        | "revisionsantrag"
        | "familienantrag"
        | "sonstiger_antrag"
        | "schnellverfahren"
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
      application_status: ["entwurf", "eingereicht", "genehmigt", "abgelehnt"],
      lawyer_type: ["rechtsanwalt", "orgaanwalt"],
      service_type: [
        "beratung",
        "verteidigung",
        "revisionsantrag",
        "familienantrag",
        "sonstiger_antrag",
        "schnellverfahren",
      ],
    },
  },
} as const
