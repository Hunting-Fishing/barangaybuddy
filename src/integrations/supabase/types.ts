export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          domain: string
          entity_id: string
          entity_type: string
          id: number
          metadata: Json
          reason: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          domain: string
          entity_id: string
          entity_type: string
          id?: never
          metadata?: Json
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          domain?: string
          entity_id?: string
          entity_type?: string
          id?: never
          metadata?: Json
          reason?: string | null
        }
        Relationships: []
      }
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
      business_category_interactions: {
        Row: {
          action: string
          count: number
          created_at: string
          group_id: string
          id: string
          item_id: string
          label: string
          updated_at: string
        }
        Insert: {
          action: string
          count?: number
          created_at?: string
          group_id: string
          id?: string
          item_id: string
          label: string
          updated_at?: string
        }
        Update: {
          action?: string
          count?: number
          created_at?: string
          group_id?: string
          id?: string
          item_id?: string
          label?: string
          updated_at?: string
        }
        Relationships: []
      }
      business_category_suggestions: {
        Row: {
          first_seen_at: string
          group_id: string
          group_label: string
          id: string
          last_seen_at: string
          normalized_suggestion: string
          note: string | null
          suggestion: string
          suggestion_count: number
          updated_at: string
        }
        Insert: {
          first_seen_at?: string
          group_id: string
          group_label: string
          id?: string
          last_seen_at?: string
          normalized_suggestion: string
          note?: string | null
          suggestion: string
          suggestion_count?: number
          updated_at?: string
        }
        Update: {
          first_seen_at?: string
          group_id?: string
          group_label?: string
          id?: string
          last_seen_at?: string
          normalized_suggestion?: string
          note?: string | null
          suggestion?: string
          suggestion_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      business_hours: {
        Row: {
          closes_at: string | null
          id: string
          is_closed: boolean
          location_id: string
          opens_at: string | null
          weekday: number
        }
        Insert: {
          closes_at?: string | null
          id?: string
          is_closed?: boolean
          location_id: string
          opens_at?: string | null
          weekday: number
        }
        Update: {
          closes_at?: string | null
          id?: string
          is_closed?: boolean
          location_id?: string
          opens_at?: string | null
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "business_hours_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
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
      business_locations: {
        Row: {
          address: string
          barangay_code: string | null
          business_id: string
          created_at: string
          delivery_enabled: boolean
          id: string
          latitude: number | null
          longitude: number | null
          merchant_status: Database["public"]["Enums"]["merchant_status"]
          minimum_order_php: number
          name: string
          phone: string | null
          pickup_enabled: boolean
          prep_minutes: number
          reservations_enabled: boolean
          service_radius_km: number
          updated_at: string
        }
        Insert: {
          address: string
          barangay_code?: string | null
          business_id: string
          created_at?: string
          delivery_enabled?: boolean
          id?: string
          latitude?: number | null
          longitude?: number | null
          merchant_status?: Database["public"]["Enums"]["merchant_status"]
          minimum_order_php?: number
          name: string
          phone?: string | null
          pickup_enabled?: boolean
          prep_minutes?: number
          reservations_enabled?: boolean
          service_radius_km?: number
          updated_at?: string
        }
        Update: {
          address?: string
          barangay_code?: string | null
          business_id?: string
          created_at?: string
          delivery_enabled?: boolean
          id?: string
          latitude?: number | null
          longitude?: number | null
          merchant_status?: Database["public"]["Enums"]["merchant_status"]
          minimum_order_php?: number
          name?: string
          phone?: string | null
          pickup_enabled?: boolean
          prep_minutes?: number
          reservations_enabled?: boolean
          service_radius_km?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_locations_barangay_code_fkey"
            columns: ["barangay_code"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "business_locations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_service_areas: {
        Row: {
          barangay_code: string
          delivery_fee_php: number
          id: string
          location_id: string
        }
        Insert: {
          barangay_code: string
          delivery_fee_php?: number
          id?: string
          location_id: string
        }
        Update: {
          barangay_code?: string
          delivery_fee_php?: number
          id?: string
          location_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_service_areas_barangay_code_fkey"
            columns: ["barangay_code"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "business_service_areas_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      business_subscriptions: {
        Row: {
          business_id: string
          created_at: string
          ends_at: string | null
          id: string
          monthly_price_php: number
          starts_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          tier: string
        }
        Insert: {
          business_id: string
          created_at?: string
          ends_at?: string | null
          id?: string
          monthly_price_php: number
          starts_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          tier: string
        }
        Update: {
          business_id?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          monthly_price_php?: number
          starts_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_subscriptions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
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
      catalog_categories: {
        Row: {
          active: boolean
          catalog_id: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          catalog_id: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          catalog_id?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "catalog_categories_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalogs"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_items: {
        Row: {
          active: boolean
          available_from: string | null
          available_until: string | null
          category_id: string
          created_at: string
          description: string | null
          featured: boolean
          id: string
          image_url: string | null
          name: string
          price_php: number
          stock_quantity: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          available_from?: string | null
          available_until?: string | null
          category_id: string
          created_at?: string
          description?: string | null
          featured?: boolean
          id?: string
          image_url?: string | null
          name: string
          price_php: number
          stock_quantity?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          available_from?: string | null
          available_until?: string | null
          category_id?: string
          created_at?: string
          description?: string | null
          featured?: boolean
          id?: string
          image_url?: string | null
          name?: string
          price_php?: number
          stock_quantity?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "catalog_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogs: {
        Row: {
          active: boolean
          business_id: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["catalog_kind"]
          location_id: string | null
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          business_id: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["catalog_kind"]
          location_id?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          business_id?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["catalog_kind"]
          location_id?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalogs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalogs_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
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
      delivery_events: {
        Row: {
          actor_id: string | null
          created_at: string
          delivery_job_id: string
          from_status: Database["public"]["Enums"]["delivery_status"] | null
          id: number
          metadata: Json
          note: string | null
          to_status: Database["public"]["Enums"]["delivery_status"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          delivery_job_id: string
          from_status?: Database["public"]["Enums"]["delivery_status"] | null
          id?: never
          metadata?: Json
          note?: string | null
          to_status: Database["public"]["Enums"]["delivery_status"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          delivery_job_id?: string
          from_status?: Database["public"]["Enums"]["delivery_status"] | null
          id?: never
          metadata?: Json
          note?: string | null
          to_status?: Database["public"]["Enums"]["delivery_status"]
        }
        Relationships: [
          {
            foreignKeyName: "delivery_events_delivery_job_id_fkey"
            columns: ["delivery_job_id"]
            isOneToOne: false
            referencedRelation: "delivery_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_jobs: {
        Row: {
          accepted_at: string | null
          created_by: string
          delivered_at: string | null
          destination_address: string
          driver_id: string | null
          estimated_driver_pay_php: number
          id: string
          offered_at: string
          order_id: string | null
          package_class: string
          pickup_address: string
          status: Database["public"]["Enums"]["delivery_status"]
        }
        Insert: {
          accepted_at?: string | null
          created_by: string
          delivered_at?: string | null
          destination_address: string
          driver_id?: string | null
          estimated_driver_pay_php: number
          id?: string
          offered_at?: string
          order_id?: string | null
          package_class?: string
          pickup_address: string
          status?: Database["public"]["Enums"]["delivery_status"]
        }
        Update: {
          accepted_at?: string | null
          created_by?: string
          delivered_at?: string | null
          destination_address?: string
          driver_id?: string | null
          estimated_driver_pay_php?: number
          id?: string
          offered_at?: string
          order_id?: string | null
          package_class?: string
          pickup_address?: string
          status?: Database["public"]["Enums"]["delivery_status"]
        }
        Relationships: [
          {
            foreignKeyName: "delivery_jobs_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_jobs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_proofs: {
        Row: {
          captured_at: string
          captured_by: string
          confirmation_code_hash: string | null
          delivery_job_id: string
          id: string
          proof_type: string
          storage_path: string | null
        }
        Insert: {
          captured_at?: string
          captured_by: string
          confirmation_code_hash?: string | null
          delivery_job_id: string
          id?: string
          proof_type: string
          storage_path?: string | null
        }
        Update: {
          captured_at?: string
          captured_by?: string
          confirmation_code_hash?: string | null
          delivery_job_id?: string
          id?: string
          proof_type?: string
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_proofs_delivery_job_id_fkey"
            columns: ["delivery_job_id"]
            isOneToOne: false
            referencedRelation: "delivery_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_availability: {
        Row: {
          current_barangay_code: string | null
          driver_id: string
          latitude: number | null
          longitude: number | null
          online: boolean
          updated_at: string
        }
        Insert: {
          current_barangay_code?: string | null
          driver_id: string
          latitude?: number | null
          longitude?: number | null
          online?: boolean
          updated_at?: string
        }
        Update: {
          current_barangay_code?: string | null
          driver_id?: string
          latitude?: number | null
          longitude?: number | null
          online?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_availability_current_barangay_code_fkey"
            columns: ["current_barangay_code"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "driver_availability_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: true
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_earnings: {
        Row: {
          amount_php: number
          created_at: string
          delivery_job_id: string | null
          description: string | null
          driver_id: string
          entry_type: string
          id: string
          paid_at: string | null
          status: Database["public"]["Enums"]["ledger_status"]
        }
        Insert: {
          amount_php: number
          created_at?: string
          delivery_job_id?: string | null
          description?: string | null
          driver_id: string
          entry_type: string
          id?: string
          paid_at?: string | null
          status?: Database["public"]["Enums"]["ledger_status"]
        }
        Update: {
          amount_php?: number
          created_at?: string
          delivery_job_id?: string | null
          description?: string | null
          driver_id?: string
          entry_type?: string
          id?: string
          paid_at?: string | null
          status?: Database["public"]["Enums"]["ledger_status"]
        }
        Relationships: [
          {
            foreignKeyName: "driver_earnings_delivery_job_id_fkey"
            columns: ["delivery_job_id"]
            isOneToOne: false
            referencedRelation: "delivery_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_earnings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_profiles: {
        Row: {
          applied_at: string
          capacity_class: string
          home_barangay_code: string | null
          id: string
          legal_name: string
          phone: string
          reviewed_at: string | null
          reviewed_by: string | null
          service_area_codes: string[]
          status: Database["public"]["Enums"]["driver_status"]
          user_id: string
        }
        Insert: {
          applied_at?: string
          capacity_class?: string
          home_barangay_code?: string | null
          id?: string
          legal_name: string
          phone: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_area_codes?: string[]
          status?: Database["public"]["Enums"]["driver_status"]
          user_id: string
        }
        Update: {
          applied_at?: string
          capacity_class?: string
          home_barangay_code?: string | null
          id?: string
          legal_name?: string
          phone?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_area_codes?: string[]
          status?: Database["public"]["Enums"]["driver_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_profiles_home_barangay_code_fkey"
            columns: ["home_barangay_code"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["code"]
          },
        ]
      }
      driver_vehicles: {
        Row: {
          active: boolean
          capacity_notes: string | null
          driver_id: string
          id: string
          make_model: string
          plate_number: string
          vehicle_type: string
        }
        Insert: {
          active?: boolean
          capacity_notes?: string | null
          driver_id: string
          id?: string
          make_model: string
          plate_number: string
          vehicle_type: string
        }
        Update: {
          active?: boolean
          capacity_notes?: string | null
          driver_id?: string
          id?: string
          make_model?: string
          plate_number?: string
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_vehicles_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_contacts: {
        Row: {
          availability: string | null
          barangay_code: string
          id: string
          is_verified: boolean
          name: string
          phone_number: string
          secondary_phone: string | null
          service_type: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          availability?: string | null
          barangay_code: string
          id?: string
          is_verified?: boolean
          name: string
          phone_number: string
          secondary_phone?: string | null
          service_type: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          availability?: string | null
          barangay_code?: string
          id?: string
          is_verified?: boolean
          name?: string
          phone_number?: string
          secondary_phone?: string | null
          service_type?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "emergency_contacts_barangay_code_fkey"
            columns: ["barangay_code"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["code"]
          },
        ]
      }
      evacuation_centres: {
        Row: {
          address: string | null
          barangay_code: string
          capacity: number | null
          contact_number: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          barangay_code: string
          capacity?: number | null
          contact_number?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          barangay_code?: string
          capacity?: number | null
          contact_number?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evacuation_centres_barangay_code_fkey"
            columns: ["barangay_code"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["code"]
          },
        ]
      }
      family_groups: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      family_members: {
        Row: {
          barangay_code: string
          birth_date: string
          created_at: string
          created_by: string
          display_name: string
          family_group_id: string
          id: string
          kind: Database["public"]["Enums"]["family_member_kind"]
          legal_name: string
          private_photo_path: string | null
          public_photo_url: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          barangay_code: string
          birth_date: string
          created_at?: string
          created_by: string
          display_name: string
          family_group_id: string
          id?: string
          kind: Database["public"]["Enums"]["family_member_kind"]
          legal_name: string
          private_photo_path?: string | null
          public_photo_url?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          barangay_code?: string
          birth_date?: string
          created_at?: string
          created_by?: string
          display_name?: string
          family_group_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["family_member_kind"]
          legal_name?: string
          private_photo_path?: string | null
          public_photo_url?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_members_barangay_code_fkey"
            columns: ["barangay_code"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "family_members_family_group_id_fkey"
            columns: ["family_group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      family_rate_offers: {
        Row: {
          active: boolean
          base_price_php: number
          category: string
          created_at: string
          description: string
          discount_kind: Database["public"]["Enums"]["family_discount_kind"]
          discount_value: number
          ends_at: string | null
          id: string
          name: string
          owned_by_barangay_buddy: boolean
          product_code: string
          starts_at: string | null
        }
        Insert: {
          active?: boolean
          base_price_php: number
          category: string
          created_at?: string
          description: string
          discount_kind: Database["public"]["Enums"]["family_discount_kind"]
          discount_value: number
          ends_at?: string | null
          id?: string
          name: string
          owned_by_barangay_buddy?: boolean
          product_code: string
          starts_at?: string | null
        }
        Update: {
          active?: boolean
          base_price_php?: number
          category?: string
          created_at?: string
          description?: string
          discount_kind?: Database["public"]["Enums"]["family_discount_kind"]
          discount_value?: number
          ends_at?: string | null
          id?: string
          name?: string
          owned_by_barangay_buddy?: boolean
          product_code?: string
          starts_at?: string | null
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
          status: string
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
      group_event_rsvps: {
        Row: {
          created_at: string
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "group_events"
            referencedColumns: ["id"]
          },
        ]
      }
      group_events: {
        Row: {
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          entry_fee_php: number
          group_id: string
          id: string
          member_free: boolean
          starts_at: string
          status: Database["public"]["Enums"]["event_status"]
          title: string
          updated_at: string
          venue_business_id: string | null
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          entry_fee_php?: number
          group_id: string
          id?: string
          member_free?: boolean
          starts_at: string
          status?: Database["public"]["Enums"]["event_status"]
          title: string
          updated_at?: string
          venue_business_id?: string | null
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          entry_fee_php?: number
          group_id?: string
          id?: string
          member_free?: boolean
          starts_at?: string
          status?: Database["public"]["Enums"]["event_status"]
          title?: string
          updated_at?: string
          venue_business_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_events_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_events_venue_business_id_fkey"
            columns: ["venue_business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      group_memberships: {
        Row: {
          amount_paid_php: number
          created_at: string
          expires_at: string | null
          group_id: string
          id: string
          payment_note: string | null
          payment_ref: string | null
          role: Database["public"]["Enums"]["group_role"]
          started_at: string | null
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_paid_php?: number
          created_at?: string
          expires_at?: string | null
          group_id: string
          id?: string
          payment_note?: string | null
          payment_ref?: string | null
          role?: Database["public"]["Enums"]["group_role"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_paid_php?: number
          created_at?: string
          expires_at?: string | null
          group_id?: string
          id?: string
          payment_note?: string | null
          payment_ref?: string | null
          role?: Database["public"]["Enums"]["group_role"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_memberships_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_promos: {
        Row: {
          business_id: string | null
          code: string | null
          created_at: string
          created_by: string | null
          description: string | null
          discount_amount_php: number | null
          discount_percent: number | null
          group_id: string
          id: string
          title: string
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          business_id?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_amount_php?: number | null
          discount_percent?: number | null
          group_id: string
          id?: string
          title: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          business_id?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_amount_php?: number | null
          discount_percent?: number | null
          group_id?: string
          id?: string
          title?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_promos_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_promos_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_venues: {
        Row: {
          approved_at: string | null
          business_id: string
          created_at: string
          group_id: string
          id: string
          requested_by: string | null
          status: Database["public"]["Enums"]["venue_status"]
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          business_id: string
          created_at?: string
          group_id: string
          id?: string
          requested_by?: string | null
          status?: Database["public"]["Enums"]["venue_status"]
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          business_id?: string
          created_at?: string
          group_id?: string
          id?: string
          requested_by?: string | null
          status?: Database["public"]["Enums"]["venue_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_venues_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_venues_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_public: boolean
          logo_url: string | null
          membership_fee_php: number
          membership_period_days: number
          name: string
          payment_instructions: string | null
          slug: string
          type: Database["public"]["Enums"]["group_type"]
          updated_at: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_public?: boolean
          logo_url?: string | null
          membership_fee_php?: number
          membership_period_days?: number
          name: string
          payment_instructions?: string | null
          slug: string
          type?: Database["public"]["Enums"]["group_type"]
          updated_at?: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_public?: boolean
          logo_url?: string | null
          membership_fee_php?: number
          membership_period_days?: number
          name?: string
          payment_instructions?: string | null
          slug?: string
          type?: Database["public"]["Enums"]["group_type"]
          updated_at?: string
        }
        Relationships: []
      }
      guardian_child_relationships: {
        Row: {
          child_member_id: string
          created_at: string
          guardian_account_id: string
          id: string
          is_primary: boolean
          relationship: string
          revoked_at: string | null
          status: Database["public"]["Enums"]["guardian_relationship_status"]
          verified_at: string | null
        }
        Insert: {
          child_member_id: string
          created_at?: string
          guardian_account_id: string
          id?: string
          is_primary?: boolean
          relationship: string
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["guardian_relationship_status"]
          verified_at?: string | null
        }
        Update: {
          child_member_id?: string
          created_at?: string
          guardian_account_id?: string
          id?: string
          is_primary?: boolean
          relationship?: string
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["guardian_relationship_status"]
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guardian_child_relationships_child_member_id_fkey"
            columns: ["child_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_adjustments: {
        Row: {
          business_id: string
          change_qty: number
          created_at: string
          created_by: string | null
          id: string
          item_id: string
          note: string | null
          reason: string
        }
        Insert: {
          business_id: string
          change_qty: number
          created_at?: string
          created_by?: string | null
          id?: string
          item_id: string
          note?: string | null
          reason?: string
        }
        Update: {
          business_id?: string
          change_qty?: number
          created_at?: string
          created_by?: string | null
          id?: string
          item_id?: string
          note?: string | null
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_adjustments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_adjustments_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          barcode: string | null
          business_id: string
          category: string | null
          color: string | null
          core_charge: number
          cost_per_unit: number
          created_at: string
          date_last_ordered: string | null
          date_last_used: string | null
          date_purchased: string | null
          description: string | null
          dimensions: string | null
          environmental_fee: number
          hazmat_fee: number
          id: string
          image_url: string | null
          links: Json
          listing_id: string | null
          location: string | null
          manufacturer: string | null
          manufacturer_part_number: string | null
          markup_percent: number
          material: string | null
          maximum_stock: number
          minimum_stock: number
          model_year: string | null
          name: string
          notes: string | null
          on_order_quantity: number
          publish_to_store: boolean
          quantity: number
          reorder_point: number
          reserved_quantity: number
          sell_price: number
          sku: string | null
          status: string
          sub_category: string | null
          supplier: string | null
          tax_exempt: boolean
          tax_rate: number
          total_cost: number
          unit: string
          updated_at: string
          warranty_period: string | null
          weight: number | null
        }
        Insert: {
          barcode?: string | null
          business_id: string
          category?: string | null
          color?: string | null
          core_charge?: number
          cost_per_unit?: number
          created_at?: string
          date_last_ordered?: string | null
          date_last_used?: string | null
          date_purchased?: string | null
          description?: string | null
          dimensions?: string | null
          environmental_fee?: number
          hazmat_fee?: number
          id?: string
          image_url?: string | null
          links?: Json
          listing_id?: string | null
          location?: string | null
          manufacturer?: string | null
          manufacturer_part_number?: string | null
          markup_percent?: number
          material?: string | null
          maximum_stock?: number
          minimum_stock?: number
          model_year?: string | null
          name: string
          notes?: string | null
          on_order_quantity?: number
          publish_to_store?: boolean
          quantity?: number
          reorder_point?: number
          reserved_quantity?: number
          sell_price?: number
          sku?: string | null
          status?: string
          sub_category?: string | null
          supplier?: string | null
          tax_exempt?: boolean
          tax_rate?: number
          total_cost?: number
          unit?: string
          updated_at?: string
          warranty_period?: string | null
          weight?: number | null
        }
        Update: {
          barcode?: string | null
          business_id?: string
          category?: string | null
          color?: string | null
          core_charge?: number
          cost_per_unit?: number
          created_at?: string
          date_last_ordered?: string | null
          date_last_used?: string | null
          date_purchased?: string | null
          description?: string | null
          dimensions?: string | null
          environmental_fee?: number
          hazmat_fee?: number
          id?: string
          image_url?: string | null
          links?: Json
          listing_id?: string | null
          location?: string | null
          manufacturer?: string | null
          manufacturer_part_number?: string | null
          markup_percent?: number
          material?: string | null
          maximum_stock?: number
          minimum_stock?: number
          model_year?: string | null
          name?: string
          notes?: string | null
          on_order_quantity?: number
          publish_to_store?: boolean
          quantity?: number
          reorder_point?: number
          reserved_quantity?: number
          sell_price?: number
          sku?: string | null
          status?: string
          sub_category?: string | null
          supplier?: string | null
          tax_exempt?: boolean
          tax_rate?: number
          total_cost?: number
          unit?: string
          updated_at?: string
          warranty_period?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
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
          stock_checked_at: string | null
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
          stock_checked_at?: string | null
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
          stock_checked_at?: string | null
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
      marketplace_order_events: {
        Row: {
          actor_id: string | null
          created_at: string
          from_status:
            | Database["public"]["Enums"]["marketplace_order_status"]
            | null
          id: number
          metadata: Json
          order_id: string
          reason: string | null
          to_status: Database["public"]["Enums"]["marketplace_order_status"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          from_status?:
            | Database["public"]["Enums"]["marketplace_order_status"]
            | null
          id?: never
          metadata?: Json
          order_id: string
          reason?: string | null
          to_status: Database["public"]["Enums"]["marketplace_order_status"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          from_status?:
            | Database["public"]["Enums"]["marketplace_order_status"]
            | null
          id?: never
          metadata?: Json
          order_id?: string
          reason?: string | null
          to_status?: Database["public"]["Enums"]["marketplace_order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_order_items: {
        Row: {
          catalog_item_id: string | null
          id: string
          item_name: string
          line_total_php: number | null
          modifier_snapshot: Json
          order_id: string
          quantity: number
          unit_price_php: number
        }
        Insert: {
          catalog_item_id?: string | null
          id?: string
          item_name: string
          line_total_php?: number | null
          modifier_snapshot?: Json
          order_id: string
          quantity: number
          unit_price_php: number
        }
        Update: {
          catalog_item_id?: string | null
          id?: string
          item_name?: string
          line_total_php?: number | null
          modifier_snapshot?: Json
          order_id?: string
          quantity?: number
          unit_price_php?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_order_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_orders: {
        Row: {
          business_id: string
          completed_at: string | null
          created_at: string
          customer_id: string
          customer_notes: string | null
          delivery_address: string | null
          delivery_barangay_code: string | null
          delivery_fee_php: number
          discount_php: number
          fulfillment_mode: Database["public"]["Enums"]["order_fulfillment_mode"]
          id: string
          location_id: string
          order_number: number
          service_fee_php: number
          status: Database["public"]["Enums"]["marketplace_order_status"]
          subtotal_php: number
          total_php: number
          updated_at: string
        }
        Insert: {
          business_id: string
          completed_at?: string | null
          created_at?: string
          customer_id: string
          customer_notes?: string | null
          delivery_address?: string | null
          delivery_barangay_code?: string | null
          delivery_fee_php?: number
          discount_php?: number
          fulfillment_mode: Database["public"]["Enums"]["order_fulfillment_mode"]
          id?: string
          location_id: string
          order_number?: never
          service_fee_php?: number
          status?: Database["public"]["Enums"]["marketplace_order_status"]
          subtotal_php?: number
          total_php?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          completed_at?: string | null
          created_at?: string
          customer_id?: string
          customer_notes?: string | null
          delivery_address?: string | null
          delivery_barangay_code?: string | null
          delivery_fee_php?: number
          discount_php?: number
          fulfillment_mode?: Database["public"]["Enums"]["order_fulfillment_mode"]
          id?: string
          location_id?: string
          order_number?: never
          service_fee_php?: number
          status?: Database["public"]["Enums"]["marketplace_order_status"]
          subtotal_php?: number
          total_php?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_orders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_orders_delivery_barangay_code_fkey"
            columns: ["delivery_barangay_code"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "marketplace_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
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
      minor_consents: {
        Row: {
          audit_metadata: Json
          checkbox_confirmed: boolean
          child_profile_id: string
          consent_text: string
          consent_version: string
          created_at: string
          granted_at: string
          guardian_account_id: string
          id: string
          permission_type: Database["public"]["Enums"]["minor_permission_type"]
          relationship_id: string
          revoked_at: string | null
          typed_guardian_name: string
        }
        Insert: {
          audit_metadata?: Json
          checkbox_confirmed: boolean
          child_profile_id: string
          consent_text: string
          consent_version: string
          created_at?: string
          granted_at?: string
          guardian_account_id: string
          id?: string
          permission_type: Database["public"]["Enums"]["minor_permission_type"]
          relationship_id: string
          revoked_at?: string | null
          typed_guardian_name: string
        }
        Update: {
          audit_metadata?: Json
          checkbox_confirmed?: boolean
          child_profile_id?: string
          consent_text?: string
          consent_version?: string
          created_at?: string
          granted_at?: string
          guardian_account_id?: string
          id?: string
          permission_type?: Database["public"]["Enums"]["minor_permission_type"]
          relationship_id?: string
          revoked_at?: string | null
          typed_guardian_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "minor_consents_child_profile_id_fkey"
            columns: ["child_profile_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "minor_consents_relationship_id_fkey"
            columns: ["relationship_id"]
            isOneToOne: false
            referencedRelation: "guardian_child_relationships"
            referencedColumns: ["id"]
          },
        ]
      }
      modifier_groups: {
        Row: {
          id: string
          item_id: string
          max_choices: number
          min_choices: number
          name: string
          required: boolean
        }
        Insert: {
          id?: string
          item_id: string
          max_choices?: number
          min_choices?: number
          name: string
          required?: boolean
        }
        Update: {
          id?: string
          item_id?: string
          max_choices?: number
          min_choices?: number
          name?: string
          required?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "modifier_groups_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
        ]
      }
      modifier_options: {
        Row: {
          active: boolean
          group_id: string
          id: string
          name: string
          price_delta_php: number
        }
        Insert: {
          active?: boolean
          group_id: string
          id?: string
          name: string
          price_delta_php?: number
        }
        Update: {
          active?: boolean
          group_id?: string
          id?: string
          name?: string
          price_delta_php?: number
        }
        Relationships: [
          {
            foreignKeyName: "modifier_options_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "modifier_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      official_safety_alerts: {
        Row: {
          barangay_code: string | null
          created_at: string
          expires_at: string
          external_id: string | null
          headline: string
          id: string
          ingested_at: string | null
          is_active: boolean
          issued_at: string
          message: string
          severity: string
          source_name: string
          source_url: string | null
        }
        Insert: {
          barangay_code?: string | null
          created_at?: string
          expires_at: string
          external_id?: string | null
          headline: string
          id?: string
          ingested_at?: string | null
          is_active?: boolean
          issued_at?: string
          message: string
          severity?: string
          source_name: string
          source_url?: string | null
        }
        Update: {
          barangay_code?: string | null
          created_at?: string
          expires_at?: string
          external_id?: string | null
          headline?: string
          id?: string
          ingested_at?: string | null
          is_active?: boolean
          issued_at?: string
          message?: string
          severity?: string
          source_name?: string
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "official_safety_alerts_barangay_code_fkey"
            columns: ["barangay_code"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["code"]
          },
        ]
      }
      order_substitutions: {
        Row: {
          created_at: string
          id: string
          order_item_id: string
          proposed_by: string
          replacement_name: string
          replacement_price_php: number
          responded_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_item_id: string
          proposed_by: string
          replacement_name: string
          replacement_price_php: number
          responded_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          order_item_id?: string
          proposed_by?: string
          replacement_name?: string
          replacement_price_php?: number
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_substitutions_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "marketplace_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_commissions: {
        Row: {
          base_amount_php: number
          commission_php: number | null
          created_at: string
          id: string
          order_id: string | null
          rate_percent: number
          spotlight_booking_id: string | null
          status: Database["public"]["Enums"]["ledger_status"]
        }
        Insert: {
          base_amount_php: number
          commission_php?: number | null
          created_at?: string
          id?: string
          order_id?: string | null
          rate_percent: number
          spotlight_booking_id?: string | null
          status?: Database["public"]["Enums"]["ledger_status"]
        }
        Update: {
          base_amount_php?: number
          commission_php?: number | null
          created_at?: string
          id?: string
          order_id?: string | null
          rate_percent?: number
          spotlight_booking_id?: string | null
          status?: Database["public"]["Enums"]["ledger_status"]
        }
        Relationships: [
          {
            foreignKeyName: "platform_commissions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_commissions_spotlight_booking_id_fkey"
            columns: ["spotlight_booking_id"]
            isOneToOne: false
            referencedRelation: "spotlight_booking_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_payments: {
        Row: {
          amount_php: number
          created_at: string
          id: string
          order_id: string | null
          payer_id: string | null
          provider: string
          provider_reference: string | null
          spotlight_booking_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount_php: number
          created_at?: string
          id?: string
          order_id?: string | null
          payer_id?: string | null
          provider?: string
          provider_reference?: string | null
          spotlight_booking_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount_php?: number
          created_at?: string
          id?: string
          order_id?: string | null
          payer_id?: string | null
          provider?: string
          provider_reference?: string | null
          spotlight_booking_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_payments_spotlight_booking_id_fkey"
            columns: ["spotlight_booking_id"]
            isOneToOne: false
            referencedRelation: "spotlight_booking_requests"
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
      restaurant_reservations: {
        Row: {
          contact_name: string
          contact_phone: string
          created_at: string
          id: string
          location_id: string
          notes: string | null
          party_size: number
          requester_id: string
          reserved_for: string
          status: Database["public"]["Enums"]["reservation_status"]
          updated_at: string
        }
        Insert: {
          contact_name: string
          contact_phone: string
          created_at?: string
          id?: string
          location_id: string
          notes?: string | null
          party_size: number
          requester_id: string
          reserved_for: string
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
        }
        Update: {
          contact_name?: string
          contact_phone?: string
          created_at?: string
          id?: string
          location_id?: string
          notes?: string | null
          party_size?: number
          requester_id?: string
          reserved_for?: string
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_reservations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
        ]
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
      road_hazard_confirmations: {
        Row: {
          created_at: string
          id: string
          report_id: string
          updated_at: string
          user_id: string
          vote: string
        }
        Insert: {
          created_at?: string
          id?: string
          report_id: string
          updated_at?: string
          user_id: string
          vote: string
        }
        Update: {
          created_at?: string
          id?: string
          report_id?: string
          updated_at?: string
          user_id?: string
          vote?: string
        }
        Relationships: [
          {
            foreignKeyName: "road_hazard_confirmations_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "road_hazard_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      road_hazard_reports: {
        Row: {
          barangay_code: string | null
          created_at: string
          description: string | null
          expires_at: string
          hazard_type: string
          id: string
          is_official: boolean
          latitude: number
          longitude: number
          occurred_at: string
          passability: string
          photo_url: string | null
          reported_by: string
          severity: string
          source: string
          status: string
          updated_at: string
          water_depth_cm: number | null
        }
        Insert: {
          barangay_code?: string | null
          created_at?: string
          description?: string | null
          expires_at?: string
          hazard_type: string
          id?: string
          is_official?: boolean
          latitude: number
          longitude: number
          occurred_at?: string
          passability?: string
          photo_url?: string | null
          reported_by: string
          severity?: string
          source?: string
          status?: string
          updated_at?: string
          water_depth_cm?: number | null
        }
        Update: {
          barangay_code?: string | null
          created_at?: string
          description?: string | null
          expires_at?: string
          hazard_type?: string
          id?: string
          is_official?: boolean
          latitude?: number
          longitude?: number
          occurred_at?: string
          passability?: string
          photo_url?: string | null
          reported_by?: string
          severity?: string
          source?: string
          status?: string
          updated_at?: string
          water_depth_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "road_hazard_reports_barangay_code_fkey"
            columns: ["barangay_code"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["code"]
          },
        ]
      }
      roadsafe_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          barangay_code: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: number
          new_data: Json | null
          previous_data: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          barangay_code?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: never
          new_data?: Json | null
          previous_data?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          barangay_code?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: never
          new_data?: Json | null
          previous_data?: Json | null
        }
        Relationships: []
      }
      roadsafe_notifications: {
        Row: {
          alert_id: string
          attempts: number
          channel: string
          created_at: string
          id: string
          last_error: string | null
          provider_message_id: string | null
          sent_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          alert_id: string
          attempts?: number
          channel: string
          created_at?: string
          id?: string
          last_error?: string | null
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          alert_id?: string
          attempts?: number
          channel?: string
          created_at?: string
          id?: string
          last_error?: string | null
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roadsafe_notifications_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "official_safety_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      roadsafe_operator_assignments: {
        Row: {
          barangay_code: string
          created_at: string
          granted_by: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          barangay_code: string
          created_at?: string
          granted_by?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          barangay_code?: string
          created_at?: string
          granted_by?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roadsafe_operator_assignments_barangay_code_fkey"
            columns: ["barangay_code"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["code"]
          },
        ]
      }
      roadsafe_subscriptions: {
        Row: {
          barangay_code: string
          created_at: string
          email_enabled: boolean
          id: string
          minimum_severity: string
          phone_number: string | null
          push_enabled: boolean
          sms_enabled: boolean
          user_id: string
        }
        Insert: {
          barangay_code: string
          created_at?: string
          email_enabled?: boolean
          id?: string
          minimum_severity?: string
          phone_number?: string | null
          push_enabled?: boolean
          sms_enabled?: boolean
          user_id: string
        }
        Update: {
          barangay_code?: string
          created_at?: string
          email_enabled?: boolean
          id?: string
          minimum_severity?: string
          phone_number?: string | null
          push_enabled?: boolean
          sms_enabled?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roadsafe_subscriptions_barangay_code_fkey"
            columns: ["barangay_code"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["code"]
          },
        ]
      }
      settlements: {
        Row: {
          beneficiary_id: string
          beneficiary_type: string
          created_at: string
          deductions_php: number
          gross_php: number
          id: string
          net_php: number | null
          paid_at: string | null
          period_end: string
          period_start: string
          status: Database["public"]["Enums"]["ledger_status"]
        }
        Insert: {
          beneficiary_id: string
          beneficiary_type: string
          created_at?: string
          deductions_php?: number
          gross_php: number
          id?: string
          net_php?: number | null
          paid_at?: string | null
          period_end: string
          period_start: string
          status?: Database["public"]["Enums"]["ledger_status"]
        }
        Update: {
          beneficiary_id?: string
          beneficiary_type?: string
          created_at?: string
          deductions_php?: number
          gross_php?: number
          id?: string
          net_php?: number | null
          paid_at?: string | null
          period_end?: string
          period_start?: string
          status?: Database["public"]["Enums"]["ledger_status"]
        }
        Relationships: []
      }
      spotlight_booking_requests: {
        Row: {
          audience_size: number | null
          budget_php: number | null
          commission_percent: number
          created_at: string
          event_date: string
          event_location: string
          event_type: string
          guardian_approved_at: string | null
          guardian_approved_by: string | null
          id: string
          message: string
          minor_child_profile_id: string | null
          requester_id: string
          status: Database["public"]["Enums"]["spotlight_inquiry_status"]
          submission_id: string
          transport_needed: boolean
          updated_at: string
        }
        Insert: {
          audience_size?: number | null
          budget_php?: number | null
          commission_percent?: number
          created_at?: string
          event_date: string
          event_location: string
          event_type: string
          guardian_approved_at?: string | null
          guardian_approved_by?: string | null
          id?: string
          message: string
          minor_child_profile_id?: string | null
          requester_id: string
          status?: Database["public"]["Enums"]["spotlight_inquiry_status"]
          submission_id: string
          transport_needed?: boolean
          updated_at?: string
        }
        Update: {
          audience_size?: number | null
          budget_php?: number | null
          commission_percent?: number
          created_at?: string
          event_date?: string
          event_location?: string
          event_type?: string
          guardian_approved_at?: string | null
          guardian_approved_by?: string | null
          id?: string
          message?: string
          minor_child_profile_id?: string | null
          requester_id?: string
          status?: Database["public"]["Enums"]["spotlight_inquiry_status"]
          submission_id?: string
          transport_needed?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spotlight_booking_requests_minor_child_profile_id_fkey"
            columns: ["minor_child_profile_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spotlight_booking_requests_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "spotlight_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spotlight_booking_requests_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "spotlight_peoples_choice"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "spotlight_booking_requests_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "spotlight_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spotlight_booking_requests_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "spotlight_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      spotlight_campaigns: {
        Row: {
          commission_percent: number
          created_at: string
          description: string
          id: string
          is_active: boolean
          max_age: number | null
          min_age: number
          name: string
          slug: string
          starts_at: string
          submissions_close_at: string
          updated_at: string
          voting_ends_at: string
          voting_starts_at: string
        }
        Insert: {
          commission_percent?: number
          created_at?: string
          description: string
          id?: string
          is_active?: boolean
          max_age?: number | null
          min_age?: number
          name: string
          slug: string
          starts_at: string
          submissions_close_at: string
          updated_at?: string
          voting_ends_at: string
          voting_starts_at: string
        }
        Update: {
          commission_percent?: number
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          max_age?: number | null
          min_age?: number
          name?: string
          slug?: string
          starts_at?: string
          submissions_close_at?: string
          updated_at?: string
          voting_ends_at?: string
          voting_starts_at?: string
        }
        Relationships: []
      }
      spotlight_judge_scores: {
        Row: {
          barangay_appeal: number | null
          booking_potential: number | null
          created_at: string
          id: string
          judge_id: string
          notes: string | null
          originality: number | null
          presentation: number | null
          score: number
          submission_id: string
          talent: number | null
          updated_at: string
        }
        Insert: {
          barangay_appeal?: number | null
          booking_potential?: number | null
          created_at?: string
          id?: string
          judge_id: string
          notes?: string | null
          originality?: number | null
          presentation?: number | null
          score: number
          submission_id: string
          talent?: number | null
          updated_at?: string
        }
        Update: {
          barangay_appeal?: number | null
          booking_potential?: number | null
          created_at?: string
          id?: string
          judge_id?: string
          notes?: string | null
          originality?: number | null
          presentation?: number | null
          score?: number
          submission_id?: string
          talent?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spotlight_judge_scores_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "spotlight_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spotlight_judge_scores_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "spotlight_peoples_choice"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "spotlight_judge_scores_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "spotlight_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spotlight_judge_scores_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "spotlight_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      spotlight_minor_booking_approvals: {
        Row: {
          approved_at: string
          audit_metadata: Json
          booking_approved: boolean
          booking_request_id: string
          child_profile_id: string
          consent_version: string
          guardian_account_id: string
          id: string
          live_event_approved: boolean
          revoked_at: string | null
          transportation_approved: boolean
          typed_guardian_name: string
        }
        Insert: {
          approved_at?: string
          audit_metadata?: Json
          booking_approved: boolean
          booking_request_id: string
          child_profile_id: string
          consent_version: string
          guardian_account_id: string
          id?: string
          live_event_approved?: boolean
          revoked_at?: string | null
          transportation_approved?: boolean
          typed_guardian_name: string
        }
        Update: {
          approved_at?: string
          audit_metadata?: Json
          booking_approved?: boolean
          booking_request_id?: string
          child_profile_id?: string
          consent_version?: string
          guardian_account_id?: string
          id?: string
          live_event_approved?: boolean
          revoked_at?: string | null
          transportation_approved?: boolean
          typed_guardian_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "spotlight_minor_booking_approvals_booking_request_id_fkey"
            columns: ["booking_request_id"]
            isOneToOne: true
            referencedRelation: "spotlight_booking_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spotlight_minor_booking_approvals_child_profile_id_fkey"
            columns: ["child_profile_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      spotlight_sponsor_inquiries: {
        Row: {
          budget_range: string | null
          company_name: string
          contact_name: string
          created_at: string
          email: string
          id: string
          message: string | null
          package_tier: string
          phone: string | null
          status: Database["public"]["Enums"]["spotlight_inquiry_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          budget_range?: string | null
          company_name: string
          contact_name: string
          created_at?: string
          email: string
          id?: string
          message?: string | null
          package_tier: string
          phone?: string | null
          status?: Database["public"]["Enums"]["spotlight_inquiry_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          budget_range?: string | null
          company_name?: string
          contact_name?: string
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          package_tier?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["spotlight_inquiry_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      spotlight_submissions: {
        Row: {
          audition_video_url: string
          availability: string
          barangay_code: string
          biography: string
          birth_date: string
          campaign_id: string
          category: string
          child_profile_id: string | null
          contact_email: string
          contact_phone: string
          created_at: string
          featured_at: string | null
          free_entry_acknowledged: boolean
          guardian_consent: boolean
          guardian_email: string | null
          guardian_name: string | null
          guardian_phone: string | null
          guardian_relationship: string | null
          id: string
          moderation_notes: string | null
          private_photo_path: string
          public_photo_url: string | null
          slug: string | null
          stage_name: string
          status: Database["public"]["Enums"]["spotlight_submission_status"]
          terms_accepted: boolean
          updated_at: string
          user_id: string | null
        }
        Insert: {
          audition_video_url: string
          availability: string
          barangay_code: string
          biography: string
          birth_date: string
          campaign_id: string
          category: string
          child_profile_id?: string | null
          contact_email: string
          contact_phone: string
          created_at?: string
          featured_at?: string | null
          free_entry_acknowledged?: boolean
          guardian_consent?: boolean
          guardian_email?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          guardian_relationship?: string | null
          id?: string
          moderation_notes?: string | null
          private_photo_path: string
          public_photo_url?: string | null
          slug?: string | null
          stage_name: string
          status?: Database["public"]["Enums"]["spotlight_submission_status"]
          terms_accepted?: boolean
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          audition_video_url?: string
          availability?: string
          barangay_code?: string
          biography?: string
          birth_date?: string
          campaign_id?: string
          category?: string
          child_profile_id?: string | null
          contact_email?: string
          contact_phone?: string
          created_at?: string
          featured_at?: string | null
          free_entry_acknowledged?: boolean
          guardian_consent?: boolean
          guardian_email?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          guardian_relationship?: string | null
          id?: string
          moderation_notes?: string | null
          private_photo_path?: string
          public_photo_url?: string | null
          slug?: string | null
          stage_name?: string
          status?: Database["public"]["Enums"]["spotlight_submission_status"]
          terms_accepted?: boolean
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "spotlight_submissions_barangay_code_fkey"
            columns: ["barangay_code"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "spotlight_submissions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "spotlight_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spotlight_submissions_child_profile_id_fkey"
            columns: ["child_profile_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      spotlight_votes: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          invalidated_at: string | null
          invalidated_by: string | null
          invalidation_reason: string | null
          submission_id: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          invalidated_at?: string | null
          invalidated_by?: string | null
          invalidation_reason?: string | null
          submission_id: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          invalidated_at?: string | null
          invalidated_by?: string | null
          invalidation_reason?: string | null
          submission_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spotlight_votes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "spotlight_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spotlight_votes_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "spotlight_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spotlight_votes_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "spotlight_peoples_choice"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "spotlight_votes_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "spotlight_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spotlight_votes_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "spotlight_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      support_cases: {
        Row: {
          assigned_to: string | null
          category: string
          created_at: string
          delivery_job_id: string | null
          id: string
          message: string
          opened_by: string
          order_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category: string
          created_at?: string
          delivery_job_id?: string | null
          id?: string
          message: string
          opened_by: string
          order_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          delivery_job_id?: string | null
          id?: string
          message?: string
          opened_by?: string
          order_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_cases_delivery_job_id_fkey"
            columns: ["delivery_job_id"]
            isOneToOne: false
            referencedRelation: "delivery_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_cases_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "marketplace_orders"
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
      vehicle_profiles: {
        Row: {
          created_at: string
          ground_clearance_mm: number | null
          id: string
          is_default: boolean
          is_modified: boolean
          make: string | null
          manufacturer_wading_depth_mm: number | null
          model: string | null
          nickname: string
          updated_at: string
          user_id: string
          vehicle_type: string
          year: number | null
        }
        Insert: {
          created_at?: string
          ground_clearance_mm?: number | null
          id?: string
          is_default?: boolean
          is_modified?: boolean
          make?: string | null
          manufacturer_wading_depth_mm?: number | null
          model?: string | null
          nickname: string
          updated_at?: string
          user_id: string
          vehicle_type: string
          year?: number | null
        }
        Update: {
          created_at?: string
          ground_clearance_mm?: number | null
          id?: string
          is_default?: boolean
          is_modified?: boolean
          make?: string | null
          manufacturer_wading_depth_mm?: number | null
          model?: string | null
          nickname?: string
          updated_at?: string
          user_id?: string
          vehicle_type?: string
          year?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      ecosystem_kpis: {
        Row: {
          active_locations: number | null
          approved_drivers: number | null
          completed_deliveries: number | null
          completed_orders: number | null
          gross_commission_php: number | null
          gross_merchandise_value_php: number | null
          public_talent: number | null
          total_orders: number | null
        }
        Relationships: []
      }
      spotlight_leaderboard: {
        Row: {
          audition_video_url: string | null
          availability: string | null
          barangay_code: string | null
          barangay_name: string | null
          biography: string | null
          campaign_id: string | null
          category: string | null
          city_name: string | null
          combined_score: number | null
          featured_at: string | null
          id: string | null
          judge_score: number | null
          province_name: string | null
          public_photo_url: string | null
          slug: string | null
          stage_name: string | null
          status:
            | Database["public"]["Enums"]["spotlight_submission_status"]
            | null
          votes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "spotlight_submissions_barangay_code_fkey"
            columns: ["barangay_code"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "spotlight_submissions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "spotlight_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      spotlight_peoples_choice: {
        Row: {
          barangay_name: string | null
          campaign_id: string | null
          city_name: string | null
          public_photo_url: string | null
          slug: string | null
          stage_name: string | null
          submission_id: string | null
          votes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "spotlight_submissions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "spotlight_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      spotlight_public_profiles: {
        Row: {
          audition_video_url: string | null
          availability: string | null
          barangay_code: string | null
          barangay_name: string | null
          biography: string | null
          campaign_id: string | null
          category: string | null
          city_name: string | null
          featured_at: string | null
          id: string | null
          province_name: string | null
          public_photo_url: string | null
          slug: string | null
          stage_name: string | null
          status:
            | Database["public"]["Enums"]["spotlight_submission_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "spotlight_submissions_barangay_code_fkey"
            columns: ["barangay_code"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "spotlight_submissions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "spotlight_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_guardian_link: {
        Args: { p_relationship_id: string }
        Returns: undefined
      }
      assign_roadsafe_operator_by_email: {
        Args: { _barangay_code: string; _email: string; _role?: string }
        Returns: string
      }
      create_guardian_managed_child: {
        Args: {
          p_barangay_code: string
          p_birth_date: string
          p_display_name: string
          p_family_name: string
          p_legal_name: string
          p_photo_path: string
          p_relationship: string
        }
        Returns: string
      }
      create_marketplace_order: {
        Args: {
          p_business: string
          p_delivery_address: string
          p_items: Json
          p_location: string
          p_mode: Database["public"]["Enums"]["order_fulfillment_mode"]
        }
        Returns: string
      }
      has_minor_permission: {
        Args: {
          p_child: string
          p_permission: Database["public"]["Enums"]["minor_permission_type"]
          p_primary_only?: boolean
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_business_category_interaction: {
        Args: {
          p_action: string
          p_group_id: string
          p_item_id: string
          p_label: string
        }
        Returns: undefined
      }
      invalidate_spotlight_vote: {
        Args: { p_reason: string; p_vote: string }
        Returns: undefined
      }
      invite_second_guardian: {
        Args: {
          p_child: string
          p_guardian_account: string
          p_relationship: string
        }
        Returns: string
      }
      is_active_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_admin: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_guardian_of: {
        Args: { p_child: string; p_guardian: string; p_primary_only?: boolean }
        Returns: boolean
      }
      is_roadsafe_operator: {
        Args: { _barangay_code: string }
        Returns: boolean
      }
      manages_business: { Args: { p_business: string }; Returns: boolean }
      manages_catalog: { Args: { p_catalog: string }; Returns: boolean }
      manages_location: { Args: { p_location: string }; Returns: boolean }
      manages_order: { Args: { p_order: string }; Returns: boolean }
      propose_order_substitution: {
        Args: {
          p_order_item: string
          p_replacement_name: string
          p_replacement_price_php: number
        }
        Returns: {
          created_at: string
          id: string
          order_item_id: string
          proposed_by: string
          replacement_name: string
          replacement_price_php: number
          responded_at: string | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "order_substitutions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      remove_roadsafe_operator: {
        Args: { _assignment_id: string }
        Returns: undefined
      }
      respond_order_substitution: {
        Args: { p_accept: boolean; p_substitution: string }
        Returns: {
          created_at: string
          id: string
          order_item_id: string
          proposed_by: string
          replacement_name: string
          replacement_price_php: number
          responded_at: string | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "order_substitutions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transition_delivery: {
        Args: {
          p_job: string
          p_note?: string
          p_status: Database["public"]["Enums"]["delivery_status"]
        }
        Returns: {
          accepted_at: string | null
          created_by: string
          delivered_at: string | null
          destination_address: string
          driver_id: string | null
          estimated_driver_pay_php: number
          id: string
          offered_at: string
          order_id: string | null
          package_class: string
          pickup_address: string
          status: Database["public"]["Enums"]["delivery_status"]
        }
        SetofOptions: {
          from: "*"
          to: "delivery_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transition_marketplace_order: {
        Args: {
          p_order: string
          p_reason?: string
          p_status: Database["public"]["Enums"]["marketplace_order_status"]
        }
        Returns: {
          business_id: string
          completed_at: string | null
          created_at: string
          customer_id: string
          customer_notes: string | null
          delivery_address: string | null
          delivery_barangay_code: string | null
          delivery_fee_php: number
          discount_php: number
          fulfillment_mode: Database["public"]["Enums"]["order_fulfillment_mode"]
          id: string
          location_id: string
          order_number: number
          service_fee_php: number
          status: Database["public"]["Enums"]["marketplace_order_status"]
          subtotal_php: number
          total_php: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "marketplace_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transition_restaurant_reservation: {
        Args: {
          p_reservation: string
          p_status: Database["public"]["Enums"]["reservation_status"]
        }
        Returns: {
          contact_name: string
          contact_phone: string
          created_at: string
          id: string
          location_id: string
          notes: string | null
          party_size: number
          requester_id: string
          reserved_for: string
          status: Database["public"]["Enums"]["reservation_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "restaurant_reservations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transition_spotlight_booking: {
        Args: {
          p_booking: string
          p_reason?: string
          p_status: Database["public"]["Enums"]["spotlight_inquiry_status"]
        }
        Returns: {
          audience_size: number | null
          budget_php: number | null
          commission_percent: number
          created_at: string
          event_date: string
          event_location: string
          event_type: string
          guardian_approved_at: string | null
          guardian_approved_by: string | null
          id: string
          message: string
          minor_child_profile_id: string | null
          requester_id: string
          status: Database["public"]["Enums"]["spotlight_inquiry_status"]
          submission_id: string
          transport_needed: boolean
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "spotlight_booking_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_business_category_suggestion: {
        Args: {
          p_group_id: string
          p_group_label: string
          p_normalized_suggestion: string
          p_note?: string
          p_suggestion: string
        }
        Returns: undefined
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
      catalog_kind:
        | "restaurant"
        | "grocery"
        | "pharmacy"
        | "hardware"
        | "service"
      delivery_status:
        | "offered"
        | "accepted"
        | "arrived_pickup"
        | "collected"
        | "en_route"
        | "delivered"
        | "failed"
        | "returned"
        | "cancelled"
      driver_status: "pending" | "approved" | "suspended" | "rejected"
      event_status: "scheduled" | "cancelled" | "completed"
      family_discount_kind: "percent" | "fixed_php" | "bonus"
      family_member_kind: "adult" | "child"
      fuel_type: "gasoline_91" | "gasoline_95" | "gasoline_97" | "diesel"
      group_role: "owner" | "admin" | "member"
      group_type: "league" | "club" | "interest_group"
      guardian_relationship_status: "pending" | "verified" | "revoked"
      ledger_status: "pending" | "approved" | "paid" | "void"
      marketplace_order_status:
        | "submitted"
        | "confirmed"
        | "preparing"
        | "ready"
        | "assigned"
        | "picked_up"
        | "delivered"
        | "completed"
        | "rejected"
        | "cancelled"
        | "refunded"
      membership_status: "pending" | "active" | "expired" | "cancelled"
      merchant_status: "pending" | "verified" | "suspended"
      minor_permission_type:
        | "public_profile"
        | "spotlight_participation"
        | "public_media"
        | "leaderboard"
        | "booking_inquiries"
        | "transportation"
        | "live_events"
      order_fulfillment_mode: "pickup" | "delivery" | "reservation"
      payment_status:
        | "pending"
        | "authorized"
        | "paid"
        | "failed"
        | "refunded"
        | "void"
      reservation_status:
        | "requested"
        | "confirmed"
        | "seated"
        | "completed"
        | "declined"
        | "cancelled"
        | "no_show"
      spotlight_inquiry_status:
        | "new"
        | "contacted"
        | "closed"
        | "talent_review"
        | "accepted"
        | "declined"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "disputed"
      spotlight_submission_status:
        | "pending"
        | "needs_changes"
        | "approved"
        | "rejected"
        | "featured"
      subscription_status: "trial" | "active" | "past_due" | "cancelled"
      venue_status: "pending" | "approved" | "rejected"
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
  graphql_public: {
    Enums: {},
  },
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
      catalog_kind: [
        "restaurant",
        "grocery",
        "pharmacy",
        "hardware",
        "service",
      ],
      delivery_status: [
        "offered",
        "accepted",
        "arrived_pickup",
        "collected",
        "en_route",
        "delivered",
        "failed",
        "returned",
        "cancelled",
      ],
      driver_status: ["pending", "approved", "suspended", "rejected"],
      event_status: ["scheduled", "cancelled", "completed"],
      family_discount_kind: ["percent", "fixed_php", "bonus"],
      family_member_kind: ["adult", "child"],
      fuel_type: ["gasoline_91", "gasoline_95", "gasoline_97", "diesel"],
      group_role: ["owner", "admin", "member"],
      group_type: ["league", "club", "interest_group"],
      guardian_relationship_status: ["pending", "verified", "revoked"],
      ledger_status: ["pending", "approved", "paid", "void"],
      marketplace_order_status: [
        "submitted",
        "confirmed",
        "preparing",
        "ready",
        "assigned",
        "picked_up",
        "delivered",
        "completed",
        "rejected",
        "cancelled",
        "refunded",
      ],
      membership_status: ["pending", "active", "expired", "cancelled"],
      merchant_status: ["pending", "verified", "suspended"],
      minor_permission_type: [
        "public_profile",
        "spotlight_participation",
        "public_media",
        "leaderboard",
        "booking_inquiries",
        "transportation",
        "live_events",
      ],
      order_fulfillment_mode: ["pickup", "delivery", "reservation"],
      payment_status: [
        "pending",
        "authorized",
        "paid",
        "failed",
        "refunded",
        "void",
      ],
      reservation_status: [
        "requested",
        "confirmed",
        "seated",
        "completed",
        "declined",
        "cancelled",
        "no_show",
      ],
      spotlight_inquiry_status: [
        "new",
        "contacted",
        "closed",
        "talent_review",
        "accepted",
        "declined",
        "confirmed",
        "completed",
        "cancelled",
        "disputed",
      ],
      spotlight_submission_status: [
        "pending",
        "needs_changes",
        "approved",
        "rejected",
        "featured",
      ],
      subscription_status: ["trial", "active", "past_due", "cancelled"],
      venue_status: ["pending", "approved", "rejected"],
    },
  },
} as const
