export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

type TableShape<Row, Insert, Update> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      tenants: TableShape<
        {
          id: string
          slug: string
          name: string
          segment: string
          phone: string
          email: string | null
          logo_url: string | null
          primary_color: string | null
          site_style: string
          bio: string | null
          address: string | null
          plan: string
          subscription_status: string
          trial_started_at: string
          trial_ends_at: string
          created_at: string
          updated_at: string
        },
        {
          id?: string
          slug: string
          name: string
          segment?: string
          phone: string
          email?: string | null
          logo_url?: string | null
          primary_color?: string | null
          site_style?: string
          bio?: string | null
          address?: string | null
          plan?: string
          subscription_status?: string
          trial_started_at?: string
          trial_ends_at?: string
          created_at?: string
          updated_at?: string
        },
        {
          slug?: string
          name?: string
          segment?: string
          phone?: string
          email?: string | null
          logo_url?: string | null
          primary_color?: string | null
          site_style?: string
          bio?: string | null
          address?: string | null
          updated_at?: string
        }
      >
      tenant_members: TableShape<
        { id: string; tenant_id: string; user_id: string; role: string; created_at: string },
        { id?: string; tenant_id: string; user_id: string; role?: string; created_at?: string },
        { role?: string }
      >
      tenant_settings: TableShape<
        {
          tenant_id: string
          open_time: string
          close_time: string
          lunch_start: string | null
          lunch_end: string | null
          service_minutes: number
          slot_interval_minutes: number
          open_weekdays: number[]
          updated_at: string
        },
        {
          tenant_id: string
          open_time?: string
          close_time?: string
          lunch_start?: string | null
          lunch_end?: string | null
          service_minutes?: number
          slot_interval_minutes?: number
          open_weekdays?: number[]
          updated_at?: string
        },
        {
          open_time?: string
          close_time?: string
          lunch_start?: string | null
          lunch_end?: string | null
          service_minutes?: number
          slot_interval_minutes?: number
          open_weekdays?: number[]
          updated_at?: string
        }
      >
      tenant_services: TableShape<
        {
          id: string
          tenant_id: string
          name: string
          description: string | null
          duration_minutes: number
          price: number
          max_capacity: number
          active: boolean
          sort_order: number
          created_at: string
        },
        {
          id?: string
          tenant_id: string
          name: string
          description?: string | null
          duration_minutes: number
          price?: number
          max_capacity?: number
          active?: boolean
          sort_order?: number
          created_at?: string
        },
        {
          name?: string
          description?: string | null
          duration_minutes?: number
          price?: number
          max_capacity?: number
          active?: boolean
          sort_order?: number
        }
      >
      tenant_professionals: TableShape<
        {
          id: string
          tenant_id: string
          name: string
          role: string
          phone: string | null
          avatar_url: string | null
          active: boolean
          created_at: string
        },
        {
          id?: string
          tenant_id: string
          name: string
          role?: string
          phone?: string | null
          avatar_url?: string | null
          active?: boolean
          created_at?: string
        },
        {
          name?: string
          role?: string
          phone?: string | null
          avatar_url?: string | null
          active?: boolean
        }
      >
      tenant_appointments: TableShape<
        {
          id: string
          tenant_id: string
          service_id: string
          professional_id: string | null
          service_name: string
          professional_name: string | null
          client_name: string
          phone: string
          date: string
          time: string
          status: string
          price: number
          created_at: string
        },
        {
          id?: string
          tenant_id: string
          service_id: string
          professional_id?: string | null
          service_name: string
          professional_name?: string | null
          client_name: string
          phone: string
          date: string
          time: string
          status?: string
          price?: number
          created_at?: string
        },
        { status?: string; date?: string; time?: string }
      >
      appointments: {
        Row: {
          client_name: string
          created_at: string
          date: string
          id: string
          phone: string
          service: string
          status: string
          time: string
        }
        Insert: {
          client_name: string
          created_at?: string
          date: string
          id?: string
          phone: string
          service: string
          status?: string
          time: string
        }
        Update: {
          client_name?: string
          created_at?: string
          date?: string
          id?: string
          phone?: string
          service?: string
          status?: string
          time?: string
        }
        Relationships: []
      }
      blocked_dates: {
        Row: {
          created_at: string
          date: string
          id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
        }
        Relationships: []
      }
      business_settings: {
        Row: {
          close_time: string
          id: number
          lunch_end: string | null
          lunch_start: string | null
          open_time: string
          open_weekdays: number[]
          service_minutes: number
          slot_interval_minutes: number
          updated_at: string
        }
        Insert: {
          close_time?: string
          id?: number
          lunch_end?: string | null
          lunch_start?: string | null
          open_time?: string
          open_weekdays?: number[]
          service_minutes?: number
          slot_interval_minutes?: number
          updated_at?: string
        }
        Update: {
          close_time?: string
          id?: number
          lunch_end?: string | null
          lunch_start?: string | null
          open_time?: string
          open_weekdays?: number[]
          service_minutes?: number
          slot_interval_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      book_tenant_appointment: {
        Args: {
          _date: string
          _name: string
          _phone: string
          _price?: number
          _professional_id: string | null
          _service_id: string
          _service_name: string
          _tenant_id: string
          _time: string
        }
        Returns: string
      }
      change_tenant_appointment: {
        Args: {
          _appointment_id: string
          _cancel?: boolean
          _new_date?: string | null
          _new_time?: string | null
          _phone: string
        }
        Returns: undefined
      }
      create_tenant_with_owner: {
        Args: {
          _close_time: string
          _lunch_end: string | null
          _lunch_start: string | null
          _name: string
          _open_time: string
          _open_weekdays: number[]
          _phone: string
          _primary_color: string
          _segment: string
          _service_capacity: number
          _service_duration: number
          _service_name: string
          _service_price: number
          _site_style: string
          _slug: string
        }
        Returns: string
      }
      find_tenant_appointments: {
        Args: { _phone: string; _tenant_id: string }
        Returns: {
          client_name: string
          date: string
          id: string
          service_name: string
          time: string
        }[]
      }
      get_public_tenant_page: { Args: { _slug: string }; Returns: Json }
      get_tenant_occupied_slots: {
        Args: { _date: string; _professional_id?: string | null; _service_id: string; _tenant_id: string }
        Returns: string[]
      }
      tenant_has_access: { Args: { _tenant_id: string }; Returns: boolean }
      update_tenant_appointment: {
        Args: { _appointment_id: string; _date?: string | null; _status?: string | null; _time?: string | null }
        Returns: undefined
      }
      admin_exists: { Args: never; Returns: boolean }
      book_appointment: {
        Args: {
          _date: string
          _name: string
          _phone: string
          _service: string
          _time: string
        }
        Returns: string
      }
      cancel_appointment: {
        Args: { _id: string; _phone: string }
        Returns: undefined
      }
      find_my_appointment: {
        Args: { _phone: string }
        Returns: {
          client_name: string
          date: string
          id: string
          service: string
          time: string
        }[]
      }
      get_occupied_times: { Args: { _date: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      reschedule_appointment: {
        Args: { _date: string; _id: string; _phone: string; _time: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin"
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
      app_role: ["admin"],
    },
  },
} as const
