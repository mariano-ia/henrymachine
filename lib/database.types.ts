// Tipos generados del schema de Supabase (henry-machine).
// Regenerar con: supabase gen types typescript (o la MCP generate_typescript_types).
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      authors: {
        Row: { created_at: string; display_name: string; id: string; is_admin: boolean; is_henry: boolean }
        Insert: { created_at?: string; display_name?: string; id: string; is_admin?: boolean; is_henry?: boolean }
        Update: { created_at?: string; display_name?: string; id?: string; is_admin?: boolean; is_henry?: boolean }
        Relationships: []
      }
      content_source_items: {
        Row: { created_at: string; id: string; kind: Database["public"]["Enums"]["content_source_kind"]; label: string | null; position: number; source_id: string; uri: string }
        Insert: { created_at?: string; id?: string; kind: Database["public"]["Enums"]["content_source_kind"]; label?: string | null; position?: number; source_id: string; uri: string }
        Update: { created_at?: string; id?: string; kind?: Database["public"]["Enums"]["content_source_kind"]; label?: string | null; position?: number; source_id?: string; uri?: string }
        Relationships: []
      }
      content_sources: {
        Row: { created_at: string; experience_id: string; id: string; ingest_error: string | null; ingest_status: Database["public"]["Enums"]["ingest_status"]; ingested_at: string | null; inline_text: string | null; rag_corpus_ref: string | null; rag_provider: string | null; updated_at: string }
        Insert: { created_at?: string; experience_id: string; id?: string; ingest_error?: string | null; ingest_status?: Database["public"]["Enums"]["ingest_status"]; ingested_at?: string | null; inline_text?: string | null; rag_corpus_ref?: string | null; rag_provider?: string | null; updated_at?: string }
        Update: { created_at?: string; experience_id?: string; id?: string; ingest_error?: string | null; ingest_status?: Database["public"]["Enums"]["ingest_status"]; ingested_at?: string | null; inline_text?: string | null; rag_corpus_ref?: string | null; rag_provider?: string | null; updated_at?: string }
        Relationships: []
      }
      entitlements: {
        Row: { anon_id: string | null; created_at: string; experience_id: string; grant_email: string | null; id: string; purchase_id: string | null; revoked_at: string | null; source: Database["public"]["Enums"]["entitlement_source"]; user_id: string | null }
        Insert: { anon_id?: string | null; created_at?: string; experience_id: string; grant_email?: string | null; id?: string; purchase_id?: string | null; revoked_at?: string | null; source?: Database["public"]["Enums"]["entitlement_source"]; user_id?: string | null }
        Update: { anon_id?: string | null; created_at?: string; experience_id?: string; grant_email?: string | null; id?: string; purchase_id?: string | null; revoked_at?: string | null; source?: Database["public"]["Enums"]["entitlement_source"]; user_id?: string | null }
        Relationships: []
      }
      events: {
        Row: { anon_id: string | null; country: string | null; created_at: string; id: string; name: string; props: Json; slug: string | null }
        Insert: { anon_id?: string | null; country?: string | null; created_at?: string; id?: string; name: string; props?: Json; slug?: string | null }
        Update: { anon_id?: string | null; country?: string | null; created_at?: string; id?: string; name?: string; props?: Json; slug?: string | null }
        Relationships: []
      }
      experiences: {
        Row: { upsell_experience_id: string | null; upsell_message: string | null; upsell_promo_code: string | null; author_id: string; card_image_path: string | null; city: string | null; cover_path: string | null; created_at: string; currency: string; distance_m: number | null; expected_minutes: number | null; generated_from: string | null; henry_tip: string | null; id: string; language: string; neighborhood: string | null; pitch: string | null; price_cents: number; published_at: string | null; resume_window_hours: number; slug: string; status: Database["public"]["Enums"]["experience_status"]; stripe_price_id: string | null; theme: string | null; title: string; updated_at: string; voice_override: Json | null; voice_profile_id: string | null }
        Insert: { upsell_experience_id?: string | null; upsell_message?: string | null; upsell_promo_code?: string | null; author_id: string; card_image_path?: string | null; city?: string | null; cover_path?: string | null; created_at?: string; currency?: string; distance_m?: number | null; expected_minutes?: number | null; generated_from?: string | null; henry_tip?: string | null; id?: string; language?: string; neighborhood?: string | null; pitch?: string | null; price_cents?: number; published_at?: string | null; resume_window_hours?: number; slug: string; status?: Database["public"]["Enums"]["experience_status"]; stripe_price_id?: string | null; theme?: string | null; title: string; updated_at?: string; voice_override?: Json | null; voice_profile_id?: string | null }
        Update: { upsell_experience_id?: string | null; upsell_message?: string | null; upsell_promo_code?: string | null; author_id?: string; card_image_path?: string | null; city?: string | null; cover_path?: string | null; created_at?: string; currency?: string; distance_m?: number | null; expected_minutes?: number | null; generated_from?: string | null; henry_tip?: string | null; id?: string; language?: string; neighborhood?: string | null; pitch?: string | null; price_cents?: number; published_at?: string | null; resume_window_hours?: number; slug?: string; status?: Database["public"]["Enums"]["experience_status"]; stripe_price_id?: string | null; theme?: string | null; title?: string; updated_at?: string; voice_override?: Json | null; voice_profile_id?: string | null }
        Relationships: []
      }
      generation_jobs: {
        Row: { author_id: string; created_at: string; draft: Json | null; error: string | null; experience_id: string | null; finished_at: string | null; id: string; status: Database["public"]["Enums"]["generation_status"]; step_count: number | null; story: string }
        Insert: { author_id: string; created_at?: string; draft?: Json | null; error?: string | null; experience_id?: string | null; finished_at?: string | null; id?: string; status?: Database["public"]["Enums"]["generation_status"]; step_count?: number | null; story: string }
        Update: { author_id?: string; created_at?: string; draft?: Json | null; error?: string | null; experience_id?: string | null; finished_at?: string | null; id?: string; status?: Database["public"]["Enums"]["generation_status"]; step_count?: number | null; story?: string }
        Relationships: []
      }
      leads: {
        Row: { created_at: string; email: string; id: string; marketing_consent: boolean; slug: string | null; source: string | null }
        Insert: { created_at?: string; email: string; id?: string; marketing_consent?: boolean; slug?: string | null; source?: string | null }
        Update: { created_at?: string; email?: string; id?: string; marketing_consent?: boolean; slug?: string | null; source?: string | null }
        Relationships: []
      }
      login_codes: {
        Row: { attempts: number; code_hash: string; created_at: string; email: string; expires_at: string }
        Insert: { attempts?: number; code_hash: string; created_at?: string; email: string; expires_at: string }
        Update: { attempts?: number; code_hash?: string; created_at?: string; email?: string; expires_at?: string }
        Relationships: []
      }
      play_sessions: {
        Row: { country: string | null; anon_id: string | null; created_at: string; current_step_position: number; email: string | null; entitlement_id: string | null; experience_id: string; expires_at: string | null; id: string; last_active_at: string; mode: Database["public"]["Enums"]["interaction_mode"]; paywall_passed: boolean; phase: Database["public"]["Enums"]["tour_phase"]; started_at: string | null; status: Database["public"]["Enums"]["session_status"]; total_turns: number; turns_in_step: number; user_id: string | null; wind_down: boolean }
        Insert: { country?: string | null; anon_id?: string | null; created_at?: string; current_step_position?: number; email?: string | null; entitlement_id?: string | null; experience_id: string; expires_at?: string | null; id?: string; last_active_at?: string; mode?: Database["public"]["Enums"]["interaction_mode"]; paywall_passed?: boolean; phase?: Database["public"]["Enums"]["tour_phase"]; started_at?: string | null; status?: Database["public"]["Enums"]["session_status"]; total_turns?: number; turns_in_step?: number; user_id?: string | null; wind_down?: boolean }
        Update: { country?: string | null; anon_id?: string | null; created_at?: string; current_step_position?: number; email?: string | null; entitlement_id?: string | null; experience_id?: string; expires_at?: string | null; id?: string; last_active_at?: string; mode?: Database["public"]["Enums"]["interaction_mode"]; paywall_passed?: boolean; phase?: Database["public"]["Enums"]["tour_phase"]; started_at?: string | null; status?: Database["public"]["Enums"]["session_status"]; total_turns?: number; turns_in_step?: number; user_id?: string | null; wind_down?: boolean }
        Relationships: []
      }
      purchases: {
        Row: { is_gift: boolean; gift_recipient_email: string | null; gift_message: string | null; marketing_consent: boolean | null; amount_cents: number; anon_id: string | null; created_at: string; currency: string; experience_id: string; id: string; paid_at: string | null; purchaser_email: string | null; refunded_at: string | null; status: Database["public"]["Enums"]["purchase_status"]; stripe_checkout_session_id: string | null; stripe_event_id: string | null; stripe_payment_intent_id: string | null; user_id: string | null }
        Insert: { is_gift?: boolean; gift_recipient_email?: string | null; gift_message?: string | null; marketing_consent?: boolean | null; amount_cents?: number; anon_id?: string | null; created_at?: string; currency?: string; experience_id: string; id?: string; paid_at?: string | null; purchaser_email?: string | null; refunded_at?: string | null; status?: Database["public"]["Enums"]["purchase_status"]; stripe_checkout_session_id?: string | null; stripe_event_id?: string | null; stripe_payment_intent_id?: string | null; user_id?: string | null }
        Update: { is_gift?: boolean; gift_recipient_email?: string | null; gift_message?: string | null; marketing_consent?: boolean | null; amount_cents?: number; anon_id?: string | null; created_at?: string; currency?: string; experience_id?: string; id?: string; paid_at?: string | null; purchaser_email?: string | null; refunded_at?: string | null; status?: Database["public"]["Enums"]["purchase_status"]; stripe_checkout_session_id?: string | null; stripe_event_id?: string | null; stripe_payment_intent_id?: string | null; user_id?: string | null }
        Relationships: []
      }
      sales: {
        Row: { amount_cents: number; created_at: string; currency: string; email: string | null; experience_id: string; experience_title: string | null; id: string; purchase_id: string | null; refunded_at: string | null; status: Database["public"]["Enums"]["sale_status"]; stripe_session_id: string | null; utm_campaign: string | null; utm_medium: string | null; utm_source: string | null }
        Insert: { amount_cents: number; created_at?: string; currency?: string; email?: string | null; experience_id: string; experience_title?: string | null; id?: string; purchase_id?: string | null; refunded_at?: string | null; status?: Database["public"]["Enums"]["sale_status"]; stripe_session_id?: string | null; utm_campaign?: string | null; utm_medium?: string | null; utm_source?: string | null }
        Update: { amount_cents?: number; created_at?: string; currency?: string; email?: string | null; experience_id?: string; experience_title?: string | null; id?: string; purchase_id?: string | null; refunded_at?: string | null; status?: Database["public"]["Enums"]["sale_status"]; stripe_session_id?: string | null; utm_campaign?: string | null; utm_medium?: string | null; utm_source?: string | null }
        Relationships: []
      }
      session_messages: {
        Row: { prompt_tokens: number | null; output_tokens: number | null; created_at: string; id: string; intent: string | null; media_id: string | null; phase: Database["public"]["Enums"]["tour_phase"] | null; role: Database["public"]["Enums"]["message_role"]; session_id: string; step_position: number | null; text: string }
        Insert: { prompt_tokens?: number | null; output_tokens?: number | null; created_at?: string; id?: string; intent?: string | null; media_id?: string | null; phase?: Database["public"]["Enums"]["tour_phase"] | null; role: Database["public"]["Enums"]["message_role"]; session_id: string; step_position?: number | null; text: string }
        Update: { prompt_tokens?: number | null; output_tokens?: number | null; created_at?: string; id?: string; intent?: string | null; media_id?: string | null; phase?: Database["public"]["Enums"]["tour_phase"] | null; role?: Database["public"]["Enums"]["message_role"]; session_id?: string; step_position?: number | null; text?: string }
        Relationships: []
      }
      session_step_states: {
        Row: { id: string; session_id: string; state: Database["public"]["Enums"]["step_runtime_state"]; step_id: string; updated_at: string }
        Insert: { id?: string; session_id: string; state?: Database["public"]["Enums"]["step_runtime_state"]; step_id: string; updated_at?: string }
        Update: { id?: string; session_id?: string; state?: Database["public"]["Enums"]["step_runtime_state"]; step_id?: string; updated_at?: string }
        Relationships: []
      }
      step_media: {
        Row: { bucket: string; caption: string | null; created_at: string; duration_sec: number | null; experience_id: string; external_url: string | null; gated: boolean; height: number | null; id: string; kind: Database["public"]["Enums"]["media_kind"]; position: number; step_id: string; step_position: number; storage_path: string | null; width: number | null }
        Insert: { bucket?: string; caption?: string | null; created_at?: string; duration_sec?: number | null; experience_id: string; external_url?: string | null; gated?: boolean; height?: number | null; id?: string; kind: Database["public"]["Enums"]["media_kind"]; position?: number; step_id: string; step_position: number; storage_path?: string | null; width?: number | null }
        Update: { bucket?: string; caption?: string | null; created_at?: string; duration_sec?: number | null; experience_id?: string; external_url?: string | null; gated?: boolean; height?: number | null; id?: string; kind?: Database["public"]["Enums"]["media_kind"]; position?: number; step_id?: string; step_position?: number; storage_path?: string | null; width?: number | null }
        Relationships: []
      }
      reviews: {
        Row: { anon_id: string | null; author_name: string | null; body: string | null; country: string | null; created_at: string; experience_id: string; id: string; rating: number; status: string; updated_at: string; user_id: string | null; verified_purchase: boolean }
        Insert: { anon_id?: string | null; author_name?: string | null; body?: string | null; country?: string | null; created_at?: string; experience_id: string; id?: string; rating: number; status?: string; updated_at?: string; user_id?: string | null; verified_purchase?: boolean }
        Update: { anon_id?: string | null; author_name?: string | null; body?: string | null; country?: string | null; created_at?: string; experience_id?: string; id?: string; rating?: number; status?: string; updated_at?: string; user_id?: string | null; verified_purchase?: boolean }
        Relationships: []
      }
      steps: {
        Row: { address: string | null; ask_review: boolean; review_message: string | null; arrive_script: string | null; body: string | null; created_at: string; experience_id: string; id: string; is_paywall: boolean; knowledge_scope: Json; lat: number | null; lng: number | null; meta: Json; meta_verified: boolean; orientation_hint: string | null; payoff: string | null; paywall_message: string | null; place_query: string | null; position: number; proposal: string | null; title: string | null; type: Database["public"]["Enums"]["step_type"]; updated_at: string; walk_to_next: string | null }
        Insert: { address?: string | null; ask_review?: boolean; review_message?: string | null; arrive_script?: string | null; body?: string | null; created_at?: string; experience_id: string; id?: string; is_paywall?: boolean; knowledge_scope?: Json; lat?: number | null; lng?: number | null; meta?: Json; meta_verified?: boolean; orientation_hint?: string | null; payoff?: string | null; paywall_message?: string | null; place_query?: string | null; position: number; proposal?: string | null; title?: string | null; type?: Database["public"]["Enums"]["step_type"]; updated_at?: string; walk_to_next?: string | null }
        Update: { address?: string | null; ask_review?: boolean; review_message?: string | null; arrive_script?: string | null; body?: string | null; created_at?: string; experience_id?: string; id?: string; is_paywall?: boolean; knowledge_scope?: Json; lat?: number | null; lng?: number | null; meta?: Json; meta_verified?: boolean; orientation_hint?: string | null; payoff?: string | null; paywall_message?: string | null; place_query?: string | null; position?: number; proposal?: string | null; title?: string | null; type?: Database["public"]["Enums"]["step_type"]; updated_at?: string; walk_to_next?: string | null }
        Relationships: []
      }
      stripe_events: {
        Row: { event_id: string; payload: Json; processed_at: string | null; received_at: string; type: string }
        Insert: { event_id: string; payload: Json; processed_at?: string | null; received_at?: string; type: string }
        Update: { event_id?: string; payload?: Json; processed_at?: string | null; received_at?: string; type?: string }
        Relationships: []
      }
      support_flags: {
        Row: { created_at: string; email: string | null; experience_id: string | null; id: string; reason: string; resolved: boolean; session_id: string | null; user_id: string | null }
        Insert: { created_at?: string; email?: string | null; experience_id?: string | null; id?: string; reason: string; resolved?: boolean; session_id?: string | null; user_id?: string | null }
        Update: { created_at?: string; email?: string | null; experience_id?: string | null; id?: string; reason?: string; resolved?: boolean; session_id?: string | null; user_id?: string | null }
        Relationships: []
      }
      personality_sources: {
        Row: { id: string; kind: string; title: string | null; storage_path: string | null; external_url: string | null; raw_text: string | null; mime_type: string | null; status: string; notes: string | null; error: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; kind: string; title?: string | null; storage_path?: string | null; external_url?: string | null; raw_text?: string | null; mime_type?: string | null; status?: string; notes?: string | null; error?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; kind?: string; title?: string | null; storage_path?: string | null; external_url?: string | null; raw_text?: string | null; mime_type?: string | null; status?: string; notes?: string | null; error?: string | null; created_at?: string; updated_at?: string }
        Relationships: []
      }
      utilities: {
        Row: { active: boolean; address: string | null; category: string; created_at: string; henry_note: string | null; hours: string | null; id: string; is_free: boolean; name: string; neighborhood: string | null; place_query: string | null; position: number; updated_at: string }
        Insert: { active?: boolean; address?: string | null; category: string; created_at?: string; henry_note?: string | null; hours?: string | null; id?: string; is_free?: boolean; name: string; neighborhood?: string | null; place_query?: string | null; position?: number; updated_at?: string }
        Update: { active?: boolean; address?: string | null; category?: string; created_at?: string; henry_note?: string | null; hours?: string | null; id?: string; is_free?: boolean; name?: string; neighborhood?: string | null; place_query?: string | null; position?: number; updated_at?: string }
        Relationships: []
      }
      voice_profiles: {
        Row: { created_at: string; created_by: string | null; id: string; is_global: boolean; name: string; profile: Json; updated_at: string }
        Insert: { created_at?: string; created_by?: string | null; id?: string; is_global?: boolean; name: string; profile?: Json; updated_at?: string }
        Update: { created_at?: string; created_by?: string | null; id?: string; is_global?: boolean; name?: string; profile?: Json; updated_at?: string }
        Relationships: []
      }
    }
    Views: {
      experiences_public: {
        Row: { card_image_path: string | null; city: string | null; cover_path: string | null; currency: string | null; distance_m: number | null; expected_minutes: number | null; id: string | null; language: string | null; neighborhood: string | null; paywall_position: number | null; pitch: string | null; price_cents: number | null; published_at: string | null; slug: string | null; stops_count: number | null; theme: string | null; title: string | null }
        Relationships: []
      }
    }
    Functions: {
      admin_add_step: {
        Args: { p_exp: string; p_after: number; p_type: "message" | "arrival" }
        Returns: string
      }
      admin_delete_step: { Args: { p_step: string }; Returns: undefined }
      assert_publishable: { Args: { exp: string }; Returns: undefined }
      country_leaderboard: {
        Args: { p_limit?: number }
        Returns: { country: string; steps: number; tours: number }[]
      }
      set_experience_pricing: {
        Args: {
          p_exp: string
          p_price_cents: number
          p_paywall_after: number | null
          p_message: string | null
          p_stripe_price_id?: string | null
        }
        Returns: undefined
      }
      can_read_step: { Args: { p_step_id: string }; Returns: boolean }
      has_experience_access: { Args: { exp: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_experience_author: { Args: { exp: string }; Returns: boolean }
      paywall_position: { Args: { exp: string }; Returns: number }
      player_steps: {
        Args: { p_exp: string }
        Returns: Database["public"]["Tables"]["steps"]["Row"][]
      }
      rl_hit: {
        Args: { p_key: string; p_window_secs: number; p_max: number }
        Returns: boolean
      }
    }
    Enums: {
      content_source_kind: "youtube" | "pdf" | "url" | "text" | "video_file"
      entitlement_source: "purchase" | "grant" | "free"
      experience_status: "draft" | "published" | "archived"
      generation_status: "pending" | "running" | "done" | "error"
      ingest_status: "pending" | "ingesting" | "ready" | "error"
      interaction_mode: "normal" | "express" | "solo_ver" | "refugio" | "safety"
      media_kind: "video" | "image" | "audio"
      message_role: "user" | "henry" | "system"
      purchase_status: "pending" | "paid" | "refunded" | "failed" | "expired"
      sale_status: "paid" | "refunded"
      session_status: "NO_INICIADO" | "EN_CURSO" | "TERMINADO" | "EXPIRADO"
      step_runtime_state: "pendiente" | "actual" | "completada" | "salteada" | "vista"
      step_type: "message" | "arrival" | "media" | "interactive" | "paywall"
      tour_phase: "CAMINANDO" | "EN_PARADA" | "EN_PAUSA"
    }
    CompositeTypes: { [_ in never]: never }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]
