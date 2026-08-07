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
      allergens: {
        Row: {
          id: string
          name: string
          slug: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          branch_id: string | null
          changes: Json | null
          created_at: string
          entity: string
          entity_id: string | null
          id: number
          idempotency_key: string | null
          new_state: Json | null
          previous_state: Json | null
          reason: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          branch_id?: string | null
          changes?: Json | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: never
          idempotency_key?: string | null
          new_state?: Json | null
          previous_state?: Json | null
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          branch_id?: string | null
          changes?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: never
          idempotency_key?: string | null
          new_state?: Json | null
          previous_state?: Json | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      banners: {
        Row: {
          active: boolean
          display_order: number
          id: string
          image_url: string | null
          link: string | null
          subtitle: string | null
          title: string
        }
        Insert: {
          active?: boolean
          display_order?: number
          id?: string
          image_url?: string | null
          link?: string | null
          subtitle?: string | null
          title: string
        }
        Update: {
          active?: boolean
          display_order?: number
          id?: string
          image_url?: string | null
          link?: string | null
          subtitle?: string | null
          title?: string
        }
        Relationships: []
      }
      branch_menu_items: {
        Row: {
          available: boolean
          branch_id: string
          menu_item_id: string
          price: number | null
          stock: number | null
        }
        Insert: {
          available?: boolean
          branch_id: string
          menu_item_id: string
          price?: number | null
          stock?: number | null
        }
        Update: {
          available?: boolean
          branch_id?: string
          menu_item_id?: string
          price?: number | null
          stock?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "branch_menu_items_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_menu_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          city: string | null
          delivery_area_note: string | null
          delivery_enabled: boolean
          delivery_fee: number
          delivery_minimum: number
          email: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          pension_delivery_fee: number | null
          phone: string | null
          pickup_enabled: boolean
          restaurant_id: string
          slug: string
          status: string
          timezone: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          delivery_area_note?: string | null
          delivery_enabled?: boolean
          delivery_fee?: number
          delivery_minimum?: number
          email?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          pension_delivery_fee?: number | null
          phone?: string | null
          pickup_enabled?: boolean
          restaurant_id: string
          slug: string
          status?: string
          timezone?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          delivery_area_note?: string | null
          delivery_enabled?: boolean
          delivery_fee?: number
          delivery_minimum?: number
          email?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          pension_delivery_fee?: number | null
          phone?: string | null
          pickup_enabled?: boolean
          restaurant_id?: string
          slug?: string
          status?: string
          timezone?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_item_modifiers: {
        Row: {
          cart_item_id: string
          modifier_option_id: string
          price_snapshot: number
        }
        Insert: {
          cart_item_id: string
          modifier_option_id: string
          price_snapshot?: number
        }
        Update: {
          cart_item_id?: string
          modifier_option_id?: string
          price_snapshot?: number
        }
        Relationships: [
          {
            foreignKeyName: "cart_item_modifiers_cart_item_id_fkey"
            columns: ["cart_item_id"]
            isOneToOne: false
            referencedRelation: "cart_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_item_modifiers_modifier_option_id_fkey"
            columns: ["modifier_option_id"]
            isOneToOne: false
            referencedRelation: "modifier_options"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          cart_id: string
          id: string
          menu_item_id: string
          notes: string | null
          quantity: number
          unit_price_snapshot: number
        }
        Insert: {
          cart_id: string
          id?: string
          menu_item_id: string
          notes?: string | null
          quantity: number
          unit_price_snapshot: number
        }
        Update: {
          cart_id?: string
          id?: string
          menu_item_id?: string
          notes?: string | null
          quantity?: number
          unit_price_snapshot?: number
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          branch_id: string | null
          created_at: string
          fulfillment_type: string | null
          id: string
          session_id: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          fulfillment_type?: string | null
          id?: string
          session_id?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          fulfillment_type?: string | null
          id?: string
          session_id?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          description: string | null
          display_order: number
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          restaurant_id: string | null
          slug: string
        }
        Insert: {
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          restaurant_id?: string | null
          slug: string
        }
        Update: {
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          restaurant_id?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          description: string | null
          expires_at: string | null
          max_redemptions: number | null
          redeemed_count: number
          type: string
          value: number
        }
        Insert: {
          active?: boolean
          code: string
          description?: string | null
          expires_at?: string | null
          max_redemptions?: number | null
          redeemed_count?: number
          type: string
          value: number
        }
        Update: {
          active?: boolean
          code?: string
          description?: string | null
          expires_at?: string | null
          max_redemptions?: number | null
          redeemed_count?: number
          type?: string
          value?: number
        }
        Relationships: []
      }
      delivery_zones: {
        Row: {
          branch_id: string
          fee: number
          id: string
          name: string
          polygon: Json | null
        }
        Insert: {
          branch_id: string
          fee?: number
          id?: string
          name: string
          polygon?: Json | null
        }
        Update: {
          branch_id?: string
          fee?: number
          id?: string
          name?: string
          polygon?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_zones_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      dietary_tags: {
        Row: {
          id: string
          name: string
          slug: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          menu_item_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          menu_item_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          menu_item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_consumption_sources: {
        Row: {
          created_at: string
          inventory_item_id: string
          movement_id: string
          order_item_id: string
          quantity_component: number
          recipe_id: string
        }
        Insert: {
          created_at?: string
          inventory_item_id: string
          movement_id: string
          order_item_id: string
          quantity_component: number
          recipe_id: string
        }
        Update: {
          created_at?: string
          inventory_item_id?: string
          movement_id?: string
          order_item_id?: string
          quantity_component?: number
          recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_consumption_sources_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_consumption_sources_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "inventory_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_consumption_sources_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_consumption_sources_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_consumption_sources_recipe_id_inventory_item_id_fkey"
            columns: ["recipe_id", "inventory_item_id"]
            isOneToOne: false
            referencedRelation: "recipe_items"
            referencedColumns: ["recipe_id", "inventory_item_id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          base_unit: string
          branch_id: string
          category: string
          cost_per_base_unit: number
          created_at: string
          current_quantity: number
          demo_image_key: string | null
          display_unit: string
          id: string
          is_active: boolean
          minimum_quantity: number
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          base_unit: string
          branch_id: string
          category: string
          cost_per_base_unit?: number
          created_at?: string
          current_quantity?: number
          demo_image_key?: string | null
          display_unit: string
          id?: string
          is_active?: boolean
          minimum_quantity?: number
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          base_unit?: string
          branch_id?: string
          category?: string
          cost_per_base_unit?: number
          created_at?: string
          current_quantity?: number
          demo_image_key?: string | null
          display_unit?: string
          id?: string
          is_active?: boolean
          minimum_quantity?: number
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          actor_profile_id: string | null
          balance_after: number
          balance_before: number
          branch_id: string
          created_at: string
          id: string
          idempotency_key: string
          inventory_item_id: string
          metadata: Json
          movement_type: string
          order_id: string | null
          order_item_id: string | null
          quantity_delta: number
          reason: string
          reversal_of_movement_id: string | null
        }
        Insert: {
          actor_profile_id?: string | null
          balance_after: number
          balance_before: number
          branch_id: string
          created_at?: string
          id?: string
          idempotency_key: string
          inventory_item_id: string
          metadata?: Json
          movement_type: string
          order_id?: string | null
          order_item_id?: string | null
          quantity_delta: number
          reason: string
          reversal_of_movement_id?: string | null
        }
        Update: {
          actor_profile_id?: string | null
          balance_after?: number
          balance_before?: number
          branch_id?: string
          created_at?: string
          id?: string
          idempotency_key?: string
          inventory_item_id?: string
          metadata?: Json
          movement_type?: string
          order_id?: string | null
          order_item_id?: string | null
          quantity_delta?: number
          reason?: string
          reversal_of_movement_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_reversal_of_movement_id_fkey"
            columns: ["reversal_of_movement_id"]
            isOneToOne: false
            referencedRelation: "inventory_movements"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          allergens: string[] | null
          available: boolean
          base_price: number
          calories: number | null
          category_slug: string
          created_at: string
          description: string | null
          display_order: number
          featured: boolean
          id: string
          image_blur_data_url: string | null
          image_height: number | null
          image_path: string
          image_width: number | null
          ingredients: string[] | null
          name: string
          original_filename: string | null
          preparation_minutes: number | null
          restaurant_id: string | null
          seo_description: string | null
          seo_title: string | null
          short_description: string | null
          short_name: string | null
          slug: string
          tags: string[] | null
        }
        Insert: {
          allergens?: string[] | null
          available?: boolean
          base_price: number
          calories?: number | null
          category_slug: string
          created_at?: string
          description?: string | null
          display_order?: number
          featured?: boolean
          id: string
          image_blur_data_url?: string | null
          image_height?: number | null
          image_path: string
          image_width?: number | null
          ingredients?: string[] | null
          name: string
          original_filename?: string | null
          preparation_minutes?: number | null
          restaurant_id?: string | null
          seo_description?: string | null
          seo_title?: string | null
          short_description?: string | null
          short_name?: string | null
          slug: string
          tags?: string[] | null
        }
        Update: {
          allergens?: string[] | null
          available?: boolean
          base_price?: number
          calories?: number | null
          category_slug?: string
          created_at?: string
          description?: string | null
          display_order?: number
          featured?: boolean
          id?: string
          image_blur_data_url?: string | null
          image_height?: number | null
          image_path?: string
          image_width?: number | null
          ingredients?: string[] | null
          name?: string
          original_filename?: string | null
          preparation_minutes?: number | null
          restaurant_id?: string | null
          seo_description?: string | null
          seo_title?: string | null
          short_description?: string | null
          short_name?: string | null
          slug?: string
          tags?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_slug_fkey"
            columns: ["category_slug"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      modifier_groups: {
        Row: {
          display_order: number
          id: string
          maximum_selections: number
          menu_item_id: string
          minimum_selections: number
          name: string
          required: boolean
        }
        Insert: {
          display_order?: number
          id: string
          maximum_selections?: number
          menu_item_id: string
          minimum_selections?: number
          name: string
          required?: boolean
        }
        Update: {
          display_order?: number
          id?: string
          maximum_selections?: number
          menu_item_id?: string
          minimum_selections?: number
          name?: string
          required?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "modifier_groups_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      modifier_options: {
        Row: {
          additional_price: number
          available: boolean
          display_order: number
          id: string
          modifier_group_id: string
          name: string
        }
        Insert: {
          additional_price?: number
          available?: boolean
          display_order?: number
          id: string
          modifier_group_id: string
          name: string
        }
        Update: {
          additional_price?: number
          available?: boolean
          display_order?: number
          id?: string
          modifier_group_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "modifier_options_modifier_group_id_fkey"
            columns: ["modifier_group_id"]
            isOneToOne: false
            referencedRelation: "modifier_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          payload: Json
          read_at: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      opening_hours: {
        Row: {
          branch_id: string
          closing_time: string | null
          day_of_week: number
          id: string
          is_closed: boolean
          opening_time: string | null
        }
        Insert: {
          branch_id: string
          closing_time?: string | null
          day_of_week: number
          id?: string
          is_closed?: boolean
          opening_time?: string | null
        }
        Update: {
          branch_id?: string
          closing_time?: string | null
          day_of_week?: number
          id?: string
          is_closed?: boolean
          opening_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opening_hours_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          menu_item_id: string
          modifiers_snapshot: Json
          name_snapshot: string
          notes: string | null
          order_id: string
          quantity: number
          total: number
          unit_price: number
        }
        Insert: {
          id?: string
          menu_item_id: string
          modifiers_snapshot?: Json
          name_snapshot: string
          notes?: string | null
          order_id: string
          quantity: number
          total: number
          unit_price: number
        }
        Update: {
          id?: string
          menu_item_id?: string
          modifiers_snapshot?: Json
          name_snapshot?: string
          notes?: string | null
          order_id?: string
          quantity?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address_snapshot: Json | null
          branch_id: string
          coupon_code: string | null
          created_at: string
          currency: string
          customer_email: string
          customer_name: string
          customer_phone: string
          delivery_fee: number
          discount: number
          fulfillment_type: string
          id: string
          idempotency_key: string | null
          idempotency_scope: string | null
          notes: string | null
          order_kind: string
          order_number: string
          payment_method: string
          payment_reference: string | null
          payment_status: string
          request_fingerprint: string | null
          scheduled_at: string | null
          service_fee: number
          status: string
          subtotal: number
          tax: number
          tip: number
          total: number
          user_id: string | null
        }
        Insert: {
          address_snapshot?: Json | null
          branch_id: string
          coupon_code?: string | null
          created_at?: string
          currency?: string
          customer_email: string
          customer_name: string
          customer_phone: string
          delivery_fee?: number
          discount?: number
          fulfillment_type: string
          id: string
          idempotency_key?: string | null
          idempotency_scope?: string | null
          notes?: string | null
          order_kind?: string
          order_number: string
          payment_method?: string
          payment_reference?: string | null
          payment_status?: string
          request_fingerprint?: string | null
          scheduled_at?: string | null
          service_fee?: number
          status?: string
          subtotal: number
          tax?: number
          tip?: number
          total: number
          user_id?: string | null
        }
        Update: {
          address_snapshot?: Json | null
          branch_id?: string
          coupon_code?: string | null
          created_at?: string
          currency?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string
          delivery_fee?: number
          discount?: number
          fulfillment_type?: string
          id?: string
          idempotency_key?: string | null
          idempotency_scope?: string | null
          notes?: string | null
          order_kind?: string
          order_number?: string
          payment_method?: string
          payment_reference?: string | null
          payment_status?: string
          request_fingerprint?: string | null
          scheduled_at?: string | null
          service_fee?: number
          status?: string
          subtotal?: number
          tax?: number
          tip?: number
          total?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhook_events: {
        Row: {
          event_type: string
          order_id: string
          payload_digest: string
          processed_at: string
          provider: string
          provider_event_id: string
          resulting_payment_status: string
        }
        Insert: {
          event_type: string
          order_id: string
          payload_digest: string
          processed_at?: string
          provider: string
          provider_event_id: string
          resulting_payment_status: string
        }
        Update: {
          event_type?: string
          order_id?: string
          payload_digest?: string
          processed_at?: string
          provider?: string
          provider_event_id?: string
          resulting_payment_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_webhook_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pension_consumption_selections: {
        Row: {
          consumption_id: string
          created_at: string
          included_credit_snapshot: number
          order_item_id: string
          pension_menu_item_id: string
          product_price_snapshot: number
          surcharge_snapshot: number
        }
        Insert: {
          consumption_id: string
          created_at?: string
          included_credit_snapshot: number
          order_item_id: string
          pension_menu_item_id: string
          product_price_snapshot: number
          surcharge_snapshot: number
        }
        Update: {
          consumption_id?: string
          created_at?: string
          included_credit_snapshot?: number
          order_item_id?: string
          pension_menu_item_id?: string
          product_price_snapshot?: number
          surcharge_snapshot?: number
        }
        Relationships: [
          {
            foreignKeyName: "pension_consumption_selections_consumption_id_fkey"
            columns: ["consumption_id"]
            isOneToOne: false
            referencedRelation: "pension_consumptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pension_consumption_selections_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pension_consumption_selections_pension_menu_item_id_fkey"
            columns: ["pension_menu_item_id"]
            isOneToOne: false
            referencedRelation: "pension_menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      pension_consumptions: {
        Row: {
          created_at: string
          id: string
          idempotency_key: string
          meals_used: number
          membership_id: string
          menu_id: string
          order_id: string
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          status: string
          surplus_total: number
        }
        Insert: {
          created_at?: string
          id?: string
          idempotency_key: string
          meals_used?: number
          membership_id: string
          menu_id: string
          order_id: string
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: string
          surplus_total?: number
        }
        Update: {
          created_at?: string
          id?: string
          idempotency_key?: string
          meals_used?: number
          membership_id?: string
          menu_id?: string
          order_id?: string
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: string
          surplus_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "pension_consumptions_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "pension_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pension_consumptions_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "pension_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pension_consumptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pension_consumptions_reversed_by_fkey"
            columns: ["reversed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pension_membership_cycles: {
        Row: {
          agreed_price: number
          authorized_by: string
          created_at: string
          cycle_number: number
          discount: number
          ends_at: string | null
          id: string
          idempotency_key: string
          meal_limit: number | null
          membership_id: string
          modality: string
          payment_date: string
          payment_method: string
          payment_reference: string | null
          public_price_snapshot: number
          starts_at: string
        }
        Insert: {
          agreed_price: number
          authorized_by: string
          created_at?: string
          cycle_number: number
          discount: number
          ends_at?: string | null
          id?: string
          idempotency_key: string
          meal_limit?: number | null
          membership_id: string
          modality: string
          payment_date: string
          payment_method: string
          payment_reference?: string | null
          public_price_snapshot: number
          starts_at: string
        }
        Update: {
          agreed_price?: number
          authorized_by?: string
          created_at?: string
          cycle_number?: number
          discount?: number
          ends_at?: string | null
          id?: string
          idempotency_key?: string
          meal_limit?: number | null
          membership_id?: string
          modality?: string
          payment_date?: string
          payment_method?: string
          payment_reference?: string | null
          public_price_snapshot?: number
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pension_membership_cycles_authorized_by_fkey"
            columns: ["authorized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pension_membership_cycles_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "pension_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      pension_membership_transitions: {
        Row: {
          action: string
          actor_profile_id: string
          created_at: string
          id: string
          idempotency_key: string
          membership_id: string
          new_state: Json
          next_status: string
          previous_state: Json
          previous_status: string | null
          reason: string | null
        }
        Insert: {
          action: string
          actor_profile_id: string
          created_at?: string
          id?: string
          idempotency_key: string
          membership_id: string
          new_state?: Json
          next_status: string
          previous_state?: Json
          previous_status?: string | null
          reason?: string | null
        }
        Update: {
          action?: string
          actor_profile_id?: string
          created_at?: string
          id?: string
          idempotency_key?: string
          membership_id?: string
          new_state?: Json
          next_status?: string
          previous_state?: Json
          previous_status?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pension_membership_transitions_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pension_membership_transitions_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "pension_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      pension_memberships: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          agreed_price: number | null
          branch_id: string
          created_at: string
          discount: number | null
          ends_at: string | null
          finalized_at: string | null
          finalized_by: string | null
          id: string
          meal_balance: number | null
          meal_limit: number | null
          meals_consumed: number
          modality: string
          payment_date: string | null
          payment_method: string | null
          payment_reference: string | null
          plan_id: string
          profile_id: string
          public_price_snapshot: number
          request_idempotency_key: string
          starts_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          agreed_price?: number | null
          branch_id: string
          created_at?: string
          discount?: number | null
          ends_at?: string | null
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          meal_balance?: number | null
          meal_limit?: number | null
          meals_consumed?: number
          modality: string
          payment_date?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          plan_id: string
          profile_id: string
          public_price_snapshot: number
          request_idempotency_key: string
          starts_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          agreed_price?: number | null
          branch_id?: string
          created_at?: string
          discount?: number | null
          ends_at?: string | null
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          meal_balance?: number | null
          meal_limit?: number | null
          meals_consumed?: number
          modality?: string
          payment_date?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          plan_id?: string
          profile_id?: string
          public_price_snapshot?: number
          request_idempotency_key?: string
          starts_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pension_memberships_activated_by_fkey"
            columns: ["activated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pension_memberships_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pension_memberships_finalized_by_fkey"
            columns: ["finalized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pension_memberships_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "pension_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pension_memberships_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pension_menu_categories: {
        Row: {
          category: string
          display_order: number
          id: string
          is_required: boolean
          label: string
          max_selections: number
          menu_id: string
        }
        Insert: {
          category: string
          display_order?: number
          id?: string
          is_required?: boolean
          label: string
          max_selections?: number
          menu_id: string
        }
        Update: {
          category?: string
          display_order?: number
          id?: string
          is_required?: boolean
          label?: string
          max_selections?: number
          menu_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pension_menu_categories_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "pension_menus"
            referencedColumns: ["id"]
          },
        ]
      }
      pension_menu_items: {
        Row: {
          display_order: number
          id: string
          included_credit: number
          is_available: boolean
          is_included: boolean
          menu_category_id: string
          menu_item_id: string
          surcharge_amount: number
        }
        Insert: {
          display_order?: number
          id?: string
          included_credit?: number
          is_available?: boolean
          is_included?: boolean
          menu_category_id: string
          menu_item_id: string
          surcharge_amount?: number
        }
        Update: {
          display_order?: number
          id?: string
          included_credit?: number
          is_available?: boolean
          is_included?: boolean
          menu_category_id?: string
          menu_item_id?: string
          surcharge_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "pension_menu_items_menu_category_id_fkey"
            columns: ["menu_category_id"]
            isOneToOne: false
            referencedRelation: "pension_menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pension_menu_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      pension_menus: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          note: string | null
          period: string
          published_at: string | null
          published_by: string | null
          service_date: string
          status: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          note?: string | null
          period: string
          published_at?: string | null
          published_by?: string | null
          service_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          note?: string | null
          period?: string
          published_at?: string | null
          published_by?: string | null
          service_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pension_menus_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pension_menus_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pension_plans: {
        Row: {
          created_at: string
          currency: string
          default_meal_limit: number | null
          description: string | null
          duration_days: number | null
          id: string
          included_periods: string[]
          is_active: boolean
          modality: string
          name: string
          public_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          default_meal_limit?: number | null
          description?: string | null
          duration_days?: number | null
          id?: string
          included_periods: string[]
          is_active?: boolean
          modality: string
          name: string
          public_price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          default_meal_limit?: number | null
          description?: string | null
          duration_days?: number | null
          id?: string
          included_periods?: string[]
          is_active?: boolean
          modality?: string
          name?: string
          public_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          employment_started_at: string | null
          id: string
          language: string
          last_access_at: string | null
          marketing_consent: boolean
          name: string | null
          phone: string | null
          preferred_branch_id: string | null
          role: string
          staff_status: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          employment_started_at?: string | null
          id: string
          language?: string
          last_access_at?: string | null
          marketing_consent?: boolean
          name?: string | null
          phone?: string | null
          preferred_branch_id?: string | null
          role?: string
          staff_status?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          employment_started_at?: string | null
          id?: string
          language?: string
          last_access_at?: string | null
          marketing_consent?: boolean
          name?: string | null
          phone?: string | null
          preferred_branch_id?: string | null
          role?: string
          staff_status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_preferred_branch_id_fkey"
            columns: ["preferred_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          active: boolean
          badge: string | null
          coupon_code: string | null
          description: string | null
          ends_at: string | null
          id: string
          item_slug: string | null
          starts_at: string | null
          title: string
        }
        Insert: {
          active?: boolean
          badge?: string | null
          coupon_code?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          item_slug?: string | null
          starts_at?: string | null
          title: string
        }
        Update: {
          active?: boolean
          badge?: string | null
          coupon_code?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          item_slug?: string | null
          starts_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotions_item_slug_fkey"
            columns: ["item_slug"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["slug"]
          },
        ]
      }
      recipe_items: {
        Row: {
          base_unit: string
          created_at: string
          inventory_item_id: string
          quantity_required: number
          recipe_id: string
        }
        Insert: {
          base_unit: string
          created_at?: string
          inventory_item_id: string
          quantity_required: number
          recipe_id: string
        }
        Update: {
          base_unit?: string
          created_at?: string
          inventory_item_id?: string
          quantity_required?: number
          recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          is_active: boolean
          portion_yield: number
          product_id: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          portion_yield: number
          product_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          portion_yield?: number
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          checkout_tax_rate: number
          created_at: string
          currency: string
          default_language: string
          description: string | null
          email: string | null
          id: string
          logo_url: string | null
          max_line_quantity: number
          name: string
          order_number_prefix: string
          phone: string | null
          service_fee_rate: number
          slug: string
          status: string
          timezone: string
        }
        Insert: {
          checkout_tax_rate?: number
          created_at?: string
          currency?: string
          default_language?: string
          description?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          max_line_quantity?: number
          name: string
          order_number_prefix?: string
          phone?: string | null
          service_fee_rate?: number
          slug: string
          status?: string
          timezone?: string
        }
        Update: {
          checkout_tax_rate?: number
          created_at?: string
          currency?: string
          default_language?: string
          description?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          max_line_quantity?: number
          name?: string
          order_number_prefix?: string
          phone?: string | null
          service_fee_rate?: number
          slug?: string
          status?: string
          timezone?: string
        }
        Relationships: []
      }
      special_hours: {
        Row: {
          branch_id: string
          closing_time: string | null
          date: string
          id: string
          is_closed: boolean
          opening_time: string | null
          reason: string | null
        }
        Insert: {
          branch_id: string
          closing_time?: string | null
          date: string
          id?: string
          is_closed?: boolean
          opening_time?: string | null
          reason?: string | null
        }
        Update: {
          branch_id?: string
          closing_time?: string | null
          date?: string
          id?: string
          is_closed?: boolean
          opening_time?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "special_hours_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_branch_permissions: {
        Row: {
          branch_id: string
          profile_id: string
        }
        Insert: {
          branch_id: string
          profile_id: string
        }
        Update: {
          branch_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_branch_permissions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_branch_permissions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_incidents: {
        Row: {
          branch_id: string
          category: string
          created_at: string
          description: string
          id: string
          idempotency_key: string
          order_id: string | null
          priority: string
          reporter_profile_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          branch_id: string
          category: string
          created_at?: string
          description: string
          id?: string
          idempotency_key: string
          order_id?: string | null
          priority: string
          reporter_profile_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          branch_id?: string
          category?: string
          created_at?: string
          description?: string
          id?: string
          idempotency_key?: string
          order_id?: string | null
          priority?: string
          reporter_profile_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_incidents_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_incidents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_incidents_reporter_profile_id_fkey"
            columns: ["reporter_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_incidents_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_shifts: {
        Row: {
          branch_id: string
          created_at: string
          ended_at: string | null
          id: string
          profile_id: string
          started_at: string
          status: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          profile_id: string
          started_at: string
          status: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          profile_id?: string
          started_at?: string
          status?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_shifts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_shifts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_pension_membership: {
        Args: {
          target_agreed_price: number
          target_allow_surcharge: boolean
          target_ends_at: string
          target_idempotency_key: string
          target_meal_limit: number
          target_membership: string
          target_payment_date: string
          target_payment_method: string
          target_payment_reference: string
          target_reason: string
          target_starts_at: string
        }
        Returns: string
      }
      apply_inventory_movement: {
        Args: {
          target_delta: number
          target_idempotency_key: string
          target_item: string
          target_reason: string
          target_type: string
        }
        Returns: string
      }
      change_pension_membership_status: {
        Args: {
          target_action: string
          target_idempotency_key: string
          target_membership: string
          target_reason: string
        }
        Returns: string
      }
      close_pension_menu: {
        Args: {
          expected_status: string
          target_idempotency_key: string
          target_menu: string
        }
        Returns: string
      }
      consume_pension_benefit: {
        Args: {
          target_idempotency_key: string
          target_membership: string
          target_menu: string
          target_menu_item_ids: string[]
          target_order: string
        }
        Returns: string
      }
      create_and_activate_pension_membership: {
        Args: {
          target_agreed_price: number
          target_allow_surcharge: boolean
          target_branch: string
          target_customer: string
          target_idempotency_key: string
          target_meal_limit: number
          target_payment_date: string
          target_payment_method: string
          target_payment_reference: string
          target_plan: string
          target_reason: string
          target_starts_at: string
        }
        Returns: string
      }
      create_customer_order: {
        Args: {
          p_address?: Json
          p_branch_id: string
          p_coupon_code?: string
          p_customer_email: string
          p_customer_name: string
          p_customer_phone: string
          p_fulfillment_type: string
          p_idempotency_key: string
          p_items: Json
          p_notes?: string
          p_tip_percent?: number
        }
        Returns: {
          created_at: string
          order_id: string
          order_number: string
          replay: boolean
          status: string
          total: number
        }[]
      }
      create_pension_order: {
        Args: {
          p_address?: Json
          p_customer_email: string
          p_customer_name: string
          p_customer_phone: string
          p_fulfillment_type: string
          p_idempotency_key: string
          p_menu_id: string
          p_notes?: string
          p_pension_menu_item_ids: string[]
          p_tip_percent?: number
        }
        Returns: {
          consumption_id: string
          created_at: string
          order_id: string
          order_number: string
          replay: boolean
          status: string
          total: number
        }[]
      }
      manage_staff_profile: {
        Args: {
          target_branch_ids: string[]
          target_idempotency_key: string
          target_profile: string
          target_reason: string
          target_role: string
          target_status: string
        }
        Returns: string
      }
      process_stripe_payment_event: {
        Args: {
          target_event_id: string
          target_event_type: string
          target_order: string
          target_payload_digest: string
        }
        Returns: string
      }
      publish_pension_menu: {
        Args: {
          expected_status: string
          target_idempotency_key: string
          target_menu: string
        }
        Returns: string
      }
      renew_pension_membership: {
        Args: {
          target_agreed_price: number
          target_allow_surcharge: boolean
          target_ends_at: string
          target_idempotency_key: string
          target_meal_limit: number
          target_membership: string
          target_payment_date: string
          target_payment_method: string
          target_payment_reference: string
          target_reason: string
          target_starts_at: string
        }
        Returns: string
      }
      report_staff_incident: {
        Args: {
          target_branch: string
          target_category: string
          target_description: string
          target_idempotency_key: string
          target_order: string
          target_priority: string
        }
        Returns: string
      }
      request_pension_membership: {
        Args: {
          target_branch: string
          target_idempotency_key: string
          target_plan: string
        }
        Returns: string
      }
      reverse_inventory_consumption: {
        Args: {
          original_movement: string
          reversal_reason: string
          target_idempotency_key: string
        }
        Returns: string
      }
      reverse_pension_order_consumption: {
        Args: {
          target_idempotency_key: string
          target_order: string
          target_reason: string
        }
        Returns: string
      }
      save_pension_menu_draft: {
        Args: {
          target_branch: string
          target_idempotency_key: string
          target_note: string
          target_period: string
          target_service_date: string
        }
        Returns: string
      }
      set_pension_delivery_fee: {
        Args: {
          target_branch: string
          target_fee: number
          target_idempotency_key: string
        }
        Returns: number
      }
      upsert_pension_menu_item: {
        Args: {
          target_category: string
          target_category_label: string
          target_display_order: number
          target_is_available: boolean
          target_is_included: boolean
          target_is_required: boolean
          target_max_selections: number
          target_menu: string
          target_menu_item_id: string
          target_surcharge_amount: number
        }
        Returns: string
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
    Enums: {},
  },
} as const
