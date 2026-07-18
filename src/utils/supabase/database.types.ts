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
      akhir_sekolah_payments: {
        Row: {
          adm_akhir_tka: number
          created_at: string
          created_by: string
          id: string
          student_id: string
          uang_perpisahan: number
        }
        Insert: {
          adm_akhir_tka?: number
          created_at?: string
          created_by: string
          id?: string
          student_id: string
          uang_perpisahan?: number
        }
        Update: {
          adm_akhir_tka?: number
          created_at?: string
          created_by?: string
          id?: string
          student_id?: string
          uang_perpisahan?: number
        }
        Relationships: [
          {
            foreignKeyName: "akhir_sekolah_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "akhir_sekolah_payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action_type"]
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action_type"]
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action_type"]
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      classes: {
        Row: {
          class_name: string
          created_at: string
          grade_level: string
          homeroom_teacher: string | null
          id: string
        }
        Insert: {
          class_name: string
          created_at?: string
          grade_level: string
          homeroom_teacher?: string | null
          id?: string
        }
        Update: {
          class_name?: string
          created_at?: string
          grade_level?: string
          homeroom_teacher?: string | null
          id?: string
        }
        Relationships: []
      }
      config: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      inventory: {
        Row: {
          created_at: string
          grade_level: string | null
          id: string
          item_name: string
          stock_quantity: number | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string
          grade_level?: string | null
          id?: string
          item_name: string
          stock_quantity?: number | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string
          grade_level?: string | null
          id?: string
          item_name?: string
          stock_quantity?: number | null
          unit_price?: number | null
        }
        Relationships: []
      }
      master_tagihan: {
        Row: {
          created_at: string | null
          id: string
          nama_tagihan: string
          nominal_default: number | null
          tipe_tagihan: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nama_tagihan: string
          nominal_default?: number | null
          tipe_tagihan: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nama_tagihan?: string
          nominal_default?: number | null
          tipe_tagihan?: string
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          admin_id: string | null
          amount: number
          bill_id: string | null
          id: string
          jenis_tagihan: string
          payment_date: string
          receipt_id: string
          student_id: string
        }
        Insert: {
          admin_id?: string | null
          amount: number
          bill_id?: string | null
          id?: string
          jenis_tagihan: string
          payment_date?: string
          receipt_id: string
          student_id: string
        }
        Update: {
          admin_id?: string | null
          amount?: number
          bill_id?: string | null
          id?: string
          jenis_tagihan?: string
          payment_date?: string
          receipt_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "student_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["role_type"]
          status: Database["public"]["Enums"]["status_type"]
        }
        Insert: {
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["role_type"]
          status?: Database["public"]["Enums"]["status_type"]
        }
        Update: {
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["role_type"]
          status?: Database["public"]["Enums"]["status_type"]
        }
        Relationships: []
      }
      psb_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          id: string
          student_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          id?: string
          student_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "psb_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "psb_payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          created_at: string
          id: string
          item_name: string | null
          quantity: number | null
          student_id: string | null
          total_price: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_name?: string | null
          quantity?: number | null
          student_id?: string | null
          total_price?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          item_name?: string | null
          quantity?: number | null
          student_id?: string | null
          total_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      spp_payments: {
        Row: {
          created_at: string
          created_by: string
          id: string
          month: string
          spp_amount: number
          student_id: string
          updated_at: string
          uskul_amount: number
          year: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          month: string
          spp_amount?: number
          student_id: string
          updated_at?: string
          uskul_amount?: number
          year: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          month?: string
          spp_amount?: number
          student_id?: string
          updated_at?: string
          uskul_amount?: number
          year?: string
        }
        Relationships: [
          {
            foreignKeyName: "spp_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spp_payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_bills: {
        Row: {
          bulan_tagihan: string
          created_at: string | null
          id: string
          jenis_tagihan: string
          nominal: number
          status: string | null
          student_id: string | null
          tanggal_jatuh_tempo: string
        }
        Insert: {
          bulan_tagihan: string
          created_at?: string | null
          id?: string
          jenis_tagihan: string
          nominal: number
          status?: string | null
          student_id?: string | null
          tanggal_jatuh_tempo: string
        }
        Update: {
          bulan_tagihan?: string
          created_at?: string | null
          id?: string
          jenis_tagihan?: string
          nominal?: number
          status?: string | null
          student_id?: string | null
          tanggal_jatuh_tempo?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_bills_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          class_id: string | null
          class_name: string | null
          created_at: string
          diskon: Json | null
          grade_level: Database["public"]["Enums"]["grade_level_type"]
          id: string
          name: string
          nis: string | null
          parent_phone: string | null
          status: string
        }
        Insert: {
          class_id?: string | null
          class_name?: string | null
          created_at?: string
          diskon?: Json | null
          grade_level: Database["public"]["Enums"]["grade_level_type"]
          id?: string
          name: string
          nis?: string | null
          parent_phone?: string | null
          status?: string
        }
        Update: {
          class_id?: string | null
          class_name?: string | null
          created_at?: string
          diskon?: Json | null
          grade_level?: Database["public"]["Enums"]["grade_level_type"]
          id?: string
          name?: string
          nis?: string | null
          parent_phone?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      uniform_items: {
        Row: {
          created_at: string
          grade_level: Database["public"]["Enums"]["grade_level_type"]
          id: string
          name: string
          stock_quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          grade_level: Database["public"]["Enums"]["grade_level_type"]
          id?: string
          name: string
          stock_quantity?: number
          unit_price: number
        }
        Update: {
          created_at?: string
          grade_level?: Database["public"]["Enums"]["grade_level_type"]
          id?: string
          name?: string
          stock_quantity?: number
          unit_price?: number
        }
        Relationships: []
      }
      uniform_sales: {
        Row: {
          created_at: string
          created_by: string
          date: string
          id: string
          item_id: string
          quantity: number
          total_price: number
        }
        Insert: {
          created_at?: string
          created_by: string
          date?: string
          id?: string
          item_id: string
          quantity: number
          total_price: number
        }
        Update: {
          created_at?: string
          created_by?: string
          date?: string
          id?: string
          item_id?: string
          quantity?: number
          total_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "uniform_sales_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uniform_sales_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "uniform_items"
            referencedColumns: ["id"]
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
      audit_action_type: "INSERT" | "UPDATE" | "DELETE"
      grade_level_type: "SD" | "SMP"
      role_type: "admin" | "pimpinan"
      status_type: "aktif" | "nonaktif"
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
      audit_action_type: ["INSERT", "UPDATE", "DELETE"],
      grade_level_type: ["SD", "SMP"],
      role_type: ["admin", "pimpinan"],
      status_type: ["aktif", "nonaktif"],
    },
  },
} as const
