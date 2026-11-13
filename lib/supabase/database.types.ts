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
      areas: {
        Row: {
          ai_enabled: boolean
          collapsed: boolean
          color: string
          created_at: string
          icon: string | null
          id: string
          name: string
          show_lgpd_notice: boolean
          slug: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_enabled?: boolean
          collapsed?: boolean
          color: string
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          show_lgpd_notice?: boolean
          slug: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          ai_enabled?: boolean
          collapsed?: boolean
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          show_lgpd_notice?: boolean
          slug?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      attachments: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          file_name: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          file_name: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          user_id?: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      calendars: {
        Row: {
          access_role: string | null
          color: string | null
          connection_id: string
          created_at: string
          default_area_id: string | null
          google_calendar_id: string
          id: string
          is_primary: boolean
          last_error: string | null
          last_synced_at: string | null
          name: string
          sync_enabled: boolean
          sync_token: string | null
          time_zone: string | null
          updated_at: string
          user_id: string
          watch_channel_id: string | null
          watch_expires_at: string | null
          watch_resource_id: string | null
        }
        Insert: {
          access_role?: string | null
          color?: string | null
          connection_id: string
          created_at?: string
          default_area_id?: string | null
          google_calendar_id: string
          id?: string
          is_primary?: boolean
          last_error?: string | null
          last_synced_at?: string | null
          name: string
          sync_enabled?: boolean
          sync_token?: string | null
          time_zone?: string | null
          updated_at?: string
          user_id?: string
          watch_channel_id?: string | null
          watch_expires_at?: string | null
          watch_resource_id?: string | null
        }
        Update: {
          access_role?: string | null
          color?: string | null
          connection_id?: string
          created_at?: string
          default_area_id?: string | null
          google_calendar_id?: string
          id?: string
          is_primary?: boolean
          last_error?: string | null
          last_synced_at?: string | null
          name?: string
          sync_enabled?: boolean
          sync_token?: string | null
          time_zone?: string | null
          updated_at?: string
          user_id?: string
          watch_channel_id?: string | null
          watch_expires_at?: string | null
          watch_resource_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendars_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "google_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendars_default_area_id_fkey"
            columns: ["default_area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_angles: {
        Row: {
          asset_url: string | null
          body_copy: string | null
          call_to_action: string | null
          campaign_id: string
          created_at: string
          creative_format: string
          deleted_at: string | null
          headline: string | null
          hook_angle: string
          id: string
          meta_ad_id: string | null
          metrics_cached: Json
          status: string
          target_avatar: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_url?: string | null
          body_copy?: string | null
          call_to_action?: string | null
          campaign_id: string
          created_at?: string
          creative_format?: string
          deleted_at?: string | null
          headline?: string | null
          hook_angle?: string
          id?: string
          meta_ad_id?: string | null
          metrics_cached?: Json
          status?: string
          target_avatar?: string | null
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          asset_url?: string | null
          body_copy?: string | null
          call_to_action?: string | null
          campaign_id?: string
          created_at?: string
          creative_format?: string
          deleted_at?: string | null
          headline?: string | null
          hook_angle?: string
          id?: string
          meta_ad_id?: string | null
          metrics_cached?: Json
          status?: string
          target_avatar?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_angles_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      content_chunks: {
        Row: {
          area_id: string | null
          chunk_index: number
          content: string
          content_hash: string
          created_at: string
          embedding: string | null
          entity_id: string
          entity_type: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          area_id?: string | null
          chunk_index?: number
          content: string
          content_hash: string
          created_at?: string
          embedding?: string | null
          entity_id: string
          entity_type: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          area_id?: string | null
          chunk_index?: number
          content?: string
          content_hash?: string
          created_at?: string
          embedding?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_chunks_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      content_ideas: {
        Row: {
          campaign_angle_id: string | null
          created_at: string
          deleted_at: string | null
          folder_id: string | null
          format: string | null
          id: string
          marketing_agent_ref: string | null
          notes: string | null
          pillar_id: string | null
          references: Json
          script_data: Json
          search: unknown
          status: string
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          campaign_angle_id?: string | null
          created_at?: string
          deleted_at?: string | null
          folder_id?: string | null
          format?: string | null
          id?: string
          marketing_agent_ref?: string | null
          notes?: string | null
          pillar_id?: string | null
          references?: Json
          script_data?: Json
          search?: unknown
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          campaign_angle_id?: string | null
          created_at?: string
          deleted_at?: string | null
          folder_id?: string | null
          format?: string | null
          id?: string
          marketing_agent_ref?: string | null
          notes?: string | null
          pillar_id?: string | null
          references?: Json
          script_data?: Json
          search?: unknown
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_ideas_campaign_angle_id_fkey"
            columns: ["campaign_angle_id"]
            isOneToOne: false
            referencedRelation: "campaign_angles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_ideas_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_ideas_pillar_id_fkey"
            columns: ["pillar_id"]
            isOneToOne: false
            referencedRelation: "content_pillars"
            referencedColumns: ["id"]
          },
        ]
      }
      content_pillars: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          all_day: boolean
          area_id: string | null
          calendar_id: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          end_at: string
          etag: string | null
          google_event_id: string | null
          google_updated_at: string | null
          html_link: string | null
          id: string
          kind: string
          local_updated_at: string
          location: string | null
          original_start_at: string | null
          recurrence: string[] | null
          recurring_event_id: string | null
          search: unknown
          start_at: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          all_day?: boolean
          area_id?: string | null
          calendar_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          end_at: string
          etag?: string | null
          google_event_id?: string | null
          google_updated_at?: string | null
          html_link?: string | null
          id?: string
          kind?: string
          local_updated_at?: string
          location?: string | null
          original_start_at?: string | null
          recurrence?: string[] | null
          recurring_event_id?: string | null
          search?: unknown
          start_at: string
          status?: string
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          all_day?: boolean
          area_id?: string | null
          calendar_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          end_at?: string
          etag?: string | null
          google_event_id?: string | null
          google_updated_at?: string | null
          html_link?: string | null
          id?: string
          kind?: string
          local_updated_at?: string
          location?: string | null
          original_start_at?: string | null
          recurrence?: string[] | null
          recurring_event_id?: string | null
          search?: unknown
          start_at?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_accounts: {
        Row: {
          active: boolean
          created_at: string
          credit_limit_cents: number | null
          deleted_at: string | null
          due_day: number | null
          id: string
          name: string
          opening_balance_cents: number
          owner_label: string | null
          sort_order: number
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          credit_limit_cents?: number | null
          deleted_at?: string | null
          due_day?: number | null
          id?: string
          name: string
          opening_balance_cents?: number
          owner_label?: string | null
          sort_order?: number
          type: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          credit_limit_cents?: number | null
          deleted_at?: string | null
          due_day?: number | null
          id?: string
          name?: string
          opening_balance_cents?: number
          owner_label?: string | null
          sort_order?: number
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      finance_budgets: {
        Row: {
          amount_cents: number
          category_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          category_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          amount_cents?: number
          category_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "finance_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_categories: {
        Row: {
          color: string | null
          created_at: string
          deleted_at: string | null
          id: string
          kind: string
          ledger: string
          name: string
          parent_id: string | null
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          kind: string
          ledger: string
          name: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          kind?: string
          ledger?: string
          name?: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "finance_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_recurring_bills: {
        Row: {
          account_id: string | null
          active: boolean
          amount_cents: number
          amount_changes: Json
          amount_mode: string
          category_id: string | null
          created_at: string
          deleted_at: string | null
          description: string
          due_day: number | null
          end_month: string | null
          id: string
          kind: string
          member_label: string | null
          percent_bp: number | null
          skipped_months: string[]
          sort_order: number
          start_month: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          active?: boolean
          amount_cents?: number
          amount_changes?: Json
          amount_mode?: string
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description: string
          due_day?: number | null
          end_month?: string | null
          id?: string
          kind?: string
          member_label?: string | null
          percent_bp?: number | null
          skipped_months?: string[]
          sort_order?: number
          start_month?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          account_id?: string | null
          active?: boolean
          amount_cents?: number
          amount_changes?: Json
          amount_mode?: string
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string
          due_day?: number | null
          end_month?: string | null
          id?: string
          kind?: string
          member_label?: string | null
          percent_bp?: number | null
          skipped_months?: string[]
          sort_order?: number
          start_month?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_recurring_bills_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_recurring_bills_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "finance_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_rules: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          kind: string
          ledger: string
          pattern: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          kind: string
          ledger: string
          pattern: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          ledger?: string
          pattern?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "finance_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          area_id: string
          collapsed: boolean
          config: Json
          created_at: string
          deleted_at: string | null
          icon: string | null
          id: string
          module: string
          name: string
          parent_id: string | null
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          area_id: string
          collapsed?: boolean
          config?: Json
          created_at?: string
          deleted_at?: string | null
          icon?: string | null
          id?: string
          module: string
          name: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          area_id?: string
          collapsed?: boolean
          config?: Json
          created_at?: string
          deleted_at?: string | null
          icon?: string | null
          id?: string
          module?: string
          name?: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "folders_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      google_connections: {
        Row: {
          access_token_enc: string | null
          created_at: string
          expires_at: string | null
          google_email: string
          id: string
          refresh_token_enc: string
          scopes: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_enc?: string | null
          created_at?: string
          expires_at?: string | null
          google_email: string
          id?: string
          refresh_token_enc: string
          scopes?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_enc?: string | null
          created_at?: string
          expires_at?: string | null
          google_email?: string
          id?: string
          refresh_token_enc?: string
          scopes?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      habit_logs: {
        Row: {
          created_at: string
          date: string
          done: boolean
          habit_id: string
          id: string
          note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          done?: boolean
          habit_id: string
          id?: string
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          date?: string
          done?: boolean
          habit_id?: string
          id?: string
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          active: boolean
          area_id: string
          color: string | null
          created_at: string
          deleted_at: string | null
          folder_id: string | null
          frequency: string
          id: string
          name: string
          preferred_time: string | null
          sort_order: number
          times_per_week: number | null
          updated_at: string
          user_id: string
          weekdays: number[]
        }
        Insert: {
          active?: boolean
          area_id: string
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          folder_id?: string | null
          frequency?: string
          id?: string
          name: string
          preferred_time?: string | null
          sort_order?: number
          times_per_week?: number | null
          updated_at?: string
          user_id?: string
          weekdays?: number[]
        }
        Update: {
          active?: boolean
          area_id?: string
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          folder_id?: string | null
          frequency?: string
          id?: string
          name?: string
          preferred_time?: string | null
          sort_order?: number
          times_per_week?: number | null
          updated_at?: string
          user_id?: string
          weekdays?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "habits_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "habits_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      ideas: {
        Row: {
          area_id: string
          created_at: string
          deleted_at: string | null
          folder_id: string | null
          id: string
          links: Json
          notes: string | null
          search: unknown
          status: string
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          area_id: string
          created_at?: string
          deleted_at?: string | null
          folder_id?: string | null
          id?: string
          links?: Json
          notes?: string | null
          search?: unknown
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          area_id?: string
          created_at?: string
          deleted_at?: string | null
          folder_id?: string | null
          id?: string
          links?: Json
          notes?: string | null
          search?: unknown
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ideas_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ideas_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_items: {
        Row: {
          ai_suggestion: Json | null
          content: string
          converted_to_id: string | null
          converted_to_type: string | null
          created_at: string
          deleted_at: string | null
          id: string
          source: string
          status: string
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          ai_suggestion?: Json | null
          content: string
          converted_to_id?: string | null
          converted_to_type?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          source?: string
          status?: string
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Update: {
          ai_suggestion?: Json | null
          content?: string
          converted_to_id?: string | null
          converted_to_type?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          source?: string
          status?: string
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      learning_items: {
        Row: {
          area_id: string
          created_at: string
          deleted_at: string | null
          folder_id: string | null
          id: string
          note_id: string | null
          progress: number
          reason: string | null
          resources: Json
          search: unknown
          status: string
          target_date: string | null
          topic: string
          updated_at: string
          user_id: string
        }
        Insert: {
          area_id: string
          created_at?: string
          deleted_at?: string | null
          folder_id?: string | null
          id?: string
          note_id?: string | null
          progress?: number
          reason?: string | null
          resources?: Json
          search?: unknown
          status?: string
          target_date?: string | null
          topic: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          area_id?: string
          created_at?: string
          deleted_at?: string | null
          folder_id?: string | null
          id?: string
          note_id?: string | null
          progress?: number
          reason?: string | null
          resources?: Json
          search?: unknown
          status?: string
          target_date?: string | null
          topic?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_items_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_items_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_items_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_campaigns: {
        Row: {
          budget_daily_cents: number
          budget_total_cents: number
          created_at: string
          deleted_at: string | null
          end_date: string | null
          folder_id: string | null
          id: string
          meta_campaign_id: string | null
          name: string
          notes: string | null
          objective: string
          start_date: string
          status: string
          target_audience: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          budget_daily_cents?: number
          budget_total_cents?: number
          created_at?: string
          deleted_at?: string | null
          end_date?: string | null
          folder_id?: string | null
          id?: string
          meta_campaign_id?: string | null
          name: string
          notes?: string | null
          objective?: string
          start_date: string
          status?: string
          target_audience?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          budget_daily_cents?: number
          budget_total_cents?: number
          created_at?: string
          deleted_at?: string | null
          end_date?: string | null
          folder_id?: string | null
          id?: string
          meta_campaign_id?: string | null
          name?: string
          notes?: string | null
          objective?: string
          start_date?: string
          status?: string
          target_audience?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_campaigns_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_ads_metrics: {
        Row: {
          campaign_id: string | null
          clicks: number
          conversions: number
          cost_per_conversion_cents: number
          cpc_cents: number
          created_at: string
          ctr: number
          date_reported: string
          id: string
          impressions: number
          meta_ad_id: string | null
          meta_campaign_id: string
          raw_data: Json
          spend_cents: number
          user_id: string
        }
        Insert: {
          campaign_id?: string | null
          clicks?: number
          conversions?: number
          cost_per_conversion_cents?: number
          cpc_cents?: number
          created_at?: string
          ctr?: number
          date_reported: string
          id?: string
          impressions?: number
          meta_ad_id?: string | null
          meta_campaign_id: string
          raw_data?: Json
          spend_cents?: number
          user_id?: string
        }
        Update: {
          campaign_id?: string | null
          clicks?: number
          conversions?: number
          cost_per_conversion_cents?: number
          cpc_cents?: number
          created_at?: string
          ctr?: number
          date_reported?: string
          id?: string
          impressions?: number
          meta_ad_id?: string | null
          meta_campaign_id?: string
          raw_data?: Json
          spend_cents?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_ads_metrics_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      note_links: {
        Row: {
          created_at: string
          from_note_id: string
          id: string
          to_note_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          from_note_id: string
          id?: string
          to_note_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          from_note_id?: string
          id?: string
          to_note_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_links_from_note_id_fkey"
            columns: ["from_note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_links_to_note_id_fkey"
            columns: ["to_note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      notebooks: {
        Row: {
          asking_price_cents: number | null
          brand: string | null
          buyer_contact: string | null
          buyer_name: string | null
          created_at: string
          deleted_at: string | null
          id: string
          machine_fee_cents: number
          model: string
          notes: string | null
          sold_at: string | null
          specs: string | null
          status: string
          updated_at: string
          user_id: string
          warranty_days: number
        }
        Insert: {
          asking_price_cents?: number | null
          brand?: string | null
          buyer_contact?: string | null
          buyer_name?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          machine_fee_cents?: number
          model: string
          notes?: string | null
          sold_at?: string | null
          specs?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          warranty_days?: number
        }
        Update: {
          asking_price_cents?: number | null
          brand?: string | null
          buyer_contact?: string | null
          buyer_name?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          machine_fee_cents?: number
          model?: string
          notes?: string | null
          sold_at?: string | null
          specs?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          warranty_days?: number
        }
        Relationships: []
      }
      notes: {
        Row: {
          area_id: string
          content_json: Json | null
          content_md: string | null
          content_text: string | null
          created_at: string
          deleted_at: string | null
          folder_id: string | null
          id: string
          pinned: boolean
          search: unknown
          tags: string[]
          template: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          area_id: string
          content_json?: Json | null
          content_md?: string | null
          content_text?: string | null
          created_at?: string
          deleted_at?: string | null
          folder_id?: string | null
          id?: string
          pinned?: boolean
          search?: unknown
          tags?: string[]
          template?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          area_id?: string
          content_json?: Json | null
          content_md?: string | null
          content_text?: string | null
          created_at?: string
          deleted_at?: string | null
          folder_id?: string | null
          id?: string
          pinned?: boolean
          search?: unknown
          tags?: string[]
          template?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          type?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          settings: Json
          theme: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          settings?: Json
          theme?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          settings?: Json
          theme?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      publications: {
        Row: {
          caption: string | null
          channel: string
          content_idea_id: string | null
          created_at: string
          deleted_at: string | null
          id: string
          notes: string | null
          published_url: string | null
          scheduled_for: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          channel: string
          content_idea_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          notes?: string | null
          published_url?: string | null
          scheduled_for?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          caption?: string | null
          channel?: string
          content_idea_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          notes?: string | null
          published_url?: string | null
          scheduled_for?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publications_content_idea_id_fkey"
            columns: ["content_idea_id"]
            isOneToOne: false
            referencedRelation: "content_ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      reply_cases: {
        Row: {
          ai_output: Json | null
          chosen_reply: string | null
          conversation_text: string | null
          created_at: string
          deleted_at: string | null
          detected_flow_id: string | null
          id: string
          label: string | null
          outcome: string
          outcome_notes: string | null
          screenshot_paths: string[]
          service_flow_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_output?: Json | null
          chosen_reply?: string | null
          conversation_text?: string | null
          created_at?: string
          deleted_at?: string | null
          detected_flow_id?: string | null
          id?: string
          label?: string | null
          outcome?: string
          outcome_notes?: string | null
          screenshot_paths?: string[]
          service_flow_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          ai_output?: Json | null
          chosen_reply?: string | null
          conversation_text?: string | null
          created_at?: string
          deleted_at?: string | null
          detected_flow_id?: string | null
          id?: string
          label?: string | null
          outcome?: string
          outcome_notes?: string | null
          screenshot_paths?: string[]
          service_flow_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reply_cases_detected_flow_id_fkey"
            columns: ["detected_flow_id"]
            isOneToOne: false
            referencedRelation: "service_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reply_cases_service_flow_id_fkey"
            columns: ["service_flow_id"]
            isOneToOne: false
            referencedRelation: "service_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      service_flows: {
        Row: {
          active: boolean
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          info_to_collect: Json
          message_templates: Json
          name: string
          next_steps: Json
          objections: Json
          questions: Json
          search: unknown
          slug: string
          steps: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          info_to_collect?: Json
          message_templates?: Json
          name: string
          next_steps?: Json
          objections?: Json
          questions?: Json
          search?: unknown
          slug: string
          steps?: Json
          updated_at?: string
          user_id?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          info_to_collect?: Json
          message_templates?: Json
          name?: string
          next_steps?: Json
          objections?: Json
          questions?: Json
          search?: unknown
          slug?: string
          steps?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shortcuts: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          folder_id: string | null
          icon: string | null
          id: string
          sort_order: number
          title: string
          updated_at: string
          url: string
          user_id: string
          widget: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          folder_id?: string | null
          icon?: string | null
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
          url: string
          user_id?: string
          widget?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          folder_id?: string | null
          icon?: string | null
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
          url?: string
          user_id?: string
          widget?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shortcuts_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_log: {
        Row: {
          action: string
          calendar_id: string | null
          conflict: boolean
          created_at: string
          details: Json
          direction: string
          event_id: string | null
          id: string
          user_id: string
          winner: string | null
        }
        Insert: {
          action: string
          calendar_id?: string | null
          conflict?: boolean
          created_at?: string
          details?: Json
          direction: string
          event_id?: string | null
          id?: string
          user_id?: string
          winner?: string | null
        }
        Update: {
          action?: string
          calendar_id?: string | null
          conflict?: boolean
          created_at?: string
          details?: Json
          direction?: string
          event_id?: string | null
          id?: string
          user_id?: string
          winner?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_log_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_log_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          area_id: string
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          due_date: string | null
          duration_min: number | null
          event_id: string | null
          folder_id: string | null
          id: string
          notes: string | null
          priority: number
          recurrence_parent_id: string | null
          recurrence_rule: string | null
          search: unknown
          sort_order: number
          start_time: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          area_id: string
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          due_date?: string | null
          duration_min?: number | null
          event_id?: string | null
          folder_id?: string | null
          id?: string
          notes?: string | null
          priority?: number
          recurrence_parent_id?: string | null
          recurrence_rule?: string | null
          search?: unknown
          sort_order?: number
          start_time?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          area_id?: string
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          due_date?: string | null
          duration_min?: number | null
          event_id?: string | null
          folder_id?: string | null
          id?: string
          notes?: string | null
          priority?: number
          recurrence_parent_id?: string | null
          recurrence_rule?: string | null
          search?: unknown
          sort_order?: number
          start_time?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_recurrence_parent_id_fkey"
            columns: ["recurrence_parent_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_messages: {
        Row: {
          chat_id: number
          created_at: string
          id: string
          inbox_item_id: string | null
          payload: Json
          telegram_message_id: number
          user_id: string
        }
        Insert: {
          chat_id: number
          created_at?: string
          id?: string
          inbox_item_id?: string | null
          payload: Json
          telegram_message_id: number
          user_id: string
        }
        Update: {
          chat_id?: number
          created_at?: string
          id?: string
          inbox_item_id?: string | null
          payload?: Json
          telegram_message_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_messages_inbox_item_id_fkey"
            columns: ["inbox_item_id"]
            isOneToOne: false
            referencedRelation: "inbox_items"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string | null
          amount_cents: number
          bank_fitid: string | null
          category_id: string | null
          created_at: string
          date: string
          deleted_at: string | null
          description: string
          due_date: string | null
          id: string
          installment_group_id: string | null
          installment_index: number | null
          installment_total: number | null
          kind: string
          ledger: string
          member_label: string | null
          notebook_id: string | null
          notes: string | null
          paid_at: string | null
          payment_method_id: string | null
          recurring_bill_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount_cents: number
          bank_fitid?: string | null
          category_id?: string | null
          created_at?: string
          date: string
          deleted_at?: string | null
          description: string
          due_date?: string | null
          id?: string
          installment_group_id?: string | null
          installment_index?: number | null
          installment_total?: number | null
          kind: string
          ledger: string
          member_label?: string | null
          notebook_id?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_method_id?: string | null
          recurring_bill_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          account_id?: string | null
          amount_cents?: number
          bank_fitid?: string | null
          category_id?: string | null
          created_at?: string
          date?: string
          deleted_at?: string | null
          description?: string
          due_date?: string | null
          id?: string
          installment_group_id?: string | null
          installment_index?: number | null
          installment_total?: number | null
          kind?: string
          ledger?: string
          member_label?: string | null
          notebook_id?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_method_id?: string | null
          recurring_bill_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_recurring_bill_id_fkey"
            columns: ["recurring_bill_id"]
            isOneToOne: false
            referencedRelation: "finance_recurring_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "finance_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebook_profit"
            referencedColumns: ["notebook_id"]
          },
          {
            foreignKeyName: "transactions_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_reviews: {
        Row: {
          checklist: Json
          completed_at: string | null
          created_at: string
          id: string
          notes: string | null
          updated_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          checklist?: Json
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
          week_start: string
        }
        Update: {
          checklist?: Json
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      notebook_profit: {
        Row: {
          brand: string | null
          expense_cents: number | null
          income_cents: number | null
          model: string | null
          notebook_id: string | null
          profit_cents: number | null
          status: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_set_secret: {
        Args: { secret_name: string; secret_value: string }
        Returns: undefined
      }
      immutable_unaccent: { Args: { "": string }; Returns: string }
      search_all: {
        Args: { max_results?: number; q: string }
        Returns: {
          area_id: string
          folder_id: string
          id: string
          kind: string
          snippet: string
          title: string
          updated_at: string
        }[]
      }
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
    Enums: {},
  },
} as const
