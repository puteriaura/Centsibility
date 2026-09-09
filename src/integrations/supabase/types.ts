export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      commander_pins: {
        Row: {
          parent_id: string;
          pin_hash: string;
          created_at: string;
        };
        Insert: {
          parent_id: string;
          pin_hash: string;
          created_at?: string;
        };
        Update: {
          parent_id?: string;
          pin_hash?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "commander_pins_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      child_creation_keys: {
        Row: {
          id: string;
          parent_id: string;
          hashed_key: string;
          salt: string;
          expires_at: string;
          used: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          parent_id: string;
          hashed_key: string;
          salt: string;
          expires_at: string;
          used?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          parent_id?: string;
          hashed_key?: string;
          salt?: string;
          expires_at?: string;
          used?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "child_creation_keys_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      approvals: {
        Row: {
          amount: number;
          created_at: string;
          id: string;
          kid_id: string;
          kind: string;
          reason: string;
          resolved_at: string | null;
          status: string;
        };
        Insert: {
          amount?: number;
          created_at?: string;
          id?: string;
          kid_id: string;
          kind: string;
          reason: string;
          resolved_at?: string | null;
          status?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          id?: string;
          kid_id?: string;
          kind?: string;
          reason?: string;
          resolved_at?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "approvals_kid_id_fkey";
            columns: ["kid_id"];
            isOneToOne: false;
            referencedRelation: "kids";
            referencedColumns: ["id"];
          },
        ];
      };
      goals: {
        Row: {
          created_at: string;
          emoji: string;
          id: string;
          kid_id: string;
          name: string;
          saved: number;
          target: number;
        };
        Insert: {
          created_at?: string;
          emoji?: string;
          id?: string;
          kid_id: string;
          name: string;
          saved?: number;
          target: number;
        };
        Update: {
          created_at?: string;
          emoji?: string;
          id?: string;
          kid_id?: string;
          name?: string;
          saved?: number;
          target?: number;
        };
        Relationships: [
          {
            foreignKeyName: "goals_kid_id_fkey";
            columns: ["kid_id"];
            isOneToOne: false;
            referencedRelation: "kids";
            referencedColumns: ["id"];
          },
        ];
      };
      kids: {
        Row: {
          avatar: string;
          balance: number;
          bio: string | null;
          birth_date: string | null;
          birth_year: number | null;
          bridge_key_hash: string | null;
          coins: number;
          coins_decimal: number;
          created_at: string;
          failed_login_attempts: number | null;
          hashed_pin: string | null;
          hibah_rate: number;
          id: string;
          invest_balance: number;
          last_login_date: string | null;
          invest_last_paid: string;
          invest_rate: number;
          level: number;
          locked_until: string | null;
          login_code: string | null;
          name: string;
          parent_id: string;
          quiz_correct: number;
          quiz_date: string | null;
          quiz_index: number;
          quiz_wrong: number;
          streak: number;
          trust_score: number;
          unclaimed_coins: number;
          username: string | null;
          xp: number;
          session_token: string | null;
        };
        Insert: {
          avatar?: string;
          balance?: number;
          bio?: string | null;
          birth_date?: string | null;
          birth_year?: number | null;
          bridge_key_hash?: string | null;
          coins?: number;
          coins_decimal?: number;
          created_at?: string;
          failed_login_attempts?: number | null;
          hashed_pin?: string | null;
          hibah_rate?: number;
          id?: string;
          invest_balance?: number;
          last_login_date?: string | null;
          invest_last_paid?: string;
          invest_rate?: number;
          level?: number;
          locked_until?: string | null;
          login_code?: string | null;
          name: string;
          parent_id: string;
          quiz_correct?: number;
          quiz_date?: string | null;
          quiz_index?: number;
          quiz_wrong?: number;
          streak?: number;
          trust_score?: number;
          unclaimed_coins?: number;
          username?: string | null;
          xp?: number;
          session_token?: string | null;
        };
        Update: {
          avatar?: string;
          balance?: number;
          bio?: string | null;
          birth_date?: string | null;
          birth_year?: number | null;
          bridge_key_hash?: string | null;
          coins?: number;
          coins_decimal?: number;
          created_at?: string;
          failed_login_attempts?: number | null;
          hashed_pin?: string | null;
          hibah_rate?: number;
          id?: string;
          invest_balance?: number;
          last_login_date?: string | null;
          invest_last_paid?: string;
          invest_rate?: number;
          level?: number;
          locked_until?: string | null;
          login_code?: string | null;
          name?: string;
          parent_id?: string;
          quiz_correct?: number;
          quiz_date?: string | null;
          quiz_index?: number;
          quiz_wrong?: number;
          streak?: number;
          trust_score?: number;
          unclaimed_coins?: number;
          username?: string | null;
          xp?: number;
          session_token?: string | null;
        };
        Relationships: [];
      };
      loans: {
        Row: {
          amount: number;
          created_at: string;
          due_date: string;
          id: string;
          kid_id: string;
          reason: string | null;
          repaid: number;
          signature_data_url: string | null;
          signed_at: string | null;
          status: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          due_date: string;
          id?: string;
          kid_id: string;
          reason?: string | null;
          repaid?: number;
          signature_data_url?: string | null;
          signed_at?: string | null;
          status?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          due_date?: string;
          id?: string;
          kid_id?: string;
          reason?: string | null;
          repaid?: number;
          signature_data_url?: string | null;
          signed_at?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "loans_kid_id_fkey";
            columns: ["kid_id"];
            isOneToOne: false;
            referencedRelation: "kids";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          created_at: string;
          id: string;
          kid_id: string | null;
          kind: string;
          link: string | null;
          message: string;
          parent_id: string;
          read: boolean;
        };
        Insert: {
          created_at?: string;
          id?: string;
          kid_id?: string | null;
          kind: string;
          link?: string | null;
          message: string;
          parent_id: string;
          read?: boolean;
        };
        Update: {
          created_at?: string;
          id?: string;
          kid_id?: string | null;
          kind?: string;
          link?: string | null;
          message?: string;
          parent_id?: string;
          read?: boolean;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar: string;
          created_at: string;
          display_name: string | null;
          email: string | null;
          id: string;
          pin: string | null;
        };
        Insert: {
          avatar?: string;
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id: string;
          pin?: string | null;
        };
        Update: {
          avatar?: string;
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id?: string;
          pin?: string | null;
        };
        Relationships: [];
      };
      quiz_attempts: {
        Row: {
          correct: boolean;
          created_at: string;
          id: string;
          kid_id: string;
          question_index: number;
          question_text: string;
        };
        Insert: {
          correct: boolean;
          created_at?: string;
          id?: string;
          kid_id: string;
          question_index: number;
          question_text: string;
        };
        Update: {
          correct?: boolean;
          created_at?: string;
          id?: string;
          kid_id?: string;
          question_index?: number;
          question_text?: string;
        };
        Relationships: [];
      };
      rewards: {
        Row: {
          cost: number;
          created_at: string;
          id: string;
          kid_id: string;
          name: string;
          status: string;
        };
        Insert: {
          cost?: number;
          created_at?: string;
          id?: string;
          kid_id: string;
          name: string;
          status?: string;
        };
        Update: {
          cost?: number;
          created_at?: string;
          id?: string;
          kid_id?: string;
          name?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rewards_kid_id_fkey";
            columns: ["kid_id"];
            isOneToOne: false;
            referencedRelation: "kids";
            referencedColumns: ["id"];
          },
        ];
      };
      transactions: {
        Row: {
          amount: number;
          created_at: string;
          id: string;
          kid_id: string;
          label: string;
          type: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          id?: string;
          kid_id: string;
          label: string;
          type: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          id?: string;
          kid_id?: string;
          label?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_kid_id_fkey";
            columns: ["kid_id"];
            isOneToOne: false;
            referencedRelation: "kids";
            referencedColumns: ["id"];
          },
        ];
      };
      scheduled_hibahs: {
        Row: {
          id: string;
          parent_id: string;
          kid_id: string;
          amount: number;
          frequency: string;
          start_date: string;
          end_date: string | null;
          next_run_at: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          parent_id: string;
          kid_id: string;
          amount: number;
          frequency: string;
          start_date: string;
          end_date?: string | null;
          next_run_at: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          parent_id?: string;
          kid_id?: string;
          amount?: number;
          frequency?: string;
          start_date?: string;
          end_date?: string | null;
          next_run_at?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scheduled_hibahs_kid_id_fkey";
            columns: ["kid_id"];
            isOneToOne: false;
            referencedRelation: "kids";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scheduled_hibahs_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
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

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

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
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
