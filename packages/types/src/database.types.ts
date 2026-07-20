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
    PostgrestVersion: "14.1"
  }
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
      affiliate_clicks: {
        Row: {
          clicked_at: string
          diagnosis_type: string | null
          id: string
          partner: string
          product_url: string
          user_id: string
        }
        Insert: {
          clicked_at?: string
          diagnosis_type?: string | null
          id?: string
          partner: string
          product_url: string
          user_id: string
        }
        Update: {
          clicked_at?: string
          diagnosis_type?: string | null
          id?: string
          partner?: string
          product_url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_clicks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_clicks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      articles: {
        Row: {
          category: Database["public"]["Enums"]["article_category"]
          content_json: Json
          difficulty: Database["public"]["Enums"]["article_difficulty"]
          flag_count: number
          generated_at: string
          id: string
          is_hidden: boolean
          is_safety_critical: boolean
          is_seed_content: boolean
          is_verified: boolean
          keywords: string[]
          raw_text: string
          read_time_minutes: number | null
          search_vector: unknown
          slug: string
          summary: string | null
          title: string
          updated_at: string
          version: number
          view_count: number
        }
        Insert: {
          category?: Database["public"]["Enums"]["article_category"]
          content_json: Json
          difficulty?: Database["public"]["Enums"]["article_difficulty"]
          flag_count?: number
          generated_at?: string
          id?: string
          is_hidden?: boolean
          is_safety_critical?: boolean
          is_seed_content?: boolean
          is_verified?: boolean
          keywords?: string[]
          raw_text?: string
          read_time_minutes?: number | null
          search_vector?: unknown
          slug: string
          summary?: string | null
          title: string
          updated_at?: string
          version?: number
          view_count?: number
        }
        Update: {
          category?: Database["public"]["Enums"]["article_category"]
          content_json?: Json
          difficulty?: Database["public"]["Enums"]["article_difficulty"]
          flag_count?: number
          generated_at?: string
          id?: string
          is_hidden?: boolean
          is_safety_critical?: boolean
          is_seed_content?: boolean
          is_verified?: boolean
          keywords?: string[]
          raw_text?: string
          read_time_minutes?: number | null
          search_vector?: unknown
          slug?: string
          summary?: string | null
          title?: string
          updated_at?: string
          version?: number
          view_count?: number
        }
        Relationships: []
      }
      bike_health_reports: {
        Row: {
          bike_id: string
          download_expires_at: string | null
          iap_transaction_id: string | null
          id: string
          pdf_signed_url: string | null
          pdf_storage_path: string | null
          purchased_at: string
          status: string
          user_id: string
        }
        Insert: {
          bike_id: string
          download_expires_at?: string | null
          iap_transaction_id?: string | null
          id?: string
          pdf_signed_url?: string | null
          pdf_storage_path?: string | null
          purchased_at?: string
          status?: string
          user_id: string
        }
        Update: {
          bike_id?: string
          download_expires_at?: string | null
          iap_transaction_id?: string | null
          id?: string
          pdf_signed_url?: string | null
          pdf_storage_path?: string | null
          purchased_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bike_health_reports_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "motorcycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bike_health_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bike_health_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_post_categories: {
        Row: {
          category_id: string
          is_primary: boolean
          post_id: string
        }
        Insert: {
          category_id: string
          is_primary?: boolean
          post_id: string
        }
        Update: {
          category_id?: string
          is_primary?: boolean
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_post_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_post_categories_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_post_gear: {
        Row: {
          brand: string | null
          meta: Json
          model: string | null
          post_id: string
          price_eur: number | null
          rating: number | null
          verdict: string | null
        }
        Insert: {
          brand?: string | null
          meta?: Json
          model?: string | null
          post_id: string
          price_eur?: number | null
          rating?: number | null
          verdict?: string | null
        }
        Update: {
          brand?: string | null
          meta?: Json
          model?: string | null
          post_id?: string
          price_eur?: number | null
          rating?: number | null
          verdict?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_post_gear_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_post_guide: {
        Row: {
          difficulty: string | null
          meta: Json
          post_id: string
        }
        Insert: {
          difficulty?: string | null
          meta?: Json
          post_id: string
        }
        Update: {
          difficulty?: string | null
          meta?: Json
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_post_guide_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_post_keywords: {
        Row: {
          keyword_id: string
          post_id: string
        }
        Insert: {
          keyword_id: string
          post_id: string
        }
        Update: {
          keyword_id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_post_keywords_keyword_id_fkey"
            columns: ["keyword_id"]
            isOneToOne: false
            referencedRelation: "keywords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_post_keywords_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_post_maintenance: {
        Row: {
          applicable_models: string[]
          dataset_models: string[]
          make: string | null
          meta: Json
          model: string | null
          post_id: string
          variant: string | null
        }
        Insert: {
          applicable_models?: string[]
          dataset_models?: string[]
          make?: string | null
          meta?: Json
          model?: string | null
          post_id: string
          variant?: string | null
        }
        Update: {
          applicable_models?: string[]
          dataset_models?: string[]
          make?: string | null
          meta?: Json
          model?: string | null
          post_id?: string
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_post_maintenance_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_post_translations: {
        Row: {
          body_json: Json | null
          body_raw: string
          body_text: string
          created_at: string
          excerpt: string | null
          faq: Json
          keyword_text: string
          locale: string
          post_id: string
          reading_time: string | null
          search_vector: unknown
          seo_description: string | null
          seo_title: string | null
          title: string
          updated_at: string
          word_count: number | null
        }
        Insert: {
          body_json?: Json | null
          body_raw?: string
          body_text?: string
          created_at?: string
          excerpt?: string | null
          faq?: Json
          keyword_text?: string
          locale: string
          post_id: string
          reading_time?: string | null
          search_vector?: unknown
          seo_description?: string | null
          seo_title?: string | null
          title: string
          updated_at?: string
          word_count?: number | null
        }
        Update: {
          body_json?: Json | null
          body_raw?: string
          body_text?: string
          created_at?: string
          excerpt?: string | null
          faq?: Json
          keyword_text?: string
          locale?: string
          post_id?: string
          reading_time?: string | null
          search_vector?: unknown
          seo_description?: string | null
          seo_title?: string | null
          title?: string
          updated_at?: string
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_post_translations_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_post_trip: {
        Row: {
          country_codes: string[]
          distance_km: number | null
          meta: Json
          post_id: string
          route_gpx: string | null
        }
        Insert: {
          country_codes?: string[]
          distance_km?: number | null
          meta?: Json
          post_id: string
          route_gpx?: string | null
        }
        Update: {
          country_codes?: string[]
          distance_km?: number | null
          meta?: Json
          post_id?: string
          route_gpx?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_post_trip_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_post_versions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          post_id: string
          snapshot: Json
          version_num: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          post_id: string
          snapshot: Json
          version_num: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          post_id?: string
          snapshot?: Json
          version_num?: number
        }
        Relationships: [
          {
            foreignKeyName: "blog_post_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_post_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_post_versions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author: string | null
          cover_alt: string | null
          cover_image: string | null
          created_at: string
          id: string
          is_safety_critical: boolean
          published_at: string | null
          scheduled_for: string | null
          slug: string
          spec_data: boolean
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          author?: string | null
          cover_alt?: string | null
          cover_image?: string | null
          created_at?: string
          id?: string
          is_safety_critical?: boolean
          published_at?: string | null
          scheduled_for?: string | null
          slug: string
          spec_data?: boolean
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          author?: string | null
          cover_alt?: string | null
          cover_image?: string | null
          created_at?: string
          id?: string
          is_safety_critical?: boolean
          published_at?: string | null
          scheduled_for?: string | null
          slug?: string
          spec_data?: boolean
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_id: string | null
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_flags: {
        Row: {
          comment_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_flags_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_flags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_flags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          created_at: string
          flagged_count: number
          group_ride_id: string | null
          id: string
          parent_comment_id: string | null
          ride_id: string | null
          route_id: string | null
          text: string
          trip_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          flagged_count?: number
          group_ride_id?: string | null
          id?: string
          parent_comment_id?: string | null
          ride_id?: string | null
          route_id?: string | null
          text: string
          trip_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          flagged_count?: number
          group_ride_id?: string | null
          id?: string
          parent_comment_id?: string | null
          ride_id?: string | null
          route_id?: string | null
          text?: string
          trip_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_comments_group_ride"
            columns: ["group_ride_id"]
            isOneToOne: false
            referencedRelation: "group_rides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_comments_route"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      content_flags: {
        Row: {
          article_id: string
          comment: string
          created_at: string
          id: string
          section_reference: string | null
          status: Database["public"]["Enums"]["flag_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          article_id: string
          comment: string
          created_at?: string
          id?: string
          section_reference?: string | null
          status?: Database["public"]["Enums"]["flag_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          article_id?: string
          comment?: string
          created_at?: string
          id?: string
          section_reference?: string | null
          status?: Database["public"]["Enums"]["flag_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_flags_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_flags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_flags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      content_generation_log: {
        Row: {
          content_id: string | null
          content_type: string
          cost_cents: number | null
          created_at: string
          error_message: string | null
          id: string
          input_tokens: number | null
          model: string | null
          output_tokens: number | null
          status: string
          user_id: string | null
        }
        Insert: {
          content_id?: string | null
          content_type: string
          cost_cents?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          input_tokens?: number | null
          model?: string | null
          output_tokens?: number | null
          status?: string
          user_id?: string | null
        }
        Update: {
          content_id?: string | null
          content_type?: string
          cost_cents?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          input_tokens?: number | null
          model?: string | null
          output_tokens?: number | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_generation_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_generation_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      data_export_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          download_url: string | null
          error_message: string | null
          expires_at: string | null
          id: string
          requested_at: string
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          download_url?: string | null
          error_message?: string | null
          expires_at?: string | null
          id?: string
          requested_at?: string
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          download_url?: string | null
          error_message?: string | null
          expires_at?: string | null
          id?: string
          requested_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_export_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_export_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      device_push_tokens: {
        Row: {
          created_at: string
          id: string
          last_seen_at: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_seen_at?: string
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_seen_at?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_photos: {
        Row: {
          diagnostic_id: string
          file_size_bytes: number | null
          id: string
          original_filename: string | null
          storage_path: string
          uploaded_at: string
        }
        Insert: {
          diagnostic_id: string
          file_size_bytes?: number | null
          id?: string
          original_filename?: string | null
          storage_path: string
          uploaded_at?: string
        }
        Update: {
          diagnostic_id?: string
          file_size_bytes?: number | null
          id?: string
          original_filename?: string | null
          storage_path?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_photos_diagnostic_id_fkey"
            columns: ["diagnostic_id"]
            isOneToOne: false
            referencedRelation: "diagnostics"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostics: {
        Row: {
          additional_notes: string | null
          confidence: number | null
          created_at: string
          data_sharing_opted_in: boolean
          description: string | null
          free_text_description: string | null
          id: string
          manual_bike_info: Json | null
          motorcycle_id: string | null
          photo_url: string | null
          related_article_id: string | null
          result_json: Json
          severity: Database["public"]["Enums"]["diagnostic_severity"] | null
          status: string
          urgency: string | null
          user_id: string
          wizard_answers: Json | null
        }
        Insert: {
          additional_notes?: string | null
          confidence?: number | null
          created_at?: string
          data_sharing_opted_in?: boolean
          description?: string | null
          free_text_description?: string | null
          id?: string
          manual_bike_info?: Json | null
          motorcycle_id?: string | null
          photo_url?: string | null
          related_article_id?: string | null
          result_json: Json
          severity?: Database["public"]["Enums"]["diagnostic_severity"] | null
          status?: string
          urgency?: string | null
          user_id: string
          wizard_answers?: Json | null
        }
        Update: {
          additional_notes?: string | null
          confidence?: number | null
          created_at?: string
          data_sharing_opted_in?: boolean
          description?: string | null
          free_text_description?: string | null
          id?: string
          manual_bike_info?: Json | null
          motorcycle_id?: string | null
          photo_url?: string | null
          related_article_id?: string | null
          result_json?: Json
          severity?: Database["public"]["Enums"]["diagnostic_severity"] | null
          status?: string
          urgency?: string | null
          user_id?: string
          wizard_answers?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "diagnostics_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "motorcycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostics_related_article_id_fkey"
            columns: ["related_article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      discover_trip_reviews: {
        Row: {
          bike_id: string | null
          condition_tags: Json | null
          created_at: string
          discover_trip_id: string
          id: string
          rating: number
          text: string | null
          user_id: string | null
        }
        Insert: {
          bike_id?: string | null
          condition_tags?: Json | null
          created_at?: string
          discover_trip_id: string
          id?: string
          rating: number
          text?: string | null
          user_id?: string | null
        }
        Update: {
          bike_id?: string | null
          condition_tags?: Json | null
          created_at?: string
          discover_trip_id?: string
          id?: string
          rating?: number
          text?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discover_trip_reviews_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "motorcycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discover_trip_reviews_discover_trip_id_fkey"
            columns: ["discover_trip_id"]
            isOneToOne: false
            referencedRelation: "discover_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discover_trip_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discover_trip_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      discover_trips: {
        Row: {
          average_rating: number | null
          city: string | null
          clone_count: number
          contributor_user_id: string | null
          country_code: string
          curvature_index: number | null
          day_count: number
          description: string
          difficulty: string
          distance_m: number | null
          elevation_gain_m: number | null
          estimated_duration_minutes: number | null
          featured_order: number | null
          forked_from_discover_trip_id: string | null
          id: string
          is_featured: boolean
          is_motovault_pick: boolean
          migrated_from_route_id: string | null
          polyline: string | null
          published_at: string
          region_code: string | null
          review_count: number
          search_tsv: unknown
          slug: string
          source_trip_id: string | null
          start_lat: number | null
          start_lng: number | null
          start_point: unknown
          status: string
          surface_type: string | null
          title: string
          updated_at: string
          view_count: number
          waypoints: Json
        }
        Insert: {
          average_rating?: number | null
          city?: string | null
          clone_count?: number
          contributor_user_id?: string | null
          country_code: string
          curvature_index?: number | null
          day_count?: number
          description: string
          difficulty: string
          distance_m?: number | null
          elevation_gain_m?: number | null
          estimated_duration_minutes?: number | null
          featured_order?: number | null
          forked_from_discover_trip_id?: string | null
          id?: string
          is_featured?: boolean
          is_motovault_pick?: boolean
          migrated_from_route_id?: string | null
          polyline?: string | null
          published_at?: string
          region_code?: string | null
          review_count?: number
          search_tsv?: unknown
          slug: string
          source_trip_id?: string | null
          start_lat?: number | null
          start_lng?: number | null
          start_point?: unknown
          status?: string
          surface_type?: string | null
          title: string
          updated_at?: string
          view_count?: number
          waypoints?: Json
        }
        Update: {
          average_rating?: number | null
          city?: string | null
          clone_count?: number
          contributor_user_id?: string | null
          country_code?: string
          curvature_index?: number | null
          day_count?: number
          description?: string
          difficulty?: string
          distance_m?: number | null
          elevation_gain_m?: number | null
          estimated_duration_minutes?: number | null
          featured_order?: number | null
          forked_from_discover_trip_id?: string | null
          id?: string
          is_featured?: boolean
          is_motovault_pick?: boolean
          migrated_from_route_id?: string | null
          polyline?: string | null
          published_at?: string
          region_code?: string | null
          review_count?: number
          search_tsv?: unknown
          slug?: string
          source_trip_id?: string | null
          start_lat?: number | null
          start_lng?: number | null
          start_point?: unknown
          status?: string
          surface_type?: string | null
          title?: string
          updated_at?: string
          view_count?: number
          waypoints?: Json
        }
        Relationships: [
          {
            foreignKeyName: "discover_trips_contributor_user_id_fkey"
            columns: ["contributor_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discover_trips_contributor_user_id_fkey"
            columns: ["contributor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discover_trips_forked_from_discover_trip_id_fkey"
            columns: ["forked_from_discover_trip_id"]
            isOneToOne: false
            referencedRelation: "discover_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discover_trips_source_trip_id_fkey"
            columns: ["source_trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      document_categories: {
        Row: {
          created_at: string
          id: string
          is_hidden: boolean
          kind: string
          name: string
          prompts_expiry: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_hidden?: boolean
          kind?: string
          name: string
          prompts_expiry?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_hidden?: boolean
          kind?: string
          name?: string
          prompts_expiry?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      document_files: {
        Row: {
          created_at: string
          document_id: string
          file_size_bytes: number | null
          id: string
          mime_type: string
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          file_size_bytes?: number | null
          id?: string
          mime_type: string
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_files_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category_id: string
          created_at: string
          deleted_at: string | null
          expiry_date: string | null
          id: string
          is_pinned: boolean
          motorcycle_id: string
          note: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          deleted_at?: string | null
          expiry_date?: string | null
          id?: string
          is_pinned?: boolean
          motorcycle_id: string
          note?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          deleted_at?: string | null
          expiry_date?: string | null
          id?: string
          is_pinned?: boolean
          motorcycle_id?: string
          note?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "document_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "motorcycles"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_photos: {
        Row: {
          bucket: string
          created_at: string
          expense_id: string
          file_size_bytes: number | null
          id: string
          mime_type: string
          storage_path: string
          user_id: string
        }
        Insert: {
          bucket?: string
          created_at?: string
          expense_id: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string
          storage_path: string
          user_id: string
        }
        Update: {
          bucket?: string
          created_at?: string
          expense_id?: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_photos_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          currency: string
          date: string
          deleted_at: string | null
          description: string | null
          id: string
          item_name: string | null
          maintenance_task_id: string | null
          motorcycle_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          currency?: string
          date: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          item_name?: string | null
          maintenance_task_id?: string | null
          motorcycle_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          currency?: string
          date?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          item_name?: string | null
          maintenance_task_id?: string | null
          motorcycle_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_maintenance_task_id_fkey"
            columns: ["maintenance_task_id"]
            isOneToOne: false
            referencedRelation: "maintenance_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "motorcycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      group_ride_participants: {
        Row: {
          group_ride_id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          group_ride_id: string
          joined_at?: string
          user_id: string
        }
        Update: {
          group_ride_id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_ride_participants_group_ride_id_fkey"
            columns: ["group_ride_id"]
            isOneToOne: false
            referencedRelation: "group_rides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_ride_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_ride_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      group_rides: {
        Row: {
          comment_count: number
          created_at: string
          date_time: string
          description: string
          difficulty: string
          id: string
          max_riders: number
          meeting_point_lat: number
          meeting_point_lng: number
          meeting_point_name: string | null
          organiser_user_id: string
          participant_count: number
          route_description: string | null
          route_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          comment_count?: number
          created_at?: string
          date_time: string
          description: string
          difficulty: string
          id?: string
          max_riders?: number
          meeting_point_lat: number
          meeting_point_lng: number
          meeting_point_name?: string | null
          organiser_user_id: string
          participant_count?: number
          route_description?: string | null
          route_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          comment_count?: number
          created_at?: string
          date_time?: string
          description?: string
          difficulty?: string
          id?: string
          max_riders?: number
          meeting_point_lat?: number
          meeting_point_lng?: number
          meeting_point_name?: string | null
          organiser_user_id?: string
          participant_count?: number
          route_description?: string | null
          route_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_rides_organiser_user_id_fkey"
            columns: ["organiser_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_rides_organiser_user_id_fkey"
            columns: ["organiser_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_rides_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      keywords: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      learning_progress: {
        Row: {
          article_id: string
          article_read: boolean
          first_read_at: string | null
          id: string
          last_read_at: string | null
          quiz_best_score: number | null
          quiz_completed: boolean
          user_id: string
        }
        Insert: {
          article_id: string
          article_read?: boolean
          first_read_at?: string | null
          id?: string
          last_read_at?: string | null
          quiz_best_score?: number | null
          quiz_completed?: boolean
          user_id: string
        }
        Update: {
          article_id?: string
          article_read?: boolean
          first_read_at?: string | null
          id?: string
          last_read_at?: string | null
          quiz_best_score?: number | null
          quiz_completed?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_progress_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_data_sources: {
        Row: {
          created_at: string
          edition_language: string | null
          id: string
          market_applicability: string | null
          reference: string | null
          retrieved_at: string
          source_type: string
          source_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          edition_language?: string | null
          id?: string
          market_applicability?: string | null
          reference?: string | null
          retrieved_at?: string
          source_type: string
          source_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          edition_language?: string | null
          id?: string
          market_applicability?: string | null
          reference?: string | null
          retrieved_at?: string
          source_type?: string
          source_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      maintenance_push_log: {
        Row: {
          due_date: string
          id: string
          sent_at: string
          task_id: string
          user_id: string
        }
        Insert: {
          due_date: string
          id?: string
          sent_at?: string
          task_id: string
          user_id: string
        }
        Update: {
          due_date?: string
          id?: string
          sent_at?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_push_log_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "maintenance_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_push_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_push_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_task_line_items: {
        Row: {
          created_at: string
          id: string
          label: string
          line_total: number | null
          part_ref: string | null
          quantity: number | null
          service_type: string
          sort_order: number
          task_id: string
          unit_price: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          line_total?: number | null
          part_ref?: string | null
          quantity?: number | null
          service_type: string
          sort_order?: number
          task_id: string
          unit_price?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          line_total?: number | null
          part_ref?: string | null
          quantity?: number | null
          service_type?: string
          sort_order?: number
          task_id?: string
          unit_price?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_task_line_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "maintenance_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_task_photos: {
        Row: {
          bucket: string
          created_at: string
          file_size_bytes: number | null
          id: string
          mime_type: string
          storage_path: string
          task_id: string
          user_id: string
        }
        Insert: {
          bucket?: string
          created_at?: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string
          storage_path: string
          task_id: string
          user_id: string
        }
        Update: {
          bucket?: string
          created_at?: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string
          storage_path?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_task_photos_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "maintenance_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_tasks: {
        Row: {
          completed_at: string | null
          completed_mileage: number | null
          cost: number | null
          created_at: string
          currency: string | null
          deleted_at: string | null
          description: string | null
          due_date: string | null
          id: string
          interval_days: number | null
          interval_km: number | null
          is_recurring: boolean
          labor_cost: number | null
          motorcycle_id: string
          notes: string | null
          oem_schedule_id: string | null
          parts_cost: number | null
          parts_needed: string[] | null
          priority: string
          remind_1d: boolean
          remind_30d: boolean
          remind_7d: boolean
          source: string
          status: string
          target_mileage: number | null
          tax_amount: number | null
          tax_rate: number | null
          title: string
          total_amount: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_mileage?: number | null
          cost?: number | null
          created_at?: string
          currency?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          interval_days?: number | null
          interval_km?: number | null
          is_recurring?: boolean
          labor_cost?: number | null
          motorcycle_id: string
          notes?: string | null
          oem_schedule_id?: string | null
          parts_cost?: number | null
          parts_needed?: string[] | null
          priority?: string
          remind_1d?: boolean
          remind_30d?: boolean
          remind_7d?: boolean
          source?: string
          status?: string
          target_mileage?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          title: string
          total_amount?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completed_mileage?: number | null
          cost?: number | null
          created_at?: string
          currency?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          interval_days?: number | null
          interval_km?: number | null
          is_recurring?: boolean
          labor_cost?: number | null
          motorcycle_id?: string
          notes?: string | null
          oem_schedule_id?: string | null
          parts_cost?: number | null
          parts_needed?: string[] | null
          priority?: string
          remind_1d?: boolean
          remind_30d?: boolean
          remind_7d?: boolean
          source?: string
          status?: string
          target_mileage?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          title?: string
          total_amount?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_tasks_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "motorcycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tasks_oem_schedule_id_fkey"
            columns: ["oem_schedule_id"]
            isOneToOne: false
            referencedRelation: "oem_maintenance_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      model_insights: {
        Row: {
          created_at: string
          generated_at: string | null
          id: string
          make: string
          model: string
          normalized_key: string | null
          payload: Json | null
          source_model: string | null
          status: string
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          generated_at?: string | null
          id?: string
          make: string
          model: string
          normalized_key?: string | null
          payload?: Json | null
          source_model?: string | null
          status?: string
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          generated_at?: string | null
          id?: string
          make?: string
          model?: string
          normalized_key?: string | null
          payload?: Json | null
          source_model?: string | null
          status?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      motorcycle_specs: {
        Row: {
          created_at: string
          id: string
          is_safety_critical: boolean
          is_verified: boolean
          make: string
          model: string | null
          source_context: string | null
          source_id: string | null
          source_page: string | null
          spec_name: string
          spec_type: string
          unit: string
          updated_at: string
          value_display: string | null
          value_numeric: number
          variant: string | null
          verified_at: string | null
          verified_by: string | null
          year_from: number | null
          year_to: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_safety_critical?: boolean
          is_verified?: boolean
          make: string
          model?: string | null
          source_context?: string | null
          source_id?: string | null
          source_page?: string | null
          spec_name: string
          spec_type: string
          unit: string
          updated_at?: string
          value_display?: string | null
          value_numeric: number
          variant?: string | null
          verified_at?: string | null
          verified_by?: string | null
          year_from?: number | null
          year_to?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          is_safety_critical?: boolean
          is_verified?: boolean
          make?: string
          model?: string | null
          source_context?: string | null
          source_id?: string | null
          source_page?: string | null
          spec_name?: string
          spec_type?: string
          unit?: string
          updated_at?: string
          value_display?: string | null
          value_numeric?: number
          variant?: string | null
          verified_at?: string | null
          verified_by?: string | null
          year_from?: number | null
          year_to?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "motorcycle_specs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "maintenance_data_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "motorcycle_specs_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "motorcycle_specs_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      motorcycles: {
        Row: {
          created_at: string
          current_mileage: number | null
          deleted_at: string | null
          engine_cc: number | null
          id: string
          is_primary: boolean
          make: string
          metadata: Json | null
          mileage_unit: string | null
          mileage_updated_at: string | null
          model: string
          nickname: string | null
          odometer_last_ride_id: string | null
          odometer_sync_source: string
          primary_photo_url: string | null
          purchase_date: string | null
          purchase_price: number | null
          recall_count: number | null
          recall_last_checked_at: string | null
          type: Database["public"]["Enums"]["motorcycle_type"] | null
          updated_at: string
          user_id: string
          variant: string | null
          vin: string | null
          year: number
        }
        Insert: {
          created_at?: string
          current_mileage?: number | null
          deleted_at?: string | null
          engine_cc?: number | null
          id?: string
          is_primary?: boolean
          make: string
          metadata?: Json | null
          mileage_unit?: string | null
          mileage_updated_at?: string | null
          model: string
          nickname?: string | null
          odometer_last_ride_id?: string | null
          odometer_sync_source?: string
          primary_photo_url?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          recall_count?: number | null
          recall_last_checked_at?: string | null
          type?: Database["public"]["Enums"]["motorcycle_type"] | null
          updated_at?: string
          user_id: string
          variant?: string | null
          vin?: string | null
          year: number
        }
        Update: {
          created_at?: string
          current_mileage?: number | null
          deleted_at?: string | null
          engine_cc?: number | null
          id?: string
          is_primary?: boolean
          make?: string
          metadata?: Json | null
          mileage_unit?: string | null
          mileage_updated_at?: string | null
          model?: string
          nickname?: string | null
          odometer_last_ride_id?: string | null
          odometer_sync_source?: string
          primary_photo_url?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          recall_count?: number | null
          recall_last_checked_at?: string | null
          type?: Database["public"]["Enums"]["motorcycle_type"] | null
          updated_at?: string
          user_id?: string
          variant?: string | null
          vin?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "motorcycles_odometer_last_ride_id_fkey"
            columns: ["odometer_last_ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "motorcycles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "motorcycles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      oem_maintenance_schedules: {
        Row: {
          created_at: string
          description: string | null
          engine_cc_max: number | null
          engine_cc_min: number | null
          engine_type: string | null
          id: string
          interval_days: number | null
          interval_km: number | null
          is_safety_critical: boolean
          is_verified: boolean
          make: string
          model: string | null
          priority: string
          sort_order: number | null
          source_context: string | null
          source_id: string | null
          source_page: string | null
          task_name: string
          variant: string | null
          verified_at: string | null
          verified_by: string | null
          year_from: number | null
          year_to: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          engine_cc_max?: number | null
          engine_cc_min?: number | null
          engine_type?: string | null
          id?: string
          interval_days?: number | null
          interval_km?: number | null
          is_safety_critical?: boolean
          is_verified?: boolean
          make: string
          model?: string | null
          priority?: string
          sort_order?: number | null
          source_context?: string | null
          source_id?: string | null
          source_page?: string | null
          task_name: string
          variant?: string | null
          verified_at?: string | null
          verified_by?: string | null
          year_from?: number | null
          year_to?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          engine_cc_max?: number | null
          engine_cc_min?: number | null
          engine_type?: string | null
          id?: string
          interval_days?: number | null
          interval_km?: number | null
          is_safety_critical?: boolean
          is_verified?: boolean
          make?: string
          model?: string | null
          priority?: string
          sort_order?: number | null
          source_context?: string | null
          source_id?: string | null
          source_page?: string | null
          task_name?: string
          variant?: string | null
          verified_at?: string | null
          verified_by?: string | null
          year_from?: number | null
          year_to?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "oem_maintenance_schedules_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "maintenance_data_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oem_maintenance_schedules_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oem_maintenance_schedules_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          country_code: string
          id: number
          kind: string
          latitude: number
          longitude: number
          name: string
          population: number | null
          region_code: string | null
          route_count: number
          search_tsv: unknown
        }
        Insert: {
          country_code: string
          id: number
          kind: string
          latitude: number
          longitude: number
          name: string
          population?: number | null
          region_code?: string | null
          route_count?: number
          search_tsv?: unknown
        }
        Update: {
          country_code?: string
          id?: number
          kind?: string
          latitude?: number
          longitude?: number
          name?: string
          population?: number | null
          region_code?: string | null
          route_count?: number
          search_tsv?: unknown
        }
        Relationships: []
      }
      premium_waitlist: {
        Row: {
          feature: string
          id: string
          signed_up_at: string
          user_id: string
        }
        Insert: {
          feature: string
          id?: string
          signed_up_at?: string
          user_id: string
        }
        Update: {
          feature?: string
          id?: string
          signed_up_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "premium_waitlist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "premium_waitlist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          answers_json: Json
          completed_at: string
          id: string
          quiz_id: string
          score: number
          total_questions: number
          user_id: string
        }
        Insert: {
          answers_json: Json
          completed_at?: string
          id?: string
          quiz_id: string
          score: number
          total_questions: number
          user_id: string
        }
        Update: {
          answers_json?: Json
          completed_at?: string
          id?: string
          quiz_id?: string
          score?: number
          total_questions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          article_id: string
          generated_at: string
          id: string
          questions_json: Json
        }
        Insert: {
          article_id: string
          generated_at?: string
          id?: string
          questions_json: Json
        }
        Update: {
          article_id?: string
          generated_at?: string
          id?: string
          questions_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: true
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_scans: {
        Row: {
          consumed_month: string
          created_at: string
          extraction_payload: Json | null
          id: string
          is_onboarding: boolean
          saved_at: string | null
          saved_record_refs: Json | null
          status: string
          storage_path: string | null
          user_id: string
        }
        Insert: {
          consumed_month?: string
          created_at?: string
          extraction_payload?: Json | null
          id?: string
          is_onboarding?: boolean
          saved_at?: string | null
          saved_record_refs?: Json | null
          status?: string
          storage_path?: string | null
          user_id: string
        }
        Update: {
          consumed_month?: string
          created_at?: string
          extraction_payload?: Json | null
          id?: string
          is_onboarding?: boolean
          saved_at?: string | null
          saved_record_refs?: Json | null
          status?: string
          storage_path?: string | null
          user_id?: string
        }
        Relationships: []
      }
      revenuecat_webhook_events: {
        Row: {
          app_user_id: string
          event_id: string
          event_type: string
          processed_at: string
        }
        Insert: {
          app_user_id: string
          event_id: string
          event_type: string
          processed_at?: string
        }
        Update: {
          app_user_id?: string
          event_id?: string
          event_type?: string
          processed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenuecat_webhook_events_app_user_id_fkey"
            columns: ["app_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenuecat_webhook_events_app_user_id_fkey"
            columns: ["app_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_kudos: {
        Row: {
          created_at: string
          ride_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ride_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          ride_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_kudos_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_kudos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_kudos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_records: {
        Row: {
          achieved_at: string
          created_at: string
          id: string
          motorcycle_id: string
          previous_value: number | null
          record_type: Database["public"]["Enums"]["ride_record_type"]
          ride_id: string | null
          unit: string
          user_id: string
          value: number
        }
        Insert: {
          achieved_at: string
          created_at?: string
          id?: string
          motorcycle_id?: string
          previous_value?: number | null
          record_type: Database["public"]["Enums"]["ride_record_type"]
          ride_id?: string | null
          unit: string
          user_id: string
          value: number
        }
        Update: {
          achieved_at?: string
          created_at?: string
          id?: string
          motorcycle_id?: string
          previous_value?: number | null
          record_type?: Database["public"]["Enums"]["ride_record_type"]
          ride_id?: string | null
          unit?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "ride_records_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_rollups: {
        Row: {
          band_cruise_s: number
          band_silly_s: number
          band_spirited_s: number
          band_urban_s: number
          computed_at: string
          distance_m: number
          elevation_gain_m: number
          elevation_loss_m: number
          max_lean_angle: number | null
          max_speed_mps: number | null
          motorcycle_id: string
          moving_time_s: number
          paused_time_s: number
          period_kind: Database["public"]["Enums"]["ride_rollup_period"]
          period_start: string
          ride_count: number
          user_id: string
        }
        Insert: {
          band_cruise_s?: number
          band_silly_s?: number
          band_spirited_s?: number
          band_urban_s?: number
          computed_at?: string
          distance_m?: number
          elevation_gain_m?: number
          elevation_loss_m?: number
          max_lean_angle?: number | null
          max_speed_mps?: number | null
          motorcycle_id: string
          moving_time_s?: number
          paused_time_s?: number
          period_kind: Database["public"]["Enums"]["ride_rollup_period"]
          period_start: string
          ride_count?: number
          user_id: string
        }
        Update: {
          band_cruise_s?: number
          band_silly_s?: number
          band_spirited_s?: number
          band_urban_s?: number
          computed_at?: string
          distance_m?: number
          elevation_gain_m?: number
          elevation_loss_m?: number
          max_lean_angle?: number | null
          max_speed_mps?: number | null
          motorcycle_id?: string
          moving_time_s?: number
          paused_time_s?: number
          period_kind?: Database["public"]["Enums"]["ride_rollup_period"]
          period_start?: string
          ride_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_rollups_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_rollups_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_shares: {
        Row: {
          created_at: string
          id: string
          ride_id: string
          shared_by_user_id: string
          shared_with_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ride_id: string
          shared_by_user_id: string
          shared_with_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ride_id?: string
          shared_by_user_id?: string
          shared_with_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_shares_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_summaries: {
        Row: {
          created_at: string
          edited_by_user: boolean
          generated_at: string | null
          generation_status: string
          id: string
          locale: string
          model_version: string | null
          ride_id: string
          summary_text: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          edited_by_user?: boolean
          generated_at?: string | null
          generation_status?: string
          id?: string
          locale?: string
          model_version?: string | null
          ride_id: string
          summary_text?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          edited_by_user?: boolean
          generated_at?: string | null
          generation_status?: string
          id?: string
          locale?: string
          model_version?: string | null
          ride_id?: string
          summary_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_summaries_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_waypoints: {
        Row: {
          accuracy: number | null
          altitude: number | null
          heading: number | null
          latitude: number
          lean_angle: number | null
          longitude: number
          recorded_at: string
          ride_id: string
          speed_mps: number | null
        }
        Insert: {
          accuracy?: number | null
          altitude?: number | null
          heading?: number | null
          latitude: number
          lean_angle?: number | null
          longitude: number
          recorded_at: string
          ride_id: string
          speed_mps?: number | null
        }
        Update: {
          accuracy?: number | null
          altitude?: number | null
          heading?: number | null
          latitude?: number
          lean_angle?: number | null
          longitude?: number
          recorded_at?: string
          ride_id?: string
          speed_mps?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ride_waypoints_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      rides: {
        Row: {
          ai_summary: string | null
          auto_paused_duration_s: number
          avg_speed_mps: number | null
          comment_count: number
          created_at: string
          deleted_at: string | null
          distance_m: number | null
          elevation_gain: number | null
          elevation_loss: number | null
          ended_at: string | null
          gps_quality: number | null
          id: string
          is_public: boolean
          kudos_count: number
          max_lean_angle: number | null
          max_speed_mps: number | null
          metadata: Json
          mileage_applied: boolean
          motorcycle_id: string | null
          name: string | null
          paused_duration_s: number
          region: string | null
          route_polyline: string | null
          route_thumbnail_uri: string | null
          started_at: string
          status: string
          updated_at: string
          user_id: string
          visibility: Database["public"]["Enums"]["content_visibility"]
          weather_snapshot: Json | null
        }
        Insert: {
          ai_summary?: string | null
          auto_paused_duration_s?: number
          avg_speed_mps?: number | null
          comment_count?: number
          created_at?: string
          deleted_at?: string | null
          distance_m?: number | null
          elevation_gain?: number | null
          elevation_loss?: number | null
          ended_at?: string | null
          gps_quality?: number | null
          id?: string
          is_public?: boolean
          kudos_count?: number
          max_lean_angle?: number | null
          max_speed_mps?: number | null
          metadata?: Json
          mileage_applied?: boolean
          motorcycle_id?: string | null
          name?: string | null
          paused_duration_s?: number
          region?: string | null
          route_polyline?: string | null
          route_thumbnail_uri?: string | null
          started_at: string
          status?: string
          updated_at?: string
          user_id: string
          visibility?: Database["public"]["Enums"]["content_visibility"]
          weather_snapshot?: Json | null
        }
        Update: {
          ai_summary?: string | null
          auto_paused_duration_s?: number
          avg_speed_mps?: number | null
          comment_count?: number
          created_at?: string
          deleted_at?: string | null
          distance_m?: number | null
          elevation_gain?: number | null
          elevation_loss?: number | null
          ended_at?: string | null
          gps_quality?: number | null
          id?: string
          is_public?: boolean
          kudos_count?: number
          max_lean_angle?: number | null
          max_speed_mps?: number | null
          metadata?: Json
          mileage_applied?: boolean
          motorcycle_id?: string | null
          name?: string | null
          paused_duration_s?: number
          region?: string | null
          route_polyline?: string | null
          route_thumbnail_uri?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
          visibility?: Database["public"]["Enums"]["content_visibility"]
          weather_snapshot?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "rides_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "motorcycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      route_list_items: {
        Row: {
          added_at: string
          list_id: string
          note: string | null
          route_id: string
        }
        Insert: {
          added_at?: string
          list_id: string
          note?: string | null
          route_id: string
        }
        Update: {
          added_at?: string
          list_id?: string
          note?: string | null
          route_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "route_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_list_items_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      route_lists: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          slug: string
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          slug: string
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          slug?: string
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_lists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_lists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      route_reviews: {
        Row: {
          bike_id: string | null
          condition_tags: Json | null
          created_at: string
          id: string
          rating: number
          route_id: string
          text: string | null
          user_id: string
        }
        Insert: {
          bike_id?: string | null
          condition_tags?: Json | null
          created_at?: string
          id?: string
          rating: number
          route_id: string
          text?: string | null
          user_id: string
        }
        Update: {
          bike_id?: string | null
          condition_tags?: Json | null
          created_at?: string
          id?: string
          rating?: number
          route_id?: string
          text?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_reviews_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "motorcycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_reviews_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      route_saves: {
        Row: {
          route_id: string
          saved_at: string
          user_id: string
        }
        Insert: {
          route_id: string
          saved_at?: string
          user_id: string
        }
        Update: {
          route_id?: string
          saved_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_saves_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_saves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_saves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          city: string | null
          comment_count: number
          contributor_user_id: string
          country_code: string | null
          created_at: string
          curvature_index: number | null
          description: string | null
          distance_m: number
          editorial_description: string | null
          elevation_gain_m: number | null
          end_point: unknown
          featured_tag: string | null
          geography: unknown
          id: string
          is_motovault_pick: boolean
          name: string | null
          polyline: string
          rating_avg: number | null
          rating_count: number
          region_code: string | null
          search_tsv: unknown
          slug: string | null
          source_ride_id: string | null
          start_point: unknown
          status: string
          surface_type: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          comment_count?: number
          contributor_user_id: string
          country_code?: string | null
          created_at?: string
          curvature_index?: number | null
          description?: string | null
          distance_m: number
          editorial_description?: string | null
          elevation_gain_m?: number | null
          end_point?: unknown
          featured_tag?: string | null
          geography?: unknown
          id?: string
          is_motovault_pick?: boolean
          name?: string | null
          polyline: string
          rating_avg?: number | null
          rating_count?: number
          region_code?: string | null
          search_tsv?: unknown
          slug?: string | null
          source_ride_id?: string | null
          start_point?: unknown
          status?: string
          surface_type?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          comment_count?: number
          contributor_user_id?: string
          country_code?: string | null
          created_at?: string
          curvature_index?: number | null
          description?: string | null
          distance_m?: number
          editorial_description?: string | null
          elevation_gain_m?: number | null
          end_point?: unknown
          featured_tag?: string | null
          geography?: unknown
          id?: string
          is_motovault_pick?: boolean
          name?: string | null
          polyline?: string
          rating_avg?: number | null
          rating_count?: number
          region_code?: string | null
          search_tsv?: unknown
          slug?: string | null
          source_ride_id?: string | null
          start_point?: unknown
          status?: string
          surface_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "routes_contributor_user_id_fkey"
            columns: ["contributor_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routes_contributor_user_id_fkey"
            columns: ["contributor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routes_source_ride_id_fkey"
            columns: ["source_ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      share_links: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          motorcycle_id: string
          revoked_at: string | null
          token: string
          token_hashed_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          motorcycle_id: string
          revoked_at?: string | null
          token: string
          token_hashed_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          motorcycle_id?: string
          revoked_at?: string | null
          token?: string
          token_hashed_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_links_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "motorcycles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_post_queue: {
        Row: {
          angle: string
          attempts: number
          caption: string
          created_at: string
          error: string | null
          facebook_caption: string | null
          headline: string | null
          id: string
          last_attempt_at: string | null
          post_image_url: string | null
          post_prompt: string
          post_results: Json | null
          published_at: string | null
          scheduled_for: string
          screenshot_keys: string[] | null
          slot: string
          source: string | null
          status: string
          story_image_url: string | null
          story_prompt: string
          story_results: Json | null
          updated_at: string
        }
        Insert: {
          angle: string
          attempts?: number
          caption: string
          created_at?: string
          error?: string | null
          facebook_caption?: string | null
          headline?: string | null
          id?: string
          last_attempt_at?: string | null
          post_image_url?: string | null
          post_prompt: string
          post_results?: Json | null
          published_at?: string | null
          scheduled_for: string
          screenshot_keys?: string[] | null
          slot: string
          source?: string | null
          status?: string
          story_image_url?: string | null
          story_prompt: string
          story_results?: Json | null
          updated_at?: string
        }
        Update: {
          angle?: string
          attempts?: number
          caption?: string
          created_at?: string
          error?: string | null
          facebook_caption?: string | null
          headline?: string | null
          id?: string
          last_attempt_at?: string | null
          post_image_url?: string | null
          post_prompt?: string
          post_results?: Json | null
          published_at?: string | null
          scheduled_for?: string
          screenshot_keys?: string[] | null
          slot?: string
          source?: string | null
          status?: string
          story_image_url?: string | null
          story_prompt?: string
          story_results?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      sponsorships: {
        Row: {
          clicks_count: number
          cost_per_impression: number
          created_at: string
          cta_text: string
          cta_url: string
          description: string | null
          ends_at: string | null
          id: string
          image_url: string | null
          impressions_count: number
          monthly_budget: number | null
          placement_type: string
          route_id: string
          spent_this_month: number
          sponsor_id: string
          starts_at: string
          status: Database["public"]["Enums"]["sponsorship_status"]
          title: string
          updated_at: string
        }
        Insert: {
          clicks_count?: number
          cost_per_impression?: number
          created_at?: string
          cta_text?: string
          cta_url: string
          description?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          impressions_count?: number
          monthly_budget?: number | null
          placement_type: string
          route_id: string
          spent_this_month?: number
          sponsor_id: string
          starts_at: string
          status?: Database["public"]["Enums"]["sponsorship_status"]
          title: string
          updated_at?: string
        }
        Update: {
          clicks_count?: number
          cost_per_impression?: number
          created_at?: string
          cta_text?: string
          cta_url?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          impressions_count?: number
          monthly_budget?: number | null
          placement_type?: string
          route_id?: string
          spent_this_month?: number
          sponsor_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["sponsorship_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsorships_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsorships_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsorships_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      surface_reports: {
        Row: {
          condition: Database["public"]["Enums"]["surface_condition"]
          id: string
          note: string | null
          photo_url: string | null
          report_date: string
          reported_at: string
          route_id: string
          user_id: string
        }
        Insert: {
          condition: Database["public"]["Enums"]["surface_condition"]
          id?: string
          note?: string | null
          photo_url?: string | null
          report_date?: string
          reported_at?: string
          route_id: string
          user_id: string
        }
        Update: {
          condition?: Database["public"]["Enums"]["surface_condition"]
          id?: string
          note?: string | null
          photo_url?: string | null
          report_date?: string
          reported_at?: string
          route_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "surface_reports_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surface_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surface_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          declined_at: string | null
          id: string
          invited_by_user_id: string
          invited_user_id: string
          trip_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          declined_at?: string | null
          id?: string
          invited_by_user_id: string
          invited_user_id: string
          trip_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          declined_at?: string | null
          id?: string
          invited_by_user_id?: string
          invited_user_id?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_invites_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_participants: {
        Row: {
          bike_id: string | null
          joined_at: string
          role: string
          status: string
          trip_id: string
          user_id: string
        }
        Insert: {
          bike_id?: string | null
          joined_at?: string
          role?: string
          status?: string
          trip_id: string
          user_id: string
        }
        Update: {
          bike_id?: string | null
          joined_at?: string
          role?: string
          status?: string
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_participants_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "motorcycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_participants_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_reviews: {
        Row: {
          bike_id: string | null
          condition_tags: Json | null
          created_at: string
          id: string
          rating: number
          text: string | null
          trip_id: string
          user_id: string | null
        }
        Insert: {
          bike_id?: string | null
          condition_tags?: Json | null
          created_at?: string
          id?: string
          rating: number
          text?: string | null
          trip_id: string
          user_id?: string | null
        }
        Update: {
          bike_id?: string | null
          condition_tags?: Json | null
          created_at?: string
          id?: string
          rating?: number
          text?: string | null
          trip_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_reviews_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "motorcycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_reviews_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_saves: {
        Row: {
          id: string
          saved_at: string
          trip_id: string
          user_id: string
        }
        Insert: {
          id?: string
          saved_at?: string
          trip_id: string
          user_id: string
        }
        Update: {
          id?: string
          saved_at?: string
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_saves_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_saves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_saves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_share_tokens: {
        Row: {
          created_at: string
          id: string
          rotated_at: string
          token_hash: string
          trip_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          rotated_at?: string
          token_hash: string
          trip_id: string
        }
        Update: {
          created_at?: string
          id?: string
          rotated_at?: string
          token_hash?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_share_tokens_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: true
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_suggestions: {
        Row: {
          author_user_id: string
          country_code: string | null
          created_at: string
          day_index: number | null
          decided_at: string | null
          decided_by: string | null
          decided_note: string | null
          id: string
          kind: string
          lat: number | null
          lng: number | null
          name: string
          notes: string | null
          period_of_day: string | null
          source_url: string | null
          status: string
          trip_id: string | null
          updated_at: string
          waypoint_id: string | null
        }
        Insert: {
          author_user_id: string
          country_code?: string | null
          created_at?: string
          day_index?: number | null
          decided_at?: string | null
          decided_by?: string | null
          decided_note?: string | null
          id?: string
          kind?: string
          lat?: number | null
          lng?: number | null
          name: string
          notes?: string | null
          period_of_day?: string | null
          source_url?: string | null
          status?: string
          trip_id?: string | null
          updated_at?: string
          waypoint_id?: string | null
        }
        Update: {
          author_user_id?: string
          country_code?: string | null
          created_at?: string
          day_index?: number | null
          decided_at?: string | null
          decided_by?: string | null
          decided_note?: string | null
          id?: string
          kind?: string
          lat?: number | null
          lng?: number | null
          name?: string
          notes?: string | null
          period_of_day?: string | null
          source_url?: string | null
          status?: string
          trip_id?: string | null
          updated_at?: string
          waypoint_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_suggestions_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_suggestions_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_suggestions_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_suggestions_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_suggestions_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_suggestions_waypoint_id_fkey"
            columns: ["waypoint_id"]
            isOneToOne: false
            referencedRelation: "trip_waypoints"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_waypoints: {
        Row: {
          created_at: string
          day_index: number
          id: string
          lat: number
          lng: number
          name: string
          notes: string | null
          period_of_day: string | null
          sort_order: number
          trip_id: string
          type: string
        }
        Insert: {
          created_at?: string
          day_index?: number
          id?: string
          lat: number
          lng: number
          name: string
          notes?: string | null
          period_of_day?: string | null
          sort_order: number
          trip_id: string
          type: string
        }
        Update: {
          created_at?: string
          day_index?: number
          id?: string
          lat?: number
          lng?: number
          name?: string
          notes?: string | null
          period_of_day?: string | null
          sort_order?: number
          trip_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_waypoints_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          average_rating: number | null
          best_season_months: number[] | null
          city: string | null
          clone_count: number
          cloned_from_discover_trip_id: string | null
          cloned_from_trip_id: string | null
          country_code: string | null
          cover_image_url: string | null
          created_at: string
          curvature_index: number | null
          dates_pending: boolean
          day_count: number | null
          description: string
          difficulty: string
          distance_m: number | null
          elevation_gain_m: number | null
          elevation_profile: Json | null
          end_date: string
          estimated_duration_minutes: number | null
          forked_from_trip_id: string | null
          id: string
          is_featured: boolean
          is_flagged: boolean
          is_motovault_pick: boolean
          is_template: boolean
          max_riders: number
          migrated_from_discover_trip_id: string | null
          organiser_user_id: string
          participant_count: number
          polyline: string | null
          published_at: string | null
          region_code: string | null
          review_count: number
          search_tsv: unknown
          slug: string | null
          start_date: string
          start_lat: number | null
          start_lng: number | null
          start_point: unknown
          status: string
          surface_type: string | null
          title: string
          updated_at: string
          view_count: number
          visibility: Database["public"]["Enums"]["content_visibility"]
        }
        Insert: {
          average_rating?: number | null
          best_season_months?: number[] | null
          city?: string | null
          clone_count?: number
          cloned_from_discover_trip_id?: string | null
          cloned_from_trip_id?: string | null
          country_code?: string | null
          cover_image_url?: string | null
          created_at?: string
          curvature_index?: number | null
          dates_pending?: boolean
          day_count?: number | null
          description: string
          difficulty: string
          distance_m?: number | null
          elevation_gain_m?: number | null
          elevation_profile?: Json | null
          end_date: string
          estimated_duration_minutes?: number | null
          forked_from_trip_id?: string | null
          id?: string
          is_featured?: boolean
          is_flagged?: boolean
          is_motovault_pick?: boolean
          is_template?: boolean
          max_riders?: number
          migrated_from_discover_trip_id?: string | null
          organiser_user_id: string
          participant_count?: number
          polyline?: string | null
          published_at?: string | null
          region_code?: string | null
          review_count?: number
          search_tsv?: unknown
          slug?: string | null
          start_date: string
          start_lat?: number | null
          start_lng?: number | null
          start_point?: unknown
          status?: string
          surface_type?: string | null
          title: string
          updated_at?: string
          view_count?: number
          visibility?: Database["public"]["Enums"]["content_visibility"]
        }
        Update: {
          average_rating?: number | null
          best_season_months?: number[] | null
          city?: string | null
          clone_count?: number
          cloned_from_discover_trip_id?: string | null
          cloned_from_trip_id?: string | null
          country_code?: string | null
          cover_image_url?: string | null
          created_at?: string
          curvature_index?: number | null
          dates_pending?: boolean
          day_count?: number | null
          description?: string
          difficulty?: string
          distance_m?: number | null
          elevation_gain_m?: number | null
          elevation_profile?: Json | null
          end_date?: string
          estimated_duration_minutes?: number | null
          forked_from_trip_id?: string | null
          id?: string
          is_featured?: boolean
          is_flagged?: boolean
          is_motovault_pick?: boolean
          is_template?: boolean
          max_riders?: number
          migrated_from_discover_trip_id?: string | null
          organiser_user_id?: string
          participant_count?: number
          polyline?: string | null
          published_at?: string | null
          region_code?: string | null
          review_count?: number
          search_tsv?: unknown
          slug?: string | null
          start_date?: string
          start_lat?: number | null
          start_lng?: number | null
          start_point?: unknown
          status?: string
          surface_type?: string | null
          title?: string
          updated_at?: string
          view_count?: number
          visibility?: Database["public"]["Enums"]["content_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "trips_cloned_from_discover_trip_id_fkey"
            columns: ["cloned_from_discover_trip_id"]
            isOneToOne: false
            referencedRelation: "discover_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_cloned_from_trip_id_fkey"
            columns: ["cloned_from_trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_forked_from_trip_id_fkey"
            columns: ["forked_from_trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_organiser_user_id_fkey"
            columns: ["organiser_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_organiser_user_id_fkey"
            columns: ["organiser_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_gating_events: {
        Row: {
          created_at: string
          feature: string
          id: string
          route_id: string | null
          trip_id: string | null
          user_id: string
          year_month: string | null
        }
        Insert: {
          created_at?: string
          feature: string
          id?: string
          route_id?: string | null
          trip_id?: string | null
          user_id: string
          year_month?: string | null
        }
        Update: {
          created_at?: string
          feature?: string
          id?: string
          route_id?: string | null
          trip_id?: string | null
          user_id?: string
          year_month?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_gating_events_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_gating_events_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_gating_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_gating_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          bio: string | null
          city: string | null
          created_at: string
          currency: string
          deleted_at: string | null
          deletion_scheduled_at: string | null
          display_name: string | null
          email: string
          follower_count: number
          following_count: number
          full_name: string | null
          handle: string | null
          id: string
          is_public: boolean
          measurement_system: string
          onboarding_completed_at: string | null
          preferences: Json | null
          public_username: string | null
          revenuecat_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          show_saved_publicly: boolean
          subscription_expires_at: string | null
          subscription_status: string
          subscription_tier: string
          trial_started_at: string | null
          updated_at: string
          years_riding: number | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          deletion_scheduled_at?: string | null
          display_name?: string | null
          email: string
          follower_count?: number
          following_count?: number
          full_name?: string | null
          handle?: string | null
          id: string
          is_public?: boolean
          measurement_system?: string
          onboarding_completed_at?: string | null
          preferences?: Json | null
          public_username?: string | null
          revenuecat_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          show_saved_publicly?: boolean
          subscription_expires_at?: string | null
          subscription_status?: string
          subscription_tier?: string
          trial_started_at?: string | null
          updated_at?: string
          years_riding?: number | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          deletion_scheduled_at?: string | null
          display_name?: string | null
          email?: string
          follower_count?: number
          following_count?: number
          full_name?: string | null
          handle?: string | null
          id?: string
          is_public?: boolean
          measurement_system?: string
          onboarding_completed_at?: string | null
          preferences?: Json | null
          public_username?: string | null
          revenuecat_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          show_saved_publicly?: boolean
          subscription_expires_at?: string | null
          subscription_status?: string
          subscription_tier?: string
          trial_started_at?: string | null
          updated_at?: string
          years_riding?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      public_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          display_name: string | null
          handle: string | null
          id: string | null
          is_public: boolean | null
          public_username: string | null
          show_saved_publicly: boolean | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          display_name?: string | null
          handle?: string | null
          id?: string | null
          is_public?: boolean | null
          public_username?: string | null
          show_saved_publicly?: boolean | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          display_name?: string | null
          handle?: string | null
          id?: string | null
          is_public?: boolean | null
          public_username?: string | null
          show_saved_publicly?: boolean | null
        }
        Relationships: []
      }
      route_twist_buckets: {
        Row: {
          country_code: string | null
          p0: number | null
          p10: number | null
          p100: number | null
          p20: number | null
          p30: number | null
          p40: number | null
          p50: number | null
          p60: number | null
          p70: number | null
          p80: number | null
          p90: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _upsert_rollup: {
        Args: {
          p_metrics: Json
          p_motorcycle_id: string
          p_period_kind: Database["public"]["Enums"]["ride_rollup_period"]
          p_period_start: string
          p_user_id: string
        }
        Returns: undefined
      }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      all_bikes_sentinel: { Args: never; Returns: string }
      auth_uid_check: { Args: never; Returns: string }
      blog_locale_config: { Args: { loc: string }; Returns: unknown }
      cancel_account_deletion: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      claim_next_social_post: {
        Args: { p_slot: string }
        Returns: {
          angle: string
          attempts: number
          caption: string
          created_at: string
          error: string | null
          facebook_caption: string | null
          headline: string | null
          id: string
          last_attempt_at: string | null
          post_image_url: string | null
          post_prompt: string
          post_results: Json | null
          published_at: string | null
          scheduled_for: string
          screenshot_keys: string[] | null
          slot: string
          source: string | null
          status: string
          story_image_url: string | null
          story_prompt: string
          story_results: Json | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "social_post_queue"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      clone_discover_trip: {
        Args: { p_discover_trip_id: string; p_user_id: string }
        Returns: string
      }
      clone_trip_template: {
        Args: { p_trip_id: string; p_user_id: string }
        Returns: string
      }
      complete_onboarding: {
        Args: {
          p_annual_repair_spend?: string
          p_bike_make?: string
          p_bike_mileage?: number
          p_bike_model?: string
          p_bike_nickname?: string
          p_bike_photo_url?: string
          p_bike_type?: Database["public"]["Enums"]["motorcycle_type"]
          p_bike_year?: number
          p_currency?: string
          p_last_service_date?: string
          p_maintenance_reminders?: boolean
          p_mileage_unit?: string
          p_preferences: Json
          p_recall_alerts?: boolean
          p_reminder_channel?: string
          p_seasonal_tips?: boolean
          p_user_id: string
          p_weekly_summary?: boolean
        }
        Returns: Json
      }
      cron_trigger_maintenance_due_push: { Args: never; Returns: undefined }
      disablelongtransactions: { Args: never; Returns: string }
      document_vault_bytes_used: { Args: never; Returns: number }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      earth: { Args: never; Returns: number }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      expense_dashboard_aggregates: {
        Args: { p_motorcycle_id: string }
        Returns: Json
      }
      find_nearest_place: {
        Args: { p_kind?: string; p_lat: number; p_lng: number }
        Returns: {
          country_code: string
          name: string
          place_id: number
          region_code: string
        }[]
      }
      flag_comment: { Args: { comment_uuid: string }; Returns: number }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_daily_ai_spend: { Args: { p_since: string }; Returns: number }
      get_make_stats: {
        Args: never
        Returns: {
          distinct_models: number
          make: string
          riders: number
          total_bikes: number
        }[]
      }
      get_routes_needing_slug: {
        Args: { batch_offset?: number; batch_size?: number }
        Returns: {
          id: string
          lat: number
          lng: number
          name: string
        }[]
      }
      gettransactionid: { Args: never; Returns: unknown }
      hard_delete_expired_accounts: { Args: never; Returns: number }
      increment_article_view_count: {
        Args: { p_article_id: string }
        Returns: undefined
      }
      increment_discover_trip_view: {
        Args: { p_id: string }
        Returns: undefined
      }
      increment_trip_clone: { Args: { p_trip_id: string }; Returns: undefined }
      increment_trip_view: { Args: { p_id: string }; Returns: undefined }
      is_admin: { Args: never; Returns: boolean }
      join_group_ride: {
        Args: { p_group_ride_id: string; p_user_id: string }
        Returns: undefined
      }
      join_trip: {
        Args: {
          p_bike_id?: string
          p_status?: string
          p_trip_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      longtransactionsenabled: { Args: never; Returns: boolean }
      mark_article_read: {
        Args: { p_article_id: string; p_user_id: string }
        Returns: {
          article_id: string
          article_read: boolean
          first_read_at: string | null
          id: string
          last_read_at: string | null
          quiz_best_score: number | null
          quiz_completed: boolean
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "learning_progress"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      process_revenuecat_event: {
        Args: {
          p_app_user_id: string
          p_event_id: string
          p_event_type: string
          p_expiration_at?: string
          p_period_type?: string
        }
        Returns: undefined
      }
      publish_due_blog_posts: { Args: never; Returns: undefined }
      purge_soft_deleted_rides: { Args: never; Returns: undefined }
      reconcile_orphaned_document_objects: { Args: never; Returns: number }
      reconcile_orphaned_receipt_objects: { Args: never; Returns: number }
      record_ride_analytics: {
        Args: {
          p_motorcycle_id: string
          p_ride_id: string
          p_ride_metrics: Json
          p_started_at: string
          p_user_id: string
        }
        Returns: undefined
      }
      refresh_blog_post_keyword_text: {
        Args: { p_post_id: string }
        Returns: undefined
      }
      reorder_trip_waypoints: {
        Args: { p_trip_id: string; p_waypoint_ids: string[] }
        Returns: undefined
      }
      replace_trip_waypoints: {
        Args: { p_trip_id: string; p_waypoints: Json }
        Returns: undefined
      }
      reserve_ai_generation: {
        Args: {
          p_content_type: string
          p_daily_limit: number
          p_user_id: string
        }
        Returns: string
      }
      reserve_receipt_scan: {
        Args: {
          p_is_onboarding?: boolean
          p_monthly_limit?: number
          p_user_id: string
        }
        Returns: {
          over_quota: boolean
          reservation_id: string
        }[]
      }
      resolve_trip_by_token: { Args: { p_token: string }; Returns: Json }
      rotate_trip_share_token: { Args: { p_trip_id: string }; Returns: string }
      search_blog_posts: {
        Args: { loc?: string; query: string }
        Returns: {
          post_id: string
          rank: number
          slug: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      soft_delete_maintenance_task: {
        Args: { task_id: string }
        Returns: boolean
      }
      soft_delete_motorcycle: {
        Args: { motorcycle_id: string }
        Returns: boolean
      }
      soft_delete_user: { Args: { p_user_id: string }; Returns: undefined }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      track_sponsorship_click: { Args: { p_id: string }; Returns: boolean }
      track_sponsorship_impression: { Args: { p_id: string }; Returns: boolean }
      trip_is_public: { Args: { p_trip_id: string }; Returns: boolean }
      typeahead_search: {
        Args: { result_limit?: number; search_term: string }
        Returns: {
          country_code: string
          id: string
          kind: string
          name: string
          population: number
          region_code: string
          sim: number
          slug: string
          source: string
        }[]
      }
      unlockrows: { Args: { "": string }; Returns: number }
      update_route_geography: {
        Args: {
          end_wkt: string
          linestring_wkt: string
          route_uuid: string
          start_wkt: string
        }
        Returns: undefined
      }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
      user_is_trip_organiser: {
        Args: { p_trip_id: string; p_user_id: string }
        Returns: boolean
      }
      user_is_trip_participant: {
        Args: { p_trip_id: string; p_user_id: string }
        Returns: boolean
      }
      utc_date: { Args: { ts: string }; Returns: string }
      year_month_immutable: { Args: { ts: string }; Returns: string }
    }
    Enums: {
      article_category:
        | "engine"
        | "brakes"
        | "electrical"
        | "suspension"
        | "drivetrain"
        | "tires"
        | "fuel"
        | "general"
      article_difficulty: "beginner" | "intermediate" | "advanced"
      content_visibility: "private" | "unlisted" | "public"
      diagnostic_severity: "low" | "medium" | "high" | "critical"
      flag_status: "pending" | "reviewed" | "resolved" | "dismissed"
      motorcycle_type:
        | "cruiser"
        | "sportbike"
        | "standard"
        | "touring"
        | "dual_sport"
        | "dirt_bike"
        | "scooter"
        | "other"
      ride_record_type:
        | "longest_distance"
        | "longest_duration"
        | "top_speed"
        | "max_lean"
        | "max_elevation_gain"
        | "most_distance_week"
        | "most_distance_month"
        | "most_rides_week"
        | "most_rides_month"
        | "longest_streak"
      ride_rollup_period: "day" | "week" | "month"
      sponsorship_status: "active" | "paused" | "deactivated" | "expired"
      surface_condition:
        | "smooth"
        | "rough"
        | "gravel"
        | "potholes"
        | "wet"
        | "icy"
        | "debris"
        | "construction"
      user_role: "user" | "admin"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
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
      article_category: [
        "engine",
        "brakes",
        "electrical",
        "suspension",
        "drivetrain",
        "tires",
        "fuel",
        "general",
      ],
      article_difficulty: ["beginner", "intermediate", "advanced"],
      content_visibility: ["private", "unlisted", "public"],
      diagnostic_severity: ["low", "medium", "high", "critical"],
      flag_status: ["pending", "reviewed", "resolved", "dismissed"],
      motorcycle_type: [
        "cruiser",
        "sportbike",
        "standard",
        "touring",
        "dual_sport",
        "dirt_bike",
        "scooter",
        "other",
      ],
      ride_record_type: [
        "longest_distance",
        "longest_duration",
        "top_speed",
        "max_lean",
        "max_elevation_gain",
        "most_distance_week",
        "most_distance_month",
        "most_rides_week",
        "most_rides_month",
        "longest_streak",
      ],
      ride_rollup_period: ["day", "week", "month"],
      sponsorship_status: ["active", "paused", "deactivated", "expired"],
      surface_condition: [
        "smooth",
        "rough",
        "gravel",
        "potholes",
        "wet",
        "icy",
        "debris",
        "construction",
      ],
      user_role: ["user", "admin"],
    },
  },
} as const
