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
      barangays: {
        Row: {
          city_code: string
          code: string
          name: string
          slug: string
        }
        Insert: {
          city_code: string
          code: string
          name: string
          slug: string
        }
        Update: {
          city_code?: string
          code?: string
          name?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "barangays_city_code_fkey"
            columns: ["city_code"]
            isOneToOne: false
            referencedRelation: "cities_municipalities"
            referencedColumns: ["code"]
          },
        ]
      }
      business_import_runs: {
        Row: {
          businesses_upserted: number
          error: string | null
          finished_at: string | null
          id: string
          source: string
          started_at: string
          status: string
          total_fetched: number
        }
        Insert: {
          businesses_upserted?: number
          error?: string | null
          finished_at?: string | null
          id?: string
          source: string
          started_at?: string
          status: string
          total_fetched?: number
        }
        Update: {
          businesses_upserted?: number
          error?: string | null
          finished_at?: string | null
          id?: string
          source?: string
          started_at?: string
          status?: string
          total_fetched?: number
        }
        Relationships: []
      }
      business_imports: {
        Row: {
          created_at: string
          created_business_id: string | null
          created_by: string | null
          error: string | null
          extracted: Json | null
          id: string
          ip_hash: string | null
          raw_payload: Json | null
          source: Database["public"]["Enums"]["business_import_source"]
          source_external_id: string | null
          source_url: string
          status: Database["public"]["Enums"]["business_import_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_business_id?: string | null
          created_by?: string | null
          error?: string | null
          extracted?: Json | null
          id?: string
          ip_hash?: string | null
          raw_payload?: Json | null
          source: Database["public"]["Enums"]["business_import_source"]
          source_external_id?: string | null
          source_url: string
          status?: Database["public"]["Enums"]["business_import_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_business_id?: string | null
          created_by?: string | null
          error?: string | null
          extracted?: Json | null
          id?: string
          ip_hash?: string | null
          raw_payload?: Json | null
          source?: Database["public"]["Enums"]["business_import_source"]
          source_external_id?: string | null
          source_url?: string
          status?: Database["public"]["Enums"]["business_import_status"]
          updated_at?: string
        }
        Relationships: []
      }
      businesses: {
        Row: {
          additional_types: Database["public"]["Enums"]["business_type"][]
          address: string | null
          barangay_code: string
          contact_email: string | null
          contact_phone: string | null
          cover_image_url: string | null
          created_at: string
          custom_types: string[]
          description: string | null
          hours: string | null
          id: string
          import_source_id: string | null
          imported_from: string | null
          is_claimed: boolean
          is_published: boolean
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name: string
          owner_id: string | null
          slug: string
          tags: string[]
          type: Database["public"]["Enums"]["business_type"]
          updated_at: string
          website: string | null
        }
        Insert: {
          additional_types?: Database["public"]["Enums"]["business_type"][]
          address?: string | null
          barangay_code: string
          contact_email?: string | null
          contact_phone?: string | null
          cover_image_url?: string | null
          created_at?: string
          custom_types?: string[]
          description?: string | null
          hours?: string | null
          id?: string
          import_source_id?: string | null
          imported_from?: string | null
          is_claimed?: boolean
          is_published?: boolean
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name: string
          owner_id?: string | null
          slug: string
          tags?: string[]
          type: Database["public"]["Enums"]["business_type"]
          updated_at?: string
          website?: string | null
        }
        Update: {
          additional_types?: Database["public"]["Enums"]["business_type"][]
          address?: string | null
          barangay_code?: string
          contact_email?: string | null
          contact_phone?: string | null
          cover_image_url?: string | null
          created_at?: string
          custom_types?: string[]
          description?: string | null
          hours?: string | null
          id?: string
          import_source_id?: string | null
          imported_from?: string | null
          is_claimed?: boolean
          is_published?: boolean
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          owner_id?: string | null
          slug?: string
          tags?: string[]
          type?: Database["public"]["Enums"]["business_type"]
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "businesses_barangay_code_fkey"
            columns: ["barangay_code"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["code"]
          },
        ]
      }
      cities_municipalities: {
        Row: {
          code: string
          flag_url: string | null
          is_city: boolean
          name: string
          province_code: string
          slug: string
        }
        Insert: {
          code: string
          flag_url?: string | null
          is_city?: boolean
          name: string
          province_code: string
          slug: string
        }
        Update: {
          code?: string
          flag_url?: string | null
          is_city?: boolean
          name?: string
          province_code?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "cities_municipalities_province_code_fkey"
            columns: ["province_code"]
            isOneToOne: false
            referencedRelation: "provinces"
            referencedColumns: ["code"]
          },
        ]
      }
      claim_requests: {
        Row: {
          business_id: string
          created_at: string
          id: string
          message: string | null
          status: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          message?: string | null
          status?: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          message?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          business_id: string
          consumer_id: string
          created_at: string
          id: string
          last_message_at: string
          owner_id: string
        }
        Insert: {
          business_id: string
          consumer_id: string
          created_at?: string
          id?: string
          last_message_at?: string
          owner_id: string
        }
        Update: {
          business_id?: string
          consumer_id?: string
          created_at?: string
          id?: string
          last_message_at?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_type_catalog: {
        Row: {
          first_seen_at: string
          label: string
          slug: string
          source: string
          updated_at: string
          usage_count: number
        }
        Insert: {
          first_seen_at?: string
          label: string
          slug: string
          source?: string
          updated_at?: string
          usage_count?: number
        }
        Update: {
          first_seen_at?: string
          label?: string
          slug?: string
          source?: string
          updated_at?: string
          usage_count?: number
        }
        Relationships: []
      }
      favorites: {
        Row: {
          business_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_import_runs: {
        Row: {
          error: string | null
          finished_at: string | null
          id: string
          prices_upserted: number
          source: string
          started_at: string
          stations_upserted: number
          status: string
        }
        Insert: {
          error?: string | null
          finished_at?: string | null
          id?: string
          prices_upserted?: number
          source: string
          started_at?: string
          stations_upserted?: number
          status?: string
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          id?: string
          prices_upserted?: number
          source?: string
          started_at?: string
          stations_upserted?: number
          status?: string
        }
        Relationships: []
      }
      fuel_price_snapshots: {
        Row: {
          brand: string
          fetched_at: string
          fuel_type: string
          id: string
          price: number
          region_code: string | null
          region_name: string | null
          snapshot_date: string
          source: string
        }
        Insert: {
          brand: string
          fetched_at?: string
          fuel_type: string
          id?: string
          price: number
          region_code?: string | null
          region_name?: string | null
          snapshot_date: string
          source?: string
        }
        Update: {
          brand?: string
          fetched_at?: string
          fuel_type?: string
          id?: string
          price?: number
          region_code?: string | null
          region_name?: string | null
          snapshot_date?: string
          source?: string
        }
        Relationships: []
      }
      fuel_price_votes: {
        Row: {
          created_at: string
          fuel_price_id: string
          id: string
          user_id: string
          vote: number
        }
        Insert: {
          created_at?: string
          fuel_price_id: string
          id?: string
          user_id: string
          vote: number
        }
        Update: {
          created_at?: string
          fuel_price_id?: string
          id?: string
          user_id?: string
          vote?: number
        }
        Relationships: [
          {
            foreignKeyName: "fuel_price_votes_fuel_price_id_fkey"
            columns: ["fuel_price_id"]
            isOneToOne: false
            referencedRelation: "fuel_prices"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_prices: {
        Row: {
          downvotes: number
          fuel_type: Database["public"]["Enums"]["fuel_type"]
          id: string
          price: number
          reported_at: string
          reported_by: string
          station_id: string
          upvotes: number
        }
        Insert: {
          downvotes?: number
          fuel_type: Database["public"]["Enums"]["fuel_type"]
          id?: string
          price: number
          reported_at?: string
          reported_by: string
          station_id: string
          upvotes?: number
        }
        Update: {
          downvotes?: number
          fuel_type?: Database["public"]["Enums"]["fuel_type"]
          id?: string
          price?: number
          reported_at?: string
          reported_by?: string
          station_id?: string
          upvotes?: number
        }
        Relationships: [
          {
            foreignKeyName: "fuel_prices_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          business_id: string
          category: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          in_stock: boolean
          name: string
          normalized_name: string | null
          pack_qty: number
          price: number | null
          size_unit: string | null
          size_value: number | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          in_stock?: boolean
          name: string
          normalized_name?: string | null
          pack_qty?: number
          price?: number | null
          size_unit?: string | null
          size_value?: number | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          in_stock?: boolean
          name?: string
          normalized_name?: string | null
          pack_qty?: number
          price?: number | null
          size_unit?: string | null
          size_value?: number | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          barangay_code: string | null
          created_at: string
          display_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          barangay_code?: string | null
          created_at?: string
          display_name: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          barangay_code?: string | null
          created_at?: string
          display_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_barangay_code_fkey"
            columns: ["barangay_code"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["code"]
          },
        ]
      }
      provinces: {
        Row: {
          code: string
          flag_url: string | null
          name: string
          region_code: string
          slug: string
        }
        Insert: {
          code: string
          flag_url?: string | null
          name: string
          region_code: string
          slug: string
        }
        Update: {
          code?: string
          flag_url?: string | null
          name?: string
          region_code?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "provinces_region_code_fkey"
            columns: ["region_code"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["code"]
          },
        ]
      }
      regions: {
        Row: {
          code: string
          flag_url: string | null
          name: string
          slug: string
        }
        Insert: {
          code: string
          flag_url?: string | null
          name: string
          slug: string
        }
        Update: {
          code?: string
          flag_url?: string | null
          name?: string
          slug?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          business_id: string
          comment: string | null
          created_at: string
          id: string
          rating: number
          user_id: string
        }
        Insert: {
          business_id: string
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          user_id: string
        }
        Update: {
          business_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      tag_catalog: {
        Row: {
          first_seen_at: string
          label: string
          slug: string
          source: string
          updated_at: string
          usage_count: number
        }
        Insert: {
          first_seen_at?: string
          label: string
          slug: string
          source?: string
          updated_at?: string
          usage_count?: number
        }
        Update: {
          first_seen_at?: string
          label?: string
          slug?: string
          source?: string
          updated_at?: string
          usage_count?: number
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "consumer" | "admin"
      business_import_source:
        | "google"
        | "facebook"
        | "instagram"
        | "twitter"
        | "tiktok"
        | "linkedin"
        | "youtube"
        | "website"
      business_import_status: "pending" | "completed" | "failed"
      business_type:
        | "store"
        | "service"
        | "restaurant"
        | "food_vendor"
        | "fuel_station"
        | "sari_sari"
        | "market_vendor"
        | "wet_market"
        | "dry_goods"
        | "farmer"
        | "fisher"
        | "ambulant_vendor"
        | "bakery"
        | "pharmacy"
        | "hardware"
        | "repair_shop"
        | "salon"
        | "laundry"
        | "transport"
        | "agri_supply"
        | "livestock"
      fuel_type: "gasoline_91" | "gasoline_95" | "gasoline_97" | "diesel"
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
      app_role: ["owner", "consumer", "admin"],
      business_import_source: [
        "google",
        "facebook",
        "instagram",
        "twitter",
        "tiktok",
        "linkedin",
        "youtube",
        "website",
      ],
      business_import_status: ["pending", "completed", "failed"],
      business_type: [
        "store",
        "service",
        "restaurant",
        "food_vendor",
        "fuel_station",
        "sari_sari",
        "market_vendor",
        "wet_market",
        "dry_goods",
        "farmer",
        "fisher",
        "ambulant_vendor",
        "bakery",
        "pharmacy",
        "hardware",
        "repair_shop",
        "salon",
        "laundry",
        "transport",
        "agri_supply",
        "livestock",
      ],
      fuel_type: ["gasoline_91", "gasoline_95", "gasoline_97", "diesel"],
    },
  },
} as const